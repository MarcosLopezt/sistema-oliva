"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCreateProvider, useUpdateProvider } from "@/lib/hooks";
import type { Provider } from "@/lib/types";

export function ProviderDialog({
  open,
  onOpenChange,
  provider,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider?: Provider | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open && (
          <ProviderForm
            provider={provider}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ProviderForm({
  provider,
  onDone,
}: {
  provider?: Provider | null;
  onDone: () => void;
}) {
  const isEdit = !!provider;
  const create = useCreateProvider();
  const update = useUpdateProvider();
  const [name, setName] = useState(provider?.name ?? "");
  const [notes, setNotes] = useState(provider?.notes ?? "");
  const loading = create.isPending || update.isPending;

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Poné un nombre para el proveedor.");
      return;
    }
    const input = { name: name.trim(), notes: notes.trim() || null };
    try {
      if (isEdit) {
        await update.mutateAsync({ id: provider!.id, input });
        toast.success("Proveedor actualizado.");
      } else {
        await create.mutateAsync(input);
        toast.success("Proveedor creado.");
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
          {isEdit ? "Editar proveedor" : "Nuevo proveedor"}
        </DialogTitle>
        <DialogDescription>
          Datos del proveedor. Los productos y precios se cargan adentro.
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="prov-name">Nombre</Label>
          <Input
            id="prov-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: El Criollo"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="prov-notes">Notas (opcional)</Label>
          <Textarea
            id="prov-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Contacto, medio de pago habitual, etc."
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
