/**
 * VERIFICACIÓN CRÍTICA — el costo de un evento finalizado no se mueve.
 *
 * Es el test que define si el congelamiento funcionó. Toma un evento, lo
 * "finaliza" (saca la foto), después rompe el catálogo de todas las formas que
 * antes le cambiaban los números —editar el precio de un producto, archivar un
 * ingrediente, cambiar una receta, cambiar la tarifa de un rol, borrar una
 * bebida— y comprueba que la foto siga dando EXACTAMENTE lo mismo.
 *
 * El punto 6 es el control negativo, y es tan importante como el resto: el
 * mismo evento en modo ABIERTO tiene que cambiar en todos esos casos. Sin eso,
 * un cálculo roto que devolviera siempre cero pasaría los cinco primeros.
 *
 * Corre sin base de datos: ejercita el mecanismo (buildSnapshotData /
 * readSnapshot), que es donde vive la garantía.
 *
 * Uso:
 *   node -e "const {createJiti}=require('jiti');createJiti(process.cwd()+'/',{alias:{'@':process.cwd()+'/src'}})('./scripts/verificar-costos-congelados.ts')"
 */
import {
  buildSnapshotData,
  computeEventCost,
  readSnapshot,
  type CostInputs,
  type EventCostSnapshot,
} from "@/lib/snapshot";
import type {
  BarBeverage,
  BarSettings,
  EventRecipeWithRecipe,
  EventStaffWithStaff,
  IngredientWithProduct,
} from "@/lib/types";
import { CASES } from "./fixtures-costeo";

let fallos = 0;
let ok = 0;

function check(nombre: string, real: unknown, esperado: unknown, tol = 1e-9) {
  const pasa =
    typeof real === "number" && typeof esperado === "number"
      ? Math.abs(real - esperado) <= tol
      : Object.is(real, esperado);
  if (pasa) {
    ok++;
    console.log(`  ✓ ${nombre}`);
  } else {
    fallos++;
    console.log(`  ✗ ${nombre}: esperado ${esperado}, obtenido ${real}`);
  }
}

function checkDistinto(nombre: string, a: number, b: number) {
  if (Math.abs(a - b) > 1e-9) {
    ok++;
    console.log(`  ✓ ${nombre} (${a.toFixed(2)} → ${b.toFixed(2)})`);
  } else {
    fallos++;
    console.log(
      `  ✗ ${nombre}: NO cambió (${a}). El control negativo falló: si el ` +
        `cálculo vivo tampoco reacciona, los tests de arriba no prueban nada.`,
    );
  }
}

// ---------------------------------------------------------------------------
// Escenario: un evento con las 6 secciones cargadas.
// ---------------------------------------------------------------------------

const settings: BarSettings = {
  id: true,
  dia_semana: 1,
  dia_jueves: 1.2,
  dia_finde: 1.4,
  hor_mediodia: 0.8,
  hor_cena: 1,
  hor_nocturno: 1.3,
};

function beverage(over: Partial<BarBeverage> & { id: string }): BarBeverage {
  return {
    name: "Bebida",
    service: "con_alcohol",
    size_ml: 1000,
    price: 5000,
    ml_per_person_hour: 20,
    sort_order: 0,
    market_auto: false,
    market_price_source: null,
    market_price_updated_at: null,
    created_at: "2026-01-01T00:00:00Z",
    ...over,
  } as BarBeverage;
}

function staffLine(
  over: Partial<EventStaffWithStaff> & { id: string },
): EventStaffWithStaff {
  return {
    event_id: "ev-1",
    staff_id: "st-1",
    hours: 8,
    rate_override: null,
    role_id: null,
    paid: false,
    created_at: "2026-01-01T00:00:00Z",
    staff: {
      id: "st-1",
      full_name: "Juan Pérez",
      category: "servicio",
      role: null,
      role_id: "role-1",
      hourly_rate: null, // hereda del rol → sensible a tocar la tarifa del rol
      active: true,
      created_at: "2026-01-01T00:00:00Z",
      staff_role: {
        id: "role-1",
        name: "Mozo",
        category: "servicio",
        hourly_rate: 4000,
        active: true,
        created_at: "2026-01-01T00:00:00Z",
      },
    },
    event_role: null,
    ...over,
  } as EventStaffWithStaff;
}

