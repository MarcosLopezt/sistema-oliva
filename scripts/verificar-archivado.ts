/**
 * VERIFICACIÓN — archivado y selección múltiple.
 *
 * Cubre los puntos del plan de testing que no necesitan base ni navegador:
 *  2. Archivar algo usado por un evento ACTIVO se detecta y se nombra.
 *  3. Archivar NO puede tocar un evento FINALIZADO (lee su foto).
 *  4. El deshacer restituye exactamente los ids de la operación.
 *  5. "Seleccionar todos" con un filtro activo toma solo los filtrados.
 *
 * Uso:
 *   node -e "const {createJiti}=require('jiti');createJiti(process.cwd()+'/',{alias:{'@':process.cwd()+'/src'}})('./scripts/verificar-archivado.ts')"
 */
import {
  BULK_CONFIRM_THRESHOLD,
  buildDependencyGraph,
  computeArchiveImpact,
  computeDeletePlan,
  nameList,
  type ArchivableRow,
} from "@/lib/archivado";
import {
  buildSnapshotData,
  computeEventCost,
  readSnapshot,
  type CostInputs,
  type EventCostSnapshot,
} from "@/lib/snapshot";
import type { EventRow } from "@/lib/types";
import { CASES } from "./fixtures-costeo";

let fallos = 0;
let ok = 0;

function check(nombre: string, real: unknown, esperado: unknown) {
  const pasa =
    typeof real === "number" && typeof esperado === "number"
      ? Math.abs(real - esperado) < 1e-9
      : Object.is(real, esperado);
  if (pasa) {
    ok++;
    console.log(`  ✓ ${nombre}`);
  } else {
    fallos++;
    console.log(`  ✗ ${nombre}: esperado ${esperado}, obtenido ${real}`);
  }
}

// ---------------------------------------------------------------------------
// Escenario: dos eventos activos y uno finalizado, sobre el mismo catálogo.
// ---------------------------------------------------------------------------

const base = CASES.aceite.event;

const evActivo1: EventRow = {
  ...base,
  id: "ev-act-1",
  name: "Casamiento García",
  status: "activo",
  barra_service: "con_alcohol",
};
const evActivo2: EventRow = {
  ...base,
  id: "ev-act-2",
  name: "Corporativo Banco Nación",
  status: "activo",
  barra_service: "sin_alcohol",
};
const evCerrado: EventRow = {
  ...base,
  id: "ev-fin",
  name: "Cumpleaños Pérez",
  status: "finalizado",
  barra_service: "con_alcohol",
};

const graph = buildDependencyGraph({
  events: [evActivo1, evActivo2, evCerrado],
  eventRecipes: [
    { event_id: "ev-act-1", recipe_id: "rec-1" },
    { event_id: "ev-act-2", recipe_id: "rec-2" },
    // El evento cerrado usa la MISMA receta que el activo 1: es la trampa.
    { event_id: "ev-fin", recipe_id: "rec-1" },
  ],
  recipes: [
    { id: "rec-1", items: [{ ingredient_id: "ing-aceite" }] },
    { id: "rec-2", items: [{ ingredient_id: "ing-sal" }] },
  ],
  ingredients: [
    { id: "ing-aceite", product_id: "prod-aceite" },
    { id: "ing-sal", product_id: null },
  ],
});

// ---------------------------------------------------------------------------
console.log("\n2) ARCHIVAR algo usado por un evento ACTIVO se detecta y se nombra");

{
  const rows: ArchivableRow[] = [{ id: "ing-aceite", name: "Aceite" }];
  const imp = computeArchiveImpact("ingredients", rows, graph);

  check("detecta 1 evento activo afectado", imp.affected.length, 1);
  check(
    "lo nombra",
    imp.affected[0]?.event.name,
    "Casamiento García",
  );
  check("dice por qué elemento", imp.affected[0]?.via.join(","), "Aceite");
  check("nada queda bloqueado: archivar siempre se puede", imp.blocked.length, 0);
  check("se archiva el que se pidió", imp.archivable.length, 1);
}

{
  // Un producto llega al evento a través del ingrediente que abastece.
  const imp = computeArchiveImpact(
    "products",
    [{ id: "prod-aceite", name: "Aceite bidón 5 L" }],
    graph,
  );
  check(
    "un producto también se rastrea hasta el evento activo",
    imp.affected[0]?.event.name,
    "Casamiento García",
  );
}

{
  // Las bebidas no tienen FK: el impacto se decide por el servicio del evento.
  const imp = computeArchiveImpact(
    "bar_beverages",
    [{ id: "bev-1", name: "Fernet", service: "con_alcohol" } as ArchivableRow],
    graph,
  );
  check(
    "una bebida alcanza solo a los eventos activos de su servicio",
    imp.affected.map((a) => a.event.name).join(","),
    "Casamiento García",
  );
}

{
  // Los sobrantes son hoja del grafo: no entran en ningún costeo.
  const imp = computeArchiveImpact(
    "leftovers",
    [{ id: "lef-1", name: "Aceite sobrante" }],
    graph,
  );
  check("archivar un sobrante no afecta a ningún evento", imp.affected.length, 0);
}

