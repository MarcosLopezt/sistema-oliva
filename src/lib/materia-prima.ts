import { convert } from "@/lib/cost";
import { formatNum, formatDate } from "@/lib/format";
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
  /** Cantidad total en la unidad base del producto (packs × pack_size). */
  totalBaseQty: number;
  baseUnitLabel: string;
  /** Etiqueta de la unidad de venta del proveedor (ej "caja", "bidón"), si existe. */
  saleUnit: string | null;
  priceEach: number;
  subtotal: number;
  /**
   * MODELO TRES CAPAS (solo cuando el producto tiene unit_content):
   * Unidades individuales realmente necesarias antes de redondear a packs.
   * Ej: se necesitan 1.643 botellas → unitsNeeded = 2.
   */
  unitsNeeded: number | null;
  /** Tamaño del pack (unidades por caja). Solo con unit_content. */
  unitsPerPack: number | null;
  /**
   * Unidades sobrantes al comprar packs completos (packs × pack_size − unitsNeeded).
   * Ej: comprar 1 caja (6 un) pero necesitar 2 → surplusUnits = 4.
   */
  surplusUnits: number | null;
};

export type MPGroup = {
  provider: string;
  /** id del proveedor (null para el grupo "Precio de mercado"). */
  providerId: string | null;
  /** Teléfono / WhatsApp del proveedor, si está cargado. */
  phone: string | null;
  lines: MPLine[];
  subtotal: number;
};

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
  //    La clave del grupo es el id del proveedor (o el sentinel MERCADO).
  type GroupAcc = {
    provider: string;
    providerId: string | null;
    phone: string | null;
    lines: MPLine[];
  };
  const groupMap = new Map<string, GroupAcc>();
  const addLine = (
    key: string,
    meta: Omit<GroupAcc, "lines">,
    line: MPLine,
  ) => {
    const g = groupMap.get(key);
    if (g) g.lines.push(line);
    else groupMap.set(key, { ...meta, lines: [line] });
  };

  for (const { ingredient: ing, baseQty } of needs.values()) {
    if (ing.product) {
      const prod = ing.product;
      const provider = prod.provider;
      const providerKey = provider?.id ?? "sin-proveedor";
      const providerMeta = {
        provider: provider?.name ?? "Sin proveedor",
        providerId: provider?.id ?? null,
        phone: provider?.phone ?? null,
      };

      // Camino 1: conversión directa entre dimensiones compatibles (ej: kg ↔ kg).
      const directFactor = convert(1, ing.base_unit, prod.base_unit);
      if (directFactor != null) {
        const neededProductUnits = baseQty * directFactor;
        const packs = Math.max(1, Math.ceil(neededProductUnits / prod.pack_size));
        const subtotal = packs * prod.price;
        const baseUnitLabel = unitLbl(prod.base_unit);
        addLine(providerKey, providerMeta, {
          ingredientId: ing.id,
          ingredientName: ing.name,
          productName: prod.name,
          buyQty: packs,
          buyUnitLabel:
            prod.pack_size === 1
              ? baseUnitLabel
              : `pack ${prod.pack_size} ${baseUnitLabel}`,
          totalBaseQty: packs * prod.pack_size,
          baseUnitLabel,
          saleUnit: prod.sale_unit ?? null,
          priceEach: prod.price,
          subtotal,
          unitsNeeded: null,
          unitsPerPack: null,
          surplusUnits: null,
        });
      } else if (prod.unit_content_value && prod.unit_content_unit) {
        // Camino 2: modelo tres capas.
        //   contenido (ml/g) → unidades individuales → packs (cajas).
        // Se usa cuando el producto está en 'un' con un contenido definido
        // (ej: botella 700 ml, caja de 6).
        const contentUnit = prod.unit_content_unit as UnitKind;
        const contentFactor = convert(1, ing.base_unit, contentUnit);
        if (contentFactor == null) {
          problems.push({
            ingredientName: ing.name,
            reason: `unidad incompatible con contenido del producto (${ing.base_unit} vs ${contentUnit})`,
          });
          continue;
        }
        // 1) Cuánto contenido (ml/g) necesito en total.
        const contentNeeded = baseQty * contentFactor;
        // 2) Cuántas unidades individuales (botellas) necesito — redondear arriba.
        const rawUnitsNeeded = contentNeeded / prod.unit_content_value;
        const unitsNeeded = Math.max(1, Math.ceil(rawUnitsNeeded));
        // 3) Cuántos packs (cajas) debo pedir — redondear arriba.
        const packs = Math.max(1, Math.ceil(unitsNeeded / prod.pack_size));
        const purchasedUnits = packs * prod.pack_size;
        const surplusUnits = purchasedUnits - unitsNeeded;
        const subtotal = packs * prod.price;
        const saleUnitLabel = prod.sale_unit ?? `pack ${prod.pack_size} un`;
        addLine(providerKey, providerMeta, {
          ingredientId: ing.id,
          ingredientName: ing.name,
          productName: prod.name,
          buyQty: packs,
          buyUnitLabel: saleUnitLabel,
          totalBaseQty: purchasedUnits,
          baseUnitLabel: "un",
          saleUnit: prod.sale_unit ?? null,
          priceEach: prod.price,
          subtotal,
          unitsNeeded,
          unitsPerPack: prod.pack_size,
          surplusUnits: surplusUnits > 0 ? surplusUnits : 0,
        });
      } else {
        problems.push({
          ingredientName: ing.name,
          reason:
            prod.base_unit === "un"
              ? "producto en unidades sin contenido configurado — editá el producto y cargá su contenido por unidad"
              : "unidad del producto incompatible",
        });
      }
    } else if (ing.market_price != null) {
      const subtotal = baseQty * ing.market_price;
      const baseUnitLabel = unitLbl(ing.base_unit);
      addLine(
        MERCADO,
        { provider: MERCADO, providerId: null, phone: null },
        {
          ingredientId: ing.id,
          ingredientName: ing.name,
          productName: null,
          buyQty: Math.round(baseQty * 1000) / 1000,
          buyUnitLabel: baseUnitLabel,
          totalBaseQty: Math.round(baseQty * 1000) / 1000,
          baseUnitLabel,
          saleUnit: null,
          priceEach: ing.market_price,
          subtotal,
          unitsNeeded: null,
          unitsPerPack: null,
          surplusUnits: null,
        },
      );
    } else {
      problems.push({ ingredientName: ing.name, reason: "sin precio cargado" });
    }
  }

  const groups: MPGroup[] = [...groupMap.values()]
    .map((g) => ({
      provider: g.provider,
      providerId: g.providerId,
      phone: g.phone,
      lines: g.lines.sort((a, b) =>
        a.ingredientName.localeCompare(b.ingredientName),
      ),
      subtotal: g.lines.reduce((s, l) => s + l.subtotal, 0),
    }))
    .sort((a, b) => a.provider.localeCompare(b.provider));

  const total = groups.reduce((s, g) => s + g.subtotal, 0);
  const perPerson = event.pax > 0 ? total / event.pax : 0;

  return { groups, problems, total, perPerson };
}

