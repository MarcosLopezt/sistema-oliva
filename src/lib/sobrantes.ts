import { formatNum, parseDate, unitLabel } from "@/lib/format";
import type { MateriaPrimaResult } from "@/lib/materia-prima";
import type {
  ContentUnit,
  EventRecipeWithRecipe,
  EventRow,
  IngredientWithProduct,
  Leftover,
  LeftoverStatus,
  LeftoverWithProduct,
  UnitKind,
} from "@/lib/types";

/**
 * SOBRANTES — ETAPA 1.
 *
 * Este módulo vive AL COSTADO del motor de costeo. Solo LEE el resultado de
 * `computeMateriaPrima`; no lo modifica ni lo recalcula. Nada de acá descuenta
 * stock, altera el costo de un evento, cambia el pedido al proveedor ni toca el
 * precio sugerido por persona.
 */

/** Producto vinculado a un ingrediente (con su proveedor embebido). */
type LinkedProduct = NonNullable<IngredientWithProduct["product"]>;

// --------------------------- Fechas calendarias ---------------------------

/** Fecha de hoy como "YYYY-MM-DD" en horario LOCAL (nunca UTC, ver format.ts). */
export function todayISO(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Suma días a una fecha calendaria "YYYY-MM-DD", en horario local. */
export function addDays(iso: string, days: number): string {
  const d = parseDate(iso);
  d.setDate(d.getDate() + days);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Días calendario entre dos fechas (b − a). Negativo si `b` ya pasó. */
export function daysBetween(a: string, b: string): number {
  const ms = parseDate(b).getTime() - parseDate(a).getTime();
  return Math.round(ms / 86_400_000);
}

/**
 * Fecha de vencimiento = fecha del evento + días de vida útil del producto.
 * Devuelve null si el producto no tiene la vida útil cargada (el sobrante
 * queda sin vencimiento y la UI avisa que falta configurarlo).
 * Si el evento no tiene fecha, se usa la de registro como base.
 */
export function computeExpiry(
  baseDate: string | null,
  shelfLifeDays: number | null | undefined,
): string | null {
  if (shelfLifeDays == null || shelfLifeDays <= 0) return null;
  return addDays(baseDate ?? todayISO(), shelfLifeDays);
}

// ------------------------------ Vencimiento -------------------------------

/** Ventana en la que un sobrante se considera "por vencer". */
export const EXPIRY_SOON_DAYS = 7;

export type ExpiryState =
  /** El producto no tiene vida útil cargada: no se puede saber. */
  | "sin-definir"
  /** Falta más que la ventana de aviso. */
  | "ok"
  /** Vence dentro de los próximos EXPIRY_SOON_DAYS días. */
  | "por-vencer"
  /** La fecha ya pasó. */
  | "vencido";

export type ExpiryInfo = {
  state: ExpiryState;
  /** Días hasta el vencimiento. Negativo si ya venció. null si no aplica. */
  days: number | null;
};

export function expiryInfo(
  expiresAt: string | null,
  today: string = todayISO(),
): ExpiryInfo {
  if (!expiresAt) return { state: "sin-definir", days: null };
  const days = daysBetween(today, expiresAt);
  if (days < 0) return { state: "vencido", days };
  if (days <= EXPIRY_SOON_DAYS) return { state: "por-vencer", days };
  return { state: "ok", days };
}

/**
 * Estado real del sobrante, derivado al leer.
 *
 * `status` en la base guarda solo las transiciones que hace el usuario
 * (disponible / consumido / descartado). "Vencido" se calcula acá contra
 * `expires_at`: así no hace falta un cron y, si mañana se corrige la fecha de
 * vencimiento, el estado se acomoda solo en vez de quedar pegado.
 */
export function effectiveStatus(
  l: Pick<Leftover, "status" | "expires_at">,
  today: string = todayISO(),
): LeftoverStatus {
  if (l.status !== "disponible") return l.status;
  return expiryInfo(l.expires_at, today).state === "vencido"
    ? "vencido"
    : "disponible";
}

/** true si el sobrante se puede usar hoy: disponible, no vencido y con stock. */
export function isUsable(
  l: Pick<Leftover, "status" | "expires_at" | "qty_remaining">,
  today: string = todayISO(),
): boolean {
  return effectiveStatus(l, today) === "disponible" && l.qty_remaining > 0;
}

// -------------------- Unidad de presentación / edición --------------------

/**
 * Las cantidades se GUARDAN siempre en `base_unit`, pero mostrarlas así puede
 * ser ilegible: en el modelo tres capas la unidad base es "un" (botellas), y
 * "sobran 0,62 botellas" no le dice nada a nadie — lo que se mide es "3,1 L".
 *
 * Esta función devuelve en qué unidad conviene mostrar/ingresar la cantidad y
 * el factor para convertir:  displayQty = baseQty × factor
 */
/**
 * Cualquier cosa que tenga unidad base y (opcionalmente) contenido por unidad.
 * Acepta las dos convenciones que conviven en el código: la de la base
 * (`base_unit`, como Product y Leftover) y la de los tipos armados en memoria
 * (`baseUnit`, como LeftoverDraft y CalibrationRow).
 */
export type QtyScalable =
  | {
      base_unit: UnitKind;
      unit_content_value: number | null;
      unit_content_unit: ContentUnit | null;
    }
  | {
      baseUnit: UnitKind;
      unitContentValue: number | null;
      unitContentUnit: ContentUnit | null;
    };

function normalize(src: QtyScalable) {
  return "base_unit" in src
    ? {
        unit: src.base_unit,
        value: src.unit_content_value,
        contentUnit: src.unit_content_unit,
      }
    : {
        unit: src.baseUnit,
        value: src.unitContentValue,
        contentUnit: src.unitContentUnit,
      };
}

export function displayScale(src: QtyScalable): {
  unit: UnitKind;
  factor: number;
} {
  const { unit, value, contentUnit } = normalize(src);
  if (unit === "un" && value != null && contentUnit != null) {
    return { unit: contentUnit, factor: value };
  }
  return { unit, factor: 1 };
}

export function toDisplayQty(baseQty: number, src: QtyScalable): number {
  return baseQty * displayScale(src).factor;
}

export function toBaseQty(displayQty: number, src: QtyScalable): number {
  const { factor } = displayScale(src);
  return factor > 0 ? displayQty / factor : displayQty;
}

/**
 * Cantidad lista para mostrar, con la unidad más natural.
 * 628,25 ml → "628,25 ml" · 3100 ml → "3,1 L" · 0,62 un de 5 L → "3,1 L"
 */
export function formatQty(baseQty: number, src: QtyScalable): string {
  const { unit, factor } = displayScale(src);
  const qty = baseQty * factor;
  if (unit === "ml" && Math.abs(qty) >= 1000)
    return `${formatNum(qty / 1000)} L`;
  if (unit === "g" && Math.abs(qty) >= 1000)
    return `${formatNum(qty / 1000)} kg`;
  return `${formatNum(qty)} ${unitLabel(unit)}`;
}

/** Sobrante como % de lo comprado. null si no se sabe cuánto se compró. */
export function pctOfPack(
  qty: number,
  purchasedQty: number | null | undefined,
): number | null {
  if (purchasedQty == null || purchasedQty <= 0) return null;
  return (qty / purchasedQty) * 100;
}

// ------------------- Precarga al cerrar un evento (Tarea 4) -------------------

/**
 * Línea precargada de sobrante, lista para que el usuario confirme, corrija o
 * descarte. Se arma con datos que el motor YA calculó.
 */
export type LeftoverDraft = {
  /** Clave estable de React = id del producto (una línea por producto). */
  productId: string;
  productName: string;
  providerName: string;
  /** Ingredientes que se abastecen con este producto (para reconocer la línea). */
  ingredientName: string;

  // Todas las cantidades en base_unit del producto.
  /** Comprado: packs × pack_size. */
  purchasedQty: number;
  /** Necesario con merma, sin redondear (MPLine.neededBaseQty). */
  neededQty: number;
  /** Sobrante teórico = comprado − necesario. Es lo que se precarga. */
  calculatedQty: number;

  // Snapshots que se guardan con el sobrante.
  baseUnit: UnitKind;
  unitContentValue: number | null;
  unitContentUnit: ContentUnit | null;
  /** $ por base_unit (price / pack_size). Irrecuperable si cambia la lista. */
  unitCost: number | null;
  shelfLifeDays: number | null;
  /** Fecha del evento + vida útil. null = el producto no la tiene cargada. */
  expiresAt: string | null;
};

/**
 * Sobrante mínimo (ya en unidad de presentación) para que valga la pena
 * ofrecerlo. Por debajo es ruido de redondeo: nadie guarda 0,004 ml de aceite.
 */
const MIN_DISPLAY_QTY = 0.01;

/**
 * Índice ingrediente → producto vinculado, armado desde el menú del evento.
 * `MPLine` identifica sus ingredientes pero no expone el id del producto; este
 * índice lo resuelve sin tocar el motor.
 */
export function productsByIngredient(
  selections: EventRecipeWithRecipe[],
): Map<string, LinkedProduct> {
  const map = new Map<string, LinkedProduct>();
  for (const sel of selections) {
    for (const item of sel.recipe?.items ?? []) {
      const ing = item.ingredient;
      if (ing?.product) map.set(ing.id, ing.product);
    }
  }
  return map;
}

/**
 * Arma la lista precargada de sobrantes de un evento.
 *
 * SOLO LECTURA: recibe el resultado que `computeMateriaPrima` ya produjo y no
 * vuelve a calcular nada del costeo. El sobrante sale de dos campos que el
 * motor expone: `totalBaseQty` (lo que se compra) y `neededBaseQty` (lo que
 * realmente se necesita, con merma y sin redondear a packs).
 *
 * OJO: no se usa `surplusUnits`, que es otra cosa — cuenta unidades ENTERAS
 * sin abrir. Acá interesa también el contenido que queda dentro de la unidad
 * abierta: para 6.900 ml de aceite en bidones de 5 L, `surplusUnits` es 0 pero
 * quedan 3,1 L pagados sin usar.
 *
 * Se saltean las líneas de precio de mercado (sin producto): se compran sin
 * redondeo a packs, así que no generan sobrante sistemático.
 */
export function buildLeftoverDrafts(
  event: EventRow,
  mp: MateriaPrimaResult,
  productByIngredient: Map<string, LinkedProduct>,
): LeftoverDraft[] {
  const drafts: LeftoverDraft[] = [];

  for (const group of mp.groups) {
    for (const line of group.lines) {
      // Línea de precio de mercado: sin producto, sin pack, sin sobrante.
      if (!line.productName) continue;

      // Todos los ingredientes consolidados en una línea comparten producto,
      // así que alcanza con el primero que se pueda resolver.
      const prod = line.ingredientIds
        .map((id) => productByIngredient.get(id))
        .find((p): p is LinkedProduct => p != null);
      if (!prod) continue;

      const calculated = line.totalBaseQty - line.neededBaseQty;
      // El umbral se aplica sobre la cantidad como se va a mostrar: 0,01 ml
      // es ruido, pero 0,01 "un" de un bidón de 5 L son 50 ml y sí importan.
      if (toDisplayQty(calculated, prod) < MIN_DISPLAY_QTY) continue;

      drafts.push({
        productId: prod.id,
        productName: prod.name,
        providerName: group.provider,
        ingredientName: line.ingredientName,
        purchasedQty: line.totalBaseQty,
        neededQty: line.neededBaseQty,
        calculatedQty: calculated,
        baseUnit: prod.base_unit,
        unitContentValue: prod.unit_content_value,
        unitContentUnit: prod.unit_content_unit,
        unitCost: prod.pack_size > 0 ? prod.price / prod.pack_size : null,
        shelfLifeDays: prod.leftover_shelf_life_days,
        expiresAt: computeExpiry(event.event_date, prod.leftover_shelf_life_days),
      });
    }
  }

  return drafts.sort((a, b) => a.productName.localeCompare(b.productName));
}

// ------------------- Aviso al planificar (Tarea 6) -------------------

/**
 * Sobrantes utilizables hoy, indexados por producto. Alimenta el aviso
 * INFORMATIVO de la sección Materia Prima: muestra que hay stock disponible,
 * pero no descuenta nada ni cambia ningún número del evento.
 */
export function usableByProduct(
  leftovers: LeftoverWithProduct[],
  today: string = todayISO(),
): Map<string, LeftoverWithProduct[]> {
  const map = new Map<string, LeftoverWithProduct[]>();
  for (const l of leftovers) {
    if (!isUsable(l, today)) continue;
    const list = map.get(l.product_id);
    if (list) list.push(l);
    else map.set(l.product_id, [l]);
  }
  // El que vence antes va primero: es el que conviene usar.
  for (const list of map.values()) {
    list.sort((a, b) => (a.expires_at ?? "9999").localeCompare(b.expires_at ?? "9999"));
  }
  return map;
}

// ------------------- Calibración de la merma (Tarea 5) -------------------

export type CalibrationRow = {
  productId: string;
  productName: string;
  baseUnit: UnitKind;
  unitContentValue: number | null;
  unitContentUnit: ContentUnit | null;
  /** Sobrantes con ambas cantidades cargadas (los manuales no cuentan). */
  samples: number;
  avgCalculated: number;
  avgConfirmed: number;
  /** confirmado − calculado, promedio. Negativo = sobró MENOS de lo previsto. */
  avgDiff: number;
  /** Diferencia relativa sobre lo calculado, en %. null si el promedio es 0. */
  avgDiffPct: number | null;
};

/**
 * Compara lo que calculó el sistema contra lo que confirmó el usuario, por
 * producto. Es el insumo para calibrar la merma:
 *
 *  · Sobra sistemáticamente MENOS de lo calculado (avgDiff < 0) → la merma real
 *    es mayor que la configurada y se están subestimando costos.
 *  · Sobra MÁS (avgDiff > 0) → se está comprando de más.
 *
 * Etapa 1 solo muestra el número; no ajusta nada automáticamente.
 */
export function calibrationByProduct(
  leftovers: LeftoverWithProduct[],
): CalibrationRow[] {
  type Acc = Omit<CalibrationRow, "avgCalculated" | "avgConfirmed" | "avgDiff" | "avgDiffPct"> & {
    sumCalculated: number;
    sumConfirmed: number;
  };
  const acc = new Map<string, Acc>();

  for (const l of leftovers) {
    // Solo los que vinieron de una precarga: los manuales no tienen con qué comparar.
    if (l.qty_calculated == null) continue;
    const prev = acc.get(l.product_id);
    if (prev) {
      prev.samples++;
      prev.sumCalculated += l.qty_calculated;
      prev.sumConfirmed += l.qty_confirmed;
    } else {
      acc.set(l.product_id, {
        productId: l.product_id,
        productName: l.product?.name ?? "—",
        baseUnit: l.base_unit,
        unitContentValue: l.unit_content_value,
        unitContentUnit: l.unit_content_unit,
        samples: 1,
        sumCalculated: l.qty_calculated,
        sumConfirmed: l.qty_confirmed,
      });
    }
  }

  return [...acc.values()]
    .map((a) => {
      const avgCalculated = a.sumCalculated / a.samples;
      const avgConfirmed = a.sumConfirmed / a.samples;
      const avgDiff = avgConfirmed - avgCalculated;
      return {
        productId: a.productId,
        productName: a.productName,
        baseUnit: a.baseUnit,
        unitContentValue: a.unitContentValue,
        unitContentUnit: a.unitContentUnit,
        samples: a.samples,
        avgCalculated,
        avgConfirmed,
        avgDiff,
        avgDiffPct: avgCalculated > 0 ? (avgDiff / avgCalculated) * 100 : null,
      };
    })
    .sort((a, b) => Math.abs(b.avgDiff) - Math.abs(a.avgDiff));
}
