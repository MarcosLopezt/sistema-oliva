"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import * as q from "@/lib/queries";
import type {
  ProviderInput,
  ProductInput,
  IngredientInput,
} from "@/lib/types";

export const keys = {
  providers: ["providers"] as const,
  products: (providerId?: string) =>
    providerId ? (["products", providerId] as const) : (["products"] as const),
  allProducts: ["products"] as const,
  ingredients: ["ingredients"] as const,
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
