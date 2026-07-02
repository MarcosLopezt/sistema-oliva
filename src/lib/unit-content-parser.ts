/**
 * Parser para detectar el contenido por unidad (volumen o peso) en el nombre
 * de un producto. Ej: "LICOR CUSENIER X 700CC" → { value: 700, unit: 'ml' }.
 *
 * Diferencia clave con el parser de presentación (excel.ts): este devuelve el
 * contenido POR UNIDAD individual, no el total del pack. Para "2X125GR" devuelve
 * 125 g (por paquete), no 250 g (total de la caja).
 *
 * Normaliza a la unidad chica: cc/l/lt → ml (×1000); kg → g (×1000).
 */

type ContentUnit = "ml" | "g";

export type ParsedUnitContent = {
  /** Valor normalizado a la unidad chica (ml o g). Ej: 700 (para 700 CC). */
  value: number;
  /** Unidad normalizada: 'ml' para volúmenes, 'g' para masas. */
  unit: ContentUnit;
  /** Siempre 'name': indica que vino del nombre del producto. */
  source: "name";
};

type UnitSpec = { unit: ContentUnit; factor: number };

const UNIT_TABLE: [RegExp, UnitSpec][] = [
  [/^(cc|cm3)$/i,              { unit: "ml", factor: 1 }],
  [/^ml$/i,                    { unit: "ml", factor: 1 }],
  [/^(l|lt|lts|litro|litros)$/i, { unit: "ml", factor: 1000 }],
  [/^(g|gr|grs|grm|gramo|gramos)$/i, { unit: "g", factor: 1 }],
  [/^(kg|kgs|kilo|kilos)$/i,   { unit: "g", factor: 1000 }],
];

function resolveUnit(raw: string): UnitSpec | null {
  const t = raw.trim().toLowerCase().replace(/\.$/, "");
  for (const [re, spec] of UNIT_TABLE) {
    if (re.test(t)) return spec;
  }
  return null;
}

/**
 * Busca el ÚLTIMO patrón "[número] [unidad de peso/volumen]" en el nombre.
 * Si no lo encuentra, devuelve null.
 *
 * Ejemplos:
 *   "LICOR DE CAFE CUSENIER X 700CC"  → { value: 700,  unit: 'ml' }
 *   "ACEITE GIRASOL X 1LT"             → { value: 1000, unit: 'ml' }
 *   "HARINA 0000 X 25KG"               → { value: 25000, unit: 'g' }
 *   "GALLETITAS 12X354GRS"             → { value: 354,  unit: 'g' }
 *   "AGUA MINERAL X 500ML"             → { value: 500,  unit: 'ml' }
 */
export function parseUnitContentFromName(name: string): ParsedUnitContent | null {
  if (!name) return null;

  // Regex: número (con coma o punto decimal) seguido de unidad de peso/volumen.
  const re =
    /(\d+(?:[.,]\d+)?)\s*(cc|cm3|ml|l|lt|lts|litros?|g|gr|grs?|grm|gramos?|kg|kgs?|kilos?)\.?\b/gi;

  let last: { rawNum: string; rawUnit: string } | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(name)) !== null) {
    last = { rawNum: m[1], rawUnit: m[2] };
  }
  if (!last) return null;

  const num = Number(last.rawNum.replace(",", "."));
  if (!Number.isFinite(num) || num <= 0) return null;

  const spec = resolveUnit(last.rawUnit);
  if (!spec) return null;

  return { value: num * spec.factor, unit: spec.unit, source: "name" };
}
