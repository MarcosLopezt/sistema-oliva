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
import { useAddEventStaff, useUpdateEventStaff } from "@/lib/hooks";
import { formatARS } from "@/lib/format";
import { staffCategoryLabel, type EventStaffWithStaff, type Staff } from "@/lib/types";

export function EventStaffDialog({
  open,
  onOpenChange,
  eventId,
  editing,
  available,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  /** Asignación a editar, o null para crear una nueva. */
  editing: EventStaffWithStaff | null;
  /** Empleados activos disponibles para agregar (solo se usa al crear). */
  available: Staff[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open && (
          <EventStaffForm
            eventId={eventId}
            editing={editing}
            available={available}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function EventStaffForm({
  eventId,
  editing,
  available,
  onDone,
}: {
  eventId: string;
  editing: EventStaffWithStaff | null;
  available: Staff[];
  onDone: () => void;
}) {
  const isEdit = !!editing;
  const add = useAddEventStaff();
  const update = useUpdateEventStaff();

  const [staffId, setStaffId] = useState(
    editing?.staff_id ?? available[0]?.id ?? "",
  );
  const [hours, setHours] = useState(
    editing?.hours != null ? String(editing.hours) : "",
  );
  const [rate, setRate] = useState(
    editing?.rate_override != null ? String(editing.rate_override) : "",
  );

  const loading = add.isPending || update.isPending;

  const selected: Staff | null = isEdit
    ? editing!.staff
    : (available.find((s) => s.id === staffId) ?? null);
  const baseRate = selected?.hourly_rate ?? 0;
  const effRate = rate.trim() ? Number(rate.replace(",", ".")) : baseRate;
  const hoursN = hours.trim() ? Number(hours.replace(",", ".")) : 0;
  const lineTotal =
    Number.isFinite(effRate) && Number.isFinite(hoursN) ? effRate * hoursN : 0;

  async function handleSave() {
    if (!isEdit && !staffId) {
      toast.error("Elegí un empleado.");
      return;
    }
    if (!hours.trim() || Number.isNaN(hoursN) || hoursN < 0) {
      toast.error("Horas inválidas.");
      return;
    }
    const override = rate.trim() ? Number(rate.replace(",", ".")) : null;
    if (override != null && (Number.isNaN(override) || override < 0)) {
      toast.error("Tarifa inválida.");
      return;
    }
    try {
      if (isEdit) {
        await update.mutateAsync({
          id: editing!.id,
          eventId,
          input: { hours: hoursN, rate_override: override },
        });
        toast.success("Personal actualizado.");
      } else {
        await add.mutateAsync({
          eventId,
          input: { staff_id: staffId, hours: hoursN, rate_override: override },
        });
        toast.success("Empleado agregado al evento.");
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
          {isEdit ? "Editar participación" : "Agregar empleado al evento"}
        </DialogTitle>
        <DialogDescription>
          Horas trabajadas × tarifa = total a pagar. La tarifa puntual no cambia
          la tarifa base global del empleado.
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="es-staff">Empleado</Label>
          {isEdit ? (
            <Input
              id="es-staff"
              value={`${editing!.staff?.full_name ?? "—"} · ${staffCategoryLabel(
                editing!.staff?.category ?? "",
              )}`}
              disabled
            />
          ) : available.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No quedan empleados activos sin asignar.
            </p>
          ) : (
            <NativeSelect
              id="es-staff"
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
            >
              {available.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name} · {staffCategoryLabel(s.category)} ·{" "}
                  {formatARS(s.hourly_rate)}/h
                </option>
              ))}
            </NativeSelect>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="es-hours">Horas</Label>
            <Input
              id="es-hours"
              inputMode="decimal"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="Ej: 8"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="es-rate">Tarifa puntual ($/h)</Label>
            <Input
              id="es-rate"
              inputMode="decimal"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder={`Base: ${formatARS(baseRate)}`}
            />
          </div>
        </div>
        <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm">
          <span className="text-muted-foreground">Total a pagar</span>
          <span className="font-semibold tabular-nums">{formatARS(lineTotal)}</span>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button
          onClick={handleSave}
          disabled={loading || (!isEdit && available.length === 0)}
        >
          {loading ? "Guardando…" : "Guardar"}
        </Button>
      </DialogFooter>
    </>
  );
}
