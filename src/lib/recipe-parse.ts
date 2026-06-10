import { parseUnit } from "@/lib/excel";
import type { UnitKind } from "@/lib/types";

export type ParsedLine = {
  raw: string;
  quantity: number | null;
  unit: UnitKind | null;
  name: string;
};

function num(s: string): number {
  return Number(s.replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, ""));
}

function clean(s: string): string {
  return s.replace(/\s+/g, " ").replace(/[.:;,\s]+$/, "").trim();
}

/** Extrae "cantidad + unidad" del comienzo de un texto. */
function extractLeadingQty(text: string): {
  qty: number | null;
  unit: UnitKind | null;
  rest: string;
} {
  const m = text.match(/^([\d.,]+)\s*([a-zA-Záéíóúñ./]+)?\s*(.*)$/);
  if (!m || !/\d/.test(m[1])) return { qty: null, unit: null, rest: text };
  const qty = num(m[1]);
  const tok = (m[2] ?? "").trim();
  const unit = parseUnit(tok);
  // Si el token no es una unidad reconocida, es parte del nombre.
  const rest = (unit ? m[3] : `${tok} ${m[3] ?? ""}`).trim();
  return { qty: Number.isFinite(qty) ? qty : null, unit, rest };
}

function parseLine(raw: string): ParsedLine {
  // Formato "Nombre: 1 kg"
  const colon = raw.indexOf(":");
  if (colon > 0) {
    const left = raw.slice(0, colon);
    const right = raw.slice(colon + 1);
    const { qty, unit } = extractLeadingQty(right.trim());
    if (qty != null) return { raw, quantity: qty, unit, name: clean(left) };
  }

  // Formato "700g de harina 0000" / "1 atado ciboulette"
  const { qty, unit, rest } = extractLeadingQty(raw);
  if (qty != null) {
    const name = clean(rest.replace(/^de\s+/i, ""));
    return { raw, quantity: qty, unit, name };
  }

  // Sin cantidad (ej: "Sal c/n", títulos de sección).
  return { raw, quantity: null, unit: null, name: clean(raw) };
}

/** Parsea el texto pegado de una receta, una línea por ingrediente. */
export function parseRecipeLines(text: string): ParsedLine[] {
  return text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(parseLine)
    .filter((p) => p.name.length > 0);
}
