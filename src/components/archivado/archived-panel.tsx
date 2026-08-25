"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Archive, TriangleAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  BulkActionBar,
  RowCheckbox,
  SelectAllCheckbox,
} from "@/components/archivado/bulk-bar";
import { useBulkSelection } from "@/components/archivado/use-bulk-selection";
import {
  useSetRowsActive,
  useDeleteArchivedRows,
  useReferenceCounts,
} from "@/lib/hooks";
import { toastUndo } from "@/lib/undo";
import {
  ENTITY_LABEL,
  computeDeletePlan,
  nameList,
  type ArchivableEntity,
  type ArchivableRow,
} from "@/lib/archivado";
import { formatDate } from "@/lib/format";

/** Una fila archivada: lo mínimo para listarla. */
export type ArchivedRow = ArchivableRow & {
  archived_at?: string | null;
  /** Texto secundario de la fila (proveedor, categoría, etc.). */
  detail?: string | null;
};

/**
 * Vista de archivados, igual para las cinco entidades.
 *
 * Dos acciones:
 *  · Desarchivar — vuelve al listado. Es la salida normal.
 *  · Borrar definitivamente — SOLO para lo que no está referenciado en ningún
 *    lado. La condición la valida la base (`delete_archived_rows`, migración
 *    0020); acá se calcula igual para poder decir cuáles y por qué ANTES de
 *    ejecutar, en vez de devolver "borré 3 de 8" sin explicación.
 */
export function ArchivedPanel({
  entity,
  rows,
  isLoading,
}: {
  entity: ArchivableEntity;
  rows: ArchivedRow[];
  isLoading?: boolean;
}) {
  const label = ENTITY_LABEL[entity];
  const setActive = useSetRowsActive();
  const hardDelete = useDeleteArchivedRows();
  const { data: refs } = useReferenceCounts();

  const [search, setSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [typed, setTyped] = useState("");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(term));
  }, [rows, search]);

  const sel = useBulkSelection(filtered);

  const plan = useMemo(
    () =>
      computeDeletePlan(entity, sel.selected, {
        recipesByIngredient: refs?.recipesByIngredient,
        eventsByRecipe: refs?.eventsByRecipe,
        ingredientsByProduct: refs?.ingredientsByProduct,
        leftoversByProduct: refs?.leftoversByProduct,
      }),
    [entity, sel.selected, refs],
  );

  async function unarchive() {
    // Se capturan antes de mutar: el deshacer restituye exactamente estos.
    const ids = sel.selectedIds;
    try {
      const count = await setActive.mutateAsync({ entity, ids, active: true });
      sel.clear();
      toastUndo({
        message: `${count} ${count === 1 ? label.singular : label.plural} de vuelta en el listado.`,
        onUndo: () => setActive.mutateAsync({ entity, ids, active: false }),
        undoneMessage: `${ids.length} ${ids.length === 1 ? label.singular : label.plural} archivado${ids.length === 1 ? "" : "s"} de nuevo.`,
      });
    } catch (e) {
      toast.error("No se pudo desarchivar", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  async function runDelete() {
    const ids = plan.deletable.map((r) => r.id);
    if (ids.length === 0) return;
    try {
      const count = await hardDelete.mutateAsync({ entity, ids });
      setConfirmDelete(false);
      setTyped("");
      sel.clear();
      if (count === ids.length) {
        toast.success(
          `${count} ${count === 1 ? label.singular : label.plural} borrado${count === 1 ? "" : "s"} definitivamente.`,
        );
      } else {
        // La base rechazó algunos: apareció una referencia entre que se
        // calculó el plan y se ejecutó. Se dice, no se disimula.
        toast.warning(`Se borraron ${count} de ${ids.length}.`, {
          description:
            "Los demás quedaron archivados: aparecieron referencias nuevas mientras tanto.",
        });
      }
    } catch (e) {
      toast.error("No se pudo borrar", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  const strongOk = typed.trim() === String(plan.deletable.length);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Cargando archivados…</p>;
  }

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <Archive className="mx-auto mb-3 size-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            No hay {label.plural} archivados.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {rows.length} {rows.length === 1 ? label.singular : label.plural}{" "}
          archivado{rows.length === 1 ? "" : "s"}. Siguen existiendo y lo que ya
          los usaba los sigue usando.
        </p>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar…"
          className="w-52"
        />
      </div>

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
              <TableHead>Nombre</TableHead>
              <TableHead>Archivado</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r) => {
              const blocked = plan.blocked.find((b) => b.row.id === r.id);
              return (
                <TableRow key={r.id}>
                  <TableCell>
                    <RowCheckbox
                      checked={sel.isSelected(r.id)}
                      onToggle={() => sel.toggle(r.id)}
                      label={r.name}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    {r.name}
                    {r.detail && (
                      <span className="block text-xs font-normal text-muted-foreground">
                        {r.detail}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.archived_at ? formatDate(r.archived_at) : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {sel.isSelected(r.id) && blocked
                      ? `No se puede borrar: ${blocked.reason}`
                      : ""}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <BulkActionBar
        count={sel.count}
        noun={label}
        onClear={sel.clear}
        onUnarchive={unarchive}
        onDelete={
          plan.deletable.length > 0 ? () => setConfirmDelete(true) : undefined
        }
        busy={setActive.isPending || hardDelete.isPending}
      />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={(o) => {
          setConfirmDelete(o);
          if (!o) setTyped("");
        }}
        title="Borrar definitivamente"
        description={`Se van a borrar ${plan.deletable.length} ${plan.deletable.length === 1 ? label.singular : label.plural} para siempre.`}
        details={
          <div className="flex flex-col gap-3 text-sm">
            <div className="rounded-lg bg-muted/50 p-3 text-muted-foreground">
              {nameList(plan.deletable)}
            </div>

            <p className="flex items-start gap-2 font-medium text-destructive">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              Esto no se puede deshacer. No quedan en archivados: desaparecen.
            </p>

            {plan.blocked.length > 0 && (
              <div className="rounded-lg border bg-muted/30 p-3">
                <span className="font-medium">
                  {plan.blocked.length} de los seleccionados NO se borran
                </span>
                <ul className="mt-1 list-disc pl-5 text-xs text-muted-foreground">
                  {plan.blocked.slice(0, 6).map(({ row, reason }) => (
                    <li key={row.id}>
                      <strong>{row.name}</strong>: {reason}
                    </li>
                  ))}
                  {plan.blocked.length > 6 && (
                    <li>y {plan.blocked.length - 6} más</li>
                  )}
                </ul>
                <p className="mt-1 text-xs text-muted-foreground">
                  Quedan archivados, como estaban.
                </p>
              </div>
            )}

            <div className="flex flex-col gap-1.5 rounded-lg border bg-muted/30 p-3">
              <Label htmlFor="confirm-delete-count" className="text-xs">
                Escribí <strong>{plan.deletable.length}</strong> para confirmar.
              </Label>
              <Input
                id="confirm-delete-count"
                inputMode="numeric"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={String(plan.deletable.length)}
                className="w-24"
                autoComplete="off"
              />
            </div>
          </div>
        }
        confirmLabel="Borrar para siempre"
        loadingLabel="Borrando…"
        variant="destructive"
        onConfirm={strongOk ? runDelete : () => {}}
        loading={hardDelete.isPending || !strongOk}
      />
    </>
  );
}
