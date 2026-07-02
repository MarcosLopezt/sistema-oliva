"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, TriangleAlert, CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/native-select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  readWorkbook,
  guessHeaderRow,
  parseContent,
  parsePrice,
  parsePresentation,
  presentationToContent,
  contentFromName,
  autoMapProductColumns,
  NO_COLUMN,
  type SheetGrid,
  type ProductField,
} from "@/lib/excel";
import { useBulkUpsertProducts } from "@/lib/hooks";
import { UNITS, type ProductInput, type UnitKind } from "@/lib/types";
import { formatARS, formatNum, unitLabel } from "@/lib/format";
import { parseUnitContentFromName } from "@/lib/unit-content-parser";

const NONE = "-1";

type RowStatus = "ok" | "fallback" | "review";

/** Fila analizada: valores sugeridos + estado + texto de presentación original. */
type Analyzed = {
  rowIndex: number;
  name: string;
  code: string | null;
  price: number;
  saleUnit: string | null;
  baseUnit: UnitKind;
  packSize: number;
  status: RowStatus;
  /** Texto original de presentación (solo en filas a revisar). */
  presentationRaw: string | null;
  /** Cantidad sugerida por el parser para precargar la revisión. */
  suggestedQty: number | null;
};

/** Convierte cantidad + unidad a {baseUnit, packSize} normalizando kg→g, L→ml. */
function qtyUnitToContent(
  qty: number,
  unit: UnitKind,
): { baseUnit: UnitKind; packSize: number } {
  if (unit === "kg") return { baseUnit: "g", packSize: qty * 1000 };
  if (unit === "l") return { baseUnit: "ml", packSize: qty * 1000 };
  return { baseUnit: unit, packSize: qty };
}

