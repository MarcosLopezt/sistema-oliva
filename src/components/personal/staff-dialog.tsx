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
import { useCreateStaff, useStaffRoles, useUpdateStaff } from "@/lib/hooks";
import { formatARS } from "@/lib/format";
import type { ResolvedRate } from "@/lib/personal";
import {
  STAFF_CATEGORIES,
  staffCategoryLabel,
  type Staff,
  type StaffRole,
} from "@/lib/types";

export function StaffDialog({
  open,
  onOpenChange,
  staff,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staff?: Staff | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open && (
          <StaffForm staff={staff} onDone={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function StaffForm({
  staff,
  onDone,
}: {
  staff?: Staff | null;
  onDone: () => void;
}) {
  const isEdit = !!staff;
  const create = useCreateStaff();
  const update = useUpdateStaff();
  const { data: roles } = useStaffRoles();

  const [fullName, setFullName] = useState(staff?.full_name ?? "");
  const [roleId, setRoleId] = useState(staff?.role_id ?? "");
  const [category, setCategory] = useState(
    staff?.category ?? STAFF_CATEGORIES[0].value,
  );
  const [rate, setRate] = useState(
    staff?.hourly_rate != null ? String(staff.hourly_rate) : "",
  );
  const [active, setActive] = useState(staff?.active ?? true);

  const loading = create.isPending || update.isPending;

  // Solo se ofrecen roles activos, más el que ya tenga asignado aunque esté
  // dado de baja, para no perderlo sin querer al editar.
  const options = useMemo(
    () => (roles ?? []).filter((r) => r.active || r.id === staff?.role_id),
    [roles, staff?.role_id],
  );

  const selectedRole: StaffRole | null =
    options.find((r) => r.id === roleId) ?? null;

  // El rol define la categoría; sin rol, la categoría se elige a mano.
  const effectiveCategory = selectedRole?.category ?? category;

  const ownRate = rate.trim() ? Number(rate.replace(",", ".")) : null;
  const resolved: ResolvedRate =
    ownRate != null && !Number.isNaN(ownRate)
      ? { rate: ownRate, source: "empleado", role: selectedRole, roleOverridden: false }
      : selectedRole
        ? {
            rate: selectedRole.hourly_rate,
            source: "rol",
            role: selectedRole,
            roleOverridden: false,
          }
        : { rate: 0, source: "sin-tarifa", role: null, roleOverridden: false };

  async function handleSave() {
    if (!fullName.trim()) {
      toast.error("Poné el nombre del empleado.");
      return;
    }
    if (ownRate != null && (Number.isNaN(ownRate) || ownRate < 0)) {
      toast.error("Tarifa por hora inválida.");
      return;
    }
    const input = {
      full_name: fullName.trim(),
      category: effectiveCategory,
      role_id: roleId || null,
      hourly_rate: ownRate,
      active,
    };
    try {
      if (isEdit) {
        await update.mutateAsync({ id: staff!.id, input });
        toast.success("Empleado actualizado.");
      } else {
        await create.mutateAsync(input);
        toast.success("Empleado creado.");
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
        <DialogTitle>{isEdit ? "Editar empleado" : "Nuevo empleado"}</DialogTitle>
        <DialogDescription>
          El rol define la categoría y la tarifa por defecto. Cargá una tarifa
          propia solo si esta persona cobra distinto al resto de su rol.
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="staff-name">Nombre completo</Label>
          <Input
            id="staff-name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Ej: Juan Pérez"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="staff-role">Rol habitual</Label>
          <NativeSelect
            id="staff-role"
            value={roleId}
            onChange={(e) => setRoleId(e.target.value)}
          >
            <option value="">Sin rol</option>
            {options.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} · {staffCategoryLabel(r.category)} ·{" "}
                {formatARS(r.hourly_rate)}/h
              </option>
            ))}
          </NativeSelect>
          {options.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Todavía no hay roles. Crealos en la pestaña Roles para que los
              empleados hereden una tarifa.
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="staff-cat">Categoría</Label>
            <NativeSelect
              id="staff-cat"
              value={effectiveCategory}
              onChange={(e) => setCategory(e.target.value)}
              disabled={!!selectedRole}
            >
              {STAFF_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </NativeSelect>
            {selectedRole && (
              <p className="text-xs text-muted-foreground">
                La define el rol {selectedRole.name}.
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="staff-rate">Tarifa propia ($ / hora)</Label>
            <div className="flex gap-1">
              <Input
                id="staff-rate"
                inputMode="decimal"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                placeholder={
                  selectedRole
                    ? `Hereda ${formatARS(selectedRole.hourly_rate)}`
                    : "$ por hora"
                }
              />
              {selectedRole && rate.trim() !== "" && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setRate("")}
                  aria-label="Volver a la tarifa del rol"
                  title="Volver a la tarifa del rol"
                >
                  <RotateCcw className="size-4" />
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Vacío = hereda la del rol.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm">
          <span className="text-muted-foreground">Tarifa que se va a aplicar</span>
          <span className="flex items-center gap-2">
            <RateOriginBadge resolved={resolved} />
            <span className="font-semibold tabular-nums">
              {formatARS(resolved.rate)}/h
            </span>
          </span>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="size-4"
          />
          Activo (los inactivos no aparecen al armar un evento)
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
