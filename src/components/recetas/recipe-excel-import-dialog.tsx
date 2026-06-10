"use client";

import { useMemo, useState } from "react";
import Fuse from "fuse.js";
import { toast } from "sonner";
import { Check, TriangleAlert } from "lucide-react";
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
import { useIngredients, useImportRecipes } from "@/lib/hooks";
import {
  readWorkbook,
  guessHeaderRow,
  parseUnit,
  parsePrice,
  type SheetGrid,
} from "@/lib/excel";
import type {
  ImportRecipePlan,
  IngredientWithProduct,
  RecipeCategory,
  UnitKind,
} from "@/lib/types";

const NONE = "-1";

function normalizeCategory(text: string): RecipeCategory {
  const t = text.toLowerCase();
  if (t.includes("principal")) return "principal";
  if (t.includes("postre")) return "postre";
  if (t.includes("guarni")) return "guarnicion";
  if (t.includes("bocado")) return "bocado";
  if (t.includes("otro")) return "otro";
  return "bocado";
}

function isVeggie(text: string): boolean {
  return /^(s[ií]|x|true|1|veggie|veg)/i.test(text.trim());
}

type PreviewRecipe = {
  name: string;
  category: RecipeCategory;
  subcategory: string | null;
  is_veggie: boolean;
  yield_units: number;
  items: {
    ingredientName: string;
    quantity: number;
    unit: UnitKind;
    ingredientId: string | null;
  }[];
};

