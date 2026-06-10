import type {
  EventRow,
  BarSettings,
  BarBeverage,
  BarraDia,
  BarraHorario,
} from "@/lib/types";

export type BarraLine = {
  id: string;
  name: string;
  bottles: number;
  sizeMl: number;
  totalMl: number;
  price: number;
  subtotal: number;
};

export type BarraResult = {
  lines: BarraLine[];
  total: number;
  perPerson: number;
  factorDia: number;
  factorHorario: number;
};

function diaFactor(s: BarSettings, dia: BarraDia): number {
  if (dia === "semana") return s.dia_semana;
  if (dia === "jueves") return s.dia_jueves;
  return s.dia_finde;
}

function horarioFactor(s: BarSettings, hor: BarraHorario): number {
  if (hor === "mediodia") return s.hor_mediodia;
  if (hor === "cena") return s.hor_cena;
  return s.hor_nocturno;
}

/**
 * Calcula las botellas a comprar por bebida para la barra del evento.
 *   ml = PAX × consumo_base × horas × factor_día × factor_horario
 *   botellas = techo(ml / tamaño_botella)
 */
export function computeBarra(
  event: EventRow,
  settings: BarSettings | null | undefined,
  beverages: BarBeverage[],
): BarraResult {
  const empty: BarraResult = {
    lines: [],
    total: 0,
    perPerson: 0,
    factorDia: 1,
    factorHorario: 1,
  };
  if (!settings || event.barra_service === "ninguna") return empty;

  const fDia = diaFactor(settings, event.barra_dia);
  const fHor = horarioFactor(settings, event.barra_horario);
  const mult = event.pax * event.duration_hours * fDia * fHor;

  const lines: BarraLine[] = beverages
    .filter((b) => b.service === event.barra_service)
    .map((b) => {
      const totalMl = b.ml_per_person_hour * mult;
      const bottles = totalMl > 0 ? Math.ceil(totalMl / b.size_ml) : 0;
      const subtotal = bottles * b.price;
      return {
        id: b.id,
        name: b.name,
        bottles,
        sizeMl: b.size_ml,
        totalMl,
        price: b.price,
        subtotal,
      };
    })
    .filter((l) => l.bottles > 0);

  const total = lines.reduce((s, l) => s + l.subtotal, 0);
  const perPerson = event.pax > 0 ? total / event.pax : 0;

  return { lines, total, perPerson, factorDia: fDia, factorHorario: fHor };
}
