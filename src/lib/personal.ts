import {
  staffCategoryLabel,
  type EventStaffWithStaff,
  type StaffRole,
  type StaffWithRole,
} from "@/lib/types";

/**
 * De dónde sale la tarifa que se está aplicando. La UI lo muestra para que
 * el número nunca aparezca sin explicación.
 */
export type RateSource = "evento" | "empleado" | "rol" | "sin-tarifa";

export type ResolvedRate = {
  rate: number;
  source: RateSource;
  /** Rol que se tuvo en cuenta (el del evento si lo hay, si no el habitual). */
  role: StaffRole | null;
  /** true si el rol del evento pisa al rol habitual del empleado. */
  roleOverridden: boolean;
};

/** Rol que rige en esta asignación: el puntual del evento o el habitual. */
export function appliedRole(es: EventStaffWithStaff): StaffRole | null {
  return es.event_role ?? es.staff?.staff_role ?? null;
}

/** true si el evento le cambió el rol respecto del habitual del empleado. */
export function isRoleOverridden(es: EventStaffWithStaff): boolean {
  return es.role_id != null && es.role_id !== (es.staff?.role_id ?? null);
}

/**
 * NIVEL 1 → 2: tarifa base global del empleado, fuera de todo evento.
 * La propia pisa a la del rol; si no tiene ninguna, queda en 0 "sin tarifa".
 */
export function resolveStaffRate(s: StaffWithRole | null): ResolvedRate {
  if (s?.hourly_rate != null) {
    return {
      rate: s.hourly_rate,
      source: "empleado",
      role: s.staff_role ?? null,
      roleOverridden: false,
    };
  }
  if (s?.staff_role) {
    return {
      rate: s.staff_role.hourly_rate,
      source: "rol",
      role: s.staff_role,
      roleOverridden: false,
    };
  }
  return { rate: 0, source: "sin-tarifa", role: null, roleOverridden: false };
}

/**
 * Jerarquía completa dentro de un evento: evento → empleado → rol.
 *
 * Excepción deliberada: si el evento le cambió el ROL al empleado, su tarifa
 * propia no se arrastra. Esa tarifa se fijó para su puesto habitual, así que
 * un mozo que hoy trabaja de ayudante de cocina cobra la del rol nuevo. Igual
 * se puede ajustar a mano con rate_override, que sigue mandando sobre todo.
 */
export function resolveRate(es: EventStaffWithStaff): ResolvedRate {
  const roleOverridden = isRoleOverridden(es);
  const role = appliedRole(es);

  if (es.rate_override != null) {
    return { rate: es.rate_override, source: "evento", role, roleOverridden };
  }
  if (roleOverridden && es.event_role) {
    return {
      rate: es.event_role.hourly_rate,
      source: "rol",
      role: es.event_role,
      roleOverridden,
    };
  }
  const base = resolveStaffRate(es.staff);
  return { ...base, role: role ?? base.role, roleOverridden };
}

/** Etiqueta corta del origen de la tarifa, para mostrar al lado del número. */
export function rateSourceLabel(r: ResolvedRate): string {
  switch (r.source) {
    case "evento":
      return "ajustada para este evento";
    case "empleado":
      return "tarifa propia del empleado";
    case "rol":
      return r.role ? `hereda del rol ${r.role.name}` : "hereda del rol";
    default:
      return "sin tarifa configurada";
  }
}

/** Tarifa efectiva del empleado en un evento (solo el número). */
export function effectiveRate(es: EventStaffWithStaff): number {
  return resolveRate(es).rate;
}

/** Total a pagar por una asignación = horas × tarifa efectiva. */
export function staffLineTotal(es: EventStaffWithStaff): number {
  return es.hours * effectiveRate(es);
}

/**
 * Categoría bajo la que suma esta línea. Si el evento le cambió el rol, vale
 * la categoría del rol nuevo (un mozo que va a producción suma en producción).
 * Sin rol puntual cae en la categoría del empleado, igual que antes de 0018.
 */
export function lineCategory(es: EventStaffWithStaff): string {
  return es.event_role?.category ?? es.staff?.category ?? "otros";
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
    const cat = lineCategory(es);
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
