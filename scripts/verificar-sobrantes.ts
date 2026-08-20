/**
 * Verificación de la lógica de Sobrantes (Etapa 1), sin base de datos.
 *
 * Cubre los puntos del plan de testing que no necesitan UI:
 *  1. La precarga da cantidades coherentes con lo comprado vs lo necesario.
 *  3. La fecha de vencimiento se calcula bien desde la vida útil del producto.
 *  4. Un sobrante vencido cambia de estado (derivado, sin cron).
 *  5. Se guardan ambas cantidades y la calibración las compara bien.
 *
 * Uso:
 *   node -e "const {createJiti}=require('jiti');createJiti(process.cwd()+'/',{alias:{'@':process.cwd()+'/src'}})('./scripts/verificar-sobrantes.ts')"
 */
import { computeMateriaPrima } from "@/lib/materia-prima";
import {
  buildLeftoverDrafts,
  calibrationByProduct,
  computeExpiry,
  effectiveStatus,
  expiryInfo,
  formatQty,
  productsByIngredient,
  toBaseQty,
  toDisplayQty,
} from "@/lib/sobrantes";
import type { LeftoverWithProduct } from "@/lib/types";
import { CASES } from "./fixtures-costeo";

let fallos = 0;
let ok = 0;

function check(nombre: string, real: unknown, esperado: unknown, tol = 1e-6) {
  const pasa =
    typeof real === "number" && typeof esperado === "number"
      ? Math.abs(real - esperado) <= tol
      : Object.is(real, esperado);
  if (pasa) {
    ok++;
    console.log(`  ✓ ${nombre}: ${real}`);
  } else {
    fallos++;
    console.log(`  ✗ ${nombre}: esperado ${esperado}, obtenido ${real}`);
  }
}

// ---------------------------------------------------------------------------
console.log("\n1) PRECARGA — cantidades coherentes con comprado vs necesario");

for (const [nombre, caso] of Object.entries(CASES)) {
  const mp = computeMateriaPrima(caso.event, caso.selections);
  const drafts = buildLeftoverDrafts(
    caso.event,
    mp,
    productsByIngredient(caso.selections),
  );
  console.log(`\n  [${nombre}] ${drafts.length} línea(s) precargada(s)`);
  for (const d of drafts) {
    console.log(
      `    ${d.productName}: compró ${d.purchasedQty} · necesitó ${d.neededQty.toFixed(5)} ` +
        `· sobra ${formatQty(d.calculatedQty, d)}`,
    );
    check(
      `    coherencia (comprado − necesario)`,
      d.calculatedQty,
      d.purchasedQty - d.neededQty,
    );
  }
}

// El caso de control: el aceite deja 628,25 ml aunque surplusUnits sea 0.
{
  const caso = CASES.aceite;
  const mp = computeMateriaPrima(caso.event, caso.selections);
  const [d] = buildLeftoverDrafts(
    caso.event,
    mp,
    productsByIngredient(caso.selections),
  );
  console.log("\n  Caso de control (aceite, modelo tres capas):");
  check("    surplusUnits del motor (botellas cerradas)", mp.groups[0].lines[0].surplusUnits, 0);
  check("    sobrante real en ml", toDisplayQty(d.calculatedQty, d), 628.25, 1e-4);
  check("    presentación", formatQty(d.calculatedQty, d), "628,25 ml");
}

// El ejemplo textual del pedido: bidón de 5 L, sobran 3,1 L.
{
  const caso = CASES.bidon;
  const mp = computeMateriaPrima(caso.event, caso.selections);
  const [d] = buildLeftoverDrafts(
    caso.event,
    mp,
    productsByIngredient(caso.selections),
  );
  console.log("\n  Caso bidón (modelo directo):");
  check("    sobrante", toDisplayQty(d.calculatedQty, d), 3.1, 1e-9);
  check("    presentación", formatQty(d.calculatedQty, d), "3,1 L");
}

// Precio de mercado: sin packs, sin sobrante sistemático.
{
  const caso = CASES.mercado;
  const mp = computeMateriaPrima(caso.event, caso.selections);
  const drafts = buildLeftoverDrafts(
    caso.event,
    mp,
    productsByIngredient(caso.selections),
  );
  console.log("\n  Caso precio de mercado:");
  check("    líneas precargadas", drafts.length, 0);
}

