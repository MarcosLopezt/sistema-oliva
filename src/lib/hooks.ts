"use client";

import { useEffect, useRef, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import * as q from "@/lib/queries";
import {
  fetchMarketPrice,
  isStaleAuto,
  isStaleAutoBeverage,
} from "@/lib/market-price";
import type { IngredientWithProduct, BarBeverage } from "@/lib/types";
import type {
  ProviderInput,
  ProductInput,
  IngredientInput,
  RecipeInput,
  RecipeItemInput,
  ImportRecipePlan,
  EventInput,
  EventRecipeRole,
  BarSettingsInput,
  BarBeverageInput,
  EventCostInput,
  StaffInput,
  EventStaffInput,
} from "@/lib/types";

export const keys = {
  providers: ["providers"] as const,
  products: (providerId?: string) =>
    providerId ? (["products", providerId] as const) : (["products"] as const),
  allProducts: ["products"] as const,
  ingredients: ["ingredients"] as const,
  recipes: ["recipes"] as const,
  recipe: (id: string) => ["recipes", id] as const,
  events: ["events"] as const,
  event: (id: string) => ["events", id] as const,
  eventRecipes: (id: string) => ["events", id, "recipes"] as const,
  barSettings: ["bar_settings"] as const,
  barBeverages: ["bar_beverages"] as const,
  eventCosts: (id: string) => ["events", id, "costs"] as const,
  staff: ["staff"] as const,
  eventStaff: (id: string) => ["events", id, "staff"] as const,
  staffPayments: ["staff", "payments"] as const,
};

// ----------------------------- Proveedores -----------------------------

export function useProviders() {
  return useQuery({ queryKey: keys.providers, queryFn: q.listProviders });
}

export function useCreateProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ProviderInput) => q.createProvider(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.providers }),
  });
}

export function useUpdateProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ProviderInput }) =>
      q.updateProvider(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.providers }),
  });
}

export function useDeleteProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => q.deleteProvider(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.providers });
      qc.invalidateQueries({ queryKey: keys.allProducts });
    },
  });
}

// ------------------------------ Productos ------------------------------

export function useProducts(providerId?: string) {
  return useQuery({
    queryKey: keys.products(providerId),
    queryFn: () => q.listProducts(providerId),
  });
}

export function useAllProducts() {
  return useQuery({
    queryKey: keys.allProducts,
    queryFn: () => q.listProducts(),
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ProductInput) => q.createProduct(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<ProductInput> }) =>
      q.updateProduct(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => q.deleteProduct(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });
}

export function useBulkInsertProducts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rows: ProductInput[]) => q.bulkInsertProducts(rows),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });
}

// ----------------------------- Ingredientes -----------------------------

export function useIngredients() {
  return useQuery({ queryKey: keys.ingredients, queryFn: q.listIngredients });
}

export function useCreateIngredient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: IngredientInput) => q.createIngredient(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.ingredients }),
  });
}

export function useUpdateIngredient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: Partial<IngredientInput>;
    }) => q.updateIngredient(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.ingredients }),
  });
}

export function useDeleteIngredient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => q.deleteIngredient(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.ingredients }),
  });
}

export function useLinkIngredientProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      ingredientId,
      productId,
    }: {
      ingredientId: string;
      productId: string | null;
    }) => q.linkIngredientProduct(ingredientId, productId),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.ingredients }),
  });
}

// ------------------------------- Recetas -------------------------------

export function useRecipes() {
  return useQuery({ queryKey: keys.recipes, queryFn: q.listRecipes });
}

export function useRecipe(id: string | undefined) {
  return useQuery({
    queryKey: keys.recipe(id ?? ""),
    queryFn: () => q.getRecipe(id!),
    enabled: !!id,
  });
}

export function useCreateRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RecipeInput) => q.createRecipe(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.recipes }),
  });
}

export function useUpdateRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<RecipeInput> }) =>
      q.updateRecipe(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.recipes }),
  });
}

export function useDeleteRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => q.deleteRecipe(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.recipes }),
  });
}

export function useImportRecipes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (plans: ImportRecipePlan[]) => q.importRecipes(plans),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.recipes });
      qc.invalidateQueries({ queryKey: keys.ingredients });
    },
  });
}

