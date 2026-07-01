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
import { parseUnitContentFromName } from "@/lib/unit-content-parser";

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
  const [saleUnit, setSaleUnit] = useState(product?.sale_unit ?? "");
  const [baseUnit, setBaseUnit] = useState<UnitKind>(product?.base_unit ?? "kg");
  const [packSize, setPackSize] = useState(String(product?.pack_size ?? 1));
  const [price, setPrice] = useState(String(product?.price ?? 0));
  const [iva, setIva] = useState(product?.price_includes_iva ?? false);

  // Contenido por unidad: inicializar desde DB o auto-detectar del nombre.
  function initContent(): {
    value: string;
    unit: UnitKind | "";
    source: "name" | "manual" | "";
  } {
    if (product?.unit_content_value != null) {
      return {
        value: String(product.unit_content_value),
        unit: product.unit_content_unit ?? "",
        source: "manual",
      };
    }
    const detected = parseUnitContentFromName(product?.name ?? "");
    if (detected) {
      return { value: String(detected.value), unit: detected.unit, source: "name" };
    }
    return { value: "", unit: "", source: "" };
  }

  const init = initContent();
  const [unitContentValue, setUnitContentValue] = useState(init.value);
  const [unitContentUnit, setUnitContentUnit] = useState<UnitKind | "">(init.unit);
  // "name" = auto-detectado del nombre | "manual" = editado por el usuario | "" = vacío.
  const [contentSource, setContentSource] = useState<"name" | "manual" | "">(
    init.source,
  );

  const loading = create.isPending || update.isPending;

  function handleNameChange(newName: string) {
    setName(newName);
    // Solo re-detectar automáticamente si el usuario no editó el campo a mano.
    if (contentSource !== "manual") {
      const detected = parseUnitContentFromName(newName);
      if (detected) {
        setUnitContentValue(String(detected.value));
        setUnitContentUnit(detected.unit);
        setContentSource("name");
      } else {
        setUnitContentValue("");
        setUnitContentUnit("");
        setContentSource("");
      }
    }
  }

  function handleContentValueChange(v: string) {
    setUnitContentValue(v);
    setContentSource("manual");
  }

  function handleContentUnitChange(u: UnitKind | "") {
    setUnitContentUnit(u);
    setContentSource("manual");
  }

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

    // Contenido por unidad: ambos campos deben estar completos para ser válidos.
    const ucv = unitContentValue
      ? Number(unitContentValue.replace(",", "."))
      : null;
    const ucu = unitContentUnit || null;
    const validContent = ucv && ucv > 0 && ucu ? { ucv, ucu } : null;

    const input = {
      provider_id: providerId,
      name: name.trim(),
      code: code.trim() || null,
      sale_unit: saleUnit.trim() || null,
      base_unit: baseUnit,
      pack_size: pack,
      price: pr,
      price_includes_iva: iva,
      unit_content_value: validContent?.ucv ?? null,
      unit_content_unit: validContent?.ucu ?? null,
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
            onChange={(e) => handleNameChange(e.target.value)}
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
            <Label htmlFor="prod-sale-unit">Unidad de venta (opcional)</Label>
            <Input
              id="prod-sale-unit"
              value={saleUnit}
              onChange={(e) => setSaleUnit(e.target.value)}
              placeholder="Ej: caja, bolsa, docena"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
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
          <div className="flex flex-col gap-2">
            <Label htmlFor="prod-pack">Tamaño del pack</Label>
            <Input
              id="prod-pack"
              inputMode="decimal"
              value={packSize}
              onChange={(e) => setPackSize(e.target.value)}
            />
          </div>
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
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={iva}
            onChange={(e) => setIva(e.target.checked)}
            className="size-4"
          />
          El precio incluye IVA
        </label>

        {/* Contenido por unidad — para productos en "unidades" con volumen/peso */}
        <div className="flex flex-col gap-2 rounded-md border p-3">
          <div className="flex items-center justify-between">
            <Label>Contenido por unidad</Label>
            {contentSource === "name" && (
              <span className="text-xs text-muted-foreground">
                detectado del nombre
              </span>
            )}
            {contentSource === "manual" && (
              <span className="text-xs text-muted-foreground">
                ingresado manualmente
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Para productos en "unidades" que contienen volumen o peso (ej: botella
            de 700 ml). Habilita calcular costos proporcionales en recetas.
          </p>
          <div className="flex gap-2">
            <Input
              inputMode="decimal"
              placeholder="Cantidad (ej: 700)"
              value={unitContentValue}
              onChange={(e) => handleContentValueChange(e.target.value)}
              className="w-32"
            />
            <NativeSelect
              value={unitContentUnit}
              onChange={(e) =>
                handleContentUnitChange(e.target.value as UnitKind | "")
              }
              className="flex-1"
            >
              <option value="">— sin unidad —</option>
              <option value="ml">ml (mililitros)</option>
              <option value="g">g (gramos)</option>
              <option value="l">L (litros)</option>
              <option value="kg">kg (kilos)</option>
            </NativeSelect>
          </div>
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
