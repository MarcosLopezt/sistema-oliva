import { createClient } from "@/lib/supabase/client";
import type {
  Provider,
  ProviderInput,
  Product,
  ProductInput,
  Ingredient,
  IngredientInput,
  IngredientWithProduct,
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
