"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { ProviderDialog } from "@/components/proveedores/provider-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useProviders, useDeleteProvider } from "@/lib/hooks";
import type { Provider } from "@/lib/types";

export default function ProveedoresPage() {
  const { data: providers, isLoading, error } = useProviders();
  const del = useDeleteProvider();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Provider | null>(null);
  const [toDelete, setToDelete] = useState<Provider | null>(null);

  function openNew() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(p: Provider) {
    setEditing(p);
    setDialogOpen(true);
  }

  async function confirmDelete() {
    if (!toDelete) return;
    try {
      await del.mutateAsync(toDelete.id);
      toast.success("Proveedor eliminado.");
      setToDelete(null);
    } catch (e) {
      toast.error("No se pudo eliminar", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Proveedores</h1>
          <p className="text-muted-foreground">
            Cada proveedor tiene su lista de precios (productos).
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="size-4" />
          Nuevo proveedor
        </Button>
      </div>

      {error && (
        <p className="text-sm text-destructive">
          Error al cargar: {error.message}
        </p>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : !providers || providers.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Todavía no hay proveedores. Creá el primero con “Nuevo proveedor”.
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Notas</TableHead>
                <TableHead className="w-px text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {providers.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.notes || "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        render={<Link href={`/proveedores/${p.id}`} />}
                        variant="outline"
                        size="sm"
                      >
                        <Package className="size-4" />
                        Productos
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openEdit(p)}
                        aria-label="Editar"
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setToDelete(p)}
                        aria-label="Eliminar"
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <ProviderDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        provider={editing}
      />
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Eliminar proveedor"
        description={`Se eliminará "${toDelete?.name}" y todos sus productos. Esta acción no se puede deshacer.`}
        onConfirm={confirmDelete}
        loading={del.isPending}
      />
    </div>
  );
}
