"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Plus,
  Pencil,
  Archive,
  Upload,
  ArrowLeft,
  Info,
  Search,
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
import { Input } from "@/components/ui/input";
import { ProductDialog } from "@/components/proveedores/product-dialog";
import { ExcelImportDialog } from "@/components/proveedores/excel-import-dialog";
import { ArchiveDialog } from "@/components/archivado/archive-dialog";
import { ArchivedPanel } from "@/components/archivado/archived-panel";
import {
  ArchiveTabs,
  BulkActionBar,
  RowCheckbox,
  SelectAllCheckbox,
} from "@/components/archivado/bulk-bar";
import { useBulkSelection } from "@/components/archivado/use-bulk-selection";
import { toRow } from "@/lib/archivado";
import { useProviders, useProducts, useArchivedProducts } from "@/lib/hooks";
import {
  formatARS,
  formatDate,
  formatNum,
  formatUnitContent,
  pricePerBaseUnit,
  unitLabel,
} from "@/lib/format";
import type { Product } from "@/lib/types";

export default function ProviderProductsPage() {
  const { id } = useParams<{ id: string }>();
  const { data: providers } = useProviders();
  const provider = providers?.find((p) => p.id === id);
  const { data: products, isLoading } = useProducts(id);
  const { data: archived, isLoading: loadingArchived } =
    useArchivedProducts(id);

  const [tab, setTab] = useState<"vigentes" | "archivados">("vigentes");
  const [prodOpen, setProdOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [search, setSearch] = useState("");

  const all = useMemo(() => products ?? [], [products]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return all;
    return all.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        (p.code ?? "").toLowerCase().includes(term),
    );
  }, [all, search]);

  // Sobre `filtered`: "seleccionar todos" respeta el buscador activo.
  const sel = useBulkSelection(filtered);

  // Aviso suave: dentro de un mismo proveedor lo normal es que todos los
  // precios estén sobre la misma base. Si están mezclados, probablemente se
  // eligió mal la columna de precio en alguna importación.
  const mixedIva = useMemo(() => {
    if (!products || products.length < 2) return false;
    const first = products[0].price_includes_iva;
    return products.some((p) => p.price_includes_iva !== first);
  }, [products]);

  function openNew() {
    setEditing(null);
    setProdOpen(true);
  }
  function openEdit(p: Product) {
    setEditing(p);
    setProdOpen(true);
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
          <h1 className="text-2xl font-semibold tracking-tight text-primary">
            {provider?.name ?? "Proveedor"}
          </h1>
          <p className="text-muted-foreground">
            {all.length} productos en la lista de precios.
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

      <div className="mb-4">
        <ArchiveTabs
          value={tab}
          onChange={setTab}
          archivedCount={archived?.length}
        />
      </div>

      {tab === "archivados" ? (
        <ArchivedPanel
          entity="products"
          isLoading={loadingArchived}
          rows={(archived ?? []).map((p) => ({
            ...toRow.product(p),
            archived_at: p.archived_at,
            detail: p.code,
          }))}
        />
      ) : (
        <>
      {mixedIva && (
        <Card className="mb-4 border-sky-200 bg-sky-50 p-4 text-sm dark:bg-sky-950/20">
          <div className="flex items-start gap-2 text-sky-700 dark:text-sky-400">
            <Info className="mt-0.5 size-4 shrink-0" />
            <span>
              Este proveedor tiene productos cargados con y sin IVA. Verificá que
              sea correcto: suele pasar cuando una importación tomó la columna de
              precio equivocada. Los precios se usan tal cual están cargados.
            </span>
          </div>
        </Card>
      )}

      <div className="mb-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o código…"
            className="pl-9"
          />
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          {all.length === 0
            ? "Sin productos. Importá la lista de precios o agregá uno a mano."
            : "Ningún producto coincide con la búsqueda."}
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-px">
                  <SelectAllCheckbox
                    checked={sel.allVisibleSelected}
                    indeterminate={sel.someVisibleSelected}
                    onToggle={sel.toggleAll}
                  />
                </TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Unidad</TableHead>
                <TableHead className="text-right">
                  Pack
                  <span className="block text-[11px] font-normal text-muted-foreground">
                    cuánto trae la compra
                  </span>
                </TableHead>
                <TableHead className="text-right">
                  Contenido
                  <span className="block text-[11px] font-normal text-muted-foreground">
                    dentro de cada unidad
                  </span>
                </TableHead>
                <TableHead className="text-right">Precio</TableHead>
                <TableHead className="text-right">$/unidad</TableHead>
                <TableHead>Actualizado</TableHead>
                <TableHead className="w-px text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <RowCheckbox
                      checked={sel.isSelected(p.id)}
                      onToggle={() => sel.toggle(p.id)}
                      label={p.name}
                    />
                  </TableCell>
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
                  <TableCell className="text-right tabular-nums">
                    {/* Solo aplica a productos vendidos por unidad: es el volumen
                        o peso que trae cada botella/paquete. En los productos que
                        ya se venden por peso o volumen, ese dato es el Pack. */}
                    {formatUnitContent(p.unit_content_value, p.unit_content_unit) ?? (
                      <span className="text-muted-foreground">
                        {p.base_unit === "un" ? "sin cargar" : "—"}
                      </span>
                    )}
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
                        onClick={() => {
                          sel.clear();
                          sel.toggle(p.id);
                          setArchiveOpen(true);
                        }}
                        aria-label="Eliminar"
                      >
                        <Archive className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

          <BulkActionBar
            count={sel.count}
            noun={{ singular: "producto", plural: "productos" }}
            onClear={sel.clear}
            onArchive={() => setArchiveOpen(true)}
          />
        </>
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
      <ArchiveDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        entity="products"
        rows={sel.selected.map(toRow.product)}
        onDone={sel.clear}
      />
    </div>
  );
}