export function ExcelImportDialog({
  open,
  onOpenChange,
  providerId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providerId: string;
}) {
  const upsert = useBulkUpsertProducts();
  const [grid, setGrid] = useState<SheetGrid | null>(null);
  const [sheet, setSheet] = useState("");
  const [headerRow, setHeaderRow] = useState(0);
  const [cols, setCols] = useState<Record<ProductField, string>>({
    name: NONE,
    price: NONE,
    saleUnit: NONE,
    content: NONE,
    presentation: NONE,
    code: NONE,
  });
  const [defaultUnit, setDefaultUnit] = useState<UnitKind>("un");
  const [iva, setIva] = useState(false);
  // Ediciones manuales de las filas a revisar (clave = índice de fila).
  const [reviewEdits, setReviewEdits] = useState<
    Record<number, { qty: string; unit: UnitKind }>
  >({});

  function reset() {
    setGrid(null);
    setSheet("");
    setHeaderRow(0);
    setCols({
      name: NONE, price: NONE, saleUnit: NONE, content: NONE,
      presentation: NONE, code: NONE,
    });
    setReviewEdits({});
  }

  function autoMap(header: string[]) {
    const m = autoMapProductColumns(header);
    const toStr = (i: number) => (i === NO_COLUMN ? NONE : String(i));
    setCols({
      name: toStr(m.name),
      price: toStr(m.price),
      saleUnit: toStr(m.saleUnit),
      content: toStr(m.content),
      presentation: toStr(m.presentation),
      code: toStr(m.code),
    });
    setReviewEdits({});
  }

  async function handleFile(file: File) {
    try {
      const g = await readWorkbook(file);
      const first = g.sheetNames[0] ?? "";
      setGrid(g);
      setSheet(first);
      const rows = g.rows(first);
      const hr = guessHeaderRow(rows);
      setHeaderRow(hr);
      autoMap(rows[hr] ?? []);
    } catch (e) {
      toast.error("No se pudo leer el archivo", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  const rows = useMemo(
    () => (grid && sheet ? grid.rows(sheet) : []),
    [grid, sheet],
  );
  const header = rows[headerRow] ?? [];
  const colCount = Math.max(0, ...rows.map((r) => r.length));
  const colOptions = Array.from({ length: colCount }, (_, i) => ({
    value: String(i),
    label: header[i]?.trim() || `Columna ${i + 1}`,
  }));

  const idx = (key: ProductField) =>
    cols[key] === NONE ? NO_COLUMN : Number(cols[key]);

  // Analiza cada fila: aplica el parser de presentación y deja un estado.
  const analyzed: Analyzed[] = useMemo(() => {
    const ni = idx("name");
    const pi = idx("price");
    if (!rows.length || ni === NO_COLUMN || pi === NO_COLUMN) return [];
    const si = idx("saleUnit");
    const cti = idx("content");
    const presi = idx("presentation");
    const codi = idx("code");
    const out: Analyzed[] = [];

    for (let i = headerRow + 1; i < rows.length; i++) {
      const r = rows[i];
      const name = (r[ni] ?? "").trim();
      if (!name) continue;
      const price = parsePrice(r[pi] ?? "");
      if (Number.isNaN(price)) continue;

      const saleUnitLabel = si >= 0 ? (r[si] || "").trim() : "";
      let baseUnit: UnitKind = defaultUnit;
      let packSize = 1;
      let status: RowStatus = "fallback";
      let saleUnit: string | null = saleUnitLabel || null;
      let presentationRaw: string | null = null;
      let suggestedQty: number | null = null;

      // Prioridad 1: columna "Contenido" explícita (dato más confiable).
      const contentColRaw = cti >= 0 ? (r[cti] || "").trim() : "";
      const contentColParsed = contentColRaw ? parseContent(contentColRaw) : null;

      if (contentColParsed) {
        baseUnit = contentColParsed.baseUnit;
        packSize = contentColParsed.packSize;
        status = "ok";
        // Columna de presentación determina la unidad de venta (ej "bolsa", "cabeza").
        if (presi >= 0 && (r[presi] || "").trim()) {
          const p = parsePresentation((r[presi] || "").trim());
          saleUnit = saleUnitLabel || p.envase || (r[presi] || "").trim() || null;
        }
      } else if (presi >= 0 && (r[presi] || "").trim()) {
        // Prioridad 2: columna "Presentación" con texto libre.
        const raw = (r[presi] || "").trim();
        const p = parsePresentation(raw);
        const content = presentationToContent(p);
        if (content) {
          baseUnit = content.baseUnit;
          packSize = content.packSize;
          status = "ok";
          saleUnit = saleUnitLabel || p.envase || null;
        } else if (p.cantidad != null) {
          // Envase anidado ("Caja x 6 bidones"): intentamos sacar el contenido
          // del NOMBRE del producto (suele traerlo, ej "OREO 12 X 354 GRS").
          const fromName = contentFromName(name, p.cantidad);
          if (fromName) {
            baseUnit = fromName.baseUnit;
            packSize = fromName.packSize;
            status = "ok";
            saleUnit = saleUnitLabel || p.envase || null;
          } else {
            status = "review";
            presentationRaw = raw;
            suggestedQty = p.cantidad;
            saleUnit = saleUnitLabel || p.envase || raw;
          }
        } else {
          // Solo etiqueta (ej "docena"): la usamos como unidad de venta.
          saleUnit = saleUnitLabel || raw;
          status = "fallback";
        }
      }

      out.push({
        rowIndex: i, name, price, saleUnit, baseUnit, packSize, status,
        presentationRaw, suggestedQty,
        code: codi >= 0 ? (r[codi] || "").trim() || null : null,
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, headerRow, cols, defaultUnit]);

  // Aplica la edición manual (si existe) a una fila a revisar.
  function finalContent(a: Analyzed): { baseUnit: UnitKind; packSize: number } {
    if (a.status === "review") {
      const edit = reviewEdits[a.rowIndex];
      const qty = edit ? parsePrice(edit.qty) : a.suggestedQty ?? NaN;
      if (Number.isFinite(qty) && qty > 0) {
        return qtyUnitToContent(qty, edit?.unit ?? "un");
      }
    }
    return { baseUnit: a.baseUnit, packSize: a.packSize };
  }

  function toInput(a: Analyzed): ProductInput {
    const c = finalContent(a);
    // Auto-detectar contenido por unidad desde el nombre cuando el producto
    // está en 'un' (unidades). Permite calcular costos proporcionales luego.
    let unit_content_value: number | null = null;
    let unit_content_unit: UnitKind | null = null;
    if (c.baseUnit === "un") {
      const detected = parseUnitContentFromName(a.name);
      if (detected) {
        unit_content_value = detected.value;
        unit_content_unit = detected.unit;
      }
    }
    return {
      provider_id: providerId,
      name: a.name,
      code: a.code,
      base_unit: c.baseUnit,
      pack_size: c.packSize,
      price: a.price,
      sale_unit: a.saleUnit,
      price_includes_iva: iva,
      unit_content_value,
      unit_content_unit,
    };
  }

  const missingRequired = idx("name") === NO_COLUMN || idx("price") === NO_COLUMN;
  const okCount = analyzed.filter((a) => a.status === "ok").length;
  const fallbackCount = analyzed.filter((a) => a.status === "fallback").length;
  const reviewRows = analyzed.filter((a) => a.status === "review");
  const previewRows = analyzed.filter((a) => a.status !== "review");

  async function handleImport() {
    if (analyzed.length === 0) {
      toast.error("No hay filas válidas para importar.");
      return;
    }
    try {
      const { inserted, updated, priceChanges } = await upsert.mutateAsync({
        providerId,
        rows: analyzed.map(toInput),
      });
      const parts: string[] = [];
      if (inserted > 0) parts.push(`${inserted} nuevo${inserted !== 1 ? "s" : ""}`);
      if (updated > 0) parts.push(`${updated} actualizado${updated !== 1 ? "s" : ""}`);
      const summary = parts.join(", ") || "sin cambios";

      const descParts: string[] = [];
      if (reviewRows.length > 0)
        descParts.push(`${reviewRows.length} requieren revisión del contenido.`);
      if (priceChanges.length > 0)
        descParts.push(
          `Cambios de precio: ${priceChanges
            .map((c) => `${c.name}: ${formatARS(c.oldPrice)} → ${formatARS(c.newPrice)}`)
            .join("; ")}.`,
        );

      toast.success(`Importación completada: ${summary}.`, {
        description: descParts.length > 0 ? descParts.join(" ") : undefined,
      });
      reset();
      onOpenChange(false);
    } catch (e) {
      toast.error("Falló la importación", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  function close(o: boolean) {
    if (!o) reset();
    onOpenChange(o);
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar lista de precios (Excel)</DialogTitle>
          <DialogDescription>
            Subí el .xlsx/.xls/.csv del proveedor. Detectamos las columnas por su
            encabezado; revisá el mapeo y la vista previa antes de importar.
          </DialogDescription>
        </DialogHeader>

        {!grid ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="excel-file">Archivo</Label>
            <Input
              id="excel-file"
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            <p className="text-xs text-muted-foreground">
              Columnas que reconocemos (en cualquier orden): producto/descripción ·
              precio/costo · presentación/formato · unidad de venta · cantidad por
              unidad · código. La columna de presentación (ej “Bolsa x 5 kgs”) se
              interpreta sola.
            </p>
          </div>
        ) : (
          <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto pr-1">
            {missingRequired ? (
              <Banner
                tone="error"
                icon={<CircleAlert className="size-4" />}
                text="No detectamos Producto y/o Precio. Asignalos manualmente abajo."
              />
            ) : (
              <Banner
                tone={reviewRows.length > 0 ? "warn" : "ok"}
                icon={
                  reviewRows.length > 0 ? (
                    <TriangleAlert className="size-4" />
                  ) : (
                    <CheckCircle2 className="size-4" />
                  )
                }
                text={`${okCount + fallbackCount} productos interpretados automáticamente${
                  reviewRows.length > 0
                    ? ` · ${reviewRows.length} requieren revisión manual (abajo)`
                    : ""
                }.`}
              />
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Hoja</Label>
                <NativeSelect
                  value={sheet}
                  onChange={(e) => {
                    setSheet(e.target.value);
                    const rs = grid.rows(e.target.value);
                    const hr = guessHeaderRow(rs);
                    setHeaderRow(hr);
                    autoMap(rs[hr] ?? []);
                  }}
                >
                  {grid.sheetNames.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="header-row">Fila de encabezados (1 = primera)</Label>
                <Input
                  id="header-row"
                  inputMode="numeric"
                  value={String(headerRow + 1)}
                  onChange={(e) => {
                    const v = Math.max(1, Number(e.target.value) || 1) - 1;
                    setHeaderRow(v);
                    autoMap(rows[v] ?? []);
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Mapping label="Producto *" value={cols.name} onChange={(v) => setCols((c) => ({ ...c, name: v }))} options={colOptions} />
              <Mapping label="Precio *" value={cols.price} onChange={(v) => setCols((c) => ({ ...c, price: v }))} options={colOptions} />
              <Mapping label="Presentación" value={cols.presentation} onChange={(v) => setCols((c) => ({ ...c, presentation: v }))} options={colOptions} optional />
              <Mapping label="Unidad de venta" value={cols.saleUnit} onChange={(v) => setCols((c) => ({ ...c, saleUnit: v }))} options={colOptions} optional />
              <Mapping label="Cant. por unidad" value={cols.content} onChange={(v) => setCols((c) => ({ ...c, content: v }))} options={colOptions} optional />
              <Mapping label="Código" value={cols.code} onChange={(v) => setCols((c) => ({ ...c, code: v }))} options={colOptions} optional />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Unidad por defecto (si falta el contenido)</Label>
                <NativeSelect
                  value={defaultUnit}
                  onChange={(e) => setDefaultUnit(e.target.value as UnitKind)}
                >
                  {UNITS.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <label className="mt-6 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={iva}
                  onChange={(e) => setIva(e.target.checked)}
                  className="size-4"
                />
                Precios c/IVA
              </label>
            </div>

            {!missingRequired && (
              <div>
                <p className="mb-2 text-sm font-medium">
                  Vista previa — {previewRows.length} productos
                  {fallbackCount > 0 && (
                    <span className="ml-2 inline-flex items-center gap-1 text-amber-600">
                      <TriangleAlert className="size-3.5" />
                      {fallbackCount} sin contenido (unidad por defecto: {defaultUnit})
                    </span>
                  )}
                </p>
                <div className="overflow-hidden rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead>Unidad de venta</TableHead>
                        <TableHead className="text-right">Pack</TableHead>
                        <TableHead className="text-right">Precio</TableHead>
                        <TableHead className="text-right">$/unidad</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewRows.slice(0, 8).map((a, i) => {
                        const u = unitLabel(a.baseUnit);
                        return (
                          <TableRow key={i}>
                            <TableCell className="max-w-[220px] truncate">
                              {a.name}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {a.saleUnit || u}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatNum(a.packSize)} {u}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatARS(a.price)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">
                              {formatARS(a.price / a.packSize)} / {u}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {reviewRows.length > 0 && (
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-amber-700">
                  <TriangleAlert className="size-4" />
                  Revisión manual — {reviewRows.length} productos
                </p>
                <p className="mb-2 text-xs text-muted-foreground">
                  No pudimos deducir el contenido (ej “Caja x 6 bidones”: no sabemos
                  cuánto trae cada uno). Completá cantidad y unidad; te dejamos el
                  texto original como referencia.
                </p>
                <div className="overflow-hidden rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead>Presentación original</TableHead>
                        <TableHead className="w-24 text-right">Cantidad</TableHead>
                        <TableHead className="w-24">Unidad</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reviewRows.map((a) => {
                        const edit = reviewEdits[a.rowIndex];
                        return (
                          <TableRow key={a.rowIndex}>
                            <TableCell className="max-w-[180px] truncate">
                              {a.name}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {a.presentationRaw}
                            </TableCell>
                            <TableCell>
                              <Input
                                inputMode="decimal"
                                className="h-8 text-right"
                                value={edit?.qty ?? String(a.suggestedQty ?? "")}
                                onChange={(e) =>
                                  setReviewEdits((m) => ({
                                    ...m,
                                    [a.rowIndex]: {
                                      qty: e.target.value,
                                      unit: m[a.rowIndex]?.unit ?? "un",
                                    },
                                  }))
                                }
                              />
                            </TableCell>
                            <TableCell>
                              <NativeSelect
                                className="h-8"
                                value={edit?.unit ?? "un"}
                                onChange={(e) =>
                                  setReviewEdits((m) => ({
                                    ...m,
                                    [a.rowIndex]: {
                                      qty: m[a.rowIndex]?.qty ?? String(a.suggestedQty ?? ""),
                                      unit: e.target.value as UnitKind,
                                    },
                                  }))
                                }
                              >
                                {UNITS.map((u) => (
                                  <option key={u.value} value={u.value}>
                                    {u.value}
                                  </option>
                                ))}
                              </NativeSelect>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>
            Cancelar
          </Button>
          {grid && (
            <Button
              onClick={handleImport}
              disabled={upsert.isPending || missingRequired || analyzed.length === 0}
            >
              {upsert.isPending ? "Importando…" : `Importar ${analyzed.length} productos`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Banner({
  tone,
  icon,
  text,
}: {
  tone: "ok" | "warn" | "error";
  icon: React.ReactNode;
  text: string;
}) {
  const cls =
    tone === "ok"
      ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20"
      : tone === "warn"
        ? "border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/20"
        : "border-destructive/40 bg-destructive/10 text-destructive";
  return (
    <div className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${cls}`}>
      {icon}
      <span>{text}</span>
    </div>
  );
}

function Mapping({
  label,
  value,
  onChange,
  options,
  optional,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  optional?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs">{label}</Label>
      <NativeSelect value={value} onChange={(e) => onChange(e.target.value)}>
        <option value={NONE}>{optional ? "— (ninguna)" : "— elegí columna —"}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}
