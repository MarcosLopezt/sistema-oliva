"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { useCreateEvent, useUpdateEvent } from "@/lib/hooks";
import type { EventRow } from "@/lib/types";

export function EventDialog({
  open,
  onOpenChange,
  event,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: EventRow | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open && (
          <EventForm event={event} onDone={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function EventForm({
  event,
  onDone,
}: {
  event?: EventRow | null;
  onDone: () => void;
}) {
  const isEdit = !!event;
  const router = useRouter();
  const create = useCreateEvent();
  const update = useUpdateEvent();

  const [name, setName] = useState(event?.name ?? "");
  const [date, setDate] = useState(event?.event_date ?? "");
  const [pax, setPax] = useState(String(event?.pax ?? 0));
  const [duration, setDuration] = useState(String(event?.duration_hours ?? 5));

  const loading = create.isPending || update.isPending;

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Poné un nombre al evento.");
      return;
    }
    const paxN = Math.trunc(Number(pax) || 0);
    const dur = Number(duration.replace(",", ".")) || 5;
    if (paxN < 0) {
      toast.error("PAX inválido.");
      return;
    }
    const input = {
      name: name.trim(),
      event_date: date || null,
      pax: paxN,
      duration_hours: dur,
    };
    try {
      if (isEdit) {
        await update.mutateAsync({ id: event!.id, input });
        toast.success("Evento actualizado.");
        onDone();
      } else {
        const created = await create.mutateAsync(input);
        toast.success("Evento creado.");
        onDone();
        router.push(`/eventos/${created.id}`);
      }
    } catch (e) {
      toast.error("No se pudo guardar", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isEdit ? "Editar evento" : "Nuevo evento"}</DialogTitle>
        <DialogDescription>
          Datos básicos del evento. El menú y los costos se cargan adentro.
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="ev-name">Nombre</Label>
          <Input
            id="ev-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Casamiento Adolfo y Julia"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="ev-date">Fecha</Label>
            <Input
              id="ev-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ev-pax">PAX (invitados)</Label>
            <Input
              id="ev-pax"
              inputMode="numeric"
              value={pax}
              onChange={(e) => setPax(e.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="ev-dur">Duración (horas)</Label>
          <Input
            id="ev-dur"
            inputMode="decimal"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
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
