"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Link2, TriangleAlert } from "lucide-react";
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
import { IngredientDialog } from "@/components/ingredientes/ingredient-dialog";
import { ProductLinkDialog } from "@/components/ingredientes/product-link-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useIngredients, useDeleteIngredient } from "@/lib/hooks";
import { formatARS, pricePerBaseUnit, unitLabel } from "@/lib/format";
import { unitDimension, type IngredientWithProduct } from "@/lib/types";

export default function IngredientesPage() {
  const { data: ingredients, isLoading } = useIngredients();
  const del = useDeleteIngredient();

  const [editOpen, setEditOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [editing, setEditing] = useState<IngredientWithProduct | null>(null);
  const [linking, setLinking] = useState<IngredientWithProduct | null>(null);
  const [toDelete, setToDelete] = useState<IngredientWithProduct | null>(null);

  function openNew() {
    setEditing(null);
    setEditOpen(true);
  }

  async function confirmDelete() {
    if (!toDelete) return;
    try {
      await del.mutateAsync(toDelete.id);
      toast.success("Ingrediente eliminado.");
      setToDelete(null);
    } catch (e) {
      toast.error("No se pudo eliminar", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-primary">Ingredientes</h1>
          <p className="text-muted-foreground">
            Nombre canónico de receta, vinculado a un producto de proveedor.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="size-4" />
          Nuevo ingrediente
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : !ingredients || ingredients.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Todavía no hay ingredientes.
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ingrediente</TableHead>
                <TableHead>Unidad</TableHead>
                <TableHead>Origen del precio</TableHead>
                <TableHead className="text-right">$/unidad</TableHead>
                <TableHead className="w-px text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ingredients.map((ing) => {
                const prod = ing.product;
                const dimMismatch =
                  prod &&
                  unitDimension(prod.base_unit) !==
                    unitDimension(ing.base_unit);
                const unitPrice = prod
                  ? pricePerBaseUnit(prod.price, prod.pack_size)
                  : ing.market_price;
                return (
                  <TableRow key={ing.id}>
                    <TableCell className="font-medium">{ing.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{unitLabel(ing.base_unit)}</Badge>
                    </TableCell>
                    <TableCell>
                      {prod ? (
                        <span className="inline-flex items-center gap-1.5 text-sm">
                          <span className="truncate">
                            {prod.provider?.name}
                          </span>
                          {dimMismatch && (
                            <span
                              className="inline-flex items-center gap-1 text-xs text-amber-600"
                              title="La unidad del producto no coincide con la del ingrediente"
                            >
                              <TriangleAlert className="size-3.5" />
                              revisar unidad
                            </span>
                          )}
                        </span>
                      ) : ing.market_price != null ? (
                        <Badge variant="outline">precio mercado</Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          sin vínculo
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatARS(unitPrice)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setLinking(ing);
                            setLinkOpen(true);
                          }}
                        >
                          <Link2 className="size-4" />
                          Vincular
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => {
                            setEditing(ing);
                            setEditOpen(true);
                          }}
                          aria-label="Editar"
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setToDelete(ing)}
                          aria-label="Eliminar"
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      <IngredientDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        ingredient={editing}
      />
      <ProductLinkDialog
        open={linkOpen}
        onOpenChange={setLinkOpen}
        ingredient={linking}
      />
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Eliminar ingrediente"
        description={`Se eliminará "${toDelete?.name}".`}
        onConfirm={confirmDelete}
        loading={del.isPending}
      />
    </div>
  );
}
