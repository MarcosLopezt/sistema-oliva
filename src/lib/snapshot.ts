import { computeMateriaPrima, type MateriaPrimaResult } from "@/lib/materia-prima";
import { computeBarra, type BarraResult } from "@/lib/barra";
import { computeEventStaff, type EventStaffResult } from "@/lib/personal";
import { computeEventSummary, type EventSummary } from "@/lib/resumen";
import type {
  BarBeverage,
  BarSettings,
  EventCost,
  EventRecipeWithRecipe,
  EventRow,
  EventStaffWithStaff,
  EventTablewareWithItem,
} from "@/lib/types";

// =====================================================================
// LA FOTO DEL COSTO DE UN EVENTO
//
// Hasta la migración 0019 el costo de un evento no existía como dato: se
// recalculaba desde el catálogo vivo en cada render. Cambiar el precio de un
// producto, reimportar una lista o borrar una bebida le movía los números a
// eventos cerrados meses atrás.
//
// Ahora, al cerrarlo, se saca una foto y el evento finalizado LEE de la foto.
// Este módulo es el único lugar donde se arma y se interpreta ese documento.
// =====================================================================

/** Cómo se generó una foto de costo. */
export type SnapshotOrigin =
  | "finalizado"
  | "refinalizado"
  | "recalculado"
  | "backfill";

/**
 * Parámetros del evento con los que se calculó la foto.
 *
 * Se guardan aunque ya estén en `events`, para que el documento sea
 * autosuficiente: la foto no depende de que nadie haya tocado el evento
 * después de cerrarlo.
 */
export type SnapshotEventParams = Pick<
  EventRow,
  | "pax"
  | "duration_hours"
  | "merma_pct"
  | "veggie_pct"
  | "bocados_per_person"
  | "principal_extra"
  | "margin_pct"
  | "barra_service"
  | "barra_dia"
  | "barra_horario"
  | "vajilla_margin"
>;

const SNAPSHOT_PARAM_KEYS = [
  "pax",
  "duration_hours",
  "merma_pct",
  "veggie_pct",
  "bocados_per_person",
  "principal_extra",
  "margin_pct",
  "barra_service",
  "barra_dia",
  "barra_horario",
  "vajilla_margin",
] as const;

/**
 * El desglose del costo, calculado o congelado — es el mismo tipo en los dos
 * casos, y ese es el punto.
 *
 * Los campos son los que YA devuelven las funciones de cálculo, sin traducción
 * intermedia. Gracias a eso los componentes de UI no se enteran de si están
 * mostrando la foto o el cálculo vivo: reciben esto siempre, y no hay un
 * segundo camino de código donde los números puedan divergir.
 */
export type EventCostView = {
  materiaPrima: MateriaPrimaResult;
  barra: BarraResult;
  personal: EventStaffResult;
  vajilla: { lines: EventTablewareWithItem[]; total: number };
  /** Instalación, extras y adicionales. */
  costs: EventCost[];
  summary: EventSummary;
};

/** El documento que se guarda en `event_cost_snapshots.data`. */
export type EventCostSnapshotData = EventCostView & {
  /** Sube si cambia la forma del documento. Ver `readSnapshot`. */
  schema_version: 1;
  event: SnapshotEventParams;
};

/** Una entrada del rastro de auditoría de la foto. */
export type SnapshotHistoryEntry = {
  at: string;
  origin: SnapshotOrigin;
  internal_total: number;
  price_per_person: number;
};

/** La fila completa de `event_cost_snapshots`. */
export type EventCostSnapshot = {
  event_id: string;
  taken_at: string;
  origin: SnapshotOrigin;
  /**
   * false = reconstruida por backfill: los precios son los del día en que se
   * reconstruyó, no los del evento. No hay forma de recuperar los originales
   * (no existe historial de precios), así que se marca en vez de fingir.
   */
  reliable: boolean;
  internal_total: number;
  price_per_person: number;
  total_to_client: number;
  data: EventCostSnapshotData;
  history: SnapshotHistoryEntry[];
};

/** Todo lo que hace falta del catálogo vivo para calcular el costo. */
export type CostInputs = {
  event: EventRow;
  selections: EventRecipeWithRecipe[];
  settings: BarSettings | null | undefined;
  beverages: BarBeverage[];
  staff: EventStaffWithStaff[];
  tableware: EventTablewareWithItem[];
  costs: EventCost[];
};

