"use client";

import { useEffect, useRef, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import * as q from "@/lib/queries";
import type { UpsertResult, TablewareUpsertResult } from "@/lib/queries";
import {
  fetchMarketPrice,
  isStaleAuto,
  isStaleAutoBeverage,
} from "@/lib/market-price";
import type {
  IngredientWithProduct,
  BarBeverage,
  TablewareItemWithProvider,
} from "@/lib/types";
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
  StaffRoleInput,
  EventStaffInput,
  TablewareProviderInput,
  TablewareItemInput,
  EventTablewareInput,
  LeftoverInput,
} from "@/lib/types";
import type { EventCostSnapshotData, SnapshotOrigin } from "@/lib/snapshot";
import { buildDependencyGraph, type ArchivableEntity } from "@/lib/archivado";

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
  staffRoles: ["staff_roles"] as const,
  eventStaff: (id: string) => ["events", id, "staff"] as const,
  staffPayments: ["staff", "payments"] as const,
  tablewareProviders: ["tableware_providers"] as const,
  tablewareItems: (providerId?: string) =>
    providerId
      ? (["tableware_items", providerId] as const)
      : (["tableware_items"] as const),
  allTablewareItems: ["tableware_items"] as const,
  eventTableware: (id: string) => ["events", id, "tableware"] as const,
  leftovers: ["leftovers"] as const,
  eventLeftovers: (id: string) => ["events", id, "leftovers"] as const,
  eventSnapshot: (id: string) => ["events", id, "snapshot"] as const,
  snapshottedEvents: ["event_cost_snapshots"] as const,
  archived: (entity: ArchivableEntity) => ["archived", entity] as const,
  referenceCounts: ["reference_counts"] as const,
  eventRecipeLinks: ["event_recipe_links"] as const,
  recipeIngredientLinks: ["recipe_ingredient_links"] as const,
  ingredientProductLinks: ["ingredient_product_links"] as const,
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

export function useBulkUpsertProducts() {
  const qc = useQueryClient();
  return useMutation<UpsertResult, Error, { providerId: string; rows: ProductInput[] }>({
    mutationFn: ({ providerId, rows }) => q.bulkUpsertProducts(providerId, rows),
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

// ---------------------------- Roles de personal ----------------------------

export function useStaffRoles() {
  return useQuery({ queryKey: keys.staffRoles, queryFn: q.listStaffRoles });
}

/**
 * Tocar un rol puede cambiar la tarifa heredada de cualquier empleado y de
 * cualquier evento, así que se invalidan también esas vistas.
 */
function invalidateRoleViews(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: keys.staffRoles });
  qc.invalidateQueries({ queryKey: keys.staff });
  qc.invalidateQueries({ queryKey: keys.events });
}

export function useCreateStaffRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: StaffRoleInput) => q.createStaffRole(input),
    onSuccess: () => invalidateRoleViews(qc),
  });
}

export function useUpdateStaffRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<StaffRoleInput> }) =>
      q.updateStaffRole(id, input),
    onSuccess: () => invalidateRoleViews(qc),
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
      // Cambiarle el rol o la tarifa mueve lo que se ve en cada evento.
      qc.invalidateQueries({ queryKey: keys.events });
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

/** Agrega varios empleados al evento en una sola operación. */
export function useAddEventStaffBulk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      eventId,
      inputs,
    }: {
      eventId: string;
      inputs: EventStaffInput[];
    }) => q.addEventStaffBulk(eventId, inputs),
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

/** Quita varias asignaciones del evento en una sola operación. */
export function useRemoveEventStaffBulk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids }: { ids: string[]; eventId: string }) =>
      q.removeEventStaffBulk(ids),
    onSuccess: (_d, vars) => invalidateStaffViews(qc, vars.eventId),
  });
}

export function useStaffPayments() {
  return useQuery({
    queryKey: keys.staffPayments,
    queryFn: q.listStaffPayments,
  });
}

// --------------------------- Vajilla ----------------------------

