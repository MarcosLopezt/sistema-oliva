/**
 * Arnés de regresión del motor de costeo.
 *
 * Corre `computeMateriaPrima` sobre los fixtures de control y vuelca el
 * resultado a JSON. Sirve para comparar el ANTES y el DESPUÉS de un cambio y
 * probar que ningún número se movió. Se usó para validar que agregar
 * `neededBaseQty` (Sobrantes, Etapa 1) fue estrictamente aditivo: se comparó
 * campo por campo contra el snapshot previo y las 73 magnitudes dieron igual.
 *
 * Uso:
 *   SNAPSHOT_DEST=salida.json node -e "const {createJiti}=require('jiti');\
 *     createJiti(process.cwd()+'/',{alias:{'@':process.cwd()+'/src'}})\
 *     ('./scripts/verificar-motor-costeo.ts')"
 */
import fs from "fs";
import { computeMateriaPrima } from "@/lib/materia-prima";
import { CASES } from "./fixtures-costeo";

const out: Record<string, unknown> = {};
for (const [name, c] of Object.entries(CASES)) {
  out[name] = computeMateriaPrima(c.event, c.selections);
}

const dest = process.env.SNAPSHOT_DEST ?? "motor-costeo-snapshot.json";
fs.writeFileSync(dest, JSON.stringify(out, null, 2));
console.log(`Escrito: ${dest}`);
