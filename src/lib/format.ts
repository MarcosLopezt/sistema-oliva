import type { UnitKind } from "@/lib/types";

const ars = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

export function formatARS(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return ars.format(value);
}

const num = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 3 });
export function formatNum(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return num.format(value);
}

/**
 * Precio por unidad base del producto (precio del pack / tamaño del pack).
 * Ej: bidón 5 L a $20.000 → $4.000 por litro.
 */
export function pricePerBaseUnit(
  price: number,
  packSize: number,
): number | null {
  if (!packSize || packSize <= 0) return null;
  return price / packSize;
}

export function unitLabel(u: UnitKind): string {
  return u === "l" ? "L" : u;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
