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
  autoMapProductColumns,
  NO_COLUMN,
  type SheetGrid,
  type ProductField,
} from "@/lib/excel";
import { useBulkInsertProducts } from "@/lib/hooks";
import { UNITS, type ProductInput, type UnitKind } from "@/lib/types";
import { formatARS, formatNum, unitLabel } from "@/lib/format";

const NONE = "-1";

type ParsedRow = { input: ProductInput; usedFallback: boolean };

export function ExcelImportDialog({
  open,
  onOpenChange,
  providerId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providerId: string;
}) {
  const bulk = useBulkInsertProducts();
  const [grid, setGrid] = useState<SheetGrid | null>(null);
  const [sheet, setSheet] = useState("");
  const [headerRow, setHeaderRow] = useState(0);
  const [cols, setCols] = useState<Record<ProductField, string>>({
    name: NONE,
    price: NONE,
    saleUnit: NONE,
    content: NONE,
    code: NONE,
  });
  const [defaultUnit, setDefaultUnit] = useState<UnitKind>("un");
  const [iva, setIva] = useState(false);

  function reset() {
    setGrid(null);
    setSheet("");
    setHeaderRow(0);
    setCols({ name: NONE, price: NONE, saleUnit: NONE, content: NONE, code: NONE });
  }

  function autoMap(header: string[]) {
    const m = autoMapProductColumns(header);
    const toStr = (i: number) => (i === NO_COLUMN ? NONE : String(i));
    setCols({
      name: toStr(m.name),
      price: toStr(m.price),
      saleUnit: toStr(m.saleUnit),
      content: toStr(m.content),
      code: toStr(m.code),
    });
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

  const parsed: ParsedRow[] = useMemo(() => {
    const ni = idx("name");
    const pi = idx("price");
    if (!rows.length || ni === NO_COLUMN || pi === NO_COLUMN) return [];
    const si = idx("saleUnit");
    const cti = idx("content");
    const codi = idx("code");
    const out: ParsedRow[] = [];
    for (let i = headerRow + 1; i < rows.length; i++) {
      const r = rows[i];
      const name = (r[ni] ?? "").trim();
      if (!name) continue; // fila vacía o sin producto → se ignora
      const price = parsePrice(r[pi] ?? "");
      if (Number.isNaN(price)) continue;

      const saleUnit = si >= 0 ? (r[si] || "").trim() : "";
      let baseUnit: UnitKind = defaultUnit;
      let packSize = 1;
      let usedFallback = true;
      if (cti >= 0) {
        const c = parseContent(r[cti] ?? "");
        if (c) {
          baseUnit = c.baseUnit;
          packSize = c.packSize;
          usedFallback = false;
        }
      }
      out.push({
        usedFallback,
        input: {
          provider_id: providerId,
          name,
          code: codi >= 0 ? (r[codi] || "").trim() || null : null,
          base_unit: baseUnit,
          pack_size: packSize,
          price,
          sale_unit: saleUnit || null,
          price_includes_iva: iva,
        },
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, headerRow, cols, defaultUnit, iva, providerId]);

  const missingRequired = idx("name") === NO_COLUMN || idx("price") === NO_COLUMN;
  const noContent = idx("content") === NO_COLUMN;
  const fallbackCount = parsed.filter((p) => p.usedFallback).length;

  async function handleImport() {
    if (parsed.length === 0) {
      toast.error("No hay filas válidas para importar.");
      return;
    }
    try {
      const n = await bulk.mutateAsync(parsed.map((p) => p.input));
      toast.success(`${n} productos importados.`);
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
              precio/costo · unidad de venta/presentación · cantidad por
              unidad/contenido · código.
            </p>
          </div>
        ) : (
          <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto pr-1">
            {/* Estado del mapeo automático */}
            {missingRequired ? (
              <Banner
                tone="error"
                icon={<CircleAlert className="size-4" />}
                text="No detectamos Producto y/o Precio. Asignalos manualmente abajo."
              />
            ) : noContent ? (
              <Banner
                tone="warn"
                icon={<TriangleAlert className="size-4" />}
                text="No detectamos la columna de cantidad/contenido. Asignala para calcular el costo por unidad, o elegí abajo una unidad por defecto."
              />
            ) : (
              <Banner
                tone="ok"
                icon={<CheckCircle2 className="size-4" />}
                text="Columnas detectadas automáticamente. Revisá la vista previa."
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

            {/* Mapeo manual (fallback): siempre visible, ya pre-cargado */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Mapping label="Producto *" value={cols.name} onChange={(v) => setCols((c) => ({ ...c, name: v }))} options={colOptions} />
              <Mapping label="Precio *" value={cols.price} onChange={(v) => setCols((c) => ({ ...c, price: v }))} options={colOptions} />
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
                  Vista previa — {parsed.length} productos
                  {fallbackCount > 0 && (
                    <span className="ml-2 inline-flex items-center gap-1 text-amber-600">
                      <TriangleAlert className="size-3.5" />
                      {fallbackCount} sin contenido (unidad por defecto: {defaultUnit}, pack 1)
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
                      {parsed.slice(0, 8).map((p, i) => {
                        const { input } = p;
                        const u = unitLabel(input.base_unit);
                        return (
                          <TableRow key={i}>
                            <TableCell className="max-w-[220px] truncate">
                              {input.name}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {input.sale_unit || u}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatNum(input.pack_size)} {u}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatARS(input.price)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">
                              {formatARS(input.price / input.pack_size)} / {u}
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
              disabled={bulk.isPending || missingRequired || parsed.length === 0}
            >
              {bulk.isPending ? "Importando…" : `Importar ${parsed.length} productos`}
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