export function useTablewareProviders() {
  return useQuery({
    queryKey: keys.tablewareProviders,
    queryFn: q.listTablewareProviders,
  });
}

export function useCreateTablewareProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TablewareProviderInput) =>
      q.createTablewareProvider(input),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: keys.tablewareProviders }),
  });
}

export function useUpdateTablewareProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: TablewareProviderInput;
    }) => q.updateTablewareProvider(id, input),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: keys.tablewareProviders }),
  });
}

export function useDeleteTablewareProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => q.deleteTablewareProvider(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.tablewareProviders });
      qc.invalidateQueries({ queryKey: keys.allTablewareItems });
    },
  });
}

export function useTablewareItems(providerId?: string) {
  return useQuery({
    queryKey: keys.tablewareItems(providerId),
    queryFn: () => q.listTablewareItems(providerId),
  });
}

export function useAllTablewareItems() {
  return useQuery<TablewareItemWithProvider[]>({
    queryKey: keys.allTablewareItems,
    queryFn: q.listTablewareItemsWithProvider,
  });
}

export function useCreateTablewareItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TablewareItemInput) => q.createTablewareItem(input),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["tableware_items"] }),
  });
}

export function useUpdateTablewareItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: Partial<TablewareItemInput>;
    }) => q.updateTablewareItem(id, input),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["tableware_items"] }),
  });
}

export function useDeleteTablewareItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => q.deleteTablewareItem(id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["tableware_items"] }),
  });
}

export function useBulkUpsertTablewareItems() {
  const qc = useQueryClient();
  return useMutation<
    TablewareUpsertResult,
    Error,
    { providerId: string; rows: TablewareItemInput[] }
  >({
    mutationFn: ({ providerId, rows }) =>
      q.bulkUpsertTablewareItems(providerId, rows),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["tableware_items"] }),
  });
}

export function useEventTableware(eventId: string | undefined) {
  return useQuery({
    queryKey: keys.eventTableware(eventId ?? ""),
    queryFn: () => q.listEventTableware(eventId!),
    enabled: !!eventId,
  });
}

export function useAddEventTableware() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      eventId,
      input,
    }: {
      eventId: string;
      input: EventTablewareInput;
    }) => q.addEventTableware(eventId, input),
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: keys.eventTableware(vars.eventId) }),
  });
}

export function useUpdateEventTableware() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      eventId: string;
      input: Partial<EventTablewareInput>;
    }) => q.updateEventTableware(id, input),
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: keys.eventTableware(vars.eventId) }),
  });
}

export function useRemoveEventTableware() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; eventId: string }) =>
      q.removeEventTableware(id),
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: keys.eventTableware(vars.eventId) }),
  });
}

export function useRecalcNonManualTableware() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      eventId,
      pax,
      globalMargin,
    }: {
      eventId: string;
      pax: number;
      globalMargin: number;
    }) => q.recalcNonManualTableware(eventId, pax, globalMargin),
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: keys.eventTableware(vars.eventId) }),
  });
}

// ---------------------------- Sobrantes ----------------------------

export function useLeftovers() {
  return useQuery({ queryKey: keys.leftovers, queryFn: q.listLeftovers });
}

export function useEventLeftovers(eventId: string | undefined) {
  return useQuery({
    queryKey: keys.eventLeftovers(eventId ?? ""),
    queryFn: () => q.listEventLeftovers(eventId!),
    enabled: !!eventId,
  });
}

/** Invalida el listado global y, si el sobrante vino de un evento, el del evento. */
function invalidateLeftovers(
  qc: ReturnType<typeof useQueryClient>,
  eventId?: string | null,
) {
  qc.invalidateQueries({ queryKey: keys.leftovers });
  if (eventId) qc.invalidateQueries({ queryKey: keys.eventLeftovers(eventId) });
}

export function useCreateLeftover() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LeftoverInput) => q.createLeftover(input),
    onSuccess: (_d, input) => invalidateLeftovers(qc, input.origin_event_id),
  });
}