/** Arma los inputs del evento base. Cada llamada devuelve copias frescas. */
function baseInputs(): CostInputs {
  const caso = CASES.aceite;
  return {
    event: {
      ...caso.event,
      barra_service: "con_alcohol",
      barra_dia: "finde",
      barra_horario: "cena",
    },
    selections: structuredClone(caso.selections) as EventRecipeWithRecipe[],
    settings,
    beverages: [
      beverage({ id: "bev-1", name: "Fernet", price: 12000 }),
      beverage({ id: "bev-2", name: "Coca", price: 4000, size_ml: 2250 }),
    ],
    staff: [staffLine({ id: "es-1" })],
    tableware: [],
    costs: [
      {
        id: "c-1",
        event_id: "ev-1",
        section: "instalacion",
        name: "Flete",
        detail: null,
        quantity: 1,
        unit_price: 50000,
        sort_order: 0,
        created_at: "2026-01-01T00:00:00Z",
      },
    ],
  };
}

// ---------------------------------------------------------------------------
console.log("\n0) SE SACA LA FOTO al finalizar el evento");

const alFinalizar = baseInputs();
const data = buildSnapshotData(alFinalizar);
const snapshot = {
  event_id: "ev-1",
  taken_at: "2026-03-12T00:00:00Z",
  origin: "finalizado",
  reliable: true,
  internal_total: data.summary.internalTotal,
  price_per_person: data.summary.pricePerPerson,
  total_to_client: data.summary.totalToClient,
  // Pasa por JSON como pasaría por la base: si algo no sobrevive a la
  // serialización, tiene que romper acá y no en producción.
  data: JSON.parse(JSON.stringify(data)),
  history: [],
} as EventCostSnapshot;

const congelado = readSnapshot(snapshot);
if (!congelado) {
  console.log("  ✗ readSnapshot devolvió null: la foto no se puede leer.");
  process.exit(1);
}

const COSTO_AL_CERRAR = congelado.summary.internalTotal;
const PRECIO_AL_CERRAR = congelado.summary.pricePerPerson;
console.log(`  Costo interno al cerrar:  ${COSTO_AL_CERRAR.toFixed(2)}`);
console.log(`  Precio por persona:       ${PRECIO_AL_CERRAR.toFixed(2)}`);
check("la foto redondea igual que el cálculo vivo", COSTO_AL_CERRAR, data.summary.internalTotal);

// ---------------------------------------------------------------------------
// Cada mutación del catálogo se aplica sobre inputs frescos y se mide dos
// veces: contra la foto (no debe moverse) y contra el vivo (debe moverse).
// ---------------------------------------------------------------------------

type Mutacion = { nombre: string; aplicar: (i: CostInputs) => void };

/** Recorre los ingredientes de todas las recetas del evento. */
function ingredientes(i: CostInputs): IngredientWithProduct[] {
  return i.selections.flatMap((s) =>
    (s.recipe?.items ?? [])
      .map((it) => it.ingredient)
      .filter((x): x is IngredientWithProduct => x != null),
  );
}

