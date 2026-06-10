"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, ClipboardPaste } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { NativeSelect } from "@/components/native-select";
import { IngredientPickerDialog } from "@/components/recetas/ingredient-picker-dialog";
import {
  PasteIngredientsDialog,
  type PastedRow,
} from "@/components/recetas/paste-ingredients-dialog";
import {
  useRecipe,
  useCreateRecipe,
  useUpdateRecipe,
  useSaveRecipeItems,
} from "@/lib/hooks";
import { ingredientUnitPrice, convert } from "@/lib/cost";
import { formatARS } from "@/lib/format";
import {
  UNITS,
  RECIPE_CATEGORIES,
  BOCADO_SUBCATEGORIES,
  unitDimension,
  type IngredientWithProduct,
  type RecipeCategory,
  type RecipeWithItems,
  type UnitKind,
} from "@/lib/types";

type Row = {
  key: string;
  ingredient: IngredientWithProduct;
  quantity: string;
  unit: UnitKind;
};

function rowCost(row: Row): number | null {
  const up = ingredientUnitPrice(row.ingredient);
  if (up == null) return null;
  const q = convert(
    Number(row.quantity.replace(",", ".")) || 0,
    row.unit,
    row.ingredient.base_unit,
  );
  if (q == null) return null;
  return up * q;
}

export function RecipeEditor({ recipeId }: { recipeId?: string }) {
  const { data, isLoading } = useRecipe(recipeId);

  if (recipeId && isLoading)
    return <p className="text-sm text-muted-foreground">Cargando receta…</p>;

  return <EditorForm recipe={recipeId ? (data ?? null) : null} />;
}