export function useCreateLeftovers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ rows }: { rows: LeftoverInput[]; eventId?: string }) =>
      q.createLeftovers(rows),
    onSuccess: (_d, vars) => invalidateLeftovers(qc, vars.eventId),
  });
}

export function useUpdateLeftover() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      eventId?: string | null;
      input: Partial<LeftoverInput>;
    }) => q.updateLeftover(id, input),
    onSuccess: (_d, vars) => invalidateLeftovers(qc, vars.eventId),
  });
}

export function useDeleteLeftover() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; eventId?: string | null }) =>
      q.deleteLeftover(id),
    onSuccess: (_d, vars) => invalidateLeftovers(qc, vars.eventId),
  });
}

// ----------------------- Precio de mercado (auto) -----------------------

/**
 * Busca en background el precio de mercado de los ingredientes "sin proveedor
 * fijo" (market_auto) que estén vencidos, y los actualiza. No bloquea la carga
 * del evento. Devuelve el set de ids cuya búsqueda falló (para avisar al usuario).
 *
 * `enabled` NO es opcional a propósito: este hook ESCRIBE en la base como
 * efecto de abrir una pantalla. Sobre un evento finalizado eso le cambiaba el
 * costo a un evento cerrado sin que nadie hiciera nada — mirarlo alcanzaba.
 * Que el parámetro sea obligatorio obliga a cada llamador a decidir.
 * Ver `isEventLive`.
 */
export function useMarketPriceUpdater(
  eventId: string,
  ingredients: IngredientWithProduct[],
  enabled: boolean,
): Set<string> {
  const qc = useQueryClient();
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const attempted = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled) return;
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
  }, [ingredients, eventId, enabled, qc]);

  return failed;
}

/**
 * Igual que useMarketPriceUpdater pero para las bebidas de la barra: busca en
 * background el precio de las bebidas con market_auto vencidas y actualiza su
 * columna `price`. Devuelve el set de ids cuya búsqueda falló.
 *
 * `enabled` es obligatorio por el mismo motivo, y acá el daño era MAYOR:
 * `bar_beverages` es un catálogo global sin tabla por evento, así que un
 * precio nuevo se aplica a la barra de TODOS los eventos, incluidos los
 * finalizados. Ver `isEventLive`.
 */
export function useBeverageMarketPriceUpdater(
  beverages: BarBeverage[],
  enabled: boolean,
): Set<string> {
  const qc = useQueryClient();
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const attempted = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled) return;
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
  }, [beverages, enabled, qc]);

  return failed;
}

// -------------------- Foto del costo de eventos cerrados --------------------

export function useEventCostSnapshot(eventId: string | undefined) {
  return useQuery({
    queryKey: keys.eventSnapshot(eventId ?? ""),
    queryFn: () => q.getEventCostSnapshot(eventId!),
    enabled: !!eventId,
  });
}

/** Ids de eventos que ya tienen foto. Lo usa la pantalla de backfill. */
export function useSnapshottedEventIds() {
  return useQuery({
    queryKey: keys.snapshottedEvents,
    queryFn: q.listSnapshottedEventIds,
  });
}

/**
 * Guarda la foto del costo. Un solo hook para los cuatro orígenes (finalizar,
 * re-finalizar, recalcular, backfill): lo único que cambia entre ellos es
 * `origin`, `reliable` y si además cierran el evento.
 */
export function useSaveEventCostSnapshot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      eventId: string;
      data: EventCostSnapshotData;
      origin: SnapshotOrigin;
      reliable?: boolean;
      finalize?: boolean;
    }) => q.saveEventCostSnapshot(params),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: keys.eventSnapshot(vars.eventId) });
      qc.invalidateQueries({ queryKey: keys.snapshottedEvents });
      // `finalize` cambia events.status del lado del servidor, así que la
      // fila del evento y el listado quedaron desactualizados acá.
      if (vars.finalize) {
        qc.invalidateQueries({ queryKey: keys.event(vars.eventId) });
        qc.invalidateQueries({ queryKey: keys.events });
      }
    },
  });
}

// --------------------------- Archivado (0020) ---------------------------