// ---------------------------------------------------------------------------
console.log("\n2) IDA Y VUELTA DE UNIDADES — lo que se muestra vuelve igual");
{
  const tresCapas = {
    base_unit: "un" as const,
    unit_content_value: 5000,
    unit_content_unit: "ml" as const,
  };
  const directo = {
    base_unit: "l" as const,
    unit_content_value: null,
    unit_content_unit: null,
  };
  check("  tres capas: 0,12565 un → ml → un", toBaseQty(toDisplayQty(0.12565, tresCapas), tresCapas), 0.12565);
  check("  directo: 3,1 L → L → L", toBaseQty(toDisplayQty(3.1, directo), directo), 3.1);
  check("  usuario ingresa 3100 ml → base", toBaseQty(3100, tresCapas), 0.62);
}

// ---------------------------------------------------------------------------
console.log("\n3) VENCIMIENTO — fecha del evento + vida útil del producto");
check("  aceite: 2026-09-01 + 180 días", computeExpiry("2026-09-01", 180), "2027-02-28");
check("  crema: 2026-09-01 + 5 días", computeExpiry("2026-09-01", 5), "2026-09-06");
check("  verduras: 2026-09-01 + 3 días", computeExpiry("2026-09-01", 3), "2026-09-04");
check("  producto sin vida útil cargada", computeExpiry("2026-09-01", null), null);
check("  cruce de año", computeExpiry("2026-12-20", 30), "2027-01-19");

// ---------------------------------------------------------------------------
console.log("\n4) ESTADO DERIVADO — un vencido cambia de estado sin cron");
const HOY = "2026-09-10";
check(
  "  disponible con fecha futura",
  effectiveStatus({ status: "disponible", expires_at: "2026-09-30" }, HOY),
  "disponible",
);
check(
  "  disponible con fecha pasada → vencido",
  effectiveStatus({ status: "disponible", expires_at: "2026-09-01" }, HOY),
  "vencido",
);
check(
  "  vence hoy: todavía sirve",
  effectiveStatus({ status: "disponible", expires_at: HOY }, HOY),
  "disponible",
);
check(
  "  sin vencimiento: sigue disponible",
  effectiveStatus({ status: "disponible", expires_at: null }, HOY),
  "disponible",
);
check(
  "  consumido no se pisa con el vencimiento",
  effectiveStatus({ status: "consumido", expires_at: "2026-09-01" }, HOY),
  "consumido",
);
check("  a 5 días → por vencer", expiryInfo("2026-09-15", HOY).state, "por-vencer");
check("  a 20 días → ok", expiryInfo("2026-09-30", HOY).state, "ok");
check("  sin fecha → sin definir", expiryInfo(null, HOY).state, "sin-definir");

// ---------------------------------------------------------------------------
console.log("\n5) CALIBRACIÓN — calculado vs confirmado");
{
  const base = {
    id: "x",
    product_id: "prod-aceite",
    origin_event_id: "e",
    base_unit: "un" as const,
    unit_content_value: 5000,
    unit_content_unit: "ml" as const,
    purchased_qty: 142,
    unit_cost: 105099.18,
    merma_pct: 0.15,
    origin_event_name: "Casamiento García",
    status: "disponible" as const,
    registered_at: "2026-09-02",
    expires_at: "2027-03-01",
    expiry_manual: false,
    note: null,
    created_at: "",
    updated_at: "",
    product: null,
  };

  // Tres eventos: el sistema calculó 0,12 un y sobró consistentemente menos.
  const muestras: LeftoverWithProduct[] = [
    { ...base, id: "1", qty_calculated: 0.12, qty_confirmed: 0.08, qty_remaining: 0.08 },
    { ...base, id: "2", qty_calculated: 0.12, qty_confirmed: 0.06, qty_remaining: 0.06 },
    { ...base, id: "3", qty_calculated: 0.12, qty_confirmed: 0.1, qty_remaining: 0.1 },
    // Carga manual: sin cálculo del sistema, no debe entrar en el promedio.
    { ...base, id: "4", qty_calculated: null, qty_confirmed: 5, qty_remaining: 5 },
  ];

  const [row] = calibrationByProduct(muestras);
  check("  muestras contadas (excluye la manual)", row.samples, 3);
  check("  promedio calculado", row.avgCalculated, 0.12);
  check("  promedio confirmado", row.avgConfirmed, 0.08, 1e-9);
  check("  diferencia (negativa = sobró menos)", row.avgDiff, -0.04, 1e-9);
  check("  diferencia %", Math.round(row.avgDiffPct!), -33);
  console.log(
    "    → sobra 33% menos de lo calculado: la merma real es mayor que el 15% configurado.",
  );
}

// ---------------------------------------------------------------------------
console.log(
  `\n${fallos === 0 ? "TODO OK" : "HAY FALLOS"} — ${ok} verificaciones pasaron, ${fallos} fallaron.`,
);
if (fallos > 0) process.exitCode = 1;
