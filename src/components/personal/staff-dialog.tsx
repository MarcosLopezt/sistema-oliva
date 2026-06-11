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
import { useCreateStaff, useUpdateStaff } from "@/lib/hooks";
import { STAFF_CATEGORIES, type Staff } from "@/lib/types";

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

  const [fullName, setFullName] = useState(staff?.full_name ?? "");
  const [category, setCategory] = useState(
    staff?.category ?? STAFF_CATEGORIES[0].value,
  );
  const [role, setRole] = useState(staff?.role ?? "");
  const [rate, setRate] = useState(
    staff?.hourly_rate != null ? String(staff.hourly_rate) : "",
  );
  const [active, setActive] = useState(staff?.active ?? true);

  const loading = create.isPending || update.isPending;

  async function handleSave() {
    if (!fullName.trim()) {
      toast.error("Poné el nombre del empleado.");
      return;
    }
    const rateN = rate.trim() ? Number(rate.replace(",", ".")) : 0;
    if (Number.isNaN(rateN) || rateN < 0) {
      toast.error("Tarifa por hora inválida.");
      return;
    }
    const input = {
      full_name: fullName.trim(),
      category,
      role: role.trim() || null,
      hourly_rate: rateN,
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
          Datos del empleado. La tarifa base se puede sobreescribir por evento.
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
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="staff-cat">Categoría</Label>
            <NativeSelect
              id="staff-cat"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {STAFF_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="staff-rate">Tarifa base ($ / hora)</Label>
            <Input
              id="staff-rate"
              inputMode="decimal"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder="$ por hora"
            />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="staff-role">Rol / puesto</Label>
          <Input
            id="staff-role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="Ej: Chef, Mozo, Ayudante de cocina, Sommelier"
          />
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
