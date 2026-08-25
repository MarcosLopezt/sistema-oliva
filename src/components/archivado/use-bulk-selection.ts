"use client";

import { useCallback, useMemo, useState } from "react";

/**
 * Selección múltiple sobre una lista FILTRADA.
 *
 * El parámetro es la lista que el usuario está viendo, no el catálogo entero.
 * De ahí sale la propiedad que pediste sin esfuerzo: "seleccionar todos"
 * selecciona lo visible, así que con un filtro por proveedor activo toma solo
 * los de ese proveedor.
 *
 * La selección se guarda como ids y se PODA contra lo visible en cada render.
 * Es lo que evita el bug clásico: seleccionar 5, cambiar el filtro, y archivar
 * elementos que ya no están en pantalla.
 */
export function useBulkSelection<T extends { id: string }>(visible: T[]) {
  const [raw, setRaw] = useState<Set<string>>(new Set());

  const visibleIds = useMemo(() => new Set(visible.map((r) => r.id)), [visible]);

  /** Los seleccionados que además siguen visibles. Es la selección "real". */
  const selected = useMemo(
    () => visible.filter((r) => raw.has(r.id)),
    [visible, raw],
  );

  const selectedIds = useMemo(() => selected.map((r) => r.id), [selected]);

  const toggle = useCallback((id: string) => {
    setRaw((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  /** Selecciona o deselecciona TODO lo visible, respetando los filtros. */
  const toggleAll = useCallback(() => {
    setRaw((prev) => {
      const allSelected = visible.length > 0 && visible.every((r) => prev.has(r.id));
      if (allSelected) {
        // Deselecciona solo lo visible: si había algo seleccionado fuera del
        // filtro actual, no se toca.
        const next = new Set(prev);
        for (const r of visible) next.delete(r.id);
        return next;
      }
      const next = new Set(prev);
      for (const r of visible) next.add(r.id);
      return next;
    });
  }, [visible]);

  const clear = useCallback(() => setRaw(new Set()), []);

  const isSelected = useCallback((id: string) => raw.has(id), [raw]);

  const allVisibleSelected =
    visible.length > 0 && visible.every((r) => visibleIds.has(r.id) && raw.has(r.id));

  const someVisibleSelected = selected.length > 0 && !allVisibleSelected;

  return {
    selected,
    selectedIds,
    count: selected.length,
    isSelected,
    toggle,
    toggleAll,
    clear,
    allVisibleSelected,
    someVisibleSelected,
  };
}

export type BulkSelection<T extends { id: string }> = ReturnType<
  typeof useBulkSelection<T>
>;
