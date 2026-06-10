"use client";

import { useMemo, useState } from "react";
import Fuse from "fuse.js";
import { toast } from "sonner";
import { Check, Plus, CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/native-select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useIngredients, useCreateIngredient } from "@/lib/hooks";
import { parseRecipeLines } from "@/lib/recipe-parse";
import { UNITS, type IngredientWithProduct, type UnitKind } from "@/lib/types";

export type PastedRow = {
  ingredient: IngredientWithProduct;
  quantity: string;
  unit: UnitKind;
};

type Resolved = {
  key: string;
  name: string;
  quantity: string;
  unit: UnitKind;
  ingredient: IngredientWithProduct | null;
};

export function PasteIngredientsDialog({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (rows: PastedRow[]) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        {open && (
          <Form
            onAdd={(rows) => {
              onAdd(rows);
              onOpenChange(false);
            }}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function Form({
  onAdd,
  onClose,
}: {
  onAdd: (rows: PastedRow[]) => void;
  onClose: () => void;
}) {
  const { data: ingredients } = useIngredients();
  const createIng = useCreateIngredient();
  const [text, setText] = useState("");
  const [rows, setRows] = useState<Resolved[] | null>(null);

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

  function interpret() {
    const parsed = parseRecipeLines(text);
    if (parsed.length === 0) {
      toast.error("No se detectaron líneas. Pegá los ingredientes, uno por línea.");
      return;
    }
    const resolved: Resolved[] = parsed.map((p, i) => {
      const hit = p.name ? fuse.search(p.name)[0] : undefined;
      const match =
        hit && (hit.score ?? 1) <= 0.45 ? (hit.item as IngredientWithProduct) : null;
      return {
        key: `${i}-${Date.now()}`,
        name: p.name,
        quantity: p.quantity != null ? String(p.quantity) : "0",
        unit: p.unit ?? match?.base_unit ?? "g",
        ingredient: match,
      };
    });
    setRows(resolved);
  }

  function patch(key: string, patch: Partial<Resolved>) {
    setRows((rs) => rs?.map((r) => (r.key === key ? { ...r, ...patch } : r)) ?? rs);
  }

  async function createFor(row: Resolved) {
    try {
      const created = await createIng.mutateAsync({
        name: row.name,
        base_unit: row.unit,
      });
      patch(row.key, {
        ingredient: { ...created, product: null } as IngredientWithProduct,
      });
      toast.success(`Ingrediente "${created.name}" creado.`);
    } catch (e) {
      toast.error("No se pudo crear", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  function addAll() {
    const ready = (rows ?? []).filter((r) => r.ingredient);
    if (ready.length === 0) {
      toast.error("No hay ingredientes resueltos para agregar.");
      return;
    }
    onAdd(
      ready.map((r) => ({
        ingredient: r.ingredient!,
        quantity: r.quantity,
        unit: r.unit,
      })),
    );
  }

  const readyCount = (rows ?? []).filter((r) => r.ingredient).length;

  return (
    <>
      <DialogHeader>
        <DialogTitle>Pegar ingredientes</DialogTitle>
        <DialogDescription>
          Pegá los ingredientes (uno por línea, ej: “700g de harina 0000”).
          Interpretamos cantidad, unidad y nombre, y los vinculamos con tu catálogo.
          Revisá antes de agregar.
        </DialogDescription>
      </DialogHeader>

      {rows === null ? (
        <div className="flex flex-col gap-3">
          <Label htmlFor="paste-text">Texto de la receta</Label>
          <Textarea
            id="paste-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            placeholder={"700g de harina 0000\n175g de manteca\n840 ml de leche\n1 atado ciboulette"}
            autoFocus
          />
        </div>
      ) : (
        <div className="max-h-[50vh] overflow-y-auto rounded-md border">
          <ul className="divide-y">
            {rows.map((r) => (
              <li key={r.key} className="flex flex-wrap items-center gap-2 p-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {r.name || "—"}
                  </span>
                  {r.ingredient ? (
                    <span className="inline-flex items-center gap-1 text-xs text-primary">
                      <Check className="size-3" />
                      {r.ingredient.name}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                      <CircleHelp className="size-3" />
                      sin vínculo
                    </span>
                  )}
                </span>
                <Input
                  inputMode="decimal"
                  value={r.quantity}
                  onChange={(e) => patch(r.key, { quantity: e.target.value })}
                  className="w-20"
                />
                <NativeSelect
                  value={r.unit}
                  onChange={(e) =>
                    patch(r.key, { unit: e.target.value as UnitKind })
                  }
                  className="w-20"
                >
                  {UNITS.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.value === "l" ? "L" : u.value}
                    </option>
                  ))}
                </NativeSelect>
                {!r.ingredient && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => createFor(r)}
                    disabled={createIng.isPending || !r.name}
                  >
                    <Plus className="size-4" />
                    Crear
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        {rows === null ? (
          <Button onClick={interpret}>Interpretar</Button>
        ) : (
          <>
            <Button variant="outline" onClick={() => setRows(null)}>
              Volver
            </Button>
            <Button onClick={addAll} disabled={readyCount === 0}>
              Agregar {readyCount} a la receta
            </Button>
          </>
        )}
      </DialogFooter>
    </>
  );
}