/** Suma la vajilla del evento. Alquiler cuenta roturas; compra, solo si se cargó. */
export function computeVajilla(items: EventTablewareWithItem[]): {
  lines: EventTablewareWithItem[];
  total: number;
} {
  const total = items.reduce((sum, e) => {
    if (!e.item) return sum;
    if (e.item.cost_type === "alquiler") {
      return sum + (e.quantity + e.breakage_qty) * e.item.unit_price;
    }
    return sum + (e.charge_purchase ? e.quantity * e.item.unit_price : 0);
  }, 0);
  return { lines: items, total };
}

/**
 * Calcula el costo completo desde el catálogo vivo.
 *
 * Es el ÚNICO lugar donde se hace este cálculo. Antes cada sección lo repetía
 * por su cuenta y `EventSummary` lo volvía a hacer entero una quinta vez, así
 * que la pantalla recalculaba lo mismo cinco veces por render y cualquier
 * arreglo había que aplicarlo en cinco lugares.
 */
export function computeEventCost(inputs: CostInputs): EventCostView {
  const { event, selections, settings, beverages, staff, tableware, costs } =
    inputs;

  const materiaPrima = computeMateriaPrima(event, selections);
  const barra = computeBarra(event, settings, beverages);
  const personal = computeEventStaff(staff);
  const vajilla = computeVajilla(tableware);
  const summary = computeEventSummary(
    event,
    materiaPrima,
    barra,
    costs,
    personal.total,
    vajilla.total,
  );

  return { materiaPrima, barra, personal, vajilla, costs, summary };
}

/** Arma el documento a guardar: el cálculo vivo + la foto de los parámetros. */
export function buildSnapshotData(inputs: CostInputs): EventCostSnapshotData {
  const view = computeEventCost(inputs);
  const event = Object.fromEntries(
    SNAPSHOT_PARAM_KEYS.map((k) => [k, inputs.event[k]]),
  ) as SnapshotEventParams;

  return { schema_version: 1, event, ...view };
}

/**
 * Interpreta una foto guardada.
 *
 * Devuelve null si el documento vino con una forma que este código no sabe
 * leer. Vale la pena el chequeo: la foto la escribe el código de hoy y la lee
 * el de dentro de dos años. Ante la duda es mejor caer al cálculo vivo, que
 * está mal pero se entiende, que romper la pantalla del evento.
 */
export function readSnapshot(
  snapshot: EventCostSnapshot | null | undefined,
): EventCostView | null {
  const d = snapshot?.data;
  if (!d || d.schema_version !== 1) return null;
  if (!d.summary || !d.materiaPrima || !d.barra || !d.personal || !d.vajilla) {
    return null;
  }
  return {
    materiaPrima: d.materiaPrima,
    barra: d.barra,
    personal: d.personal,
    vajilla: d.vajilla,
    costs: d.costs ?? [],
    summary: d.summary,
  };
}

/**
 * Diferencia entre la foto vigente y lo que daría el cálculo de hoy.
 * Alimenta los diálogos de recalcular y de re-finalizar, para que el usuario
 * vea cuánto se mueve el número ANTES de aceptar que se pise la foto.
 */
export type SnapshotDelta = {
  before: { internalTotal: number; pricePerPerson: number };
  after: { internalTotal: number; pricePerPerson: number };
  /** Variación relativa del costo interno. null si el anterior era 0. */
  pct: number | null;
};

export function snapshotDelta(
  current: EventCostSnapshot,
  next: EventCostView,
): SnapshotDelta {
  const before = {
    internalTotal: current.internal_total,
    pricePerPerson: current.price_per_person,
  };
  const after = {
    internalTotal: next.summary.internalTotal,
    pricePerPerson: next.summary.pricePerPerson,
  };
  const pct =
    before.internalTotal > 0
      ? ((after.internalTotal - before.internalTotal) / before.internalTotal) *
        100
      : null;
  return { before, after, pct };
}

/** true si el evento se tocó después de cerrado (se recalculó o re-finalizó). */
export function wasTouchedAfterClosing(s: EventCostSnapshot): boolean {
  return (s.history?.length ?? 0) > 1;
}
