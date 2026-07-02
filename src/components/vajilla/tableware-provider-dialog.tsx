"use client";

import { useEffect, useState } from "react";
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
import {
  useCreateTablewareProvider,
  useUpdateTablewareProvider,
} from "@/lib/hooks";
import type { TablewareProvider } from "@/lib/types";

type Form = { name: string; phone: string; notes: string };

function blank(): Form {
  return { name: "", phone: "", notes: "" };
}

function fromProvider(p: TablewareProvider): Form {
  return { name: p.name, phone: p.phone ?? "", notes: p.notes ?? "" };
}

export function TablewareProviderDialog({
  open,
  onOpenChange,
  provider,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider?: TablewareProvider | null;
}) {
  const create = useCreateTablewareProvider();
  const update = useUpdateTablewareProvider();
  const [form, setForm] = useState<Form>(blank);

  useEffect(() => {
    if (open) setForm(provider ? fromProvider(provider) : blank());
  }, [open, provider]);

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("El nombre del proveedor es obligatorio.");
      return;
    }
    const input = {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      notes: form.notes.trim() || null,
    };
    try {
      if (provider) {
        await update.mutateAsync({ id: provider.id, input });
        toast.success("Proveedor actualizado.");
      } else {
        await create.mutateAsync(input);
        toast.success("Proveedor creado.");
      }
      onOpenChange(false);
    } catch (e) {
      toast.error("No se pudo guardar", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  const pending = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {provider ? "Editar proveedor de vajilla" : "Nuevo proveedor de vajilla"}
          </DialogTitle>
          <DialogDescription>
            Podés agregar varios proveedores e importar el catálogo de cada uno.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="prov-name">Nombre *</Label>
            <Input
              id="prov-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="ej: Celebro"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="prov-phone">Teléfono / WhatsApp</Label>
            <Input
              id="prov-phone"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="ej: 5491112345678"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="prov-notes">Notas</Label>
            <Input
              id="prov-notes"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Observaciones opcionales"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={pending}>
            {pending ? "Guardando…" : provider ? "Guardar" : "Crear"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
