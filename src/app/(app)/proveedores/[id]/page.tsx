"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  Upload,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ProductDialog } from "@/components/proveedores/product-dialog";
import { ExcelImportDialog } from "@/components/proveedores/excel-import-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useProviders, useProducts, useDeleteProduct } from "@/lib/hooks";
import { formatARS, formatDate, formatNum, pricePerBaseUnit, unitLabel } from "@/lib/format";
import type { Product } from "@/lib/types";

export default function ProviderProductsPage() {
  const { id } = useParams<{ id: string }>();
  const { data: providers } = useProviders();
  const provider = providers?.find((p) => p.id === id);
  const { data: products, isLoading } = useProducts(id);
  const del = useDeleteProduct();

  const [prodOpen, setProdOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [toDelete, setToDelete] = useState<Product | null>(null);

  function openNew() {
    setEditing(null);
    setProdOpen(true);
  }
  function openEdit(p: Product) {
    setEditing(p);
    setProdOpen(true);
  }
  async function confirmDelete() {
    if (!toDelete) return;
    try {
      await del.mutateAsync(toDelete.id);
      toast.success("Producto eliminado.");
      setToDelete(null);
    } catch (e) {
      toast.error("No se pudo eliminar", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href="/proveedores"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Proveedores
      </Link>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {provider?.name ?? "Proveedor"}
          </h1>
          <p className="text-muted-foreground">
            {products?.length ?? 0} productos en la lista de precios.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="size-4" />
            Importar Excel
          </Button>
          <Button onClick={openNew}>
            <Plus className="size-4" />
            Nuevo producto
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : !products || products.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Sin productos. Importá la lista de precios o agregá uno a mano.
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>Unidad</TableHead>
                <TableHead className="text-right">Pack</TableHead>
                <TableHead className="text-right">Precio</TableHead>
                <TableHead className="text-right">$/unidad</TableHead>
                <TableHead>Actualizado</TableHead>
                <TableHead className="w-px text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="max-w-[320px]">
                    <div className="truncate font-medium">{p.name}</div>
                    {p.code && (
                      <div className="text-xs text-muted-foreground">
                        {p.code}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {p.sale_unit?.trim() || unitLabel(p.base_unit)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNum(p.pack_size)} {unitLabel(p.base_unit)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatARS(p.price)}
                    {p.price_includes_iva && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        c/IVA
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground tabular-nums">
                    {formatARS(pricePerBaseUnit(p.price, p.pack_size))} / {unitLabel(p.base_unit)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(p.updated_at)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
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

      <ProductDialog
        open={prodOpen}
        onOpenChange={setProdOpen}
        providerId={id}
        product={editing}
      />
      <ExcelImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        providerId={id}
      />
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Eliminar producto"
        description={`Se eliminará "${toDelete?.name}".`}
        onConfirm={confirmDelete}
        loading={del.isPending}
      />
    </div>
  );
}
