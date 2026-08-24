/**
 * Verificación de la jerarquía de tarifas de personal (roles), sin base de datos.
 *
 * Cubre los puntos del plan de testing que no necesitan UI:
 *  2. El empleado hereda la tarifa de su rol.
 *  3. La tarifa propia del empleado pisa a la del rol.
 *  4. Alta masiva: 5 empleados con las mismas horas.
 *  5. Cambio de rol solo en el evento (el habitual no se toca).
 *  6. Ajuste de tarifa solo en el evento (la global no se toca).
 *  7. Los eventos preexistentes mantienen exactamente el mismo costo.
 *
 * Uso:
 *   node -e "const {createJiti}=require('jiti');createJiti(process.cwd()+'/',{alias:{'@':process.cwd()+'/src'}})('./scripts/verificar-personal-roles.ts')"
 */
import {
  computeEventStaff,
  resolveRate,
  resolveStaffRate,
  staffLineTotal,
} from "@/lib/personal";
import type {
  EventStaffWithStaff,
  StaffRole,
  StaffWithRole,
} from "@/lib/types";

let fallos = 0;
let ok = 0;

function check(nombre: string, real: unknown, esperado: unknown, tol = 1e-9) {
  const pasa =
    typeof real === "number" && typeof esperado === "number"
      ? Math.abs(real - esperado) <= tol
      : Object.is(real, esperado);
  if (pasa) {
    ok++;
    console.log(`  ✓ ${nombre}: ${String(real)}`);
  } else {
    fallos++;
    console.log(`  ✗ ${nombre}: esperado ${String(esperado)}, obtenido ${String(real)}`);
  }
}

// --------------------------------- Fixtures ---------------------------------

function rol(name: string, category: string, hourly_rate: number): StaffRole {
  return {
    id: `rol-${name.toLowerCase().replace(/\s+/g, "-")}`,
    name,
    category,
    hourly_rate,
    active: true,
    created_at: "2026-01-01T00:00:00Z",
  };
}

const CHEF = rol("Chef", "produccion", 3500);
const AYUDANTE = rol("Ayudante", "produccion", 2400);
const MOZO = rol("Mozo", "servicio", 2200);

function empleado(
  id: string,
  full_name: string,
  role: StaffRole | null,
  ownRate: number | null,
): StaffWithRole {
  return {
    id,
    full_name,
    category: role?.category ?? "servicio",
    role: null,
    role_id: role?.id ?? null,
    hourly_rate: ownRate,
    active: true,
    created_at: "2026-01-01T00:00:00Z",
    staff_role: role,
  };
}

function asignacion(
  staff: StaffWithRole,
  hours: number,
  opts: { rate_override?: number | null; event_role?: StaffRole | null } = {},
): EventStaffWithStaff {
  const event_role = opts.event_role ?? null;
  return {
    id: `es-${staff.id}`,
    event_id: "evt-1",
    staff_id: staff.id,
    hours,
    rate_override: opts.rate_override ?? null,
    role_id: event_role?.id ?? null,
    paid: false,
    created_at: "2026-01-01T00:00:00Z",
    staff,
    event_role,
  };
}

// ---------------------------------------------------------------------------
console.log("\n2) HERENCIA — el empleado sin tarifa propia hereda la del rol");

const juan = empleado("s1", "Juan", MOZO, null); // hereda 2200
const sofia = empleado("s2", "Sofía", CHEF, null); // hereda 3500

check("Juan (rol Mozo)", resolveStaffRate(juan).rate, 2200);
check("Juan · origen", resolveStaffRate(juan).source, "rol");
check("Sofía (rol Chef)", resolveStaffRate(sofia).rate, 3500);

const sinRol = empleado("s0", "Sin rol", null, null);
check("Sin rol ni tarifa", resolveStaffRate(sinRol).rate, 0);
check("Sin rol · origen", resolveStaffRate(sinRol).source, "sin-tarifa");

// ---------------------------------------------------------------------------
console.log("\n3) TARIFA PROPIA — pisa a la del rol y se señaliza distinto");

const luis = empleado("s3", "Luis", MOZO, 2500); // mozo con más experiencia
check("Luis (propia 2500 sobre rol 2200)", resolveStaffRate(luis).rate, 2500);
check("Luis · origen", resolveStaffRate(luis).source, "empleado");
check("El rol no cambió", MOZO.hourly_rate, 2200);
check("Juan sigue heredando", resolveStaffRate(juan).rate, 2200);

// ---------------------------------------------------------------------------
console.log("\n4) ALTA MASIVA — 5 mozos, 5 horas cada uno");

const mozos = [
  empleado("m1", "Mozo 1", MOZO, null),
  empleado("m2", "Mozo 2", MOZO, null),
  empleado("m3", "Mozo 3", MOZO, null),
  empleado("m4", "Mozo 4", MOZO, null),
  empleado("m5", "Mozo 5", MOZO, 2500), // uno cobra distinto
];
const altaMasiva = mozos.map((m) => asignacion(m, 5));

