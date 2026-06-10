import { convert } from "@/lib/cost";
import type {
  EventRow,
  EventRecipeWithRecipe,
  IngredientWithProduct,
  UnitKind,
} from "@/lib/types";

export type SelectionUnits = {
  eventRecipeId: string;
  recipeId: string;
  recipeName: string;
  role: EventRecipeWithRecipe["role"];
  units: number;
};

/**
 * Cantidad de unidades a producir por cada receta elegida, según los ratios del evento.
 *  - bocado: bocados_per_person × PAX (por cada variedad)
 *  - postre: 1 × PAX
 *  - principal + veggie: (PAX + extra) platos, repartidos veggie_pct / resto
 */
export function selectionUnits(
  event: EventRow,
  selections: EventRecipeWithRecipe[],
): SelectionUnits[] {
  const veggieList = selections.filter((s) => s.role === "principal_veggie");
  const normalList = selections.filter((s) => s.role === "principal");

  const totalPrincipal = event.pax + event.principal_extra;
  const veggieTotal = Math.round(totalPrincipal * event.veggie_pct);
  const normalTotal = Math.max(0, totalPrincipal - veggieTotal);

  return selections.map((s) => {
    let units = 0;
    if (s.role === "bocado") units = event.bocados_per_person * event.pax;
    else if (s.role === "postre") units = event.pax;
    else if (s.role === "principal_veggie")
      units = veggieList.length ? veggieTotal / veggieList.length : 0;
    else if (s.role === "principal")
      units = normalList.length ? normalTotal / normalList.length : 0;

    return {
      eventRecipeId: s.id,
      recipeId: s.recipe_id,
      recipeName: s.recipe?.name ?? "—",
      role: s.role,
      units,
    };
  });
}

export type MPLine = {
  ingredientId: string;
  ingredientName: string;
  /** Nombre del producto del proveedor, o null si es precio de mercado. */
  productName: string | null;
  /** Cantidad a comprar (packs si hay producto; cantidad en unidad base si es mercado). */
  buyQty: number;
  buyUnitLabel: string;
  priceEach: number;
  subtotal: number;
};

export type MPGroup = { provider: string; lines: MPLine[]; subtotal: number };

export type MPProblem = { ingredientName: string; reason: string };

export type MateriaPrimaResult = {
  groups: MPGroup[];
  problems: MPProblem[];
  total: number;
  perPerson: number;
};

type Need = { ingredient: IngredientWithProduct; baseQty: number };

const MERCADO = "Precio de mercado";

function unitLbl(u: UnitKind): string {
  return u === "l" ? "L" : u;
}

/** Calcula la materia prima del evento: necesidades, lista de compra por proveedor y total. */
export function computeMateriaPrima(
  event: EventRow,
  selections: EventRecipeWithRecipe[],
): MateriaPrimaResult {
  const units = new Map(
    selectionUnits(event, selections).map((s) => [s.eventRecipeId, s.units]),
  );

  // 1) Agregar necesidades por ingrediente (en su unidad base, con merma).
  const needs = new Map<string, Need>();
  const problems: MPProblem[] = [];
  const mermaFactor = 1 + event.merma_pct;

  for (const sel of selections) {
    const recipe = sel.recipe;
    const u = units.get(sel.id) ?? 0;
    if (!recipe || recipe.yield_units <= 0 || u <= 0) continue;
    const scale = u / recipe.yield_units;

    for (const item of recipe.items) {
      const ing = item.ingredient;
      if (!ing) continue;
      const qtyBase = convert(item.quantity * scale, item.unit, ing.base_unit);
      if (qtyBase == null) {
        problems.push({
          ingredientName: ing.name,
          reason: `unidad incompatible en "${recipe.name}"`,
        });
        continue;
      }
      const prev = needs.get(ing.id);
      if (prev) prev.baseQty += qtyBase * mermaFactor;
      else needs.set(ing.id, { ingredient: ing, baseQty: qtyBase * mermaFactor });
    }
  }

  // 2) Convertir necesidades en líneas de compra agrupadas por proveedor.
  const groupMap = new Map<string, MPLine[]>();
  const addLine = (provider: string, line: MPLine) => {
    const arr = groupMap.get(provider);
    if (arr) arr.push(line);
    else groupMap.set(provider, [line]);
  };

  for (const { ingredient: ing, baseQty } of needs.values()) {
    if (ing.product) {
      const factor = convert(1, ing.base_unit, ing.product.base_unit);
      if (factor == null) {
        problems.push({
          ingredientName: ing.name,
          reason: "unidad del producto incompatible",
        });
        continue;
      }
      const neededProductUnits = baseQty * factor;
      const packs = Math.max(1, Math.ceil(neededProductUnits / ing.product.pack_size));
      const subtotal = packs * ing.product.price;
      addLine(ing.product.provider?.name ?? "Sin proveedor", {
        ingredientId: ing.id,
        ingredientName: ing.name,
        productName: ing.product.name,
        buyQty: packs,
        buyUnitLabel:
          ing.product.pack_size === 1
            ? unitLbl(ing.product.base_unit)
            : `pack ${ing.product.pack_size} ${unitLbl(ing.product.base_unit)}`,
        priceEach: ing.product.price,
        subtotal,
      });
    } else if (ing.market_price != null) {
      const subtotal = baseQty * ing.market_price;
      addLine(MERCADO, {
        ingredientId: ing.id,
        ingredientName: ing.name,
        productName: null,
        buyQty: Math.round(baseQty * 1000) / 1000,
        buyUnitLabel: unitLbl(ing.base_unit),
        priceEach: ing.market_price,
        subtotal,
      });
    } else {
      problems.push({ ingredientName: ing.name, reason: "sin precio cargado" });
    }
  }

  const groups: MPGroup[] = [...groupMap.entries()]
    .map(([provider, lines]) => ({
      provider,
      lines: lines.sort((a, b) =>
        a.ingredientName.localeCompare(b.ingredientName),
      ),
      subtotal: lines.reduce((s, l) => s + l.subtotal, 0),
    }))
    .sort((a, b) => a.provider.localeCompare(b.provider));

  const total = groups.reduce((s, g) => s + g.subtotal, 0);
  const perPerson = event.pax > 0 ? total / event.pax : 0;

  return { groups, problems, total, perPerson };
}