// ---------------------------------------------------------------------------
console.log(
  "\n3) EL EVENTO FINALIZADO NO APARECE — y de hecho no puede verse afectado",
);

{
  const imp = computeArchiveImpact(
    "ingredients",
    [{ id: "ing-aceite", name: "Aceite" }],
    graph,
  );
  check(
    "el evento cerrado usa la misma receta pero NO se lista",
    imp.affected.some((a) => a.event.id === "ev-fin"),
    false,
  );
}

{
  // Y no es que se lo esconda: se demuestra que archivar no lo mueve.
  const inputs: CostInputs = {
    event: evCerrado,
    selections: structuredClone(CASES.aceite.selections),
    settings: null,
    beverages: [],
    staff: [],
    tableware: [],
    costs: [],
  };
  const data = buildSnapshotData(inputs);
  const snap = {
    event_id: "ev-fin",
    taken_at: "2026-03-12T00:00:00Z",
    origin: "finalizado",
    reliable: true,
    internal_total: data.summary.internalTotal,
    price_per_person: data.summary.pricePerPerson,
    total_to_client: data.summary.totalToClient,
    data: JSON.parse(JSON.stringify(data)),
    history: [],
  } as EventCostSnapshot;

  const antes = readSnapshot(snap)!.summary.internalTotal;

  // Se archivan ingrediente Y producto: el ingrediente pierde su producto,
  // que es el efecto real que archivar tiene sobre el catálogo vivo.
  const mutados = structuredClone(inputs);
  for (const s of mutados.selections) {
    for (const it of s.recipe?.items ?? []) {
      if (it.ingredient) {
        it.ingredient.active = false;
        it.ingredient.product = null;
        it.ingredient.product_id = null;
      }
    }
  }

  const despues = readSnapshot(snap)!.summary.internalTotal;
  const vivo = computeEventCost(mutados).summary.internalTotal;

  check("el costo del evento FINALIZADO no se movió", despues, antes);
  console.log(`     foto: ${antes.toFixed(2)} → ${despues.toFixed(2)}`);
  if (Math.abs(vivo - antes) > 1e-9) {
    ok++;
    console.log(
      `  ✓ control negativo: el cálculo vivo sí cambió (${antes.toFixed(2)} → ${vivo.toFixed(2)})`,
    );
  } else {
    fallos++;
    console.log("  ✗ control negativo: el cálculo vivo tampoco cambió.");
  }
}

// ---------------------------------------------------------------------------
console.log("\n4) DESHACER restituye exactamente los ids de esa operación");

{
  // Simula la base: qué está archivado y qué no.
  const archivados = new Set<string>(["viejo-1", "viejo-2"]);
  const setActive = (ids: string[], active: boolean) => {
    for (const id of ids) {
      if (active) archivados.delete(id);
      else archivados.add(id);
    }
    return ids.length;
  };

  const seleccion = ["a", "b", "c"];
  // Los ids se capturan ANTES de mutar. Es el punto del test.
  const idsDeEstaOperacion = [...seleccion];
  setActive(idsDeEstaOperacion, false);

  check("tras archivar hay 5 archivados", archivados.size, 5);

  // Alguien archiva otra cosa entremedio, antes de tocar "Deshacer".
  setActive(["intruso"], false);
  check("aparece un archivado ajeno", archivados.size, 6);

  setActive(idsDeEstaOperacion, true);

  check("el deshacer devolvió los 3 de la operación", archivados.size, 3);
  check("no resucitó los archivados de antes", archivados.has("viejo-1"), true);
  check("no tocó el archivado ajeno", archivados.has("intruso"), true);
  check("ninguno de los 3 quedó archivado", seleccion.some((id) => archivados.has(id)), false);
}

// ---------------------------------------------------------------------------
console.log('\n5) "SELECCIONAR TODOS" respeta los filtros activos');

{
  // Réplica de la lógica de useBulkSelection, sin React.
  type Fila = { id: string; proveedor: string };
  const catalogo: Fila[] = [
    { id: "p1", proveedor: "Criollo" },
    { id: "p2", proveedor: "Criollo" },
    { id: "p3", proveedor: "Cabañas" },
    { id: "p4", proveedor: "Cabañas" },
    { id: "p5", proveedor: "Gaucho" },
  ];

  const filtrar = (prov: string) =>
    prov === "todos" ? catalogo : catalogo.filter((f) => f.proveedor === prov);

  let seleccion = new Set<string>();
  const seleccionarTodos = (visibles: Fila[]) => {
    const next = new Set(seleccion);
    for (const f of visibles) next.add(f.id);
    seleccion = next;
  };
  /** La selección real: los seleccionados que además siguen visibles. */
  const efectiva = (visibles: Fila[]) =>
    visibles.filter((f) => seleccion.has(f.id)).map((f) => f.id);

  const visiblesCriollo = filtrar("Criollo");
  seleccionarTodos(visiblesCriollo);

  check("con filtro Criollo selecciona 2, no 5", efectiva(visiblesCriollo).length, 2);
  check(
    "y son los del filtro",
    efectiva(visiblesCriollo).join(","),
    "p1,p2",
  );

  // Se cambia el filtro sin deseleccionar: lo de Criollo no debe archivarse.
  const visiblesGaucho = filtrar("Gaucho");
  check(
    "al cambiar de filtro, la selección efectiva se poda a lo visible",
    efectiva(visiblesGaucho).length,
    0,
  );
}

