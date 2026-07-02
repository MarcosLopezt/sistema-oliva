"use client";

import { useEffect, useState } from "react";
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
import { useCreateTablewareItem, useUpdateTablewareItem } from "@/lib/hooks";
import {
  TABLEWARE_CATEGORIES,
  TABLEWARE_COST_TYPES,
  type TablewareItem,
  type TablewareCategory,
  type TablewareCostType,
} from "@/lib/types";

type Form = {
  name: string;
  category: TablewareCategory;
  cost_type: TablewareCostType;
  unit_price: string;
  notes: string;
};

function blank(): Form {
  return { name: "", category: "otros", cost_type: "alquiler", unit_price: "", notes: "" };
}

function fromItem(item: TablewareItem): Form {
  return {
    name: item.name,
    category: item.category,
    cost_type: item.cost_type,
    unit_price: String(item.unit_price),
    notes: item.notes ?? "",
  };
}

export function TablewareItemDialog({
  open,
  onOpenChange,
  providerId,
  item,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providerId: string;
  item?: TablewareItem | null;
}) {
  const create = useCreateTablewareItem();
  const update = useUpdateTablewareItem();
  const [form, setForm] = useState<Form>(blank);

  useEffect(() => {
    if (open) setForm(item ? fromItem(item) : blank());
  }, [open, item]);

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("El nombre es obligatorio.");
      return;
    }
    const price = Number(form.unit_price.replace(",", "."));
    if (!Number.isFinite(price) || price < 0) {
      toast.error("Precio inválido.");
      return;
    }
    const input = {
      provider_id: providerId,
      name: form.name.trim(),
      category: form.category,
      cost_type: form.cost_type,
      unit_price: price,
      notes: form.notes.trim() || null,
    };
    try {
      if (item) {
        await update.mutateAsync({ id: item.id, input });
        toast.success("Ítem actualizado.");
      } else {
        await create.mutateAsync(input);
        toast.success("Ítem creado.");
      }
      onOpenChange(false);
    } catch (e) {
      toast.error("No se pudo guardar", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  const pending = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {item ? "Editar ítem" : "Nuevo ítem de vajilla"}
          </DialogTitle>
          <DialogDescription>
            Completá los datos del ítem. El tipo de costo determina cómo se calcula en el evento.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="item-name">Nombre *</Label>
            <Input
              id="item-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="ej: Plato de mesa"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Categoría</Label>
              <NativeSelect
                value={form.category}
                onChange={(e) =>
                  setForm((f) => ({ ...f, category: e.target.value as TablewareCategory }))
                }
              >
                {TABLEWARE_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Tipo de costo</Label>
              <NativeSelect
                value={form.cost_type}
                onChange={(e) =>
                  setForm((f) => ({ ...f, cost_type: e.target.value as TablewareCostType }))
                }
              >
                {TABLEWARE_COST_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="item-price">Precio por unidad ($) *</Label>
            <Input
              id="item-price"
              inputMode="decimal"
              value={form.unit_price}
              onChange={(e) => setForm((f) => ({ ...f, unit_price: e.target.value }))}
              placeholder="ej: 250"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="item-notes">Notas</Label>
            <Input
              id="item-notes"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Observaciones opcionales"
            />
          </div>

          <p className="text-xs text-muted-foreground">
            {form.cost_type === "alquiler"
              ? "Alquiler: el costo se cobra por unidad usada en el evento. Las roturas se suman."
              : "Compra: bien reutilizable — por defecto no se carga al evento, pero podés habilitarlo puntualmente."}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={pending}>
            {pending ? "Guardando…" : item ? "Guardar" : "Crear"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