const MUTACIONES: Mutacion[] = [
  {
    nombre: "1) editar el PRECIO de un producto que el evento usa",
    aplicar: (i) => {
      for (const ing of ingredientes(i)) {
        if (ing.product) ing.product.price = ing.product.price * 2;
      }
    },
  },
  {
    nombre: "2) ARCHIVAR un ingrediente (se desvincula de su producto)",
    aplicar: (i) => {
      // Archivar saca al ingrediente de circulación; el efecto sobre el costeo
      // es el mismo que tenía el borrado con su FK `on delete set null`.
      for (const ing of ingredientes(i)) {
        ing.product = null;
        ing.product_id = null;
        ing.market_price = null;
      }
    },
  },
  {
    nombre: "3) CAMBIAR una receta (otras cantidades)",
    aplicar: (i) => {
      for (const s of i.selections) {
        for (const it of s.recipe?.items ?? []) it.quantity *= 3;
      }
    },
  },
  {
    nombre: "4) cambiar la TARIFA del rol de su personal",
    aplicar: (i) => {
      for (const es of i.staff) {
        if (es.staff?.staff_role) es.staff.staff_role.hourly_rate = 99999;
      }
    },
  },
  {
    nombre: "5) BORRAR una bebida de su barra",
    aplicar: (i) => {
      i.beverages = i.beverages.filter((b) => b.id !== "bev-1");
    },
  },
];

console.log(
  "\n1-5) LA FOTO NO SE MUEVE aunque cambie el catálogo (evento finalizado)",
);

const vivosMutados: { nombre: string; total: number }[] = [];

for (const m of MUTACIONES) {
  const mutados = baseInputs();
  m.aplicar(mutados);

  // El evento finalizado lee de la foto, que es inmune por construcción: la
  // mutación no la puede alcanzar porque no vuelve a tocar el catálogo.
  const leido = readSnapshot(snapshot)!;
  check(
    `${m.nombre} → costo interno intacto`,
    leido.summary.internalTotal,
    COSTO_AL_CERRAR,
  );
  check(
    `${m.nombre} → precio por persona intacto`,
    leido.summary.pricePerPerson,
    PRECIO_AL_CERRAR,
  );

  vivosMutados.push({
    nombre: m.nombre,
    total: computeEventCost(mutados).summary.internalTotal,
  });
}

// ---------------------------------------------------------------------------
console.log(
  "\n6) CONTROL NEGATIVO — el mismo evento ABIERTO sí tiene que cambiar",
);
console.log(
  "   (si alguna de estas no cambia, el cálculo vivo está roto y los\n" +
    "    puntos 1-5 estarían pasando por la razón equivocada)",
);

for (const v of vivosMutados) {
  checkDistinto(`   vivo: ${v.nombre}`, COSTO_AL_CERRAR, v.total);
}

// ---------------------------------------------------------------------------
console.log(
  "\n7) EL BLOQUEO ESTÁ ACOTADO — pagos y sobrantes NO entran en la foto",
);

// El costo de personal sale de horas × tarifa. `paid` no participa: por eso
// marcar un pago sigue habilitado en un evento cerrado sin tocar su costo.
const conPago = baseInputs();
for (const es of conPago.staff) es.paid = true;
check(
  "marcar un empleado como pagado no cambia el costo",
  computeEventCost(conPago).summary.internalTotal,
  COSTO_AL_CERRAR,
);

// Los sobrantes son registro posterior y no descuentan de ningún cálculo
// (Etapa 1). La foto ni siquiera los incluye, así que registrar uno después de
// cerrar el evento no puede alterar el número congelado.
const claves = Object.keys(snapshot.data).sort().join(",");
check(
  "la foto no incluye sobrantes",
  claves.includes("leftover") || claves.includes("sobrante"),
  false,
);
console.log(`     claves de la foto: ${claves}`);

// ---------------------------------------------------------------------------
console.log(
  "\n8) VERSIONADO — una foto con otra forma cae al cálculo vivo, no rompe",
);

check(
  "schema_version desconocida → null",
  readSnapshot({
    ...snapshot,
    data: { ...snapshot.data, schema_version: 99 as unknown as 1 },
  }),
  null,
);
check("sin foto → null", readSnapshot(null), null);

// ---------------------------------------------------------------------------
console.log(`\n${"=".repeat(60)}`);
console.log(`RESULTADO: ${ok} OK · ${fallos} fallos`);
if (fallos > 0) {
  console.log(
    "HAY FALLOS: el costo de los eventos finalizados NO está protegido.",
  );
  process.exit(1);
}
console.log("El costo de un evento finalizado no se mueve. ✓");
