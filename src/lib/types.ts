// Tipos del dominio de Oliva. Reflejan las tablas de Supabase (ver supabase/migrations).

export type UnitKind = "g" | "kg" | "ml" | "l" | "un";

export const UNITS: { value: UnitKind; label: string }[] = [
  { value: "g", label: "g (gramos)" },
  { value: "kg", label: "kg (kilos)" },
  { value: "ml", label: "ml (mililitros)" },
  { value: "l", label: "L (litros)" },
  { value: "un", label: "un (unidades)" },
];

/** Dimensión física de una unidad (para validar conversiones). */
export function unitDimension(u: UnitKind): "mass" | "volume" | "count" {
  if (u === "g" || u === "kg") return "mass";
  if (u === "ml" || u === "l") return "volume";
  return "count";
}

export type Provider = {
  id: string;
  name: string;
  notes: string | null;
  created_at: string;
};

export type Product = {
  id: string;
  provider_id: string;
  code: string | null;
  name: string;
  base_unit: UnitKind;
  /** Cantidad de base_unit por unidad de compra (ej: bidón 5 L → 5). */
  pack_size: number;
  /** Precio de la unidad de compra (el "pack"). */
  price: number;
  price_includes_iva: boolean;
  updated_at: string;
  created_at: string;
};

export type Ingredient = {
  id: string;
  name: string;
  base_unit: UnitKind;
  /** Producto de proveedor vinculado (mapeo persistente del match). */
  product_id: string | null;
  /** Precio de referencia por base_unit cuando no hay proveedor fijo. */
  market_price: number | null;
  market_price_updated_at: string | null;
  notes: string | null;
  created_at: string;
};

/** Ingrediente con su producto vinculado embebido (join). */
export type IngredientWithProduct = Ingredient & {
  product: (Product & { provider: Pick<Provider, "id" | "name"> }) | null;
};

// Tipos para inserción/edición (sin campos autogenerados).
export type ProviderInput = { name: string; notes?: string | null };

export type ProductInput = {
  provider_id: string;
  code?: string | null;
  name: string;
  base_unit: UnitKind;
  pack_size: number;
  price: number;
  price_includes_iva?: boolean;
};

export type IngredientInput = {
  name: string;
  base_unit: UnitKind;
  product_id?: string | null;
  market_price?: number | null;
  market_price_updated_at?: string | null;
  notes?: string | null;
};
