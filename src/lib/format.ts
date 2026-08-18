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

/**
 * Contenido por unidad en formato legible. Se guarda normalizado a la unidad
 * chica (ml / g), pero mostrarlo así es poco natural para envases grandes:
 *   5000 ml → "5 L" · 700 ml → "700 ml" · 25000 g → "25 kg" · 354 g → "354 g"
 * Devuelve null si el producto no tiene contenido cargado.
 */
export function formatUnitContent(
  value: number | null | undefined,
  unit: UnitKind | null | undefined,
): string | null {
  if (value == null || !unit || value <= 0) return null;
  if (unit === "ml" && value >= 1000) return `${formatNum(value / 1000)} L`;
  if (unit === "g" && value >= 1000) return `${formatNum(value / 1000)} kg`;
  return `${formatNum(value)} ${unitLabel(unit)}`;
}

/** Fecha calendaria pura, sin hora ni zona: "2026-09-01". */
const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Parsea las dos formas de fecha que conviven en la base:
 *
 *  - Fecha calendaria "YYYY-MM-DD" (columnas `date`, ej `events.event_date`).
 *    `new Date("2026-09-01")` la interpreta como medianoche UTC, y en Argentina
 *    (UTC−3) eso cae el día ANTERIOR: se mostraría 31/08/2026. Por eso se
 *    construye con los componentes en horario local, sin pasar por UTC.
 *  - Timestamp con zona (columnas `timestamptz`, ej `products.updated_at`).
 *    Ese ya trae el offset, así que el parseo normal es el correcto.
 */
export function parseDate(iso: string): Date {
  const m = CALENDAR_DATE.exec(iso.trim());
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(iso);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = parseDate(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