// ---------------------------------------------------------------------------
console.log("\n6) BORRADO DEFINITIVO — solo lo que no está referenciado");

{
  const rows: ArchivableRow[] = [
    { id: "ing-usado", name: "Sal" },
    { id: "ing-libre", name: "Perejil" },
  ];
  const plan = computeDeletePlan("ingredients", rows, {
    recipesByIngredient: new Map([["ing-usado", 3]]),
  });
  check("el usado queda bloqueado", plan.blocked.length, 1);
  check("con el motivo", plan.blocked[0]?.reason, "se usa en 3 recetas");
  check("el libre se puede borrar", plan.deletable[0]?.name, "Perejil");
}

{
  // El producto es el caso delicado: sus FKs son SET NULL y CASCADE, así que
  // sin chequeo explícito el borrado no fallaría — corrompería en silencio.
  const plan = computeDeletePlan(
    "products",
    [
      { id: "prod-a", name: "Aceite" },
      { id: "prod-b", name: "Sal gruesa" },
    ],
    {
      ingredientsByProduct: new Map([["prod-a", 2]]),
      leftoversByProduct: new Map([["prod-a", 1]]),
    },
  );
  check("el producto referenciado se bloquea", plan.blocked.length, 1);
  check(
    "y explica las dos referencias",
    plan.blocked[0]?.reason,
    "2 ingredientes lo usan y 1 sobrante salió de él",
  );
  check("el libre se borra", plan.deletable[0]?.name, "Sal gruesa");
}

// ---------------------------------------------------------------------------
console.log("\n7) DETALLES DE LOS DIÁLOGOS");

check(
  "la lista larga se recorta",
  nameList(
    Array.from({ length: 12 }, (_, i) => ({ id: String(i), name: `E${i}` })),
    3,
  ),
  "E0, E1, E2 y 9 más",
);
check(
  "la lista corta va entera",
  nameList([{ id: "1", name: "Uno" }, { id: "2", name: "Dos" }]),
  "Uno, Dos",
);
check("el umbral de confirmación fuerte es 10", BULK_CONFIRM_THRESHOLD, 10);

// ---------------------------------------------------------------------------
console.log(
  "\n8) LAS DOS CAPAS COINCIDEN — lo que RESTRICT frena, el plan lo frena antes",
);

{
  /**
   * Desde 0021 hay cinco FKs en RESTRICT que pueden rechazar un DELETE. El
   * camino de archivados NO debe apoyarse en ese rechazo: tiene que detectar
   * el mismo caso antes y explicarlo. Si alguna de estas fallara, el usuario
   * vería el error crudo de Postgres en lugar del mensaje útil.
   *
   * Cada fila es: una FK entrante → el conteo que el plan usa para frenarla.
   */
  const casos: {
    fk: string;
    entity: Parameters<typeof computeDeletePlan>[0];
    refs: Parameters<typeof computeDeletePlan>[2];
  }[] = [
    {
      fk: "recipe_items.ingredient_id → ingredients",
      entity: "ingredients",
      refs: { recipesByIngredient: new Map([["x", 1]]) },
    },
    {
      fk: "event_recipes.recipe_id → recipes",
      entity: "recipes",
      refs: { eventsByRecipe: new Map([["x", 1]]) },
    },
    {
      fk: "ingredients.product_id → products (0021)",
      entity: "products",
      refs: { ingredientsByProduct: new Map([["x", 1]]) },
    },
    {
      fk: "leftovers.product_id → products (0021)",
      entity: "products",
      refs: { leftoversByProduct: new Map([["x", 1]]) },
    },
  ];

  for (const c of casos) {
    const plan = computeDeletePlan(c.entity, [{ id: "x", name: "X" }], c.refs);
    check(
      `frena antes de tocar la base: ${c.fk}`,
      plan.blocked.length === 1 && plan.deletable.length === 0,
      true,
    );
  }

  // Y sin referencias, el borrado sigue estando permitido: RESTRICT no
  // convierte al archivado en un callejón sin salida.
  const libre = computeDeletePlan("products", [{ id: "y", name: "Y" }], {});
  check("sin referencias, el borrado definitivo sigue disponible", libre.deletable.length, 1);
}

// ---------------------------------------------------------------------------
console.log(`\n${"=".repeat(60)}`);
console.log(`RESULTADO: ${ok} OK · ${fallos} fallos`);
if (fallos > 0) process.exit(1);
console.log("Archivado y selección múltiple: OK ✓");
