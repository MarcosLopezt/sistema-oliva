"use client";

import { useState } from "react";
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
import { useCreateProduct, useUpdateProduct } from "@/lib/hooks";
import { UNITS, type Product, type UnitKind } from "@/lib/types";

export function ProductDialog({
  open,
  onOpenChange,
  providerId,
  product,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providerId: string;
  product?: Product | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open && (
          <ProductForm
            providerId={providerId}
            product={product}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ProductForm({
  providerId,
  product,
  onDone,
}: {
  providerId: string;
  product?: Product | null;
  onDone: () => void;
}) {
  const isEdit = !!product;
  const create = useCreateProduct();
  const update = useUpdateProduct();

  const [name, setName] = useState(product?.name ?? "");
  const [code, setCode] = useState(product?.code ?? "");
  const [baseUnit, setBaseUnit] = useState<UnitKind>(product?.base_unit ?? "kg");
  const [packSize, setPackSize] = useState(String(product?.pack_size ?? 1));
  const [price, setPrice] = useState(String(product?.price ?? 0));
  const [iva, setIva] = useState(product?.price_includes_iva ?? false);

  const loading = create.isPending || update.isPending;

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Poné un nombre de producto.");
      return;
    }
    const pack = Number(packSize.replace(",", "."));
    const pr = Number(price.replace(",", "."));
    if (!(pack > 0)) {
      toast.error("El tamaño del pack debe ser mayor a 0.");
      return;
    }
    if (pr < 0 || Number.isNaN(pr)) {
      toast.error("Precio inválido.");
      return;
    }
    const input = {
      provider_id: providerId,
      name: name.trim(),
      code: code.trim() || null,
      base_unit: baseUnit,
      pack_size: pack,
      price: pr,
      price_includes_iva: iva,
    };
    try {
      if (isEdit) {
        await update.mutateAsync({ id: product!.id, input });
        toast.success("Producto actualizado.");
      } else {
        await create.mutateAsync(input);
        toast.success("Producto creado.");
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
        <DialogTitle>{isEdit ? "Editar producto" : "Nuevo producto"}</DialogTitle>
        <DialogDescription>
          El precio es por unidad de compra. El tamaño del pack es cuánto rinde
          esa unidad (ej: bidón de 5 L → unidad L, pack 5).
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="prod-name">Nombre</Label>
          <Input
            id="prod-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: ACEITE DE GIRASOL BIDON X 5LT"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="prod-code">Código (opcional)</Label>
            <Input
              id="prod-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="prod-unit">Unidad base</Label>
            <NativeSelect
              id="prod-unit"
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
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="prod-pack">Tamaño del pack</Label>
            <Input
              id="prod-pack"
              inputMode="decimal"
              value={packSize}
              onChange={(e) => setPackSize(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="prod-price">Precio (por pack)</Label>
            <Input
              id="prod-price"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={iva}
            onChange={(e) => setIva(e.target.checked)}
            className="size-4"
          />
          El precio incluye IVA
        </label>
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
