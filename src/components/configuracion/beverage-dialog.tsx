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
import { BEVERAGE_SERVICES, type BarBeverage, type BeverageService } from "@/lib/types";

type Service = BeverageService;

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

  const initialPrice = String(beverage?.price ?? 0);
  const [name, setName] = useState(beverage?.name ?? "");
  const [service, setService] = useState<Service>(beverage?.service ?? "con_alcohol");
  const [sizeMl, setSizeMl] = useState(String(beverage?.size_ml ?? 1000));
  const [price, setPrice] = useState(initialPrice);
  const [mlpph, setMlpph] = useState(String(beverage?.ml_per_person_hour ?? 0));
  const [marketAuto, setMarketAuto] = useState(beverage?.market_auto ?? false);

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
    // Si tocaste el precio a mano, queda marcado como "manual".
    const priceChanged = price !== initialPrice;
    const input = {
      name: name.trim(),
      service,
      size_ml: size,
      price: Math.max(0, num(price) || 0),
      ml_per_person_hour: Math.max(0, num(mlpph) || 0),
      market_auto: marketAuto,
      ...(priceChanged
        ? {
            market_price_source: "manual" as const,
            market_price_updated_at: new Date().toISOString(),
          }
        : {}),
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
              {BEVERAGE_SERVICES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
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
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={marketAuto}
            onChange={(e) => setMarketAuto(e.target.checked)}
            className="size-4"
          />
          Buscar el precio de mercado automáticamente
        </label>
        <p className="text-xs text-muted-foreground">
          Con esto activado, el precio se actualiza solo (≈1 vez por semana) al
          abrir un evento. Si editás el precio a mano, queda como precio manual.
        </p>
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
