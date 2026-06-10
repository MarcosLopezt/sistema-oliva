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

// ----------------------------- Ingredientes -----------------------------

const INGREDIENT_SELECT =
  "*, product:products(*, provider:providers(id, name))";

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
  "*, ingredient:ingredients(*, product:products(*, provider:providers(id, name)))";

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