function EditorForm({ recipe }: { recipe: RecipeWithItems | null }) {
  const router = useRouter();
  const create = useCreateRecipe();
  const update = useUpdateRecipe();
  const saveItems = useSaveRecipeItems();

  const [name, setName] = useState(recipe?.name ?? "");
  const [category, setCategory] = useState<RecipeCategory>(
    recipe?.category ?? "bocado",
  );
  const [subcategory, setSubcategory] = useState(recipe?.subcategory ?? "");
  const [isVeggie, setIsVeggie] = useState(recipe?.is_veggie ?? false);
  const [yieldUnits, setYieldUnits] = useState(String(recipe?.yield_units ?? 1));
  const [description, setDescription] = useState(recipe?.description ?? "");
  const [notes, setNotes] = useState(recipe?.notes ?? "");
  const [rows, setRows] = useState<Row[]>(
    (recipe?.items ?? [])
      .filter((it) => it.ingredient)
      .map((it) => ({
        key: it.id,
        ingredient: it.ingredient as IngredientWithProduct,
        quantity: String(it.quantity),
        unit: it.unit,
      })),
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);

  const saving = create.isPending || update.isPending || saveItems.isPending;

  function addIngredient(ing: IngredientWithProduct) {
    setRows((r) => [
      ...r,
      {
        key: `${ing.id}-${Date.now()}`,
        ingredient: ing,
        quantity: "0",
        unit: ing.base_unit,
      },
    ]);
  }
  function removeRow(key: string) {
    setRows((r) => r.filter((x) => x.key !== key));
  }
  function addRows(newRows: PastedRow[]) {
    setRows((r) => {
      const existing = new Set(r.map((x) => x.ingredient.id));
      const toAdd: Row[] = newRows
        .filter((nr) => !existing.has(nr.ingredient.id))
        .map((nr, i) => ({
          key: `${nr.ingredient.id}-${Date.now()}-${i}`,
          ingredient: nr.ingredient,
          quantity: nr.quantity,
          unit: nr.unit,
        }));
      return [...r, ...toAdd];
    });
  }
  function patchRow(key: string, patch: Partial<Row>) {
    setRows((r) => r.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  }

  const yieldN = Number(yieldUnits.replace(",", ".")) || 0;
  let total = 0;
  let missing = 0;
  for (const row of rows) {
    const c = rowCost(row);
    if (c == null) missing++;
    else total += c;
  }
  const perUnit = yieldN > 0 ? total / yieldN : 0;

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Poné un nombre a la receta.");
      return;
    }
    if (!(yieldN > 0)) {
      toast.error("El rinde (unidades) debe ser mayor a 0.");
      return;
    }
    const input = {
      name: name.trim(),
      category,
      subcategory: subcategory.trim() || null,
      is_veggie: isVeggie,
      yield_units: yieldN,
      description: description.trim() || null,
      notes: notes.trim() || null,
    };
    try {
      let id = recipe?.id;
      if (id) {
        await update.mutateAsync({ id, input });
      } else {
        const created = await create.mutateAsync(input);
        id = created.id;
      }
      await saveItems.mutateAsync({
        recipeId: id,
        items: rows.map((r, i) => ({
          ingredient_id: r.ingredient.id,
          quantity: Number(r.quantity.replace(",", ".")) || 0,
          unit: r.unit,
          sort_order: i,
        })),
      });
      toast.success(recipe ? "Receta actualizada." : "Receta creada.");
      router.push("/recetas");
      router.refresh();
    } catch (e) {
      toast.error("No se pudo guardar", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/recetas"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Recetas
      </Link>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">
        {recipe ? "Editar receta" : "Nueva receta"}
      </h1>

      <Card className="mb-4">
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="rec-name">Nombre del plato</Label>
            <Input
              id="rec-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Blinis, crema agria y pesca"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="rec-cat">Categoría</Label>
            <NativeSelect
              id="rec-cat"
              value={category}
              onChange={(e) => setCategory(e.target.value as RecipeCategory)}
            >
              {RECIPE_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="rec-sub">Subcategoría (opcional)</Label>
            <Input
              id="rec-sub"
              list="bocado-subs"
              value={subcategory}
              onChange={(e) => setSubcategory(e.target.value)}
              placeholder={category === "bocado" ? "Ej: Pesca" : "—"}
            />
            <datalist id="bocado-subs">
              {BOCADO_SUBCATEGORIES.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="rec-yield">Rinde (unidades por lote)</Label>
            <Input
              id="rec-yield"
              inputMode="decimal"
              value={yieldUnits}
              onChange={(e) => setYieldUnits(e.target.value)}
            />
          </div>
          <label className="mt-7 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isVeggie}
              onChange={(e) => setIsVeggie(e.target.checked)}
              className="size-4"
            />
            Es opción vegetariana
          </label>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="rec-desc">Descripción (opcional)</Label>
            <Textarea
              id="rec-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Texto del plato como aparece en la propuesta."
            />
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="rec-notes">Notas de preparación (opcional)</Label>
            <Textarea
              id="rec-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardContent>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="font-medium">Ingredientes del lote</h2>
              <p className="text-sm text-muted-foreground">
                Cantidades para producir {yieldN || 0} unidades.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPasteOpen(true)}
              >
                <ClipboardPaste className="size-4" />
                Pegar texto
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPickerOpen(true)}
              >
                <Plus className="size-4" />
                Agregar
              </Button>
            </div>
          </div>

          {rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Sin ingredientes. Agregá el primero.
            </p>
          ) : (
            <div className="flex flex-col divide-y">
              {rows.map((row) => {
                const c = rowCost(row);
                const dimMismatch =
                  unitDimension(row.unit) !==
                  unitDimension(row.ingredient.base_unit);
                return (
                  <div
                    key={row.key}
                    className="flex flex-wrap items-center gap-2 py-2"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {row.ingredient.name}
                    </span>
                    <Input
                      inputMode="decimal"
                      value={row.quantity}
                      onChange={(e) =>
                        patchRow(row.key, { quantity: e.target.value })
                      }
                      className="w-24"
                    />
                    <NativeSelect
                      value={row.unit}
                      onChange={(e) =>
                        patchRow(row.key, { unit: e.target.value as UnitKind })
                      }
                      className="w-24"
                    >
                      {UNITS.map((u) => (
                        <option key={u.value} value={u.value}>
                          {u.value === "l" ? "L" : u.value}
                        </option>
                      ))}
                    </NativeSelect>
                    <span className="w-28 text-right text-sm tabular-nums">
                      {c == null ? (
                        <span
                          className="text-amber-600"
                          title={
                            dimMismatch
                              ? "La unidad no coincide con la del ingrediente"
                              : "Ingrediente sin precio (vinculá un producto o cargá precio de mercado)"
                          }
                        >
                          sin costo
                        </span>
                      ) : (
                        formatARS(c)
                      )}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeRow(row.key)}
                      aria-label="Quitar"
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">
            Costo del lote
            <div className="text-xl font-semibold text-foreground">
              {formatARS(total)}
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            Costo por unidad
            <div className="text-xl font-semibold text-primary">
              {formatARS(perUnit)}
            </div>
          </div>
          {missing > 0 && (
            <p className="text-sm text-amber-600">
              {missing} ingrediente{missing > 1 ? "s" : ""} sin costo — el total es parcial.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href="/recetas" />}
        >
          Cancelar
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Guardando…" : "Guardar receta"}
        </Button>
      </div>

      <IngredientPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        excludeIds={rows.map((r) => r.ingredient.id)}
        onPick={addIngredient}
      />
      <PasteIngredientsDialog
        open={pasteOpen}
        onOpenChange={setPasteOpen}
        onAdd={addRows}
      />
    </div>
  );
}
