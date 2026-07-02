import { createClient } from "@/lib/supabase/client";
import type {
  Provider,
  ProviderInput,
  Product,
  ProductInput,
  Ingredient,
  IngredientInput,
  IngredientWithProduct,
  Recipe,
  RecipeInput,
  RecipeItemInput,
  RecipeListRow,
  RecipeWithItems,
  RecipeItemWithIngredient,
  ImportRecipePlan,
  EventRow,
  EventInput,
  EventRecipeRole,
  EventRecipeWithRecipe,
  BarSettings,
  BarSettingsInput,
  BarBeverage,
  BarBeverageInput,
  EventCost,
  EventCostInput,
  Staff,
  StaffInput,
  EventStaffInput,
  EventStaffWithStaff,
  EventStaffWithEvent,
  TablewareProvider,
  TablewareProviderInput,
  TablewareItem,
  TablewareItemWithProvider,
  TablewareItemInput,
  EventTableware,
  EventTablewareWithItem,
  EventTablewareInput,
} from "@/lib/types";

const db = () => createClient();

function check<T>(data: T | null, error: { message: string } | null): T {
  if (error) throw new Error(error.message);
  return data as T;
}

// ----------------------------- Proveedores -----------------------------

export async function listProviders(): Promise<Provider[]> {
  const { data, error } = await db()
    .from("providers")
    .select("*")
    .order("name");
  return check(data, error);
}

export async function createProvider(input: ProviderInput): Promise<Provider> {
  const { data, error } = await db()
    .from("providers")
    .insert(input)
    .select()
    .single();
  return check(data, error);
}

export async function updateProvider(
  id: string,
  input: ProviderInput,
): Promise<Provider> {
  const { data, error } = await db()
    .from("providers")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  return check(data, error);
}

