"use client";

import { useMemo, useState } from "react";
import { Plus, Pencil, Archive, Link2, TriangleAlert, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { IngredientDialog } from "@/components/ingredientes/ingredient-dialog";
import { ProductLinkDialog } from "@/components/ingredientes/product-link-dialog";
import { ArchiveDialog } from "@/components/archivado/archive-dialog";
import { ArchivedPanel } from "@/components/archivado/archived-panel";
import {
  ArchiveTabs,
  BulkActionBar,
  RowCheckbox,
  SelectAllCheckbox,
} from "@/components/archivado/bulk-bar";
import { useBulkSelection } from "@/components/archivado/use-bulk-selection";
import { useIngredients, useArchivedIngredients } from "@/lib/hooks";
import { formatARS, unitLabel } from "@/lib/format";
import { ingredientUnitPrice, ingredientPriceIssue } from "@/lib/cost";
import { toRow } from "@/lib/archivado";
import type { IngredientWithProduct } from "@/lib/types";

/** Origen del precio, para filtrar. */
type SourceFilter = "todos" | "proveedor" | "mercado" | "sin-precio";

export default function IngredientesPage() {
  const [tab, setTab] = useState<"vigentes" | "archivados">("vigentes");
  const { data: ingredients, isLoading } = useIngredients();
  const { data: archived, isLoading: loadingArchived } =
    useArchivedIngredients();

  const [editOpen, setEditOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [editing, setEditing] = useState<IngredientWithProduct | null>(null);
  const [linking, setLinking] = useState<IngredientWithProduct | null>(null);

  const [search, setSearch] = useState("");
  const [providerId, setProviderId] = useState("todos");
  const [source, setSource] = useState<SourceFilter>("todos");

  const all = useMemo(() => ingredients ?? [], [ingredients]);

  const providers = useMemo(() => {
    const m = new Map<string, string>();
    for (const i of all) {
      const p = i.product?.provider;
      if (p) m.set(p.id, p.name);
    }
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [all]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return all.filter((i) => {
      if (term && !i.name.toLowerCase().includes(term)) return false;
      if (providerId !== "todos" && i.product?.provider?.id !== providerId)
        return false;
      if (source === "proveedor" && !i.product) return false;
      if (source === "mercado" && (i.product || i.market_price == null))
        return false;
      if (source === "sin-precio" && (i.product || i.market_price != null))
        return false;
      return true;
    });
  }, [all, search, providerId, source]);

  // La selección se calcula sobre `filtered`, no sobre `all`: por eso
  // "seleccionar todos" con un filtro activo toma solo los filtrados.
  const sel = useBulkSelection(filtered);

  function openNew() {
    setEditing(null);
    setEditOpen(true);
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-primary">Ingredientes</h1>
          <p className="text-muted-foreground">
            Nombre canónico de receta, vinculado a un producto de proveedor.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="size-4" />
          Nuevo ingrediente
        </Button>
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
          entity="ingredients"
          isLoading={loadingArchived}
          rows={(archived ?? []).map((i) => ({
            ...toRow.ingredient(i),
            archived_at: i.archived_at,
            detail: i.product?.provider?.name ?? null,
          }))}
        />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative min-w-48 flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre…"
                className="pl-9"
              />
            </div>
            <NativeSelect
              value={providerId}
              onChange={(e) => setProviderId(e.target.value)}
              className="w-52"
            >
              <option value="todos">Todos los proveedores</option>
              {providers.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect
              value={source}
              onChange={(e) => setSource(e.target.value as SourceFilter)}
              className="w-48"
            >
              <option value="todos">Cualquier precio</option>
              <option value="proveedor">Con proveedor</option>
              <option value="mercado">Precio de mercado</option>
              <option value="sin-precio">Sin precio</option>
            </NativeSelect>
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : filtered.length === 0 ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              {all.length === 0
                ? "Todavía no hay ingredientes."
                : "Ningún ingrediente coincide con los filtros."}
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
                    <TableHead>Ingrediente</TableHead>
                    <TableHead>Unidad</TableHead>
                    <TableHead>Origen del precio</TableHead>
                    <TableHead className="text-right">$/unidad</TableHead>
                    <TableHead className="w-px text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((ing) => {
                    const prod = ing.product;
                    // Mismo motor que usan recetas y eventos: contempla el
                    // modelo de tres capas y convierte a la unidad base.
                    const unitPrice = ingredientUnitPrice(ing);
                    // La alerta se enciende exactamente cuando el costeo falla.
                    const issue = ingredientPriceIssue(ing);
                    return (
                      <TableRow key={ing.id}>
                        <TableCell>
                          <RowCheckbox
                            checked={sel.isSelected(ing.id)}
                            onToggle={() => sel.toggle(ing.id)}
                            label={ing.name}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{ing.name}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {unitLabel(ing.base_unit)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {prod ? (
                            <span className="inline-flex items-center gap-1.5 text-sm">
                              <span className="truncate">
                                {prod.provider?.name}
                              </span>
                              {issue && (
                                <span
                                  className="inline-flex items-center gap-1 text-xs text-amber-600"
                                  title={issue}
                                >
                                  <TriangleAlert className="size-3.5" />
                                  revisar unidad
                                </span>
                              )}
                            </span>
                          ) : ing.market_price != null ? (
                            <Badge variant="outline">precio mercado</Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              sin vínculo
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {unitPrice == null ? (
                            "—"
                          ) : (
                            <>
                              {formatARS(unitPrice)}
                              <span className="text-muted-foreground">
                                {" / "}
                                {unitLabel(ing.base_unit)}
                              </span>
                            </>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setLinking(ing);
                                setLinkOpen(true);
                              }}
                            >
                              <Link2 className="size-4" />
                              Vincular
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => {
                                setEditing(ing);
                                setEditOpen(true);
                              }}
                              aria-label="Editar"
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => {
                                sel.clear();
                                sel.toggle(ing.id);
                                setArchiveOpen(true);
                              }}
                              aria-label="Eliminar"
                            >
                              <Archive className="size-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          )}

          <BulkActionBar
            count={sel.count}
            noun={{ singular: "ingrediente", plural: "ingredientes" }}
            onClear={sel.clear}
            onArchive={() => setArchiveOpen(true)}
          />
        </>
      )}

      <IngredientDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        ingredient={editing}
      />
      <ProductLinkDialog
        open={linkOpen}
        onOpenChange={setLinkOpen}
        ingredient={linking}
      />
      <ArchiveDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        entity="ingredients"
        rows={sel.selected.map(toRow.ingredient)}
        onDone={sel.clear}
      />
    </div>
  );
}
