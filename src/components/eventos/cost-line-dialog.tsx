"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCreateEventCost, useUpdateEventCost } from "@/lib/hooks";
import { formatARS } from "@/lib/format";
import { COST_SECTIONS, type EventCost, type EventCostSection } from "@/lib/types";

export function CostLineDialog({
  open,
  onOpenChange,
  eventId,
  section,
  cost,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  section: EventCostSection;
  cost?: EventCost | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open && (
          <Form
            eventId={eventId}
            section={section}
            cost={cost}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function Form({
  eventId,
  section,
  cost,
  onDone,
}: {
  eventId: string;
  section: EventCostSection;
  cost?: EventCost | null;
  onDone: () => void;
}) {
  const cfg = COST_SECTIONS[section];
  const isEdit = !!cost;
  const create = useCreateEventCost();
  const update = useUpdateEventCost();

  const [name, setName] = useState(cost?.name ?? "");
  const [detail, setDetail] = useState(cost?.detail ?? "");
  const [quantity, setQuantity] = useState(String(cost?.quantity ?? 1));
  const [unitPrice, setUnitPrice] = useState(String(cost?.unit_price ?? 0));

  const loading = create.isPending || update.isPending;
  const num = (s: string) => Number(s.replace(",", "."));
  const subtotal = (num(quantity) || 0) * (num(unitPrice) || 0);

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Poné un nombre.");
      return;
    }
    const input = {
      section,
      name: name.trim(),
      detail: cfg.detailLabel ? detail.trim() || null : null,
      quantity: Math.max(0, num(quantity) || 0),
      unit_price: Math.max(0, num(unitPrice) || 0),
    };
    try {
      if (isEdit) {
        await update.mutateAsync({ id: cost!.id, eventId, input });
        toast.success("Línea actualizada.");
      } else {
        await create.mutateAsync({ eventId, input });
        toast.success("Línea agregada.");
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
          {isEdit ? "Editar" : "Agregar"} — {cfg.title}
        </DialogTitle>
        <DialogDescription>{cfg.description}</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="cost-name">
            {section === "personal" ? "Nombre / empleado" : "Concepto"}
          </Label>
          <Input
            id="cost-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        {cfg.detailLabel && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="cost-detail">{cfg.detailLabel}</Label>
            <Input
              id="cost-detail"
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
            />
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="cost-qty">{cfg.qtyLabel}</Label>
            <Input
              id="cost-qty"
              inputMode="decimal"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="cost-price">{cfg.priceLabel}</Label>
            <Input
              id="cost-price"
              inputMode="decimal"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
            />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Subtotal: <span className="font-medium text-foreground">{formatARS(subtotal)}</span>
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