export function useSaveRecipeItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      recipeId,
      items,
    }: {
      recipeId: string;
      items: RecipeItemInput[];
    }) => q.saveRecipeItems(recipeId, items),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: keys.recipe(vars.recipeId) });
      qc.invalidateQueries({ queryKey: keys.recipes });
    },
  });
}

// ------------------------------- Eventos -------------------------------

export function useEvents() {
  return useQuery({ queryKey: keys.events, queryFn: q.listEvents });
}

export function useEvent(id: string | undefined) {
  return useQuery({
    queryKey: keys.event(id ?? ""),
    queryFn: () => q.getEvent(id!),
    enabled: !!id,
  });
}

export function useCreateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: EventInput) => q.createEvent(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.events }),
  });
}

export function useUpdateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<EventInput> }) =>
      q.updateEvent(id, input),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: keys.events });
      qc.invalidateQueries({ queryKey: keys.event(vars.id) });
    },
  });
}

export function useDeleteEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => q.deleteEvent(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.events }),
  });
}

export function useEventRecipes(eventId: string | undefined) {
  return useQuery({
    queryKey: keys.eventRecipes(eventId ?? ""),
    queryFn: () => q.listEventRecipes(eventId!),
    enabled: !!eventId,
  });
}

export function useAddEventRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      eventId,
      recipeId,
      role,
    }: {
      eventId: string;
      recipeId: string;
      role: EventRecipeRole;
    }) => q.addEventRecipe(eventId, recipeId, role),
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: keys.eventRecipes(vars.eventId) }),
  });
}

export function useRemoveEventRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; eventId: string }) =>
      q.removeEventRecipe(id),
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: keys.eventRecipes(vars.eventId) }),
  });
}

// -------------------------------- Barra --------------------------------

export function useBarSettings() {
  return useQuery({ queryKey: keys.barSettings, queryFn: q.getBarSettings });
}

export function useUpdateBarSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: BarSettingsInput) => q.updateBarSettings(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.barSettings }),
  });
}

export function useBarBeverages() {
  return useQuery({ queryKey: keys.barBeverages, queryFn: q.listBarBeverages });
}

export function useCreateBarBeverage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: BarBeverageInput) => q.createBarBeverage(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.barBeverages }),
  });
}

export function useUpdateBarBeverage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: Partial<BarBeverageInput>;
    }) => q.updateBarBeverage(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.barBeverages }),
  });
}

export function useDeleteBarBeverage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => q.deleteBarBeverage(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.barBeverages }),
  });
}

// -------------------------- Costos del evento --------------------------

export function useEventCosts(eventId: string | undefined) {
  return useQuery({
    queryKey: keys.eventCosts(eventId ?? ""),
    queryFn: () => q.listEventCosts(eventId!),
    enabled: !!eventId,
  });
}

export function useCreateEventCost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      eventId,
      input,
    }: {
      eventId: string;
      input: EventCostInput;
    }) => q.createEventCost(eventId, input),
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: keys.eventCosts(vars.eventId) }),
  });
}

export function useUpdateEventCost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      eventId: string;
      input: Partial<EventCostInput>;
    }) => q.updateEventCost(id, input),
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: keys.eventCosts(vars.eventId) }),
  });
}

export function useDeleteEventCost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; eventId: string }) =>
      q.deleteEventCost(id),
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: keys.eventCosts(vars.eventId) }),
  });
}

// ------------------------------- Personal -------------------------------

export function useStaff() {
  return useQuery({ queryKey: keys.staff, queryFn: q.listStaff });
}

export function useCreateStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: StaffInput) => q.createStaff(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.staff }),
  });
}

export function useUpdateStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<StaffInput> }) =>
      q.updateStaff(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.staff });
      qc.invalidateQueries({ queryKey: keys.staffPayments });
    },
  });
}

export function useEventStaff(eventId: string | undefined) {
  return useQuery({
    queryKey: keys.eventStaff(eventId ?? ""),
    queryFn: () => q.listEventStaff(eventId!),
    enabled: !!eventId,
  });
}

