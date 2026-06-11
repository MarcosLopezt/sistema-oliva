import * as XLSX from "xlsx";
import fs from "fs";
import {
  parsePresentation,
  presentationToContent,
  contentFromName,
} from "../src/lib/excel";

const FILE = "referencia/ListaNUEVA_Precios_Criollo.xlsx";
const buf = fs.readFileSync(FILE);
const wb = XLSX.read(buf, { type: "buffer" });
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils
  .sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false, defval: "" })
  .map((r) => r.map((c) => (c == null ? "" : String(c).trim())));

// header en fila índice 1; PRODUCTO col 1, PRESENTACIÓN col 2, PRECIO col 3
const data = rows.slice(2).filter((r) => (r[1] || "").trim());
type Status = "ok" | "name" | "review" | "fallback";
type Res = {
  name: string; raw: string; status: Status;
  envase: string | null; cant: number | null; un: string | null;
  baseUnit?: string; packSize?: number;
};
const results: Res[] = [];
for (const r of data) {
  const name = (r[1] || "").trim();
  const raw = (r[2] || "").trim();
  const p = parsePresentation(raw);
  const content = presentationToContent(p);
  let status: Status;
  let baseUnit: string | undefined;
  let packSize: number | undefined;
  if (content) {
    status = "ok";
    ({ baseUnit, packSize } = content);
  } else if (p.cantidad != null) {
    const fromName = contentFromName(name, p.cantidad);
    if (fromName) {
      status = "name";
      ({ baseUnit, packSize } = fromName);
    } else {
      status = "review";
    }
  } else {
    status = "fallback";
  }
  results.push({
    name, raw, status, envase: p.envase, cant: p.cantidad, un: p.unidad,
    baseUnit, packSize,
  });
}

const by = (s: Status) => results.filter((r) => r.status === s);
const ok = by("ok"), name = by("name"), rev = by("review"), fb = by("fallback");
const pct = (n: number) => ((n / data.length) * 100).toFixed(1);

let md = `# Reporte de importación — El Criollo Distribuidora\n\n`;
md += `Archivo: \`${FILE}\` · Hoja: \`${wb.SheetNames[0]}\`\n\n`;
md += `## Resumen\n\n`;
md += `| Resultado | Filas | % |\n|---|---:|---:|\n`;
md += `| ✅ Interpretadas desde la presentación | ${ok.length} | ${pct(ok.length)}% |\n`;
md += `| 🔎 Envase anidado resuelto desde el nombre | ${name.length} | ${pct(name.length)}% |\n`;
md += `| ⚠️ Requieren revisión manual | ${rev.length} | ${pct(rev.length)}% |\n`;
md += `| ℹ️ Solo etiqueta (unidad por defecto) | ${fb.length} | ${pct(fb.length)}% |\n`;
md += `| **Total filas de producto** | **${data.length}** | 100% |\n\n`;
md += `**Interpretadas automáticamente: ${ok.length + name.length} / ${data.length} (${pct(ok.length + name.length)}%).**\n\n`;

md += `## Envases anidados resueltos desde el nombre (${name.length})\n\n`;
md += `La presentación decía "Caja x N …" (contenido por sub-envase desconocido); se dedujo del nombre del producto.\n\n`;
md += `| Producto | Presentación | → contenido total (base/pack) |\n|---|---|---|\n`;
for (const r of name)
  md += `| ${r.name} | \`${r.raw}\` | ${r.baseUnit} / ${r.packSize} |\n`;

md += `\n## Requieren revisión manual (${rev.length})\n\n`;
if (rev.length === 0) md += `_Ninguna._\n`;
else {
  md += `| Producto | Presentación original |\n|---|---|\n`;
  for (const r of rev) md += `| ${r.name} | \`${r.raw}\` |\n`;
}

md += `\n## Muestra de interpretación (20 filas variadas)\n\n`;
md += `| Presentación original | Envase | Cantidad | Unidad | → base_unit / pack_size |\n|---|---|---:|:--:|---|\n`;
const seen = new Set<string>();
const sample: Res[] = [];
for (const r of results) {
  if (r.status === "review" || seen.has(r.raw)) continue;
  seen.add(r.raw);
  sample.push(r);
  if (sample.length >= 20) break;
}
for (const r of sample)
  md += `| \`${r.raw}\` | ${r.envase ?? "—"} | ${r.cant} | ${r.un ?? "—"} | ${r.baseUnit} / ${r.packSize} |\n`;

fs.writeFileSync("test-results-criollo.md", md);
console.log(
  `presentación ${ok.length} | nombre ${name.length} | revisión ${rev.length} | fallback ${fb.length} | total ${data.length}`,
);
console.log("Escrito: test-results-criollo.md");