export async function deleteProvider(id: string): Promise<void> {
  const { error } = await db().from("providers").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ------------------------------ Productos ------------------------------

export async function listProducts(providerId?: string): Promise<Product[]> {
  let q = db().from("products").select("*").order("name");
  if (providerId) q = q.eq("provider_id", providerId);
  const { data, error } = await q;
  return check(data, error);
}

export async function createProduct(input: ProductInput): Promise<Product> {
  const { data, error } = await db()
    .from("products")
    .insert(input)
    .select()
    .single();
  return check(data, error);
}

export async function updateProduct(
  id: string,
  input: Partial<ProductInput>,
): Promise<Product> {
  const { data, error } = await db()
    .from("products")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  return check(data, error);
}

export async function deleteProduct(id: string): Promise<void> {
  const { error } = await db().from("products").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Inserta muchos productos de una (import de lista de precios). */
export async function bulkInsertProducts(
  rows: ProductInput[],
): Promise<number> {
  if (rows.length === 0) return 0;
  const { error, count } = await db()
    .from("products")
    .insert(rows, { count: "exact" });
  if (error) throw new Error(error.message);
  return count ?? rows.length;
}

export type UpsertResult = {
  inserted: number;
  updated: number;
  priceChanges: Array<{ name: string; oldPrice: number; newPrice: number }>;
};

function normalizeName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Upsert de lista de precios: detecta productos existentes del proveedor por código
 * (si lo hay) o por nombre normalizado, los actualiza con los nuevos datos, e inserta
 * los que no tienen coincidencia. Preserva IDs y vínculos con recetas.
 */
export async function bulkUpsertProducts(
  providerId: string,
  rows: ProductInput[],
): Promise<UpsertResult> {
  if (rows.length === 0) return { inserted: 0, updated: 0, priceChanges: [] };

  const { data: existing, error } = await db()
    .from("products")
    .select("id, code, name, price")
    .eq("provider_id", providerId);
  if (error) throw new Error(error.message);

  type ExistingRow = { id: string; code: string | null; name: string; price: number };
  const byCode = new Map<string, ExistingRow>();
  const byName = new Map<string, ExistingRow>();
  for (const p of (existing ?? []) as ExistingRow[]) {
    if (p.code) byCode.set(p.code.trim(), p);
    byName.set(normalizeName(p.name), p);
  }

  const toInsert: ProductInput[] = [];
  type UpdateEntry = { id: string; input: Partial<ProductInput>; oldPrice: number; name: string };
  const toUpdate: UpdateEntry[] = [];

  for (const row of rows) {
    let match: ExistingRow | undefined;
    if (row.code) match = byCode.get(row.code.trim());
    if (!match) match = byName.get(normalizeName(row.name));

    if (match) {
      toUpdate.push({
        id: match.id,
        oldPrice: match.price,
        name: match.name,
        input: {
          price: row.price,
          base_unit: row.base_unit,
          pack_size: row.pack_size,
          sale_unit: row.sale_unit ?? null,
          price_includes_iva: row.price_includes_iva ?? false,
          unit_content_value: row.unit_content_value ?? null,
          unit_content_unit: row.unit_content_unit ?? null,
          ...(row.code != null ? { code: row.code } : {}),
        },
      });
    } else {
      toInsert.push(row);
    }
  }

  if (toInsert.length > 0) {
    const { error: insertErr } = await db().from("products").insert(toInsert);
    if (insertErr) throw new Error(insertErr.message);
  }

  const priceChanges: UpsertResult["priceChanges"] = [];
  for (const u of toUpdate) {
    const { error: updateErr } = await db()
      .from("products")
      .update(u.input)
      .eq("id", u.id);
    if (updateErr) throw new Error(updateErr.message);
    if (u.input.price !== u.oldPrice) {
      priceChanges.push({ name: u.name, oldPrice: u.oldPrice, newPrice: u.input.price! });
    }
  }

  return { inserted: toInsert.length, updated: toUpdate.length, priceChanges };
}

// ----------------------------- Ingredientes -----------------------------

const INGREDIENT_SELECT =
  "*, product:products(*, provider:providers(id, name, phone))";

export async function listIngredients(): Promise<IngredientWithProduct[]> {
  const { data, error } = await db()
    .from("ingredients")
    .select(INGREDIENT_SELECT)
    .order("name");
  return check(data, error) as unknown as IngredientWithProduct[];
}

export async function createIngredient(
  input: IngredientInput,
): Promise<Ingredient> {
  const { data, error } = await db()
    .from("ingredients")
    .insert(input)
    .select()
    .single();
  return check(data, error);
}

export async function updateIngredient(
  id: string,
  input: Partial<IngredientInput>,
): Promise<Ingredient> {
  const { data, error } = await db()
    .from("ingredients")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  return check(data, error);
}

export async function deleteIngredient(id: string): Promise<void> {
  const { error } = await db().from("ingredients").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Vincula (o desvincula con null) un ingrediente a un producto de proveedor. */
export async function linkIngredientProduct(
  ingredientId: string,
  productId: string | null,
): Promise<void> {
  const { error } = await db()
    .from("ingredients")
    .update({ product_id: productId })
    .eq("id", ingredientId);
  if (error) throw new Error(error.message);
}

// ------------------------------- Recetas -------------------------------

const RECIPE_ITEMS_SELECT =
  "*, ingredient:ingredients(*, product:products(*, provider:providers(id, name, phone)))";

export async function listRecipes(): Promise<RecipeListRow[]> {
  const { data, error } = await db()
    .from("recipes")
    .select("*, recipe_items(count)")
    .order("name");
  if (error) throw new Error(error.message);
  type Row = Recipe & { recipe_items: { count: number }[] };
  return (data as Row[]).map(({ recipe_items, ...r }) => ({
    ...r,
    item_count: recipe_items?.[0]?.count ?? 0,
  }));
}

export async function getRecipe(id: string): Promise<RecipeWithItems> {
  const { data, error } = await db()
    .from("recipes")
    .select(`*, items:recipe_items(${RECIPE_ITEMS_SELECT})`)
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  const recipe = data as unknown as RecipeWithItems;
  recipe.items = [...(recipe.items ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order,
  );
  return recipe;
}

export async function createRecipe(input: RecipeInput): Promise<Recipe> {
  const { data, error } = await db()
    .from("recipes")
    .insert(input)
    .select()
    .single();
  return check(data, error);
}

export async function updateRecipe(
  id: string,
  input: Partial<RecipeInput>,
): Promise<Recipe> {
  const { data, error } = await db()
    .from("recipes")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  return check(data, error);
}

export async function deleteRecipe(id: string): Promise<void> {
  const { error } = await db().from("recipes").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Reemplaza todos los ítems de una receta (borra los previos e inserta los nuevos). */
export async function saveRecipeItems(
  recipeId: string,
  items: RecipeItemInput[],
): Promise<void> {
  const del = await db().from("recipe_items").delete().eq("recipe_id", recipeId);
  if (del.error) throw new Error(del.error.message);
  if (items.length === 0) return;
  const rows = items.map((it) => ({ ...it, recipe_id: recipeId }));
  const { error } = await db().from("recipe_items").insert(rows);
  if (error) throw new Error(error.message);
}

/**
 * Importación masiva de recetas: crea cada receta con sus ítems, dando de alta
 * los ingredientes faltantes (create_name) una sola vez aunque se repitan.
 */
export async function importRecipes(
  plans: ImportRecipePlan[],
): Promise<{ recipes: number; ingredients: number }> {
  const createdByName = new Map<string, string>();
  let ingredients = 0;

  for (const plan of plans) {
    const recipe = await createRecipe({
      name: plan.name,
      category: plan.category,
      subcategory: plan.subcategory,
      is_veggie: plan.is_veggie,
      yield_units: plan.yield_units,
    });

    const items: RecipeItemInput[] = [];
    let order = 0;
    for (const it of plan.items) {
      let id = it.ingredient_id;
      if (!id && it.create_name) {
        const key = it.create_name.toLowerCase();
        id = createdByName.get(key) ?? null;
        if (!id) {
          const ing = await createIngredient({
            name: it.create_name,
            base_unit: it.unit,
          });
          id = ing.id;
          createdByName.set(key, id);
          ingredients++;
        }
      }
      if (id)
        items.push({
          ingredient_id: id,
          quantity: it.quantity,
          unit: it.unit,
          sort_order: order++,
        });
    }
    await saveRecipeItems(recipe.id, items);
  }

  return { recipes: plans.length, ingredients };
}

// Re-export para uso en componentes que arman ítems en memoria.
export type { RecipeItemWithIngredient };

// ------------------------------- Eventos -------------------------------

export async function listEvents(): Promise<EventRow[]> {
  const { data, error } = await db()
    .from("events")
    .select("*")
    .order("event_date", { ascending: true, nullsFirst: false });
  return check(data, error);
}

export async function getEvent(id: string): Promise<EventRow> {
  const { data, error } = await db()
    .from("events")
    .select("*")
    .eq("id", id)
    .single();
  return check(data, error);
}

export async function createEvent(input: EventInput): Promise<EventRow> {
  const { data, error } = await db()
    .from("events")
    .insert(input)
    .select()
    .single();
  return check(data, error);
}

export async function updateEvent(
  id: string,
  input: Partial<EventInput>,
): Promise<EventRow> {
  const { data, error } = await db()
    .from("events")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  return check(data, error);
}

export async function deleteEvent(id: string): Promise<void> {
  const { error } = await db().from("events").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function listEventRecipes(
  eventId: string,
): Promise<EventRecipeWithRecipe[]> {
  const { data, error } = await db()
    .from("event_recipes")
    .select(
      `*, recipe:recipes(*, items:recipe_items(${RECIPE_ITEMS_SELECT}))`,
    )
    .eq("event_id", eventId);
  if (error) throw new Error(error.message);
  const rows = (data as unknown as EventRecipeWithRecipe[]) ?? [];
  for (const r of rows) {
    if (r.recipe?.items) {
      r.recipe.items = [...r.recipe.items].sort(
        (a, b) => a.sort_order - b.sort_order,
      );
    }
  }
  return rows;
}

export async function addEventRecipe(
  eventId: string,
  recipeId: string,
  role: EventRecipeRole,
): Promise<void> {
  const { error } = await db()
    .from("event_recipes")
    .insert({ event_id: eventId, recipe_id: recipeId, role });
  if (error) throw new Error(error.message);
}

export async function removeEventRecipe(id: string): Promise<void> {
  const { error } = await db().from("event_recipes").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// -------------------------------- Barra --------------------------------

export async function getBarSettings(): Promise<BarSettings> {
  const { data, error } = await db()
    .from("bar_settings")
    .select("*")
    .eq("id", true)
    .single();
  return check(data, error);
}

export async function updateBarSettings(
  input: BarSettingsInput,
): Promise<BarSettings> {
  const { data, error } = await db()
    .from("bar_settings")
    .update(input)
    .eq("id", true)
    .select()
    .single();
  return check(data, error);
}

export async function listBarBeverages(): Promise<BarBeverage[]> {
  const { data, error } = await db()
    .from("bar_beverages")
    .select("*")
    .order("sort_order")
    .order("name");
  return check(data, error);
}

export async function createBarBeverage(
  input: BarBeverageInput,
): Promise<BarBeverage> {
  const { data, error } = await db()
    .from("bar_beverages")
    .insert(input)
    .select()
    .single();
  return check(data, error);
}

export async function updateBarBeverage(
  id: string,
  input: Partial<BarBeverageInput>,
): Promise<BarBeverage> {
  const { data, error } = await db()
    .from("bar_beverages")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  return check(data, error);
}

export async function deleteBarBeverage(id: string): Promise<void> {
  const { error } = await db().from("bar_beverages").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// -------------------------- Costos del evento --------------------------

export async function listEventCosts(eventId: string): Promise<EventCost[]> {
  const { data, error } = await db()
    .from("event_costs")
    .select("*")
    .eq("event_id", eventId)
    .order("sort_order")
    .order("created_at");
  return check(data, error);
}

export async function createEventCost(
  eventId: string,
  input: EventCostInput,
): Promise<EventCost> {
  const { data, error } = await db()
    .from("event_costs")
    .insert({ ...input, event_id: eventId })
    .select()
    .single();
  return check(data, error);
}

export async function updateEventCost(
  id: string,
  input: Partial<EventCostInput>,
): Promise<EventCost> {
  const { data, error } = await db()
    .from("event_costs")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  return check(data, error);
}

export async function deleteEventCost(id: string): Promise<void> {
  const { error } = await db().from("event_costs").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ------------------------------- Personal -------------------------------

export async function listStaff(): Promise<Staff[]> {
  const { data, error } = await db()
    .from("staff")
    .select("*")
    .order("full_name");
  return check(data, error);
}

export async function createStaff(input: StaffInput): Promise<Staff> {
  const { data, error } = await db()
    .from("staff")
    .insert(input)
    .select()
    .single();
  return check(data, error);
}

export async function updateStaff(
  id: string,
  input: Partial<StaffInput>,
): Promise<Staff> {
  const { data, error } = await db()
    .from("staff")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  return check(data, error);
}

// --------------------- Personal asignado al evento ---------------------

const EVENT_STAFF_SELECT = "*, staff:staff(*)";

export async function listEventStaff(
  eventId: string,
): Promise<EventStaffWithStaff[]> {
  const { data, error } = await db()
    .from("event_staff")
    .select(EVENT_STAFF_SELECT)
    .eq("event_id", eventId);
  if (error) throw new Error(error.message);
  return (data as unknown as EventStaffWithStaff[]) ?? [];
}

export async function addEventStaff(
  eventId: string,
  input: EventStaffInput,
): Promise<EventStaffWithStaff> {
  const { data, error } = await db()
    .from("event_staff")
    .insert({ ...input, event_id: eventId })
    .select(EVENT_STAFF_SELECT)
    .single();
  return check(data, error) as unknown as EventStaffWithStaff;
}

export async function updateEventStaff(
  id: string,
  input: Partial<EventStaffInput>,
): Promise<void> {
  const { error } = await db().from("event_staff").update(input).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function removeEventStaff(id: string): Promise<void> {
  const { error } = await db().from("event_staff").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Todas las participaciones en eventos (con empleado y evento) para la vista de Pagos. */
export async function listStaffPayments(): Promise<EventStaffWithEvent[]> {
  const { data, error } = await db()
    .from("event_staff")
    .select("*, staff:staff(*), event:events(id, name, event_date)");
  if (error) throw new Error(error.message);
  return (data as unknown as EventStaffWithEvent[]) ?? [];
}

// --------------------------- Vajilla ----------------------------

export async function listTablewareProviders(): Promise<TablewareProvider[]> {
  const { data, error } = await db()
    .from("tableware_providers")
    .select("*")
    .order("name");
  return check(data, error);
}

export async function createTablewareProvider(
  input: TablewareProviderInput,
): Promise<TablewareProvider> {
  const { data, error } = await db()
    .from("tableware_providers")
    .insert(input)
    .select()
    .single();
  return check(data, error);
}

export async function updateTablewareProvider(
  id: string,
  input: TablewareProviderInput,
): Promise<TablewareProvider> {
  const { data, error } = await db()
    .from("tableware_providers")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  return check(data, error);
}

export async function deleteTablewareProvider(id: string): Promise<void> {
  const { error } = await db().from("tableware_providers").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

const TABLEWARE_ITEM_SELECT =
  "*, provider:tableware_providers(id, name, phone)";

export async function listTablewareItems(
  providerId?: string,
): Promise<TablewareItem[]> {
  let q = db().from("tableware_items").select("*").order("name");
  if (providerId) q = q.eq("provider_id", providerId);
  const { data, error } = await q;
  return check(data, error);
}

export async function listTablewareItemsWithProvider(): Promise<
  TablewareItemWithProvider[]
> {
  const { data, error } = await db()
    .from("tableware_items")
    .select(TABLEWARE_ITEM_SELECT)
    .order("name");
  return check(data, error) as unknown as TablewareItemWithProvider[];
}

export async function createTablewareItem(
  input: TablewareItemInput,
): Promise<TablewareItem> {
  const { data, error } = await db()
    .from("tableware_items")
    .insert(input)
    .select()
    .single();
  return check(data, error);
}

export async function updateTablewareItem(
  id: string,
  input: Partial<TablewareItemInput>,
): Promise<TablewareItem> {
  const { data, error } = await db()
    .from("tableware_items")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  return check(data, error);
}

export async function deleteTablewareItem(id: string): Promise<void> {
  const { error } = await db().from("tableware_items").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export type TablewareUpsertResult = {
  inserted: number;
  updated: number;
};

/** Upsert de catálogo: detecta ítems existentes del proveedor por nombre normalizado. */
export async function bulkUpsertTablewareItems(
  providerId: string,
  rows: TablewareItemInput[],
): Promise<TablewareUpsertResult> {
  if (rows.length === 0) return { inserted: 0, updated: 0 };

  const { data: existing, error } = await db()
    .from("tableware_items")
    .select("id, name")
    .eq("provider_id", providerId);
  if (error) throw new Error(error.message);

  type Existing = { id: string; name: string };
  const byName = new Map<string, Existing>();
  for (const p of (existing ?? []) as Existing[]) {
    byName.set(p.name.trim().toLowerCase().replace(/\s+/g, " "), p);
  }

  const toInsert: TablewareItemInput[] = [];
  const toUpdate: { id: string; input: Partial<TablewareItemInput> }[] = [];

  for (const row of rows) {
    const key = row.name.trim().toLowerCase().replace(/\s+/g, " ");
    const match = byName.get(key);
    if (match) {
      toUpdate.push({
        id: match.id,
        input: {
          unit_price: row.unit_price,
          category: row.category,
          cost_type: row.cost_type,
        },
      });
    } else {
      toInsert.push(row);
    }
  }

  if (toInsert.length > 0) {
    const { error: insertErr } = await db()
      .from("tableware_items")
      .insert(toInsert);
    if (insertErr) throw new Error(insertErr.message);
  }

  for (const u of toUpdate) {
    const { error: updateErr } = await db()
      .from("tableware_items")
      .update(u.input)
      .eq("id", u.id);
    if (updateErr) throw new Error(updateErr.message);
  }

  return { inserted: toInsert.length, updated: toUpdate.length };
}

// ------------------- Vajilla en el evento -------------------

const EVENT_TABLEWARE_SELECT =
  "*, item:tableware_items(*, provider:tableware_providers(id, name, phone))";

export async function listEventTableware(
  eventId: string,
): Promise<EventTablewareWithItem[]> {
  const { data, error } = await db()
    .from("event_tableware")
    .select(EVENT_TABLEWARE_SELECT)
    .eq("event_id", eventId)
    .order("created_at");
  if (error) throw new Error(error.message);
  return (data as unknown as EventTablewareWithItem[]) ?? [];
}

export async function addEventTableware(
  eventId: string,
  input: EventTablewareInput,
): Promise<EventTablewareWithItem> {
  const { data, error } = await db()
    .from("event_tableware")
    .insert({ ...input, event_id: eventId })
    .select(EVENT_TABLEWARE_SELECT)
    .single();
  return check(data, error) as unknown as EventTablewareWithItem;
}

export async function updateEventTableware(
  id: string,
  input: Partial<EventTablewareInput>,
): Promise<void> {
  const { error } = await db()
    .from("event_tableware")
    .update(input)
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function removeEventTableware(id: string): Promise<void> {
  const { error } = await db().from("event_tableware").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * Cantidad sugerida de vajilla para un ítem:
 * ceil(personas × multiplicador) + margen
 */
export function calcSuggestedQty(
  pax: number,
  multiplier: number,
  margin: number,
): number {
  return Math.ceil(pax * multiplier) + Math.round(margin);
}

/**
 * Recalcula las cantidades de los ítems de vajilla NO editados manualmente.
 * Retorna la cantidad de filas actualizadas.
 */
export async function recalcNonManualTableware(
  eventId: string,
  pax: number,
  globalMargin: number,
): Promise<number> {
  const { data, error } = await db()
    .from("event_tableware")
    .select("id, multiplier, margin_override")
    .eq("event_id", eventId)
    .eq("quantity_manual", false);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Array<{
    id: string;
    multiplier: number;
    margin_override: number | null;
  }>;

  for (const row of rows) {
    const margin = row.margin_override ?? globalMargin;
    const quantity = calcSuggestedQty(pax, row.multiplier, margin);
    const { error: upErr } = await db()
      .from("event_tableware")
      .update({ quantity })
      .eq("id", row.id);
    if (upErr) throw new Error(upErr.message);
  }

  return rows.length;
}

/** Calcula el costo de vajilla para un evento dado su listado de ítems. */
export function computeVajillaTotal(items: EventTablewareWithItem[]): number {
  return items.reduce((sum, e) => {
    if (!e.item) return sum;
    if (e.item.cost_type === "alquiler") {
      return sum + (e.quantity + e.breakage_qty) * e.item.unit_price;
    }
    // compra: solo se carga si el usuario lo habilitó para este evento
    return sum + (e.charge_purchase ? e.quantity * e.item.unit_price : 0);
  }, 0);
}

/** Genera el mensaje de pedido de vajilla para el proveedor. */
export function buildVajillaOrderMessage(
  providerName: string,
  eventName: string,
  items: EventTablewareWithItem[],
): string {
  const lines = items.map((e) => {
    const qty = e.quantity + (e.item?.cost_type === "alquiler" ? e.breakage_qty : 0);
    return `• ${e.item?.name ?? "—"}: ${qty} un.`;
  });
  return [
    `Pedido de vajilla — ${eventName}`,
    `Proveedor: ${providerName}`,
    "",
    ...lines,
  ].join("\n");
}