check("Líneas creadas", altaMasiva.length, 5);
check("Mozo 1 · total", staffLineTotal(altaMasiva[0]), 5 * 2200);
check("Mozo 5 · total (tarifa propia)", staffLineTotal(altaMasiva[4]), 5 * 2500);

const masivo = computeEventStaff(altaMasiva);
check("Un solo grupo (Servicio)", masivo.groups.length, 1);
check("Subtotal servicio", masivo.groups[0].subtotal, 4 * 5 * 2200 + 5 * 2500);
check("Total del evento", masivo.total, 4 * 5 * 2200 + 5 * 2500);

// ---------------------------------------------------------------------------
console.log("\n5) ROL PUNTUAL — un mozo trabaja de ayudante en este evento");

const luisAyudante = asignacion(luis, 6, { event_role: AYUDANTE });

check("Tarifa aplicada = la del rol nuevo", resolveRate(luisAyudante).rate, 2400);
check("Origen", resolveRate(luisAyudante).source, "rol");
check("Rol marcado como puntual", resolveRate(luisAyudante).roleOverridden, true);
check("Total", staffLineTotal(luisAyudante), 6 * 2400);
check("Su rol habitual NO cambió", luis.role_id, MOZO.id);
check("Su tarifa propia NO cambió", luis.hourly_rate, 2500);

const conRolPuntual = computeEventStaff([luisAyudante, asignacion(juan, 5)]);
check("Suma en Producción, no en Servicio", conRolPuntual.groups[0].category, "produccion");
check("Subtotal producción", conRolPuntual.groups[0].subtotal, 6 * 2400);
check("Subtotal servicio", conRolPuntual.groups[1].subtotal, 5 * 2200);

// El mismo Luis en otro evento, sin rol puntual, vuelve a su tarifa propia.
check("En otro evento vuelve a 2500", resolveRate(asignacion(luis, 4)).rate, 2500);

// ---------------------------------------------------------------------------
console.log("\n6) AJUSTE PUNTUAL — tarifa distinta solo para este evento");

const juanFeriado = asignacion(juan, 5, { rate_override: 3000 });
check("Tarifa aplicada", resolveRate(juanFeriado).rate, 3000);
check("Origen", resolveRate(juanFeriado).source, "evento");
check("Total", staffLineTotal(juanFeriado), 5 * 3000);
check("Tarifa global del empleado intacta", juan.hourly_rate, null);
check("Tarifa del rol intacta", MOZO.hourly_rate, 2200);
check("Otro evento sin ajuste", resolveRate(asignacion(juan, 5)).rate, 2200);

// El ajuste puntual manda incluso con rol cambiado.
const combinado = asignacion(luis, 5, { event_role: AYUDANTE, rate_override: 2800 });
check("Ajuste puntual sobre rol puntual", resolveRate(combinado).rate, 2800);
check("Sigue sumando en Producción", computeEventStaff([combinado]).groups[0].category, "produccion");

// ---------------------------------------------------------------------------
console.log("\n7) COMPATIBILIDAD — eventos preexistentes con el mismo costo");

/** La lógica ANTERIOR a los roles: tarifa puntual, si no la del empleado. */
function costoViejo(es: EventStaffWithStaff): number {
  const rate = es.rate_override != null ? es.rate_override : (es.staff?.hourly_rate ?? 0);
  return es.hours * rate;
}

// Empleados tal como quedan tras la migración 0018: conservan su tarifa como
// tarifa propia, y el rol derivado del texto que ya tenían cargado.
const legacy: EventStaffWithStaff[] = [
  asignacion(empleado("l1", "Legacy chef", CHEF, 3200), 8),
  asignacion(empleado("l2", "Legacy mozo", MOZO, 2000), 5),
  asignacion(empleado("l3", "Legacy ajustado", MOZO, 2000), 5, { rate_override: 2600 }),
  asignacion(empleado("l4", "Legacy sin rol", null, 1800), 3),
  asignacion(empleado("l5", "Legacy en cero", MOZO, 0), 4), // 0 NO es "sin tarifa"
];

for (const es of legacy) {
  check(
    `${es.staff!.full_name} · costo idéntico`,
    staffLineTotal(es),
    costoViejo(es),
  );
}

const totalNuevo = computeEventStaff(legacy).total;
const totalViejo = legacy.reduce((s, es) => s + costoViejo(es), 0);
check("Costo total del evento legacy", totalNuevo, totalViejo);
check("Un empleado en $0 sigue en $0", staffLineTotal(legacy[4]), 0);

// La agrupación por categoría tampoco se mueve sin rol puntual.
const gruposLegacy = computeEventStaff(legacy).groups.map((g) => g.category);
check("Categorías agrupadas", gruposLegacy.join(","), "produccion,servicio");

// ---------------------------------------------------------------------------
console.log(
  `\n${fallos === 0 ? "✓ TODO OK" : "✗ HAY FALLOS"} — ${ok} verificaciones pasaron, ${fallos} fallaron\n`,
);
if (fallos > 0) process.exitCode = 1;
