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
  /** Nombre de la unidad de venta del proveedor (ej: "cabeza", "bolsa", "docena"). Solo display. */
  sale_unit: string | null;
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
  sale_unit?: string | null;
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

// -------------------------------- Recetas --------------------------------

export type RecipeCategory =
  | "bocado"
  | "principal"
  | "postre"
  | "guarnicion"
  | "otro";

export const RECIPE_CATEGORIES: { value: RecipeCategory; label: string }[] = [
  { value: "bocado", label: "Bocado" },
  { value: "principal", label: "Plato principal" },
  { value: "postre", label: "Postre" },
  { value: "guarnicion", label: "Guarnición" },
  { value: "otro", label: "Otro" },
];

/** Subcategorías sugeridas para bocados (de las propuestas de Oliva). */
export const BOCADO_SUBCATEGORIES = [
  "Pesca",
  "Proteínas",
  "Vegetales / Sopas",
  "Picaditas / Tapeo",
];

export type Recipe = {
  id: string;
  name: string;
  category: RecipeCategory;
  subcategory: string | null;
  is_veggie: boolean;
  yield_units: number;
  description: string | null;
  notes: string | null;
  created_at: string;
};

export type RecipeItem = {
  id: string;
  recipe_id: string;
  ingredient_id: string;
  quantity: number;
  unit: UnitKind;
  sort_order: number;
  created_at: string;
};

/** Ítem de receta con el ingrediente (y su producto) embebido. */
export type RecipeItemWithIngredient = RecipeItem & {
  ingredient: IngredientWithProduct | null;
};

export type RecipeWithItems = Recipe & {
  items: RecipeItemWithIngredient[];
};

/** Receta de la lista, con conteo de ítems. */
export type RecipeListRow = Recipe & { item_count: number };

export type RecipeInput = {
  name: string;
  category: RecipeCategory;
  subcategory?: string | null;
  is_veggie?: boolean;
  yield_units: number;
  description?: string | null;
  notes?: string | null;
};

export type RecipeItemInput = {
  ingredient_id: string;
  quantity: number;
  unit: UnitKind;
  sort_order: number;
};

/** Ítem de un plan de importación de recetas (ingrediente existente o a crear). */
export type ImportRecipeItem = {
  ingredient_id: string | null;
  create_name: string | null;
  quantity: number;
  unit: UnitKind;
};

export type ImportRecipePlan = {
  name: string;
  category: RecipeCategory;
  subcategory: string | null;
  is_veggie: boolean;
  yield_units: number;
  items: ImportRecipeItem[];
};

// -------------------------------- Eventos --------------------------------

export type EventStatus = "activo" | "finalizado";

export type EventRecipeRole =
  | "bocado"
  | "principal"
  | "principal_veggie"
  | "postre";

export type BarraService = "ninguna" | "sin_alcohol" | "con_alcohol";
export type BarraDia = "semana" | "jueves" | "finde";
export type BarraHorario = "mediodia" | "cena" | "nocturno";

export type EventRow = {
  id: string;
  name: string;
  event_date: string | null;
  pax: number;
  duration_hours: number;
  status: EventStatus;
  bocados_per_person: number;
  principal_extra: number;
  veggie_pct: number;
  merma_pct: number;
  margin_pct: number;
  barra_service: BarraService;
  barra_dia: BarraDia;
  barra_horario: BarraHorario;
  notes: string | null;
  created_at: string;
};

export type EventInput = {
  name: string;
  event_date?: string | null;
  pax: number;
  duration_hours?: number;
  status?: EventStatus;
  bocados_per_person?: number;
  principal_extra?: number;
  veggie_pct?: number;
  merma_pct?: number;
  margin_pct?: number;
  barra_service?: BarraService;
  barra_dia?: BarraDia;
  barra_horario?: BarraHorario;
  notes?: string | null;
};

export type EventRecipe = {
  id: string;
  event_id: string;
  recipe_id: string;
  role: EventRecipeRole;
  created_at: string;
};