/**
 * Arma el texto del pedido para un proveedor, listo para copiar/compartir.
 * Cantidades definitivas: ya vienen con merma y redondeo a la unidad de venta.
 */
export function buildProviderOrderMessage(
  eventName: string,
  eventDate: string | null,
  group: MPGroup,
): string {
  const lines = group.lines.map((l) => {
    const saleLabel = l.saleUnit ?? l.buyUnitLabel;
    const packs = `${formatNum(l.buyQty)} ${saleLabel}`;
    // Para modelo tres capas: mostrar unidades reales y cajas por separado.
    if (l.unitsNeeded != null && l.unitsPerPack != null) {
      return `- ${l.ingredientName}: ${formatNum(l.unitsNeeded)} un (${packs})`;
    }
    const total = `${formatNum(l.totalBaseQty)} ${l.baseUnitLabel}`;
    return `- ${l.ingredientName}: ${total} (${packs})`;
  });

  const dateStr = eventDate ? ` del ${formatDate(eventDate)}` : "";
  return [
    `Hola ${group.provider},`,
    `Te paso el pedido para el evento "${eventName}"${dateStr}:`,
    "",
    ...lines,
    "",
    "Quedamos en contacto. Saludos,",
    "Oliva Gastronomía",
  ].join("\n");
}

/**
 * Indica si el sobrante de una línea es lo suficientemente grande como para
 * mostrarlo como alerta informativa (nunca de error).
 * Umbral: sobran más de 1 unidad O el sobrante supera el 30 % de lo comprado.
 */
export function isSurplusSignificant(line: MPLine): boolean {
  if (
    line.surplusUnits == null ||
    line.unitsPerPack == null ||
    line.surplusUnits <= 0
  )
    return false;
  const purchased = line.totalBaseQty; // = packs × pack_size
  return line.surplusUnits > 1 || line.surplusUnits / purchased > 0.3;
}

/** Normaliza un teléfono a solo dígitos para armar el link de wa.me. */
export function whatsappDigits(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 6 ? digits : null;
}
