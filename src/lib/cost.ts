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
 *
 * Soporta dos caminos:
 *  1) Directo: dimensiones de ingrediente y producto coinciden (ej: kg ↔ kg).
 *  2) Vía unit_content: producto en 'un' con contenido por unidad (ej: botella 700 ml).
 *     En este caso el precio se fracciona proporcionalmente: $ por ml.
 */
export function ingredientUnitPrice(
  ing: IngredientWithProduct,
): number | null {
  if (ing.product) {
    const prod = ing.product;

    // Camino 1: conversión directa entre dimensiones compatibles.
    const directFactor = convert(1, ing.base_unit, prod.base_unit);
    if (directFactor != null) {
      const pricePerProductUnit = prod.price / prod.pack_size;
      return pricePerProductUnit * directFactor;
    }

    // Camino 2: producto en 'un' con contenido (volumen/masa) por unidad.
    // Permite costear una receta con 10 ml cuando el producto es "botella de 700 ml".
    if (prod.unit_content_value && prod.unit_content_unit) {
      const contentFactor = convert(
        1,
        ing.base_unit,
        prod.unit_content_unit as UnitKind,
      );
      if (contentFactor != null) {
        // $ por unidad de venta (ej: botella) ÷ contenido → $ por ml (o g).
        const pricePerUnit = prod.price / prod.pack_size;
        const pricePerContentUnit = pricePerUnit / prod.unit_content_value;
        return pricePerContentUnit * contentFactor;
      }
    }

    return null; // dimensiones incompatibles sin solución
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
