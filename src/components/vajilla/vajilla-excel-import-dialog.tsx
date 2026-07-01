"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/native-select";
import { Badge } from "@/components/ui/badge";
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
  parsePrice,
  autoMapProductColumns,
  NO_COLUMN,
  type SheetGrid,
} from "@/lib/excel";
import { useBulkUpsertTablewareItems } from "@/lib/hooks";
import { formatARS } from "@/lib/format";
import {
  TABLEWARE_CATEGORIES,
  TABLEWARE_COST_TYPES,
  type TablewareCategory,
  type TablewareCostType,
  type TablewareItemInput,
} from "@/lib/types";

const NONE = "-1";

type ParsedRow = {
  rowIndex: number;
  name: string;
  unit_price: number;
  category: TablewareCategory;
  cost_type: TablewareCostType;
};

function Banner({
  tone,
  icon,
  text,
}: {
  tone: "ok" | "error";
  icon: React.ReactNode;
  text: string;
}) {
  const cls =
    tone === "ok"
      ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20"
      : "border-destructive/40 bg-destructive/10 text-destructive";
  return (
    <div className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${cls}`}>
      {icon}
      <span>{text}</span>
    </div>
  );
}

export function VajillaExcelImportDialog({
  open,
  onOpenChange,
  providerId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providerId: string;
}) {
  const upsert = useBulkUpsertTablewareItems();
  const [grid, setGrid] = useState<SheetGrid | null>(null);
  const [sheet, setSheet] = useState("");
  const [headerRow, setHeaderRow] = useState(0);
  const [nameCol, setNameCol] = useState(NONE);
  const [priceCol, setPriceCol] = useState(NONE);
  const [defaultCostType, setDefaultCostType] = useState<TablewareCostType>("alquiler");
  const [defaultCategory, setDefaultCategory] = useState<TablewareCategory>("otros");
  // Overrides por fila: { rowIndex -> { cost_type?, category? } }
  const [overrides, setOverrides] = useState<
    Record<number, { cost_type?: TablewareCostType; category?: TablewareCategory }>
  >({});

  function reset() {
    setGrid(null);
    setSheet("");
    setHeaderRow(0);
    setNameCol(NONE);
    setPriceCol(NONE);
    setOverrides({});
  }

  function autoMap(header: string[]) {
    const m = autoMapProductColumns(header);
    setNameCol(m.name === NO_COLUMN ? NONE : String(m.name));
    setPriceCol(m.price === NO_COLUMN ? NONE : String(m.price));
    setOverrides({});
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

  const ni = nameCol === NONE ? NO_COLUMN : Number(nameCol);
  const pi = priceCol === NONE ? NO_COLUMN : Number(priceCol);
  const missingRequired = ni === NO_COLUMN || pi === NO_COLUMN;

  const parsed: ParsedRow[] = useMemo(() => {
    if (!rows.length || ni === NO_COLUMN || pi === NO_COLUMN) return [];
    const out: ParsedRow[] = [];
    for (let i = headerRow + 1; i < rows.length; i++) {
      const r = rows[i];
      const name = (r[ni] ?? "").trim();
      if (!name) continue;
      const price = parsePrice(r[pi] ?? "");
      if (Number.isNaN(price) || price < 0) continue;
      const ov = overrides[i] ?? {};
      out.push({
        rowIndex: i,
        name,
        unit_price: price,
        category: ov.category ?? defaultCategory,
        cost_type: ov.cost_type ?? defaultCostType,
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, headerRow, ni, pi, defaultCostType, defaultCategory, overrides]);

  function setRowOverride(
    rowIndex: number,
    key: "cost_type" | "category",
    value: string,
  ) {
    setOverrides((prev) => ({
      ...prev,
      [rowIndex]: { ...prev[rowIndex], [key]: value },
    }));
  }

  async function handleImport() {
    if (parsed.length === 0) {
      toast.error("No hay filas válidas para importar.");
      return;
    }
    const rows: TablewareItemInput[] = parsed.map((p) => ({
      provider_id: providerId,
      name: p.name,
      category: p.category,
      cost_type: p.cost_type,
      unit_price: p.unit_price,
    }));
    try {
      const { inserted, updated } = await upsert.mutateAsync({ providerId, rows });
      const parts: string[] = [];
      if (inserted > 0) parts.push(`${inserted} nuevo${inserted !== 1 ? "s" : ""}`);
      if (updated > 0) parts.push(`${updated} actualizado${updated !== 1 ? "s" : ""}`);
      toast.success(`Importación completada: ${parts.join(", ") || "sin cambios"}.`);
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
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Importar catálogo de vajilla (Excel)</DialogTitle>
          <DialogDescription>
            Subí el .xlsx del proveedor. Detectamos las columnas "ITEM" y "PRECIO UN"
            automáticamente. Revisá el tipo (Alquiler / Compra) antes de importar.
          </DialogDescription>
        </DialogHeader>

        {!grid ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="vaj-file">Archivo</Label>
            <Input
              id="vaj-file"
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            <p className="text-xs text-muted-foreground">
              Columnas reconocidas: ITEM / producto / descripción (nombre) ·
              PRECIO UN / precio (monto por unidad).
            </p>
          </div>
        ) : (
          <div className="flex max-h-[65vh] flex-col gap-4 overflow-y-auto pr-1">
            {missingRequired ? (
              <Banner
                tone="error"
                icon={<CircleAlert className="size-4" />}
                text="No detectamos Nombre y/o Precio. Asignalos manualmente abajo."
              />
            ) : (
              <Banner
                tone="ok"
                icon={<CheckCircle2 className="size-4" />}
                text={`${parsed.length} ítems detectados. Ajustá el tipo (Alquiler / Compra) si es necesario.`}
              />
            )}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
                <Label>Fila encabezados</Label>
                <Input
                  inputMode="numeric"
                  value={String(headerRow + 1)}
                  onChange={(e) => {
                    const v = Math.max(1, Number(e.target.value) || 1) - 1;
                    setHeaderRow(v);
                    autoMap(rows[v] ?? []);
                  }}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Columna Nombre *</Label>
                <NativeSelect
                  value={nameCol}
                  onChange={(e) => setNameCol(e.target.value)}
                >
                  <option value={NONE}>— elegí —</option>
                  {colOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Columna Precio *</Label>
                <NativeSelect
                  value={priceCol}
                  onChange={(e) => setPriceCol(e.target.value)}
                >
                  <option value={NONE}>— elegí —</option>
                  {colOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </div>

            {/* Tipo y categoría por defecto para toda la importación */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Tipo por defecto (todos los ítems)</Label>
                <NativeSelect
                  value={defaultCostType}
                  onChange={(e) => {
                    setDefaultCostType(e.target.value as TablewareCostType);
                    setOverrides({});
                  }}
                >
                  {TABLEWARE_COST_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Categoría por defecto</Label>
                <NativeSelect
                  value={defaultCategory}
                  onChange={(e) => {
                    setDefaultCategory(e.target.value as TablewareCategory);
                    setOverrides({});
                  }}
                >
                  {TABLEWARE_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </div>

            {!missingRequired && parsed.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium">
                  Vista previa — {parsed.length} ítems
                </p>
                <div className="overflow-hidden rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ítem</TableHead>
                        <TableHead className="text-right">Precio/un</TableHead>
                        <TableHead className="w-36">Tipo</TableHead>
                        <TableHead className="w-44">Categoría</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsed.map((p) => (
                        <TableRow key={p.rowIndex}>
                          <TableCell className="max-w-[220px] truncate">
                            {p.name}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatARS(p.unit_price)}
                          </TableCell>
                          <TableCell>
                            <NativeSelect
                              className="h-8 text-xs"
                              value={p.cost_type}
                              onChange={(e) =>
                                setRowOverride(
                                  p.rowIndex,
                                  "cost_type",
                                  e.target.value,
                                )
                              }
                            >
                              {TABLEWARE_COST_TYPES.map((t) => (
                                <option key={t.value} value={t.value}>
                                  {t.label}
                                </option>
                              ))}
                            </NativeSelect>
                          </TableCell>
                          <TableCell>
                            <NativeSelect
                              className="h-8 text-xs"
                              value={p.category}
                              onChange={(e) =>
                                setRowOverride(
                                  p.rowIndex,
                                  "category",
                                  e.target.value,
                                )
                              }
                            >
                              {TABLEWARE_CATEGORIES.map((c) => (
                                <option key={c.value} value={c.value}>
                                  {c.label}
                                </option>
                              ))}
                            </NativeSelect>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Podés cambiar tipo y categoría ítem por ítem en la tabla, o usar los
                  selectores de arriba para marcar todo de una vez.
                </p>
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
              disabled={upsert.isPending || missingRequired || parsed.length === 0}
            >
              {upsert.isPending
                ? "Importando…"
                : `Importar ${parsed.length} ítems`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