function invalidateStaffViews(qc: ReturnType<typeof useQueryClient>, eventId: string) {
  qc.invalidateQueries({ queryKey: keys.eventStaff(eventId) });
  qc.invalidateQueries({ queryKey: keys.staffPayments });
  qc.invalidateQueries({ queryKey: keys.event(eventId) });
}

export function useAddEventStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ eventId, input }: { eventId: string; input: EventStaffInput }) =>
      q.addEventStaff(eventId, input),
    onSuccess: (_d, vars) => invalidateStaffViews(qc, vars.eventId),
  });
}

export function useUpdateEventStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      eventId: string;
      input: Partial<EventStaffInput>;
    }) => q.updateEventStaff(id, input),
    onSuccess: (_d, vars) => invalidateStaffViews(qc, vars.eventId),
  });
}

export function useRemoveEventStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; eventId: string }) =>
      q.removeEventStaff(id),
    onSuccess: (_d, vars) => invalidateStaffViews(qc, vars.eventId),
  });
}

export function useStaffPayments() {
  return useQuery({
    queryKey: keys.staffPayments,
    queryFn: q.listStaffPayments,
  });
}

// ----------------------- Precio de mercado (auto) -----------------------

/**
 * Busca en background el precio de mercado de los ingredientes "sin proveedor
 * fijo" (market_auto) que estén vencidos, y los actualiza. No bloquea la carga
 * del evento. Devuelve el set de ids cuya búsqueda falló (para avisar al usuario).
 */
export function useMarketPriceUpdater(
  eventId: string,
  ingredients: IngredientWithProduct[],
): Set<string> {
  const qc = useQueryClient();
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const attempted = useRef<Set<string>>(new Set());

  useEffect(() => {
    const stale = ingredients.filter(isStaleAuto);
    if (stale.length === 0) return;
    let cancelled = false;

    (async () => {
      let changed = false;
      for (const ing of stale) {
        if (attempted.current.has(ing.id)) continue;
        attempted.current.add(ing.id);

        const price = await fetchMarketPrice(ing.name, { unit: ing.base_unit });
        if (cancelled) return;
        if (price == null) {
          setFailed((s) => new Set(s).add(ing.id));
          continue;
        }
        try {
          await q.updateIngredient(ing.id, {
            market_price: price,
            market_price_updated_at: new Date().toISOString(),
            market_price_source: "auto",
          });
          changed = true;
        } catch {
          if (!cancelled) setFailed((s) => new Set(s).add(ing.id));
        }
      }
      if (changed && !cancelled) {
        qc.invalidateQueries({ queryKey: keys.ingredients });
        qc.invalidateQueries({ queryKey: keys.eventRecipes(eventId) });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ingredients, eventId, qc]);

  return failed;
}

/**
 * Igual que useMarketPriceUpdater pero para las bebidas de la barra: busca en
 * background el precio de las bebidas con market_auto vencidas y actualiza su
 * columna `price`. Devuelve el set de ids cuya búsqueda falló.
 */
export function useBeverageMarketPriceUpdater(
  beverages: BarBeverage[],
): Set<string> {
  const qc = useQueryClient();
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const attempted = useRef<Set<string>>(new Set());

  useEffect(() => {
    const stale = beverages.filter(isStaleAutoBeverage);
    if (stale.length === 0) return;
    let cancelled = false;

    (async () => {
      let changed = false;
      for (const bev of stale) {
        if (attempted.current.has(bev.id)) continue;
        attempted.current.add(bev.id);

        const price = await fetchMarketPrice(bev.name, { sizeMl: bev.size_ml });
        if (cancelled) return;
        if (price == null) {
          setFailed((s) => new Set(s).add(bev.id));
          continue;
        }
        try {
          await q.updateBarBeverage(bev.id, {
            price,
            market_price_updated_at: new Date().toISOString(),
            market_price_source: "auto",
          });
          changed = true;
        } catch {
          if (!cancelled) setFailed((s) => new Set(s).add(bev.id));
        }
      }
      if (changed && !cancelled) {
        qc.invalidateQueries({ queryKey: keys.barBeverages });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [beverages, qc]);

  return failed;
}
