"use client";

import { useState } from "react";
import { toast } from "sonner";
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
import { useCreateIngredient, useUpdateIngredient } from "@/lib/hooks";
import { UNITS, type Ingredient, type UnitKind } from "@/lib/types";

export function IngredientDialog({
  open,
  onOpenChange,
  ingredient,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ingredient?: Ingredient | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open && (
          <IngredientForm
            ingredient={ingredient}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function IngredientForm({
  ingredient,
  onDone,
}: {
  ingredient?: Ingredient | null;
  onDone: () => void;
}) {
  const isEdit = !!ingredient;
  const create = useCreateIngredient();
  const update = useUpdateIngredient();

  const [name, setName] = useState(ingredient?.name ?? "");
  const [baseUnit, setBaseUnit] = useState<UnitKind>(
    ingredient?.base_unit ?? "kg",
  );
  const [marketPrice, setMarketPrice] = useState(
    ingredient?.market_price != null ? String(ingredient.market_price) : "",
  );
  const [notes, setNotes] = useState(ingredient?.notes ?? "");

  const loading = create.isPending || update.isPending;

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Poné un nombre de ingrediente.");
      return;
    }
    const mp = marketPrice.trim() ? Number(marketPrice.replace(",", ".")) : null;
    if (mp != null && (Number.isNaN(mp) || mp < 0)) {
      toast.error("Precio de mercado inválido.");
      return;
    }
    const input = {
      name: name.trim(),
      base_unit: baseUnit,
      market_price: mp,
      market_price_updated_at: mp != null ? new Date().toISOString() : null,
      notes: notes.trim() || null,
    };
    try {
      if (isEdit) {
        await update.mutateAsync({ id: ingredient!.id, input });
        toast.success("Ingrediente actualizado.");
      } else {
        await create.mutateAsync(input);
        toast.success("Ingrediente creado.");
      }
      onDone();
    } catch (e) {
      toast.error("No se pudo guardar", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {isEdit ? "Editar ingrediente" : "Nuevo ingrediente"}
        </DialogTitle>
        <DialogDescription>
          Usá el mismo nombre que en las recetas. El vínculo con el producto del
          proveedor se hace después.
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="ing-name">Nombre</Label>
          <Input
            id="ing-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: harina 0000"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="ing-unit">Unidad base</Label>
            <NativeSelect
              id="ing-unit"
              value={baseUnit}
              onChange={(e) => setBaseUnit(e.target.value as UnitKind)}
            >
              {UNITS.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ing-market">Precio mercado (opcional)</Label>
            <Input
              id="ing-market"
              inputMode="decimal"
              value={marketPrice}
              onChange={(e) => setMarketPrice(e.target.value)}
              placeholder={`$ por ${baseUnit}`}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          El precio de mercado se usa para ingredientes sin proveedor fijo (por
          unidad base). Si vinculás un producto, se prioriza el precio del proveedor.
        </p>
        <div className="flex flex-col gap-2">
          <Label htmlFor="ing-notes">Notas (opcional)</Label>
          <Textarea
            id="ing-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button onClick={handleSave} disabled={loading}>
          {loading ? "Guardando…" : "Guardar"}
        </Button>
      </DialogFooter>
    </>
  );
}
