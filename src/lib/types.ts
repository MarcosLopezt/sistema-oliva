// Tipos del dominio de Oliva. Reflejan las tablas de Supabase (ver supabase/migrations).

export type UnitKind = "g" | "kg" | "ml" | "l" | "un";

export const UNITS: { value: UnitKind; label: string }[] = [
  { value: "g", label: "g (gramos)" },
  { value: "kg", label: "kg (kilos)" },
  { value: "ml", label: "ml (mililitros)" },
  { value: "l", label: "L (litros)" },
  { value: "un", label: "un (unidades)" },
];

/**
 * Unidades válidas como "contenido por unidad" de un producto: peso o volumen,
 * nunca conteo. Un contenido en 'un' sería redundante con pack_size y deja al
 * producto imposible de costear. Lo refuerza la constraint de la migración 0016.
 */
export type ContentUnit = "g" | "kg" | "ml" | "l";

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
  /** Teléfono / WhatsApp (formato libre). Habilita compartir el pedido. */
  phone: string | null;
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
  /**
   * SEMÁNTICA DEL PRECIO — lo que Oliva efectivamente paga por la unidad de
   * compra (el "pack"), tal cual salió de la columna elegida al importar el
   * Excel del proveedor. Algunos proveedores facturan con IVA y otros no; el
   * usuario elige la columna que corresponde a cada uno, así que este valor YA
   * es el costo real. Todo el costeo (cost.ts, materia-prima.ts) lo usa tal
   * cual: nunca se le suma ni se le resta IVA.
   */
  price: number;
  /** Nombre de la unidad de venta del proveedor (ej: "cabeza", "bolsa", "docena"). Solo display. */
  sale_unit: string | null;
  /**
   * Indica si `price` ya trae el IVA incorporado. Es INFORMATIVO: sirve para
   * trazabilidad (saber sobre qué base está cargada cada lista) y para el
   * desglose contable del evento. NO se usa para recalcular precios.
   */
  price_includes_iva: boolean;
  /**
   * Volumen o peso que contiene cada unidad individual cuando base_unit='un'.
   * Ej: 700 (para una botella de 700 ml). Permite calcular costo proporcional
   * en recetas y cantidades exactas en eventos (unidades → cajas).
   * Normalizado a la unidad chica: ml para volúmenes, g para masas.
   */
  unit_content_value: number | null;
  /** Unidad del contenido por unidad. Solo aplica cuando unit_content_value != null. */
  unit_content_unit: ContentUnit | null;
  /**
   * Días que dura el sobrante de este producto una vez abierto/fraccionado
   * (ej: aceite 180, crema 5, verduras 3). null = sin definir: los sobrantes
   * quedan sin fecha de vencimiento y la UI avisa que falta configurarlo.
   */
  leftover_shelf_life_days: number | null;
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
  /** Si true, el precio de mercado se busca/actualiza automáticamente. */
  market_auto: boolean;
  /** Origen del precio actual: 'auto' (búsqueda) o 'manual' (editado a mano). */
  market_price_source: "auto" | "manual" | null;
  notes: string | null;
  created_at: string;
};

/** Ingrediente con su producto vinculado embebido (join). */
export type IngredientWithProduct = Ingredient & {
  product:
    | (Product & { provider: Pick<Provider, "id" | "name" | "phone"> })
    | null;
};

// Tipos para inserción/edición (sin campos autogenerados).
export type ProviderInput = {
  name: string;
  notes?: string | null;
  phone?: string | null;
};

export type ProductInput = {
  provider_id: string;
  code?: string | null;
  name: string;
  base_unit: UnitKind;
  pack_size: number;
  price: number;
  sale_unit?: string | null;
  price_includes_iva?: boolean;
  unit_content_value?: number | null;
  unit_content_unit?: ContentUnit | null;
  leftover_shelf_life_days?: number | null;
};