/** Receta elegida en el evento, con la receta completa (ítems + ingredientes). */
export type EventRecipeWithRecipe = EventRecipe & {
  recipe: RecipeWithItems | null;
};

// --------------------------------- Barra ---------------------------------

export type BarSettings = {
  id: boolean;
  dia_semana: number;
  dia_jueves: number;
  dia_finde: number;
  hor_mediodia: number;
  hor_cena: number;
  hor_nocturno: number;
};

export type BarSettingsInput = Omit<BarSettings, "id">;

export type BarBeverage = {
  id: string;
  name: string;
  service: Exclude<BarraService, "ninguna">;
  size_ml: number;
  price: number;
  ml_per_person_hour: number;
  sort_order: number;
  created_at: string;
};

export type BarBeverageInput = {
  name: string;
  service: Exclude<BarraService, "ninguna">;
  size_ml: number;
  price: number;
  ml_per_person_hour: number;
  sort_order?: number;
};

export const BARRA_SERVICES: { value: BarraService; label: string }[] = [
  { value: "ninguna", label: "Sin barra" },
  { value: "sin_alcohol", label: "Sin alcohol" },
  { value: "con_alcohol", label: "Barra libre (con alcohol)" },
];

export const BARRA_DIAS: { value: BarraDia; label: string }[] = [
  { value: "semana", label: "Semana (dom–mié)" },
  { value: "jueves", label: "Jueves" },
  { value: "finde", label: "Viernes / Sábado" },
];

export const BARRA_HORARIOS: { value: BarraHorario; label: string }[] = [
  { value: "mediodia", label: "Mediodía" },
  { value: "cena", label: "Cena" },
  { value: "nocturno", label: "Nocturno" },
];

// ------------------- Costos del evento (Fase 6) -------------------

export type EventCostSection =
  | "personal"
  | "vajilla"
  | "instalacion"
  | "extra"
  | "adicional";

export type EventCost = {
  id: string;
  event_id: string;
  section: EventCostSection;
  name: string;
  detail: string | null;
  quantity: number;
  unit_price: number;
  sort_order: number;
  created_at: string;
};

export type EventCostInput = {
  section: EventCostSection;
  name: string;
  detail?: string | null;
  quantity: number;
  unit_price: number;
  sort_order?: number;
};

export type CostSectionConfig = {
  title: string;
  description: string;
  qtyLabel: string;
  priceLabel: string;
  detailLabel: string | null;
  /** false = no entra en el precio por persona (costos adicionales). */
  countsTowardPrice: boolean;
};

export const COST_SECTIONS: Record<EventCostSection, CostSectionConfig> = {
  personal: {
    title: "Personal",
    description: "Producción y servicio: horas × pago por hora.",
    qtyLabel: "Horas",
    priceLabel: "$ / hora",
    detailLabel: "Zona / rol",
    countsTowardPrice: true,
  },
  vajilla: {
    title: "Vajilla",
    description: "Platos, vasos, cubiertos, etc.",
    qtyLabel: "Cantidad",
    priceLabel: "Precio unit.",
    detailLabel: null,
    countsTowardPrice: true,
  },
  instalacion: {
    title: "Instalación / Planta",
    description: "Horas de uso × precio por hora y costos fijos.",
    qtyLabel: "Horas",
    priceLabel: "$ / hora",
    detailLabel: "Detalle",
    countsTowardPrice: true,
  },
  extra: {
    title: "Extras",
    description: "Costos internos de Oliva (nafta, hielo, etc.).",
    qtyLabel: "Cantidad",
    priceLabel: "Monto",
    detailLabel: null,
    countsTowardPrice: true,
  },
  adicional: {
    title: "Costos adicionales",
    description: "Se cobran aparte al cliente — no entran en el precio por persona.",
    qtyLabel: "Cantidad",
    priceLabel: "Precio",
    detailLabel: null,
    countsTowardPrice: false,
  },
};
