import type { IngredientWithProduct, BarBeverage } from "@/lib/types";

/**
 * Pide al proxy serverless el precio de mercado de un producto.
 *  - `sizeMl` (bebidas): precio de la botella de ese tamaño.
 *  - `unit`   (ingredientes): precio por unidad base (g/kg/ml/l/un).
 * Devuelve el número o null si falla / no hay dato confiable.
 */
export async function fetchMarketPrice(
  query: string,
  opts?: { sizeMl?: number; unit?: string },
): Promise<number | null> {
  try {
    const params = new URLSearchParams({ q: query });
    if (opts?.sizeMl && opts.sizeMl > 0) params.set("size_ml", String(opts.sizeMl));
    if (opts?.unit) params.set("unit", opts.unit);
    const res = await fetch(`/api/market-price?${params.toString()}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { price?: number };
    return typeof data.price === "number" ? data.price : null;
  } catch {
    return null;
  }
}

/** Edad máxima antes de re-buscar un precio auto (~1 semana). */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Campos mínimos que comparten ingredientes y bebidas para el precio de mercado. */
type PriceMeta = {
  market_auto: boolean;
  market_price_updated_at: string | null;
  market_price_source: "auto" | "manual" | null;
};

/** True si conviene refrescar el precio auto (vencido o nunca buscado). */
export function isPriceStale(m: PriceMeta): boolean {
  if (!m.market_auto) return false;
  if (m.market_price_source === "manual") return false;
  if (!m.market_price_updated_at) return true;
  const age = Date.now() - new Date(m.market_price_updated_at).getTime();
  return age > MAX_AGE_MS;
}

export type MarketPriceLabel = {
  text: string;
  /** tono para el estilo: ok = actualizado, manual = editado, stale = viejo. */
  tone: "ok" | "manual" | "stale";
};

/** Etiqueta a mostrar junto a un precio de mercado (genérica). */
function buildLabel(
  m: PriceMeta & { hasPrice: boolean },
  failed: boolean,
): MarketPriceLabel | null {
  const date = m.market_price_updated_at
    ? new Date(m.market_price_updated_at).toLocaleDateString("es-AR")
    : "—";

  if (m.market_price_source === "manual") {
    return { text: `Precio manual · Editado ${date}`, tone: "manual" };
  }
  if (failed && m.hasPrice) {
    return { text: `Precio desactualizado · Última actualización ${date}`, tone: "stale" };
  }
  if (m.market_auto) {
    return { text: `Precio de mercado · Actualizado ${date}`, tone: "ok" };
  }
  return null;
}

// ----------------------------- Ingredientes -----------------------------

/** Un ingrediente con búsqueda automática activada y sin proveedor fijo. */
export function isAutoMarket(ing: IngredientWithProduct): boolean {
  return ing.market_auto && ing.product_id == null;
}

/** True si el precio auto del ingrediente está vencido y conviene refrescarlo. */
export function isStaleAuto(ing: IngredientWithProduct): boolean {
  return isAutoMarket(ing) && isPriceStale(ing);
}

/** Etiqueta del precio de un ingrediente de mercado (null si tiene proveedor fijo). */
export function marketPriceLabel(
  ing: IngredientWithProduct,
  failed: boolean,
): MarketPriceLabel | null {
  if (ing.product_id != null) return null;
  return buildLabel({ ...ing, hasPrice: ing.market_price != null }, failed);
}

// ------------------------------- Bebidas -------------------------------

/** True si el precio auto de la bebida está vencido y conviene refrescarlo. */
export function isStaleAutoBeverage(bev: BarBeverage): boolean {
  return bev.market_auto && isPriceStale(bev);
}

/** Etiqueta del precio de una bebida de mercado. */
export function beverageMarketLabel(
  bev: BarBeverage,
  failed: boolean,
): MarketPriceLabel | null {
  return buildLabel({ ...bev, hasPrice: bev.price > 0 }, failed);
}
