"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarClock, TriangleAlert } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useSetRowsActive, useDependencyGraph } from "@/lib/hooks";
import { toastUndo } from "@/lib/undo";
import {
  BULK_CONFIRM_THRESHOLD,
  ENTITY_LABEL,
  computeArchiveImpact,
  nameList,
  type ArchivableEntity,
  type ArchivableRow,
} from "@/lib/archivado";
import { formatDate } from "@/lib/format";

/**
 * El diálogo de "eliminar" (que archiva) para las cinco entidades.
 *
 * Muestra, ANTES de ejecutar:
 *  · cuántos elementos y cuáles,
 *  · qué eventos ACTIVOS los usan, con nombre,
 *  · qué va a pasar exactamente con esos eventos,
 *  · lo que no se pueda archivar y por qué.
 *
 * Los eventos FINALIZADOS no aparecen porque no pueden verse afectados: leen
 * de su foto de costo (migración 0019). Nombrarlos sería ruido que le quita
 * peso al aviso que sí importa.
 */
export function ArchiveDialog({
  open,
  onOpenChange,
  entity,
  rows,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entity: ArchivableEntity;
  rows: ArchivableRow[];
  /** Se llama al terminar bien, para limpiar la selección de la pantalla. */
  onDone: () => void;
}) {
  const setActive = useSetRowsActive();
  const { graph } = useDependencyGraph();
  const [typed, setTyped] = useState("");

  const label = ENTITY_LABEL[entity];
  const n = rows.length;

  const impact = useMemo(
    () =>
      graph
        ? computeArchiveImpact(entity, rows, graph)
        : { entity, rows, affected: [], blocked: [], archivable: rows },
    [entity, rows, graph],
  );

  // Arriba del umbral se pide escribir la cantidad. Un "aceptar" a secas se
  // clickea sin leer; escribir el número obliga a mirar cuántos son.
  const needsStrongConfirm = n > BULK_CONFIRM_THRESHOLD;
  const strongOk = !needsStrongConfirm || typed.trim() === String(n);

  async function archive() {
    // Los ids se capturan ACÁ, antes de mutar: el deshacer tiene que restituir
    // exactamente estos y no "todos los archivados", que incluiría los que ya
    // estaban archivados de antes.
    const ids = impact.archivable.map((r) => r.id);
    if (ids.length === 0) return;

    try {
      const count = await setActive.mutateAsync({ entity, ids, active: false });
      onOpenChange(false);
      setTyped("");
      onDone();

      toastUndo({
        message: `${count} ${count === 1 ? label.singular : label.plural} archivado${count === 1 ? "" : "s"}.`,
        description:
          impact.affected.length > 0
            ? `${impact.affected.length} evento${impact.affected.length === 1 ? "" : "s"} activo${impact.affected.length === 1 ? "" : "s"} sigue${impact.affected.length === 1 ? "" : "n"} funcionando con ellos.`
            : undefined,
        onUndo: () => setActive.mutateAsync({ entity, ids, active: true }),
        undoneMessage: `${ids.length} ${ids.length === 1 ? label.singular : label.plural} de vuelta en el listado.`,
      });
    } catch (e) {
      toast.error("No se pudo archivar", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setTyped("");
      }}
      title={
        n === 1
          ? `Eliminar ${label.singular}`
          : `Eliminar ${n} ${label.plural}`
      }
      description={
        n === 1
          ? `“${rows[0]?.name}” deja de aparecer en los listados y selectores.`
          : `${n} ${label.plural} dejan de aparecer en los listados y selectores.`
      }
      details={
        <div className="flex flex-col gap-3 text-sm">
          {n > 1 && (
            <div className="rounded-lg bg-muted/50 p-3 text-muted-foreground">
              {nameList(rows)}
            </div>
          )}

          <p className="text-muted-foreground">
            No se borra nada: quedan en <strong>Archivados</strong> y se pueden
            recuperar cuando quieras. Lo que ya los usaba los sigue usando.
          </p>

          {impact.affected.length > 0 && (
            <div className="flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-800 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-300">
              <span className="flex items-start gap-2 font-medium">
                <CalendarClock className="mt-0.5 size-4 shrink-0" />
                {impact.affected.length === 1
                  ? "1 evento activo los usa:"
                  : `${impact.affected.length} eventos activos los usan:`}
              </span>
              <ul className="flex flex-col gap-1 pl-6">
                {impact.affected.slice(0, 6).map(({ event, via }) => (
                  <li key={event.id}>
                    <strong>{event.name}</strong>
                    {event.event_date && (
                      <span className="text-xs"> · {formatDate(event.event_date)}</span>
                    )}
                    <span className="block text-xs opacity-80">
                      usa: {via.slice(0, 4).join(", ")}
                      {via.length > 4 ? ` y ${via.length - 4} más` : ""}
                    </span>
                  </li>
                ))}
                {impact.affected.length > 6 && (
                  <li className="text-xs">
                    y {impact.affected.length - 6} evento
                    {impact.affected.length - 6 === 1 ? "" : "s"} más
                  </li>
                )}
              </ul>
              <p className="pl-6 text-xs">
                Esos eventos <strong>siguen funcionando igual</strong>: conservan
                estos elementos y su costo no cambia. Lo único que pasa es que no
                vas a poder volver a elegirlos al armar un evento nuevo.
              </p>
            </div>
          )}

          {impact.blocked.length > 0 && (
            <div className="flex flex-col gap-1 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
              <span className="flex items-center gap-2 font-medium text-destructive">
                <TriangleAlert className="size-4" />
                {impact.blocked.length} no se {impact.blocked.length === 1 ? "puede" : "pueden"} archivar
              </span>
              <ul className="list-disc pl-5 text-xs text-muted-foreground">
                {impact.blocked.map(({ row, reason }) => (
                  <li key={row.id}>
                    <strong>{row.name}</strong>: {reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {needsStrongConfirm && (
            <div className="flex flex-col gap-1.5 rounded-lg border bg-muted/30 p-3">
              <Label htmlFor="confirm-count" className="text-xs">
                Son {n} elementos. Escribí <strong>{n}</strong> para confirmar.
              </Label>
              <Input
                id="confirm-count"
                inputMode="numeric"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={String(n)}
                className="w-24"
                autoComplete="off"
              />
            </div>
          )}
        </div>
      }
      confirmLabel={
        impact.archivable.length === n
          ? "Eliminar"
          : `Eliminar ${impact.archivable.length}`
      }
      loadingLabel="Archivando…"
      variant="destructive"
      onConfirm={strongOk ? archive : () => {}}
      loading={setActive.isPending || !strongOk}
    />
  );
}
