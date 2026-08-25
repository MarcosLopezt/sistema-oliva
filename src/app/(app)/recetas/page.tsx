"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Archive, Upload, Search } from "lucide-react";
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
import { NativeSelect } from "@/components/native-select";
import { RecipeExcelImportDialog } from "@/components/recetas/recipe-excel-import-dialog";
import { ArchiveDialog } from "@/components/archivado/archive-dialog";
import { ArchivedPanel } from "@/components/archivado/archived-panel";
import {
  ArchiveTabs,
  BulkActionBar,
  RowCheckbox,
  SelectAllCheckbox,
} from "@/components/archivado/bulk-bar";
import { useBulkSelection } from "@/components/archivado/use-bulk-selection";
import { useRecipes, useArchivedRecipes } from "@/lib/hooks";
import { toRow } from "@/lib/archivado";
import { RECIPE_CATEGORIES } from "@/lib/types";

const CAT_LABEL = Object.fromEntries(
  RECIPE_CATEGORIES.map((c) => [c.value, c.label]),
);

export default function RecetasPage() {
  const [tab, setTab] = useState<"vigentes" | "archivados">("vigentes");
  const { data: recipes, isLoading } = useRecipes();
  const { data: archived, isLoading: loadingArchived } = useArchivedRecipes();

  const [importOpen, setImportOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("todas");

  const all = useMemo(() => recipes ?? [], [recipes]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return all.filter((r) => {
      if (category !== "todas" && r.category !== category) return false;
      if (term && !r.name.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [all, search, category]);

  // Sobre `filtered`: "seleccionar todos" respeta los filtros activos.
  const sel = useBulkSelection(filtered);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-primary">Recetas</h1>
          <p className="text-muted-foreground">
            Cada receta rinde un lote de unidades y se escala según los PAX.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="size-4" />
            Importar Excel
          </Button>
          <Button nativeButton={false} render={<Link href="/recetas/nueva" />}>
            <Plus className="size-4" />
            Nueva receta
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
          entity="recipes"
          isLoading={loadingArchived}
          rows={(archived ?? []).map((r) => ({
            ...toRow.recipe(r),
            archived_at: r.archived_at,
            detail: CAT_LABEL[r.category] ?? r.category,
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
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-52"
        >
          <option value="todas">Todas las categorías</option>
          {RECIPE_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </NativeSelect>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          {all.length === 0
            ? "Todavía no hay recetas. Creá la primera con “Nueva receta”."
            : "Ninguna receta coincide con los filtros."}
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
                <TableHead>Plato</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead className="text-right">Rinde</TableHead>
                <TableHead className="text-right">Ingredientes</TableHead>
                <TableHead className="w-px text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <RowCheckbox
                      checked={sel.isSelected(r.id)}
                      onToggle={() => sel.toggle(r.id)}
                      label={r.name}
                    />
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/recetas/${r.id}`}
                      className="font-medium hover:underline"
                    >
                      {r.name}
                    </Link>
                    {r.is_veggie && (
                      <Badge variant="secondary" className="ml-2">
                        veggie
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {CAT_LABEL[r.category] ?? r.category}
                    </span>
                    {r.subcategory && (
                      <span className="text-xs text-muted-foreground">
                        {" "}
                        · {r.subcategory}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.yield_units} un
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.item_count}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        nativeButton={false}
                        render={<Link href={`/recetas/${r.id}`} />}
                        aria-label="Editar"
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => {
                          sel.clear();
                          sel.toggle(r.id);
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
            noun={{ singular: "receta", plural: "recetas" }}
            onClear={sel.clear}
            onArchive={() => setArchiveOpen(true)}
          />
        </>
      )}

      <ArchiveDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        entity="recipes"
        rows={sel.selected.map(toRow.recipe)}
        onDone={sel.clear}
      />
      <RecipeExcelImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}
