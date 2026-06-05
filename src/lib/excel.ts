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
