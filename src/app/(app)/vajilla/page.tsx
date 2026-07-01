"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Upload, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { TablewareProviderDialog } from "@/components/vajilla/tableware-provider-dialog";
import { TablewareItemDialog } from "@/components/vajilla/tableware-item-dialog";
import { VajillaExcelImportDialog } from "@/components/vajilla/vajilla-excel-import-dialog";
import {
  useTablewareProviders,
  useTablewareItems,
  useDeleteTablewareProvider,
  useDeleteTablewareItem,
} from "@/lib/hooks";
import { formatARS } from "@/lib/format";
import {
  TABLEWARE_CATEGORIES,
  type TablewareProvider,
  type TablewareItem,
} from "@/lib/types";

function categoryLabel(cat: string): string {
  return TABLEWARE_CATEGORIES.find((c) => c.value === cat)?.label ?? cat;
}

// ─── Sección de un proveedor ────────────────────────────────────────────────

function ProviderSection({
  provider,
  onEditProvider,
  onDeleteProvider,
}: {
  provider: TablewareProvider;
  onEditProvider: (p: TablewareProvider) => void;
  onDeleteProvider: (p: TablewareProvider) => void;
}) {
  const { data: items } = useTablewareItems(provider.id);
  const delItem = useDeleteTablewareItem();

  const [importOpen, setImportOpen] = useState(false);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<TablewareItem | null>(null);
  const [toDeleteItem, setToDeleteItem] = useState<TablewareItem | null>(null);

  async function confirmDeleteItem() {
    if (!toDeleteItem) return;
    try {
      await delItem.mutateAsync(toDeleteItem.id);
      toast.success("Ítem eliminado.");
      setToDeleteItem(null);
    } catch (e) {
      toast.error("No se pudo eliminar", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  const list = items ?? [];

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between gap-3 border-b bg-muted/40 px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold">{provider.name}</span>
          {provider.phone && (
            <span className="text-xs text-muted-foreground">{provider.phone}</span>
          )}
          <Badge variant="secondary">{list.length} ítems</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setImportOpen(true)}
          >
            <Upload className="size-4" />
            Importar Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditingItem(null);
              setItemDialogOpen(true);
            }}
          >
            <Plus className="size-4" />
            Agregar ítem
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onEditProvider(provider)}
            aria-label="Editar proveedor"
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onDeleteProvider(provider)}
            aria-label="Eliminar proveedor"
          >
            <Trash2 className="size-4 text-destructive" />
          </Button>
        </div>
      </div>

      {list.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">
          Sin ítems. Importá desde Excel o agregá uno manualmente.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ítem</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Precio / un</TableHead>
              <TableHead className="w-px" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {categoryLabel(item.category)}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={item.cost_type === "alquiler" ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {item.cost_type === "alquiler" ? "Alquiler" : "Compra"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatARS(item.unit_price)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        setEditingItem(item);
                        setItemDialogOpen(true);
                      }}
                      aria-label="Editar"
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setToDeleteItem(item)}
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
      )}

      <VajillaExcelImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        providerId={provider.id}
      />
      <TablewareItemDialog
        open={itemDialogOpen}
        onOpenChange={setItemDialogOpen}
        providerId={provider.id}
        item={editingItem}
      />
      <ConfirmDialog
        open={!!toDeleteItem}
        onOpenChange={(o) => !o && setToDeleteItem(null)}
        title="Eliminar ítem"
        description={`Se eliminará "${toDeleteItem?.name}" del catálogo. Si ya está asignado a algún evento no se podrá eliminar.`}
        onConfirm={confirmDeleteItem}
        loading={delItem.isPending}
      />
    </Card>
  );
}

// ─── Página principal ────────────────────────────────────────────────────────

export default function VajillaPage() {
  const { data: providers, isLoading } = useTablewareProviders();
  const delProvider = useDeleteTablewareProvider();

  const [providerDialogOpen, setProviderDialogOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<TablewareProvider | null>(null);
  const [toDeleteProvider, setToDeleteProvider] = useState<TablewareProvider | null>(null);

  async function confirmDeleteProvider() {
    if (!toDeleteProvider) return;
    try {
      await delProvider.mutateAsync(toDeleteProvider.id);
      toast.success("Proveedor eliminado.");
      setToDeleteProvider(null);
    } catch (e) {
      toast.error("No se pudo eliminar", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-primary">
            <UtensilsCrossed className="size-6" />
            Vajilla
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Catálogo de vajilla por proveedor. Alquiler (platos, copas, cubiertos) y
            Compra (utensilios reutilizables).
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingProvider(null);
            setProviderDialogOpen(true);
          }}
        >
          <Plus className="size-4" />
          Nuevo proveedor
        </Button>
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      )}

      {!isLoading && (providers ?? []).length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <UtensilsCrossed className="mx-auto mb-3 size-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              Aún no hay proveedores de vajilla.
            </p>
            <Button
              className="mt-4"
              onClick={() => {
                setEditingProvider(null);
                setProviderDialogOpen(true);
              }}
            >
              <Plus className="size-4" />
              Agregar proveedor
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-4">
        {(providers ?? []).map((p) => (
          <ProviderSection
            key={p.id}
            provider={p}
            onEditProvider={(p) => {
              setEditingProvider(p);
              setProviderDialogOpen(true);
            }}
            onDeleteProvider={setToDeleteProvider}
          />
        ))}
      </div>

      <TablewareProviderDialog
        open={providerDialogOpen}
        onOpenChange={setProviderDialogOpen}
        provider={editingProvider}
      />
      <ConfirmDialog
        open={!!toDeleteProvider}
        onOpenChange={(o) => !o && setToDeleteProvider(null)}
        title="Eliminar proveedor de vajilla"
        description={`Se eliminará "${toDeleteProvider?.name}" y todos sus ítems. Esta acción no se puede deshacer.`}
        onConfirm={confirmDeleteProvider}
        loading={delProvider.isPending}
      />
    </div>
  );
}
