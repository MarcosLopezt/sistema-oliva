import * as XLSX from "xlsx";
import type { UnitKind } from "@/lib/types";

export type SheetGrid = {
  sheetNames: string[];
  rows: (name: string) => string[][];
};

/** Lee un archivo Excel/CSV y devuelve sus hojas como matrices de celdas (texto). */
export async function readWorkbook(file: File): Promise<SheetGrid> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  return {
    sheetNames: wb.SheetNames,
    rows: (name: string) => {
      const ws = wb.Sheets[name];
      if (!ws) return [];
      const json = XLSX.utils.sheet_to_json<unknown[]>(ws, {
        header: 1,
        blankrows: false,
        defval: "",
      });
      return json.map((r) => r.map((c) => (c == null ? "" : String(c).trim())));
    },
  };
}

/** Intenta deducir la fila de encabezados: la que tiene más celdas de texto no vacías. */
export function guessHeaderRow(rows: string[][]): number {
  let best = 0;
  let bestScore = -1;
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const score = rows[i].filter(
      (c) => c && Number.isNaN(Number(c.replace(",", "."))),
    ).length;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

/** Convierte texto de unidad del proveedor a una unidad base, si se puede. */
export function parseUnit(text: string): UnitKind | null {
  const t = text.toLowerCase();
  if (/\bml\b|mililitro|cc\b/.test(t)) return "ml";
  if (/\b(l|lt|lts|litro)\b|x\s*\d+\s*l\b/.test(t)) return "l";
  if (/\bkg\b|kilo/.test(t)) return "kg";
  if (/\bgr?s?\b|gramo/.test(t)) return "g";
  if (/\b(un|ud|u|unidad|caja|bolsa|bols[oó]n|atado|docena|pieza)\b/.test(t))
    return "un";
  return null;
}

/** Parsea un precio en formato AR ("$ 1.234,56") o simple. */
export function parsePrice(text: string): number {
  if (!text) return NaN;
  const cleaned = text
    .replace(/[^0-9.,-]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "") // separador de miles
    .replace(",", ".");
  return Number(cleaned);
}

// ------------------- Mapeo de columnas de lista de precios -------------------

/** Campos que el importador de productos intenta detectar por encabezado. */
export type ProductField = "name" | "price" | "saleUnit" | "content" | "code";

/**
 * Sinónimos de encabezado por campo. Se evalúan sobre el texto del encabezado
 * normalizado (minúsculas, sin espacios de más). El orden de detección (ver
 * `autoMapProductColumns`) evita que "Cant. por unidad" se confunda con "Unidad".
 */
const HEADER_SYNONYMS: Record<ProductField, RegExp> = {
  name: /(producto|descrip|art[ií]culo|^item$|nombre|detalle)/,
  price: /(precio|costo|valor|importe)/,
  code: /(c[oó]digo|^cod\.?$|sku)/,
  content:
    /(cant\.?\s*(por|x)\s*unidad|cantidad\s*(por|x)\s*unidad|contenido|gramaje|peso\s*neto|^peso$|^pack$|^cant\.?$|^cantidad$)/,
  saleUnit:
    /(unidad\s*de\s*venta|presentaci[oó]n|^unidad(es)?$|^und\.?$|^u\.?\s*m\.?$|^medida$)/,
};

export type ProductColumnMap = Record<ProductField, number>;
export const NO_COLUMN = -1;

/**
 * Mapea encabezados → campos por NOMBRE (no por posición), con sinónimos.
 * Tolera mayúsculas/minúsculas y espacios de más. Una columna se asigna a un
 * solo campo; los campos se resuelven en orden de prioridad para evitar
 * colisiones (ej: "Cant. por unidad" gana sobre "Unidad").
 */
export function autoMapProductColumns(headers: string[]): ProductColumnMap {
  const norm = headers.map((h) => h.trim().toLowerCase());
  const used = new Set<number>();
  const find = (re: RegExp): number => {
    for (let i = 0; i < norm.length; i++) {
      if (used.has(i) || !norm[i]) continue;
      if (re.test(norm[i])) {
        used.add(i);
        return i;
      }
    }
    return NO_COLUMN;
  };
  // Orden importa: nombre, precio y código primero; luego contenido (más
  // específico) y por último unidad de venta.
  const order: ProductField[] = ["name", "price", "code", "content", "saleUnit"];
  const map = {} as ProductColumnMap;
  for (const field of order) map[field] = find(HEADER_SYNONYMS[field]);
  return map;
}

/**
 * Interpreta "cantidad por unidad" → unidad base + tamaño del pack, normalizando
 * a la unidad chica de cada dimensión (kg→g, L→ml) para que el costo por unidad
 * sea comparable. Ejemplos:
 *   "100 g"  → { baseUnit: "g",  packSize: 100 }
 *   "1 kg"   → { baseUnit: "g",  packSize: 1000 }
 *   "750 ml" → { baseUnit: "ml", packSize: 750 }
 *   "1 L"    → { baseUnit: "ml", packSize: 1000 }
 *   "6 un"   → { baseUnit: "un", packSize: 6 }
 * Devuelve null si no hay un número válido.
 */
export function parseContent(
  text: string,
): { baseUnit: UnitKind; packSize: number } | null {
  if (!text) return null;
  const numMatch = text.match(/[\d][\d.,]*/);
  if (!numMatch) return null;
  const qty = parsePrice(numMatch[0]);
  if (!Number.isFinite(qty) || qty <= 0) return null;
  const unit = parseUnit(text) ?? "un"; // un número sin unidad = conteo
  if (unit === "kg") return { baseUnit: "g", packSize: qty * 1000 };
  if (unit === "l") return { baseUnit: "ml", packSize: qty * 1000 };
  return { baseUnit: unit, packSize: qty };
}
