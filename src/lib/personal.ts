import {
  staffCategoryLabel,
  type EventStaffWithStaff,
} from "@/lib/types";

/** Tarifa efectiva del empleado en un evento: la puntual si existe, si no la base. */
export function effectiveRate(es: EventStaffWithStaff): number {
  if (es.rate_override != null) return es.rate_override;
  return es.staff?.hourly_rate ?? 0;
}

/** Total a pagar por una asignación = horas × tarifa efectiva. */
export function staffLineTotal(es: EventStaffWithStaff): number {
  return es.hours * effectiveRate(es);
}

export type StaffCategoryGroup = {
  category: string;
  categoryLabel: string;
  lines: EventStaffWithStaff[];
  subtotal: number;
};

export type EventStaffResult = {
  groups: StaffCategoryGroup[];
  total: number;
};

/** Agrupa el personal del evento por categoría y calcula subtotales y total. */
export function computeEventStaff(
  lines: EventStaffWithStaff[],
): EventStaffResult {
  const byCategory = new Map<string, EventStaffWithStaff[]>();
  for (const es of lines) {
    const cat = es.staff?.category ?? "otros";
    const arr = byCategory.get(cat);
    if (arr) arr.push(es);
    else byCategory.set(cat, [es]);
  }

  const groups: StaffCategoryGroup[] = [...byCategory.entries()]
    .map(([category, ls]) => ({
      category,
      categoryLabel: staffCategoryLabel(category),
      lines: ls.sort((a, b) =>
        (a.staff?.full_name ?? "").localeCompare(b.staff?.full_name ?? ""),
      ),
      subtotal: ls.reduce((s, l) => s + staffLineTotal(l), 0),
    }))
    .sort((a, b) => a.categoryLabel.localeCompare(b.categoryLabel));

  const total = groups.reduce((s, g) => s + g.subtotal, 0);
  return { groups, total };
}
