"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
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
  parseUnit,
  parsePrice,
  type SheetGrid,
} from "@/lib/excel";
import { useBulkInsertProducts } from "@/lib/hooks";
import { UNITS, type ProductInput, type UnitKind } from "@/lib/types";
import { formatARS } from "@/lib/format";

const NONE = "-1";

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
  const [colName, setColName] = useState(NONE);
  const [colPrice, setColPrice] = useState(NONE);
  const [colCode, setColCode] = useState(NONE);
  const [colUnit, setColUnit] = useState(NONE);
  const [defaultUnit, setDefaultUnit] = useState<UnitKind>("kg");
  const [defaultPack, setDefaultPack] = useState("1");
  const [iva, setIva] = useState(false);

  function reset() {
    setGrid(null);
    setSheet("");
    setHeaderRow(0);
    setColName(NONE);
    setColPrice(NONE);
    setColCode(NONE);
    setColUnit(NONE);
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

  function autoMap(header: string[]) {
    const find = (re: RegExp) =>
      String(header.findIndex((h) => re.test(h.toLowerCase())));
    const n = find(/nombre|producto|descrip/);
    const p = find(/precio|importe|valor/);
    const c = find(/c[oó]digo|cod\b|sku/);
    const u = find(/unidad|medida|u\.?m\.?/);
    setColName(n === "-1" ? NONE : n);
    setColPrice(p === "-1" ? NONE : p);
    setColCode(c === "-1" ? NONE : c);
    setColUnit(u === "-1" ? NONE : u);
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

  const parsed: ProductInput[] = useMemo(() => {
    if (!rows.length || colName === NONE || colPrice === NONE) return [];
    const ni = Number(colName);
    const pi = Number(colPrice);
    const ci = colCode === NONE ? -1 : Number(colCode);
    const ui = colUnit === NONE ? -1 : Number(colUnit);
    const pack = Number(defaultPack.replace(",", ".")) || 1;
    const out: ProductInput[] = [];
    for (let i = headerRow + 1; i < rows.length; i++) {
      const r = rows[i];
      const name = (r[ni] ?? "").trim();
      if (!name) continue;
      const price = parsePrice(r[pi] ?? "");
      if (Number.isNaN(price)) continue;
      const unit =
        ui >= 0 ? (parseUnit(r[ui] ?? "") ?? defaultUnit) : defaultUnit;
      out.push({
        provider_id: providerId,
        name,
        code: ci >= 0 ? (r[ci] || "").trim() || null : null,
        base_unit: unit,
        pack_size: pack,
        price,
        price_includes_iva: iva,
      });
    }
    return out;
  }, [
    rows,
    headerRow,
    colName,
    colPrice,
    colCode,
    colUnit,
    defaultUnit,
    defaultPack,
    iva,
    providerId,
  ]);

  async function handleImport() {
    if (parsed.length === 0) {
      toast.error("No hay filas válidas para importar.");
      return;
    }
    try {
      const n = await bulk.mutateAsync(parsed);
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
            Subí el .xlsx/.xls/.csv del proveedor y asociá las columnas. Revisá la
            vista previa antes de importar.
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
          </div>
        ) : (
          <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto pr-1">
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

            <div className="grid grid-cols-2 gap-3">
              <Mapping label="Nombre *" value={colName} onChange={setColName} options={colOptions} />
              <Mapping label="Precio *" value={colPrice} onChange={setColPrice} options={colOptions} />
              <Mapping label="Código" value={colCode} onChange={setColCode} options={colOptions} optional />
              <Mapping label="Unidad" value={colUnit} onChange={setColUnit} options={colOptions} optional />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Unidad por defecto</Label>
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
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="def-pack">Pack por defecto</Label>
                <Input
                  id="def-pack"
                  inputMode="decimal"
                  value={defaultPack}
                  onChange={(e) => setDefaultPack(e.target.value)}
                />
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

            <div>
              <p className="mb-2 text-sm font-medium">
                Vista previa — {parsed.length} productos detectados
              </p>
              <div className="overflow-hidden rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Unidad</TableHead>
                      <TableHead className="text-right">Pack</TableHead>
                      <TableHead className="text-right">Precio</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsed.slice(0, 8).map((p, i) => (
                      <TableRow key={i}>
                        <TableCell className="max-w-[280px] truncate">
                          {p.name}
                        </TableCell>
                        <TableCell>{p.base_unit}</TableCell>
                        <TableCell className="text-right">{p.pack_size}</TableCell>
                        <TableCell className="text-right">
                          {formatARS(p.price)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>
            Cancelar
          </Button>
          {grid && (
            <Button onClick={handleImport} disabled={bulk.isPending}>
              {bulk.isPending
                ? "Importando…"
                : `Importar ${parsed.length} productos`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
      <Label>{label}</Label>
      <NativeSelect value={value} onChange={(e) => onChange(e.target.value)}>
        {optional && <option value={NONE}>— (ninguna)</option>}
        {!optional && <option value={NONE}>— elegí columna —</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}
