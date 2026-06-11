"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { RecipeExcelImportDialog } from "@/components/recetas/recipe-excel-import-dialog";
import { useRecipes, useDeleteRecipe } from "@/lib/hooks";
import { RECIPE_CATEGORIES, type RecipeListRow } from "@/lib/types";

const CAT_LABEL = Object.fromEntries(
  RECIPE_CATEGORIES.map((c) => [c.value, c.label]),
);

export default function RecetasPage() {
  const { data: recipes, isLoading } = useRecipes();
  const del = useDeleteRecipe();
  const [toDelete, setToDelete] = useState<RecipeListRow | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  async function confirmDelete() {
    if (!toDelete) return;
    try {
      await del.mutateAsync(toDelete.id);
      toast.success("Receta eliminada.");
      setToDelete(null);
    } catch (e) {
      toast.error("No se pudo eliminar", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-primary">Recetas</h1>
          <p className="text-muted-foreground">
            Cada receta rinde un lote de unidades y se escala según los PAX.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="size-4" />
            Importar Excel
          </Button>
          <Button nativeButton={false} render={<Link href="/recetas/nueva" />}>
            <Plus className="size-4" />
            Nueva receta
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : !recipes || recipes.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Todavía no hay recetas. Creá la primera con “Nueva receta”.
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plato</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead className="text-right">Rinde</TableHead>
                <TableHead className="text-right">Ingredientes</TableHead>
                <TableHead className="w-px text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recipes.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link
                      href={`/recetas/${r.id}`}
                      className="font-medium hover:underline"
                    >
                      {r.name}
                    </Link>
                    {r.is_veggie && (
                      <Badge variant="secondary" className="ml-2">
                        veggie
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {CAT_LABEL[r.category] ?? r.category}
                    </span>
                    {r.subcategory && (
                      <span className="text-xs text-muted-foreground">
                        {" "}
                        · {r.subcategory}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.yield_units} un
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.item_count}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        nativeButton={false}
                        render={<Link href={`/recetas/${r.id}`} />}
                        aria-label="Editar"
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setToDelete(r)}
                        aria-label="Eliminar"
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Eliminar receta"
        description={`Se eliminará "${toDelete?.name}" y sus ingredientes.`}
        onConfirm={confirmDelete}
        loading={del.isPending}
      />
      <RecipeExcelImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}
