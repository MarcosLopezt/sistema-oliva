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
import { useCreateStaffRole, useUpdateStaffRole } from "@/lib/hooks";
import { STAFF_CATEGORIES, type StaffRole } from "@/lib/types";

export function StaffRoleDialog({
  open,
  onOpenChange,
  role,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role?: StaffRole | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open && <RoleForm role={role} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function RoleForm({
  role,
  onDone,
}: {
  role?: StaffRole | null;
  onDone: () => void;
}) {
  const isEdit = !!role;
  const create = useCreateStaffRole();
  const update = useUpdateStaffRole();

  const [name, setName] = useState(role?.name ?? "");
  const [category, setCategory] = useState(
    role?.category ?? STAFF_CATEGORIES[0].value,
  );
  const [rate, setRate] = useState(
    role?.hourly_rate != null ? String(role.hourly_rate) : "",
  );
  const [active, setActive] = useState(role?.active ?? true);

  const loading = create.isPending || update.isPending;

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Poné el nombre del rol.");
      return;
    }
    const rateN = rate.trim() ? Number(rate.replace(",", ".")) : 0;
    if (Number.isNaN(rateN) || rateN < 0) {
      toast.error("Tarifa por hora inválida.");
      return;
    }
    const input = {
      name: name.trim(),
      category,
      hourly_rate: rateN,
      active,
    };
    try {
      if (isEdit) {
        await update.mutateAsync({ id: role!.id, input });
        toast.success("Rol actualizado.");
      } else {
        await create.mutateAsync(input);
        toast.success("Rol creado.");
      }
      onDone();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      toast.error("No se pudo guardar", {
        description: msg.includes("staff_roles_name_category_key")
          ? "Ya existe un rol con ese nombre en esa categoría."
          : msg || undefined,
      });
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isEdit ? "Editar rol" : "Nuevo rol"}</DialogTitle>
        <DialogDescription>
          La tarifa del rol es el valor por defecto: la heredan todos los
          empleados que no tengan una tarifa propia cargada.
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="role-name">Nombre del rol</Label>
          <Input
            id="role-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Mozo, Chef, Ayudante de cocina, Bachero"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="role-cat">Categoría</Label>
            <NativeSelect
              id="role-cat"
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
            <Label htmlFor="role-rate">Tarifa base ($ / hora)</Label>
            <Input
              id="role-rate"
              inputMode="decimal"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder="$ por hora"
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="size-4"
          />
          Activo (los inactivos no se ofrecen al asignar)
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
