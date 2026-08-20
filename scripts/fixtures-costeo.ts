/**
 * Fixtures compartidos por los scripts de verificación.
 *
 * Reproducen los casos de control que ya se usaron para validar el motor de
 * costeo, para que las verificaciones corran siempre sobre los mismos números.
 */
import type {
  ContentUnit,
  EventRecipeWithRecipe,
  EventRow,
  IngredientWithProduct,
  Product,
  RecipeItemWithIngredient,
  UnitKind,
} from "@/lib/types";

const PROVIDER = { id: "prov-1", name: "El Criollo", phone: "3814000000" };

type FixtureProduct = Product & { provider: typeof PROVIDER };

function product(
  over: Partial<Product> & { id: string; name: string },
): FixtureProduct {
  return {
    provider_id: PROVIDER.id,
    code: null,
    base_unit: "un",
    pack_size: 1,
    price: 0,
    sale_unit: null,
    price_includes_iva: true,
    unit_content_value: null,
    unit_content_unit: null,
    leftover_shelf_life_days: null,
    updated_at: "2026-01-01T00:00:00Z",
    created_at: "2026-01-01T00:00:00Z",
    ...over,
    provider: PROVIDER,
  } as FixtureProduct;
}

function ingredient(
  id: string,
  name: string,
  baseUnit: UnitKind,
  prod: FixtureProduct | null,
  marketPrice: number | null = null,
): IngredientWithProduct {
  return {
    id,
    name,
    base_unit: baseUnit,
    product_id: prod?.id ?? null,
    market_price: marketPrice,
    market_price_updated_at: null,
    market_auto: false,
    market_price_source: null,
    notes: null,
    created_at: "2026-01-01T00:00:00Z",
    product: prod,
  };
}

function item(
  id: string,
  ing: IngredientWithProduct,
  quantity: number,
  unit: UnitKind,
): RecipeItemWithIngredient {
  return {
    id,
    recipe_id: "r",
    ingredient_id: ing.id,
    quantity,
    unit,
    sort_order: 0,
    created_at: "2026-01-01T00:00:00Z",
    ingredient: ing,
  };
}

function selection(
  id: string,
  name: string,
  role: EventRecipeWithRecipe["role"],
  yieldUnits: number,
  items: RecipeItemWithIngredient[],
): EventRecipeWithRecipe {
  return {
    id,
    event_id: "e",
    recipe_id: `rec-${id}`,
    role,
    created_at: "2026-01-01T00:00:00Z",
    recipe: {
      id: `rec-${id}`,
      name,
      category: role === "bocado" ? "bocado" : "principal",
      subcategory: null,
      is_veggie: false,
      yield_units: yieldUnits,
      description: null,
      notes: null,
      created_at: "2026-01-01T00:00:00Z",
      items,
    },
  };
}

function event(over: Partial<EventRow>): EventRow {
  return {
    id: "e",
    name: "Fixture",
    event_date: "2026-09-01",
    pax: 200,
    duration_hours: 5,
    status: "activo",
    bocados_per_person: 3,
    principal_extra: 5,
    veggie_pct: 0,
    merma_pct: 0.15,
    margin_pct: 0,
    barra_service: "ninguna",
    barra_dia: "finde",
    barra_horario: "cena",
    notes: null,
    vajilla_margin: 5,
    created_at: "2026-01-01T00:00:00Z",
    ...over,
  };
}

export type Caso = { event: EventRow; selections: EventRecipeWithRecipe[] };

/**
 * CASO DE CONTROL — Aceite El Criollo (modelo tres capas + consolidación).
 * Dos ingredientes distintos ("Aceite" y "Aceite de oliva") sobre el MISMO
 * producto: principal 3000 ml × 205 porciones + bocado 300 ml por lote de 100
 * × 615 bocados, con 15 % de merma → 709.371,75 ml ÷ 5000 = 142 botellas.
 * Debe dar UNA sola línea y $105.099,18 × 142.
 */
function casoAceite(): Caso {
  const aceite = product({
    id: "prod-aceite",
    name: "ACEITE DE GIRASOL BIDON X 5LT",
    base_unit: "un",
    pack_size: 1,
    price: 105099.18,
    unit_content_value: 5000,
    unit_content_unit: "ml" as ContentUnit,
    leftover_shelf_life_days: 180,
  });
  const ingA = ingredient("ing-aceite", "Aceite", "ml", aceite);
  const ingB = ingredient("ing-aceite-oliva", "Aceite de oliva", "ml", aceite);

  return {
    event: event({ name: "Control aceite" }),
    selections: [
      selection("s1", "Principal", "principal", 1, [item("i1", ingA, 3000, "ml")]),
      selection("s2", "Bocado", "bocado", 100, [item("i2", ingB, 300, "ml")]),
    ],
  };
}

/**
 * CASO BIDÓN — modelo directo (producto en L, pack de 5), sin vida útil
 * cargada para ejercitar el estado "sin vida útil definida".
 * 6000 ml × 1,15 = 6,9 L necesarios → compra 2 packs = 10 L → sobran 3,1 L.
 */
function casoBidon(): Caso {
  const bidon = product({
    id: "prod-bidon",
    name: "Aceite bidón 5 L",
    base_unit: "l",
    pack_size: 5,
    price: 20000,
    sale_unit: "bidón",
  });
  const ing = ingredient("ing-bidon", "Aceite", "ml", bidon);

  return {
    event: event({
      name: "Control bidón",
      pax: 1,
      principal_extra: 0,
      bocados_per_person: 0,
    }),
    selections: [
      selection("s1", "Principal", "principal", 1, [item("i1", ing, 6000, "ml")]),
    ],
  };
}

/** CASO MERCADO — ingrediente sin producto vinculado (precio de mercado). */
function casoMercado(): Caso {
  const ing = ingredient("ing-sal", "Sal", "g", null, 2.5);
  return {
    event: event({
      name: "Control mercado",
      pax: 10,
      principal_extra: 0,
      bocados_per_person: 0,
    }),
    selections: [
      selection("s1", "Principal", "principal", 1, [item("i1", ing, 100, "g")]),
    ],
  };
}

export const CASES: Record<string, Caso> = {
  aceite: casoAceite(),
  bidon: casoBidon(),
  mercado: casoMercado(),
};
