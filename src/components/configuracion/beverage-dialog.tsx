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
import { useCreateBarBeverage, useUpdateBarBeverage } from "@/lib/hooks";
import type { BarBeverage, BarraService } from "@/lib/types";

type Service = Exclude<BarraService, "ninguna">;

export function BeverageDialog({
  open,
  onOpenChange,
  beverage,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  beverage?: BarBeverage | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open && (
          <BeverageForm
            beverage={beverage}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function BeverageForm({
  beverage,
  onDone,
}: {
  beverage?: BarBeverage | null;
  onDone: () => void;
}) {
  const isEdit = !!beverage;
  const create = useCreateBarBeverage();
  const update = useUpdateBarBeverage();

  const [name, setName] = useState(beverage?.name ?? "");
  const [service, setService] = useState<Service>(beverage?.service ?? "con_alcohol");
  const [sizeMl, setSizeMl] = useState(String(beverage?.size_ml ?? 1000));
  const [price, setPrice] = useState(String(beverage?.price ?? 0));
  const [mlpph, setMlpph] = useState(String(beverage?.ml_per_person_hour ?? 0));

  const loading = create.isPending || update.isPending;
  const num = (s: string) => Number(s.replace(",", "."));

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Poné un nombre.");
      return;
    }
    const size = num(sizeMl);
    if (!(size > 0)) {
      toast.error("El tamaño de la botella debe ser mayor a 0.");
      return;
    }
    const input = {
      name: name.trim(),
      service,
      size_ml: size,
      price: Math.max(0, num(price) || 0),
      ml_per_person_hour: Math.max(0, num(mlpph) || 0),
    };
    try {
      if (isEdit) {
        await update.mutateAsync({ id: beverage!.id, input });
        toast.success("Bebida actualizada.");
      } else {
        await create.mutateAsync(input);
        toast.success("Bebida creada.");
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
        <DialogTitle>{isEdit ? "Editar bebida" : "Nueva bebida"}</DialogTitle>
        <DialogDescription>
          El consumo es en ml por persona por hora; el sistema lo multiplica por
          PAX, horas y los factores de día/horario.
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="bev-name">Nombre</Label>
          <Input
            id="bev-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Gin Gordons"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="bev-service">Servicio</Label>
            <NativeSelect
              id="bev-service"
              value={service}
              onChange={(e) => setService(e.target.value as Service)}
            >
              <option value="sin_alcohol">Sin alcohol</option>
              <option value="con_alcohol">Con alcohol</option>
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="bev-size">Tamaño botella (ml)</Label>
            <Input
              id="bev-size"
              inputMode="decimal"
              value={sizeMl}
              onChange={(e) => setSizeMl(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="bev-mlpph">Consumo (ml/persona/hora)</Label>
            <Input
              id="bev-mlpph"
              inputMode="decimal"
              value={mlpph}
              onChange={(e) => setMlpph(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="bev-price">Precio por botella</Label>
            <Input
              id="bev-price"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
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
