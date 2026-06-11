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
export type ProductField =
  | "name"
  | "price"
  | "saleUnit"
  | "content"
  | "presentation"
  | "code";

/**
 * Sinónimos de encabezado por campo. Se evalúan sobre el texto del encabezado
 * normalizado (minúsculas, sin espacios de más). El orden de detección (ver
 * `autoMapProductColumns`) evita que "Cant. por unidad" se confunda con "Unidad".
 *
 * `presentation` = columna de texto libre que mezcla envase + cantidad + unidad
 * (ej "Bolsa x 5 kgs"). Se interpreta con parsePresentation. Va aparte de
 * `saleUnit` (etiqueta sola, ej "docena") y de `content` (cantidad sola).
 */
const HEADER_SYNONYMS: Record<ProductField, RegExp> = {
  name: /(producto|descrip|art[ií]culo|^item$|nombre|detalle)/,
  price: /(precio|costo|valor|importe)/,
  code: /(c[oó]digo|^cod\.?$|sku)/,
  content:
    /(cant\.?\s*(por|x)\s*unidad|cantidad\s*(por|x)\s*unidad|contenido|gramaje|peso\s*neto|^peso$|^pack$|^cant\.?$|^cantidad$)/,
  presentation: /(presentaci[oó]n|formato|empaque|^envase$|^present\.?$)/,
  saleUnit:
    /(unidad\s*de\s*venta|^unidad(es)?$|^und\.?$|^u\.?\s*m\.?$|^medida$)/,
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
  // Orden importa: nombre, precio y código primero; luego contenido y
  // presentación (más específicos) y por último unidad de venta (la más laxa).
  const order: ProductField[] = [
    "name",
    "price",
    "code",
    "content",
    "presentation",
    "saleUnit",
  ];
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

// --------------- Parser de "Presentación" (texto libre) ---------------
//
// Algunos proveedores meten envase + cantidad + unidad en un solo campo de
// texto (ej "Bolsa x 5 kgs", "Caja x 6 uds", "Tetra x 520 cc."). Este parser
// lo descompone. Casos ambiguos (envase anidado, ej "Caja x 6 bidones": no
// sabemos cuánto trae cada bidón) se marcan para revisión manual.

export type Presentation = {
  /** Tipo de envase detectado ("Bolsa", "Caja", "Bidón"…) o null si es venta directa. */
  envase: string | null;
  /** Cantidad total en la unidad detectada (ya aplica el multiplicador). */
  cantidad: number | null;
  /** Unidad normalizada, o null si no se pudo determinar. */
  unidad: UnitKind | null;
  /** Para casos "N x M u." (ej "Bolsa 2x125gr" → 2 paquetes): cuántos sub-paquetes. */
  multiplicador: number | null;
  /** true → no se pudo interpretar del todo y conviene que lo revise una persona. */
  ambiguous: boolean;
  /** Texto original, para mostrarlo como ayuda en la revisión. */
  raw: string;
};

const UNIT_TOKENS: [RegExp, UnitKind][] = [
  [/^(kg|kgs|kilo|kilos)$/, "kg"],
  [/^(g|gr|grs|grm|gramo|gramos)$/, "g"],
  [/^(l|lt|lts|litro|litros)$/, "l"],
  [/^(cc|ml|cm3)$/, "ml"],
  [/^(u|un|ud|uds|unid|unidad|unidades|feta|fetas|medallon|medallones|porcion|porciones)$/, "un"],
];

/** Palabras de envase que, usadas como "contenido", son ambiguas (envase anidado). */
const CONTAINER_TOKEN =
  /^(bolsa|bolsas|bidon|bidones|paq|paquete|paquetes|caja|cajas|cajon|cajones|lata|latas|balde|baldes|pote|potes|sachet|sachets|barra|barras|tableta|tabletas|estuche|estuches|frasco|frascos|pomo|pomos|pouch|botella|botellas|horma|hormas|pilon|pilones|tetra|tetras)$/;

/** Clasifica un token de unidad: una UnitKind, "container" (anidado) o null. */
function classifyUnit(tok: string): UnitKind | "container" | null {
  const t = tok.toLowerCase().replace(/\./g, "").trim();
  for (const [re, u] of UNIT_TOKENS) if (re.test(t)) return u;
  if (CONTAINER_TOKEN.test(t)) return "container";
  return null;
}

const ENVASE_LABELS: Record<string, string> = {
  bolsa: "Bolsa", bolsas: "Bolsa", bidon: "Bidón", bidones: "Bidón",
  pilon: "Pilón", pilones: "Pilón", paq: "Paquete", paquete: "Paquete",
  paquetes: "Paquete", caja: "Caja", cajas: "Caja", cajon: "Cajón",
  balde: "Balde", pote: "Pote", lata: "Lata", tableta: "Tableta",
  barra: "Barra", horma: "Horma", estuche: "Estuche", frasco: "Frasco",
  pomo: "Pomo", pouch: "Pouch", tetra: "Tetra", sachet: "Sachet",
  botella: "Botella",
};

function normalizeEnvase(s: string | undefined): string | null {
  if (!s) return null;
  const t = s.trim().toLowerCase().replace(/\.$/, "").trim();
  if (!t || /peso|aprox/.test(t)) return null;
  if (/bag\s*in\s*box/.test(t)) return "Bag in Box";
  if (ENVASE_LABELS[t]) return ENVASE_LABELS[t];
  return s.trim().replace(/^\w/, (c) => c.toUpperCase());
}

const toNum = (s: string): number => Number(s.replace(",", "."));

/** Descompone un texto de presentación en envase + cantidad + unidad. */
export function parsePresentation(raw: string): Presentation {
  const text = (raw ?? "").trim();
  const ambiguous: Presentation = {
    envase: null, cantidad: null, unidad: null, multiplicador: null,
    ambiguous: true, raw: text,
  };
  if (!text) return ambiguous;
  const s = text.replace(/\s+/g, " ").trim();

  // 1) Unidad sola, sin números: "KG.", "Unidad", "UD." → cantidad 1.
  if (!/\d/.test(s)) {
    const u = classifyUnit(s.replace(/\.$/, ""));
    if (u && u !== "container")
      return { envase: null, cantidad: 1, unidad: u, multiplicador: null, ambiguous: false, raw: text };
    return ambiguous; // texto suelto (ej "docena", desconocido)
  }

  // 2) Doble número: "[envase] N1 x N2 unidad" → total N1×N2 (ej "Bolsa 2x125gr").
  let m = s.match(/^(.*?)(\d+)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*([a-zñáéíóú]+)?\.?$/i);
  if (m) {
    const n1 = toNum(m[2]);
    const n2 = toNum(m[3]);
    const u = m[4] ? classifyUnit(m[4]) : null;
    const base = { envase: normalizeEnvase(m[1]), cantidad: n1 * n2, multiplicador: n1, raw: text };
    if (u && u !== "container") return { ...base, unidad: u, ambiguous: false };
    return { ...base, unidad: null, ambiguous: true };
  }

  // 3) "[envase] x N unidad" (la unidad puede faltar → conteo).
  m = s.match(/^(.+?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*([a-zñáéíóú]+)?\.?$/i);
  if (m) {
    const n = toNum(m[2]);
    const env = normalizeEnvase(m[1]);
    if (!m[3])
      return { envase: env, cantidad: n, unidad: "un", multiplicador: null, ambiguous: false, raw: text };
    const u = classifyUnit(m[3]);
    if (u && u !== "container")
      return { envase: env, cantidad: n, unidad: u, multiplicador: null, ambiguous: false, raw: text };
    // Envase anidado ("Caja x 6 bidones") o unidad desconocida → revisión.
    return { envase: env, cantidad: n, unidad: null, multiplicador: null, ambiguous: true, raw: text };
  }

  // 4) "[envase] N unidad" sin la "x" (ej "Bag in Box 5 lts").
  m = s.match(/^(.+?)\s+(\d+(?:[.,]\d+)?)\s*([a-zñáéíóú]+)\.?$/i);
  if (m) {
    const u = classifyUnit(m[3]);
    if (u && u !== "container")
      return { envase: normalizeEnvase(m[1]), cantidad: toNum(m[2]), unidad: u, multiplicador: null, ambiguous: false, raw: text };
  }

  // 5) Último recurso: cualquier número + unidad de peso/volumen ("Peso aprox 120 grs").
  m = s.match(/(\d+(?:[.,]\d+)?)\s*(kg|kgs|grs?|gramos?|lts?|litros?|ml|cc|l)\b/i);
  if (m) {
    const u = classifyUnit(m[2]);
    if (u && u !== "container")
      return { envase: null, cantidad: toNum(m[1]), unidad: u, multiplicador: null, ambiguous: false, raw: text };
  }

  return ambiguous;
}

/**
 * Convierte una presentación interpretada a {baseUnit, packSize} de la app,
 * normalizando a la unidad chica (kg→g, L→ml). Devuelve null si es ambigua o
 * no tiene cantidad/unidad (→ revisión manual).
 */
export function presentationToContent(
  p: Presentation,
): { baseUnit: UnitKind; packSize: number } | null {
  if (p.ambiguous || p.cantidad == null || p.unidad == null) return null;
  if (p.unidad === "kg") return { baseUnit: "g", packSize: p.cantidad * 1000 };
  if (p.unidad === "l") return { baseUnit: "ml", packSize: p.cantidad * 1000 };
  return { baseUnit: p.unidad, packSize: p.cantidad };
}

/**
 * Para envases anidados ("Caja x N paq."), el contenido de cada sub-envase no
 * está en la presentación pero casi siempre SÍ en el NOMBRE del producto
 * (ej "GALLETITAS OREO 12 X 354 GRS" = caja de 12 paquetes de 354 g). Esta
 * función lo deduce: toma el último "[número] [unidad de peso/volumen]" del
 * nombre y lo multiplica por los factores que lo preceden ("31 X 2U. X 80 grs").
 *   `packs` = cantidad de sub-envases que dijo la presentación. Si el nombre ya
 *   arranca con esa cantidad, el producto del nombre ya es el total de la caja;
 *   si no, multiplicamos por `packs`. Devuelve el contenido total del envase.
 */
export function contentFromName(
  name: string,
  packs: number | null,
): { baseUnit: UnitKind; packSize: number } | null {
  const re =
    /(\d+(?:[.,]\d+)?)\s*(kg|kgs|kilos?|grs?|gramos?|g|lts?|litros?|l|ml|cc)\b\.?/gi;
  let last: RegExpExecArray | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(name)) !== null) last = m;
  if (!last) return null;

  const baseNum = toNum(last[1]);
  const unit = classifyUnit(last[2]);
  if (!unit || unit === "container" || !(baseNum > 0)) return null;

  // Multiplicadores antes del match: "12 X", "31 X 2U. X", "22 X 3 X".
  const before = name.slice(0, last.index);
  const mults = [...before.matchAll(/(\d+(?:[.,]\d+)?)\s*u?\.?\s*[x×]/gi)].map(
    (x) => toNum(x[1]),
  );
  let total = baseNum;
  for (const k of mults) if (k > 0) total *= k;
  // Si el primer factor del nombre no es la cantidad de packs, es contenido por
  // sub-envase → multiplicar por la cantidad de packs para el total de la caja.
  if (packs && packs > 0 && mults[0] !== packs) total *= packs;
  if (!(total > 0)) return null;

  if (unit === "kg") return { baseUnit: "g", packSize: total * 1000 };
  if (unit === "l") return { baseUnit: "ml", packSize: total * 1000 };
  return { baseUnit: unit, packSize: total };
}
