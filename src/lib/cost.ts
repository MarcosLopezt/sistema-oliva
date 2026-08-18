import {
  unitDimension,
  type UnitKind,
  type IngredientWithProduct,
  type RecipeItemWithIngredient,
} from "@/lib/types";

// NOTA: este módulo es la única fuente de verdad del costeo. Toda pantalla que
// muestre un precio de ingrediente o un costo de receta debe usar estas
// funciones — no recalcular a mano — para que no vuelvan a divergir.

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
      const contentFactor = convert(1, ing.base_unit, prod.unit_content_unit);
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

/**
 * Motivo por el que un ingrediente no se puede costear, o null si está bien.
 *
 * Es el complemento exacto de `ingredientUnitPrice`: devuelve un texto
 * justamente cuando esa función devuelve null. Atar las alertas de la UI a
 * esta función evita el falso positivo de comparar dimensiones a mano, que
 * marcaba como rotos los productos que usan el modelo de tres capas
 * (producto en 'un' + contenido por unidad), que son casos válidos.
 */
export function ingredientPriceIssue(ing: IngredientWithProduct): string | null {
  if (ingredientUnitPrice(ing) != null) return null;

  const prod = ing.product;
  if (!prod) {
    return "Sin precio: vinculá un producto de proveedor o cargá un precio de mercado.";
  }
  if (prod.base_unit === "un" && !prod.unit_content_value) {
    return `El producto se vende por unidad y no tiene contenido cargado. Editá el producto e indicá cuánto (${ing.base_unit}) trae cada unidad.`;
  }
  const contenido = prod.unit_content_unit
    ? `, contenido en ${prod.unit_content_unit}`
    : "";
  return `La unidad del ingrediente (${ing.base_unit}) no es compatible con la del producto (${prod.base_unit}${contenido}).`;
}

/**
 * Forma mínima necesaria para costear una línea: cantidad + unidad + ingrediente.
 * La cumplen tanto los ítems guardados (`RecipeItemWithIngredient`) como las
 * filas en edición del editor de recetas, así que ambos usan el mismo cálculo.
 */
export type CostableItem = {
  quantity: number;
  unit: UnitKind;
  ingredient: IngredientWithProduct | null;
};

/** Costo de una línea de receta (cantidad del lote × precio del ingrediente). */
export function itemCost(item: CostableItem): number | null {
  if (!item.ingredient) return null;
  const qty = convert(item.quantity, item.unit, item.ingredient.base_unit);
  if (qty == null) return null;
  const unitPrice = ingredientUnitPrice(item.ingredient);
  if (unitPrice == null) return null;
  return qty * unitPrice;
}

/** Costo de un ítem de receta ya guardado. Alias tipado de `itemCost`. */
export function recipeItemCost(item: RecipeItemWithIngredient): number | null {
  return itemCost(item);
}

/**
 * Motivo por el que una línea de receta no se puede costear, o null si está bien.
 * Complemento exacto de `itemCost`: primero mira la unidad elegida en la receta
 * y después delega en `ingredientPriceIssue` (que cubre el resto de los casos).
 */
export function itemCostIssue(item: CostableItem): string | null {
  if (itemCost(item) != null) return null;
  if (!item.ingredient) return "Falta el ingrediente.";
  if (unitDimension(item.unit) !== unitDimension(item.ingredient.base_unit)) {
    return `La unidad de la receta (${item.unit}) no coincide con la del ingrediente (${item.ingredient.base_unit}).`;
  }
  return ingredientPriceIssue(item.ingredient);
}

export type RecipeCost = {
  /** Costo del lote completo (suma de los ítems costeables). */
  total: number;
  /** Costo por unidad producida (total / yield_units). */
  perUnit: number;
  /** Ítems que no se pudieron costear (sin precio o unidad incompatible). */
  missing: number;
};

/**
 * Costo total y por unidad de una receta. Única implementación de esta suma:
 * la usan tanto la receta guardada como el editor mientras se edita, para que
 * el número que se ve editando sea exactamente el que queda guardado.
 */
export function recipeCost(
  items: CostableItem[],
  yieldUnits: number,
): RecipeCost {
  let total = 0;
  let missing = 0;
  for (const item of items) {
    const c = itemCost(item);
    if (c == null) missing++;
    else total += c;
  }
  const perUnit = yieldUnits > 0 ? total / yieldUnits : 0;
  return { total, perUnit, missing };
}
