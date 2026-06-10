import type { MateriaPrimaResult } from "@/lib/materia-prima";
import type { BarraResult } from "@/lib/barra";
import type { EventRow, EventCost, EventCostSection } from "@/lib/types";

export type SummarySection = {
  key: string;
  label: string;
  total: number;
  pct: number;
};

export type EventSummary = {
  /** Secciones que componen el costo interno, con su % sobre el total. */
  sections: SummarySection[];
  internalTotal: number;
  costPerPerson: number;
  marginPct: number;
  pricePerPerson: number;
  /** Costos adicionales (cobrados aparte, no entran al precio por persona). */
  additionalTotal: number;
  /** Estimado total a cobrar al cliente = precio×PAX + adicionales. */
  totalToClient: number;
};

function sumSection(costs: EventCost[], section: EventCostSection): number {
  return costs
    .filter((c) => c.section === section)
    .reduce((s, c) => s + c.quantity * c.unit_price, 0);
}

/** Integra todas las fuentes de costo del evento y calcula el precio sugerido por persona. */
export function computeEventSummary(
  event: EventRow,
  mp: MateriaPrimaResult,
  barra: BarraResult,
  costs: EventCost[],
): EventSummary {
  const raw = [
    { key: "materia_prima", label: "Materia prima", total: mp.total },
    { key: "barra", label: "Barra", total: barra.total },
    { key: "personal", label: "Personal", total: sumSection(costs, "personal") },
    { key: "vajilla", label: "Vajilla", total: sumSection(costs, "vajilla") },
    {
      key: "instalacion",
      label: "Instalación",
      total: sumSection(costs, "instalacion"),
    },
    { key: "extra", label: "Extras", total: sumSection(costs, "extra") },
  ];

  const internalTotal = raw.reduce((s, r) => s + r.total, 0);
  const sections: SummarySection[] = raw.map((r) => ({
    ...r,
    pct: internalTotal > 0 ? (r.total / internalTotal) * 100 : 0,
  }));

  const costPerPerson = event.pax > 0 ? internalTotal / event.pax : 0;
  const pricePerPerson = costPerPerson * (1 + event.margin_pct);
  const additionalTotal = sumSection(costs, "adicional");
  const totalToClient = pricePerPerson * event.pax + additionalTotal;

  return {
    sections,
    internalTotal,
    costPerPerson,
    marginPct: event.margin_pct,
    pricePerPerson,
    additionalTotal,
    totalToClient,
  };
}