export type IngredientInput = {
  name: string;
  base_unit: UnitKind;
  product_id?: string | null;
  market_price?: number | null;
  market_price_updated_at?: string | null;
  market_auto?: boolean;
  market_price_source?: "auto" | "manual" | null;
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
  /** Margen global de vajilla: unidades extra de reserva (default 5). */
  vajilla_margin: number;
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
  vajilla_margin?: number;
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

/**
 * Servicio en el que figura una bebida. Igual que el del evento pero con
 * 'ambos' (la bebida aparece tanto en barra con alcohol como sin alcohol).
 */
export type BeverageService = "sin_alcohol" | "con_alcohol" | "ambos";

export const BEVERAGE_SERVICES: { value: BeverageService; label: string }[] = [
  { value: "sin_alcohol", label: "Sin alcohol" },
  { value: "con_alcohol", label: "Con alcohol" },
  { value: "ambos", label: "Ambos (con y sin alcohol)" },
];

export type BarBeverage = {
  id: string;
  name: string;
  service: BeverageService;
  size_ml: number;
  price: number;
  ml_per_person_hour: number;
  /** Si true, el precio se busca/actualiza automáticamente (como ingredientes). */
  market_auto: boolean;
  market_price_source: "auto" | "manual" | null;
  market_price_updated_at: string | null;
  sort_order: number;
  created_at: string;
};

export type BarBeverageInput = {
  name: string;
  service: BeverageService;
  size_ml: number;
  price: number;
  ml_per_person_hour: number;
  market_auto?: boolean;
  market_price_source?: "auto" | "manual" | null;
  market_price_updated_at?: string | null;
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

// ------------------------- Personal (Mejora 1) -------------------------

/**
 * Categoría del empleado. Es texto libre en la base para mantenerlo
 * extensible: para sumar una categoría nueva basta con agregarla acá.
 */
export type StaffCategory = string;

export const STAFF_CATEGORIES: { value: string; label: string }[] = [
  { value: "produccion", label: "Producción" },
  { value: "servicio", label: "Servicio" },
];

export function staffCategoryLabel(value: string): string {
  return STAFF_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

/**
 * Rol dentro de una categoría (Chef, Mozo, Bachero…). Su tarifa es el
 * NIVEL 1 de la jerarquía: el valor por defecto que heredan los empleados
 * que no tienen tarifa propia.
 */
export type StaffRole = {
  id: string;
  name: string;
  category: StaffCategory;
  hourly_rate: number;
  active: boolean;
  created_at: string;
};

export type StaffRoleInput = {
  name: string;
  category: StaffCategory;
  hourly_rate: number;
  active?: boolean;
};

export type Staff = {
  id: string;
  full_name: string;
  category: StaffCategory;
  /**
   * Texto libre previo a los roles. Se conserva como respaldo histórico de
   * la migración 0018; la UI usa role_id. No mostrar en pantallas nuevas.
   */
  role: string | null;
  /** Rol habitual del empleado (null = sin rol asignado todavía). */
  role_id: string | null;
  /** NIVEL 2: tarifa propia. null = hereda la del rol. */
  hourly_rate: number | null;
  active: boolean;
  created_at: string;
};

export type StaffInput = {
  full_name: string;
  category: StaffCategory;
  role_id?: string | null;
  hourly_rate: number | null;
  active?: boolean;
};

/** Empleado con su rol habitual embebido (join). */
export type StaffWithRole = Staff & {
  staff_role: StaffRole | null;
};

/** Empleado asignado a un evento (horas + tarifa puntual + estado de pago). */
export type EventStaff = {
  id: string;
  event_id: string;
  staff_id: string;
  hours: number;
  /** NIVEL 3: tarifa puntual para este evento (null = resolver por jerarquía). */
  rate_override: number | null;
  /** Rol puntual para este evento (null = usar el rol habitual del empleado). */
  role_id: string | null;
  paid: boolean;
  created_at: string;
};

export type EventStaffInput = {
  staff_id: string;
  hours: number;
  rate_override?: number | null;
  role_id?: string | null;
  paid?: boolean;
};

/** Asignación con el empleado y el rol del evento embebidos (join). */
export type EventStaffWithStaff = EventStaff & {
  staff: StaffWithRole | null;
  /** Rol puntual del evento, ya resuelto (null = manda el habitual). */
  event_role: StaffRole | null;
};

/** Asignación con el empleado y el evento embebidos (para la vista de Pagos). */
export type EventStaffWithEvent = EventStaff & {
  staff: StaffWithRole | null;
  event_role: StaffRole | null;
  event: Pick<EventRow, "id" | "name" | "event_date"> | null;
};

// ----------------------------- Vajilla --------------------------------

export type TablewareCategory =
  | "platos"
  | "cubiertos"
  | "cristaleria"
  | "bandejas"
  | "utensilios"
  | "otros";

export const TABLEWARE_CATEGORIES: { value: TablewareCategory; label: string }[] = [
  { value: "platos", label: "Platos" },
  { value: "cubiertos", label: "Cubiertos" },
  { value: "cristaleria", label: "Cristalería" },
  { value: "bandejas", label: "Bandejas" },
  { value: "utensilios", label: "Utensilios de cocina" },
  { value: "otros", label: "Otros" },
];

export type TablewareCostType = "alquiler" | "compra";

export const TABLEWARE_COST_TYPES: { value: TablewareCostType; label: string }[] = [
  { value: "alquiler", label: "Alquiler" },
  { value: "compra", label: "Compra" },
];

export type TablewareProvider = {
  id: string;
  name: string;
  notes: string | null;
  phone: string | null;
  created_at: string;
};

export type TablewareItem = {
  id: string;
  provider_id: string;
  name: string;
  category: TablewareCategory;
  cost_type: TablewareCostType;
  unit_price: number;
  notes: string | null;
  created_at: string;
};

export type TablewareItemWithProvider = TablewareItem & {
  provider: Pick<TablewareProvider, "id" | "name" | "phone"> | null;
};

export type EventTableware = {
  id: string;
  event_id: string;
  item_id: string;
  quantity: number;
  breakage_qty: number;
  charge_purchase: boolean;
  /** Unidades de este ítem por persona (para autocálculo). */
  multiplier: number;
  /** Margen propio del ítem (null = usar vajilla_margin del evento). */
  margin_override: number | null;
  /** true = el usuario editó la cantidad a mano; no recalcular automáticamente. */
  quantity_manual: boolean;
  created_at: string;
};

export type EventTablewareWithItem = EventTableware & {
  item: TablewareItemWithProvider | null;
};

export type TablewareProviderInput = {
  name: string;
  notes?: string | null;
  phone?: string | null;
};

export type TablewareItemInput = {
  provider_id: string;
  name: string;
  category?: TablewareCategory;
  cost_type?: TablewareCostType;
  unit_price: number;
  notes?: string | null;
};

export type EventTablewareInput = {
  item_id: string;
  quantity: number;
  breakage_qty?: number;
  charge_purchase?: boolean;
  multiplier?: number;
  margin_override?: number | null;
  quantity_manual?: boolean;
};

// ----------------------------- Sobrantes -------------------------------
// ETAPA 1: registro informativo. Nada de esto entra en el motor de costeo:
// no descuenta stock, no altera costos de eventos ni el precio por persona.

/**
 * Estado del sobrante.
 *
 * 'vencido' NO se persiste: la fuente de verdad es `expires_at` y el estado
 * se deriva al leer (ver `effectiveStatus` en lib/sobrantes.ts). Así no hace
 * falta cron y no queda drift si después se edita la fecha. El valor existe
 * en el enum porque la Etapa 2 va a necesitar congelarlo.
 */
export type LeftoverStatus =
  | "disponible"
  | "vencido"
  | "consumido"
  | "descartado";

export const LEFTOVER_STATUSES: { value: LeftoverStatus; label: string }[] = [
  { value: "disponible", label: "Disponible" },
  { value: "vencido", label: "Vencido" },
  { value: "consumido", label: "Consumido" },
  { value: "descartado", label: "Descartado" },
];

export type Leftover = {
  id: string;
  product_id: string;
  /** Evento del que sobró. null = carga manual. */
  origin_event_id: string | null;

  // CANTIDADES — siempre en `base_unit`, nunca en porcentaje.
  /** Lo que calculó el sistema al cerrar el evento. null si es carga manual. */
  qty_calculated: number | null;
  /**
   * Lo que confirmó el usuario AL REGISTRAR. Queda congelada: es el par de
   * `qty_calculated` para calibrar la merma (ver `calibrationByProduct`).
   */
  qty_confirmed: number;
  /** Stock actual. Es la que se edita y se consume. */
  qty_remaining: number;

  // SNAPSHOTS al registrar (datos irrecuperables si cambia el producto).
  base_unit: UnitKind;
  unit_content_value: number | null;
  unit_content_unit: ContentUnit | null;
  /** Total comprado en el evento origen, en base_unit. Habilita el "% del pack". */
  purchased_qty: number | null;
  /** $ por base_unit al registrar. Sin uso en Etapa 1; lo necesita la Etapa 2. */
  unit_cost: number | null;
  /** Merma del evento con la que se calculó `qty_calculated`. */
  merma_pct: number | null;
  /** Nombre del evento origen al registrar (sobrevive si se borra el evento). */
  origin_event_name: string | null;

  status: LeftoverStatus;
  registered_at: string;
  /** Calculada: fecha del evento + vida útil. null = sin vida útil definida. */
  expires_at: string | null;
  /** true = el usuario la sobrescribió a mano; no recalcular. */
  expiry_manual: boolean;

  note: string | null;
  created_at: string;
  updated_at: string;
};

/** Sobrante con producto y proveedor embebidos (join para el listado). */
export type LeftoverWithProduct = Leftover & {
  product:
    | (Pick<
        Product,
        | "id"
        | "name"
        | "base_unit"
        | "pack_size"
        | "sale_unit"
        | "unit_content_value"
        | "unit_content_unit"
        | "leftover_shelf_life_days"
      > & { provider: Pick<Provider, "id" | "name"> | null })
    | null;
};

export type LeftoverInput = {
  product_id: string;
  origin_event_id?: string | null;
  qty_calculated?: number | null;
  qty_confirmed: number;
  qty_remaining: number;
  base_unit: UnitKind;
  unit_content_value?: number | null;
  unit_content_unit?: ContentUnit | null;
  purchased_qty?: number | null;
  unit_cost?: number | null;
  merma_pct?: number | null;
  origin_event_name?: string | null;
  status?: LeftoverStatus;
  registered_at?: string;
  expires_at?: string | null;
  expiry_manual?: boolean;
  note?: string | null;
};
