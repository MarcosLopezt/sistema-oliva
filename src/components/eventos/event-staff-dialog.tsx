"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";
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
import { RateOriginBadge } from "@/components/personal/rate-origin";
import { useStaffRoles, useUpdateEventStaff } from "@/lib/hooks";
import { formatARS } from "@/lib/format";
import { rateSourceLabel, resolveRate } from "@/lib/personal";
import { staffCategoryLabel, type EventStaffWithStaff } from "@/lib/types";

export function EventStaffDialog({
  open,
  onOpenChange,
  eventId,
  editing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  /** Asignación a editar. Para agregar se usa EventStaffPickerDialog. */
  editing: EventStaffWithStaff | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open && editing && (
          <EventStaffForm
            eventId={eventId}
            editing={editing}
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
  onDone,
}: {
  eventId: string;
  editing: EventStaffWithStaff;
  onDone: () => void;
}) {
  const update = useUpdateEventStaff();
  const { data: roles } = useStaffRoles();

  const [roleId, setRoleId] = useState(editing.role_id ?? "");
  const [hours, setHours] = useState(String(editing.hours ?? ""));
  const [rate, setRate] = useState(
    editing.rate_override != null ? String(editing.rate_override) : "",
  );

  const habitual = editing.staff?.staff_role ?? null;

  const options = useMemo(
    () => (roles ?? []).filter((r) => r.active || r.id === editing.role_id),
    [roles, editing.role_id],
  );

  const hoursN = hours.trim() ? Number(hours.replace(",", ".")) : 0;
  const override = rate.trim() ? Number(rate.replace(",", ".")) : null;

  // Se arma la asignación tal como quedaría y se resuelve con la misma función
  // que usa la tabla, para que la vista previa no pueda desincronizarse.
  const preview = useMemo(() => {
    const pendingRole = options.find((r) => r.id === roleId) ?? null;
    return resolveRate({
      ...editing,
      role_id: roleId || null,
      event_role: pendingRole,
      rate_override:
        override != null && Number.isFinite(override) ? override : null,
    });
  }, [editing, options, roleId, override]);

  const lineTotal = Number.isFinite(hoursN) ? hoursN * preview.rate : 0;

  async function handleSave() {
    if (!hours.trim() || Number.isNaN(hoursN) || hoursN < 0) {
      toast.error("Horas inválidas.");
      return;
    }
    if (override != null && (Number.isNaN(override) || override < 0)) {
      toast.error("Tarifa inválida.");
      return;
    }
    try {
      await update.mutateAsync({
        id: editing.id,
        eventId,
        input: {
          hours: hoursN,
          rate_override: override,
          role_id: roleId || null,
        },
      });
      toast.success("Personal actualizado.");
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
        <DialogTitle>Editar participación</DialogTitle>
        <DialogDescription>
          Lo que cambies acá vale solo para este evento: no toca el rol habitual
          ni la tarifa global del empleado.
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="es-staff">Empleado</Label>
          <Input
            id="es-staff"
            value={`${editing.staff?.full_name ?? "—"} · ${staffCategoryLabel(
              editing.staff?.category ?? "",
            )}`}
            disabled
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="es-role">Rol en este evento</Label>
          <NativeSelect
            id="es-role"
            value={roleId}
            onChange={(e) => setRoleId(e.target.value)}
          >
            <option value="">
              {habitual ? `Rol habitual (${habitual.name})` : "Sin rol"}
            </option>
            {options.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} · {staffCategoryLabel(r.category)} ·{" "}
                {formatARS(r.hourly_rate)}/h
              </option>
            ))}
          </NativeSelect>
          {preview.roleOverridden && (
            <p className="text-xs text-amber-600">
              Trabaja en otro puesto solo en este evento. Su rol habitual sigue
              siendo {habitual?.name ?? "el que tenga asignado"}.
            </p>
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
            <Label htmlFor="es-rate">Tarifa para este evento ($/h)</Label>
            <div className="flex gap-1">
              <Input
                id="es-rate"
                inputMode="decimal"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                placeholder="Vacío = heredada"
              />
              {rate.trim() !== "" && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setRate("")}
                  aria-label="Volver a la tarifa heredada"
                  title="Volver a la tarifa heredada"
                >
                  <RotateCcw className="size-4" />
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1 rounded-md bg-muted/40 px-3 py-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Tarifa aplicada</span>
            <span className="flex items-center gap-2">
              <RateOriginBadge resolved={preview} />
              <span className="font-medium tabular-nums">
                {formatARS(preview.rate)}/h
              </span>
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {rateSourceLabel(preview)}
          </p>
          <div className="mt-1 flex items-center justify-between border-t pt-1">
            <span className="text-muted-foreground">Total a pagar</span>
            <span className="font-semibold tabular-nums">
              {formatARS(lineTotal)}
            </span>
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button onClick={handleSave} disabled={update.isPending}>
          {update.isPending ? "Guardando…" : "Guardar"}
        </Button>
      </DialogFooter>
    </>
  );
}
