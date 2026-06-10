import {
  unitDimension,
  type UnitKind,
  type IngredientWithProduct,
  type RecipeItemWithIngredient,
} from "@/lib/types";

/** Factor a la unidad base de cada dimensión (masa→g, volumen→ml, conteo→un). */
const FACTOR: Record<UnitKind, number> = {
  g: 1,
  kg: 1000,
  ml: 1,
  l: 1000,
  un: 1,
};

/**
 * Convierte una cantidad entre unidades de la misma dimensión.
 * Devuelve null si las dimensiones no coinciden (ej: kg ↔ l).
 */
export function convert(
  qty: number,
  from: UnitKind,
  to: UnitKind,
): number | null {
  if (unitDimension(from) !== unitDimension(to)) return null;
  return (qty * FACTOR[from]) / FACTOR[to];
}

/**
 * Precio por unidad base del ingrediente.
 * Prioriza el producto vinculado; si no hay, usa el precio de mercado.
 * Devuelve null si no se puede determinar (sin precio o unidades incompatibles).
 */
export function ingredientUnitPrice(
  ing: IngredientWithProduct,
): number | null {
  if (ing.product) {
    const perProductUnit = ing.product.price / ing.product.pack_size;
    const factor = convert(1, ing.base_unit, ing.product.base_unit);
    if (factor == null) return null; // dimensiones incompatibles
    return perProductUnit * factor;
  }
  if (ing.market_price != null) return ing.market_price;
  return null;
}

/** Costo de un ítem de receta (cantidad del lote × precio del ingrediente). */
export function recipeItemCost(item: RecipeItemWithIngredient): number | null {
  if (!item.ingredient) return null;
  const qty = convert(item.quantity, item.unit, item.ingredient.base_unit);
  if (qty == null) return null;
  const unitPrice = ingredientUnitPrice(item.ingredient);
  if (unitPrice == null) return null;
  return qty * unitPrice;
}

export type RecipeCost = {
  /** Costo del lote completo (suma de los ítems costeables). */
  total: number;
  /** Costo por unidad producida (total / yield_units). */
  perUnit: number;
  /** Ítems que no se pudieron costear (sin precio o unidad incompatible). */
  missing: number;
};

/** Costo total y por unidad de una receta. */
export function recipeCost(
  items: RecipeItemWithIngredient[],
  yieldUnits: number,
): RecipeCost {
  let total = 0;
  let missing = 0;
  for (const item of items) {
    const c = recipeItemCost(item);
    if (c == null) missing++;
    else total += c;
  }
  const perUnit = yieldUnits > 0 ? total / yieldUnits : 0;
  return { total, perUnit, missing };
}