export function useArchivedIngredients() {
  return useQuery({
    queryKey: keys.archived("ingredients"),
    queryFn: q.listArchivedIngredients,
  });
}

export function useArchivedRecipes() {
  return useQuery({
    queryKey: keys.archived("recipes"),
    queryFn: q.listArchivedRecipes,
  });
}

export function useArchivedProducts(providerId?: string) {
  return useQuery({
    queryKey: [...keys.archived("products"), providerId ?? "all"],
    queryFn: () => q.listArchivedProducts(providerId),
  });
}

export function useArchivedBarBeverages() {
  return useQuery({
    queryKey: keys.archived("bar_beverages"),
    queryFn: q.listArchivedBarBeverages,
  });
}

export function useArchivedLeftovers() {
  return useQuery({
    queryKey: keys.archived("leftovers"),
    queryFn: q.listArchivedLeftovers,
  });
}

/** Conteos de referencias, para saber qué archivado se puede borrar de verdad. */
export function useReferenceCounts() {
  return useQuery({
    queryKey: keys.referenceCounts,
    queryFn: q.getReferenceCounts,
  });
}

/** El grafo de dependencias: qué evento ACTIVO usa qué. */
export function useDependencyGraph() {
  const events = useQuery({ queryKey: keys.events, queryFn: q.listEvents });
  const links = useQuery({
    queryKey: keys.eventRecipeLinks,
    queryFn: q.listEventRecipeLinks,
  });
  const recipes = useQuery({
    queryKey: keys.recipeIngredientLinks,
    queryFn: q.listRecipeIngredientLinks,
  });
  // Sin filtrar por activos: un ingrediente archivado puede seguir vinculado a
  // un producto y hay que poder decir que ese producto llega a un evento.
  const ingredients = useQuery({
    queryKey: keys.ingredientProductLinks,
    queryFn: q.listIngredientProductLinks,
  });

  const ready =
    !!events.data && !!links.data && !!recipes.data && !!ingredients.data;

  return {
    graph: ready
      ? buildDependencyGraph({
          events: events.data!,
          eventRecipes: links.data!,
          recipes: recipes.data!,
          ingredients: ingredients.data!,
        })
      : null,
    isLoading:
      events.isLoading ||
      links.isLoading ||
      recipes.isLoading ||
      ingredients.isLoading,
  };
}

/**
 * Todo lo que toca el estado de archivado invalida las mismas vistas: el
 * listado vigente, el de archivados y el grafo. Centralizarlo evita que un
 * archivado quede visible por haberse olvidado de invalidar una de las tres.
 */
function invalidateArchiveViews(
  qc: ReturnType<typeof useQueryClient>,
  entity: ArchivableEntity,
) {
  const live: Record<ArchivableEntity, readonly unknown[]> = {
    ingredients: keys.ingredients,
    recipes: keys.recipes,
    products: keys.allProducts,
    bar_beverages: keys.barBeverages,
    leftovers: keys.leftovers,
  };
  qc.invalidateQueries({ queryKey: live[entity] });
  qc.invalidateQueries({ queryKey: keys.archived(entity) });
  qc.invalidateQueries({ queryKey: keys.referenceCounts });
  if (entity === "recipes" || entity === "ingredients") {
    qc.invalidateQueries({ queryKey: keys.recipeIngredientLinks });
  }
}

/** Archiva o desarchiva en masa, en una sola operación atómica. */
export function useSetRowsActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      entity,
      ids,
      active,
    }: {
      entity: ArchivableEntity;
      ids: string[];
      active: boolean;
    }) => q.setRowsActive(entity, ids, active),
    onSuccess: (_d, vars) => invalidateArchiveViews(qc, vars.entity),
  });
}

/** Borra definitivamente archivados sin referencias. */
export function useDeleteArchivedRows() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      entity,
      ids,
    }: {
      entity: ArchivableEntity;
      ids: string[];
    }) => q.deleteArchivedRows(entity, ids),
    onSuccess: (_d, vars) => invalidateArchiveViews(qc, vars.entity),
  });
}