export function RecipeExcelImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        {open && <Form onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function Form({ onClose }: { onClose: () => void }) {
  const { data: ingredients } = useIngredients();
  const importRecipes = useImportRecipes();

  const [grid, setGrid] = useState<SheetGrid | null>(null);
  const [sheet, setSheet] = useState("");
  const [headerRow, setHeaderRow] = useState(0);
  const [cols, setCols] = useState({
    receta: NONE,
    ingrediente: NONE,
    cantidad: NONE,
    unidad: NONE,
    rinde: NONE,
    categoria: NONE,
    subcategoria: NONE,
    veggie: NONE,
  });
  const [createMissing, setCreateMissing] = useState(true);

  const fuse = useMemo(
    () =>
      new Fuse(ingredients ?? [], {
        keys: ["name"],
        threshold: 0.45,
        ignoreLocation: true,
        includeScore: true,
        minMatchCharLength: 2,
      }),
    [ingredients],
  );

  async function handleFile(file: File) {
    try {
      const g = await readWorkbook(file);
      const first = g.sheetNames[0] ?? "";
      setGrid(g);
      setSheet(first);
      const rs = g.rows(first);
      const hr = guessHeaderRow(rs);
      setHeaderRow(hr);
      autoMap(rs[hr] ?? []);
    } catch (e) {
      toast.error("No se pudo leer el archivo", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  function autoMap(header: string[]) {
    const find = (re: RegExp) => {
      const i = header.findIndex((h) => re.test(h.toLowerCase()));
      return i === -1 ? NONE : String(i);
    };
    setCols({
      receta: find(/receta|plato|nombre/),
      ingrediente: find(/ingrediente|insumo/),
      cantidad: find(/cantidad|cant\b|qty/),
      unidad: find(/unidad|medida|u\.?m/),
      rinde: find(/rinde|rendimiento|unidades|porciones|yield/),
      categoria: find(/categor/),
      subcategoria: find(/subcategor|subrubro/),
      veggie: find(/veggie|vegetariano|veg\b/),
    });
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

  const preview: PreviewRecipe[] = useMemo(() => {
    if (cols.receta === NONE || cols.ingrediente === NONE) return [];
    const idx = {
      receta: Number(cols.receta),
      ingrediente: Number(cols.ingrediente),
      cantidad: cols.cantidad === NONE ? -1 : Number(cols.cantidad),
      unidad: cols.unidad === NONE ? -1 : Number(cols.unidad),
      rinde: cols.rinde === NONE ? -1 : Number(cols.rinde),
      categoria: cols.categoria === NONE ? -1 : Number(cols.categoria),
      subcategoria: cols.subcategoria === NONE ? -1 : Number(cols.subcategoria),
      veggie: cols.veggie === NONE ? -1 : Number(cols.veggie),
    };
    const map = new Map<string, PreviewRecipe>();

    for (let i = headerRow + 1; i < rows.length; i++) {
      const r = rows[i];
      const name = (r[idx.receta] ?? "").trim();
      const ingName = (r[idx.ingrediente] ?? "").trim();
      if (!name || !ingName) continue;

      let recipe = map.get(name.toLowerCase());
      if (!recipe) {
        recipe = {
          name,
          category:
            idx.categoria >= 0
              ? normalizeCategory(r[idx.categoria] ?? "")
              : "bocado",
          subcategory:
            idx.subcategoria >= 0 ? (r[idx.subcategoria] || "").trim() || null : null,
          is_veggie: idx.veggie >= 0 ? isVeggie(r[idx.veggie] ?? "") : false,
          yield_units:
            idx.rinde >= 0 ? Math.max(1, parsePrice(r[idx.rinde] ?? "") || 1) : 1,
          items: [],
        };
        map.set(name.toLowerCase(), recipe);
      }

      const quantity = idx.cantidad >= 0 ? parsePrice(r[idx.cantidad] ?? "") || 0 : 0;
      const unit =
        idx.unidad >= 0 ? (parseUnit(r[idx.unidad] ?? "") ?? "g") : "g";
      const hit = fuse.search(ingName)[0];
      const ingredientId =
        hit && (hit.score ?? 1) <= 0.45
          ? (hit.item as IngredientWithProduct).id
          : null;

      recipe.items.push({ ingredientName: ingName, quantity, unit, ingredientId });
    }

    return [...map.values()];
  }, [rows, headerRow, cols, fuse]);

  const totalItems = preview.reduce((s, r) => s + r.items.length, 0);
  const unmatched = preview.reduce(
    (s, r) => s + r.items.filter((it) => !it.ingredientId).length,
    0,
  );

  async function handleImport() {
    if (preview.length === 0) {
      toast.error("No se detectaron recetas. Revisá el mapeo de columnas.");
      return;
    }
    const plans: ImportRecipePlan[] = preview.map((r) => ({
      name: r.name,
      category: r.category,
      subcategory: r.subcategory,
      is_veggie: r.is_veggie,
      yield_units: r.yield_units,
      items: r.items
        .filter((it) => it.ingredientId || createMissing)
        .map((it) => ({
          ingredient_id: it.ingredientId,
          create_name: it.ingredientId ? null : it.ingredientName,
          quantity: it.quantity,
          unit: it.unit,
        })),
    }));
    try {
      const res = await importRecipes.mutateAsync(plans);
      toast.success(
        `${res.recipes} recetas importadas` +
          (res.ingredients > 0 ? ` · ${res.ingredients} ingredientes creados` : ""),
      );
      onClose();
    } catch (e) {
      toast.error("Falló la importación", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Importar recetas (Excel)</DialogTitle>
        <DialogDescription>
          Una fila por ingrediente. Las filas con el mismo nombre de receta se
          agrupan. Columnas mínimas: receta e ingrediente.
        </DialogDescription>
      </DialogHeader>

      {!grid ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="rec-file">Archivo</Label>
          <Input
            id="rec-file"
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          <p className="text-xs text-muted-foreground">
            Columnas sugeridas: receta · categoria · subcategoria · veggie · rinde ·
            ingrediente · cantidad · unidad
          </p>
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
              <Label htmlFor="rec-header">Fila de encabezados</Label>
              <Input
                id="rec-header"
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

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Mapping label="Receta *" value={cols.receta} onChange={(v) => setCols((c) => ({ ...c, receta: v }))} options={colOptions} />
            <Mapping label="Ingrediente *" value={cols.ingrediente} onChange={(v) => setCols((c) => ({ ...c, ingrediente: v }))} options={colOptions} />
            <Mapping label="Cantidad" value={cols.cantidad} onChange={(v) => setCols((c) => ({ ...c, cantidad: v }))} options={colOptions} optional />
            <Mapping label="Unidad" value={cols.unidad} onChange={(v) => setCols((c) => ({ ...c, unidad: v }))} options={colOptions} optional />
            <Mapping label="Rinde" value={cols.rinde} onChange={(v) => setCols((c) => ({ ...c, rinde: v }))} options={colOptions} optional />
            <Mapping label="Categoría" value={cols.categoria} onChange={(v) => setCols((c) => ({ ...c, categoria: v }))} options={colOptions} optional />
            <Mapping label="Subcategoría" value={cols.subcategoria} onChange={(v) => setCols((c) => ({ ...c, subcategoria: v }))} options={colOptions} optional />
            <Mapping label="Veggie" value={cols.veggie} onChange={(v) => setCols((c) => ({ ...c, veggie: v }))} options={colOptions} optional />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={createMissing}
              onChange={(e) => setCreateMissing(e.target.checked)}
              className="size-4"
            />
            Crear ingredientes que no estén en el catálogo
          </label>

          <div>
            <p className="mb-2 text-sm font-medium">
              {preview.length} recetas · {totalItems} ingredientes
              {unmatched > 0 && (
                <span className="ml-2 inline-flex items-center gap-1 text-amber-600">
                  <TriangleAlert className="size-3.5" />
                  {unmatched} sin vínculo
                  {createMissing ? " (se crearán)" : " (se omitirán)"}
                </span>
              )}
            </p>
            <div className="max-h-64 overflow-y-auto rounded-md border divide-y">
              {preview.map((r) => (
                <div key={r.name} className="p-2 text-sm">
                  <div className="font-medium">
                    {r.name}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {r.category}
                      {r.is_veggie ? " · veggie" : ""} · rinde {r.yield_units}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                    {r.items.map((it, i) => (
                      <span key={i} className="inline-flex items-center gap-1">
                        {it.ingredientId ? (
                          <Check className="size-3 text-primary" />
                        ) : (
                          <TriangleAlert className="size-3 text-amber-600" />
                        )}
                        {it.ingredientName} ({it.quantity} {it.unit})
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        {grid && (
          <Button onClick={handleImport} disabled={importRecipes.isPending}>
            {importRecipes.isPending
              ? "Importando…"
              : `Importar ${preview.length} recetas`}
          </Button>
        )}
      </DialogFooter>
    </>
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
        <option value={NONE}>{optional ? "— (ninguna)" : "— elegí —"}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}
