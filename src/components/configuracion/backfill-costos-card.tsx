"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { History, TriangleAlert, Check } from "lucide-react";
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
import {
  useEvents,
  useSnapshottedEventIds,
  useSaveEventCostSnapshot,
} from "@/lib/hooks";
import * as q from "@/lib/queries";
import { buildSnapshotData } from "@/lib/snapshot";
import { formatARS, formatDate } from "@/lib/format";
import { isEventLive, type EventRow } from "@/lib/types";

/**
 * RECONSTRUCCIÓN DE COSTOS — operación de una sola vez.
 *
 * Los eventos que se finalizaron antes de que existiera la foto no tienen una,
 * así que sus números todavía se recalculan con el catálogo actual y siguen
 * moviéndose cada vez que cambia un precio.
 *
 * LO QUE NO SE PUEDE HACER: recuperar los precios originales. No hay historial
 * de precios en la base (`products.price` es un único valor que se pisa en
 * cada importación), así que el costo que tuvo un evento el día que se cerró
 * está perdido. Esto congela lo mejor disponible —los precios de hoy— y marca
 * esas fotos como `reliable: false` para que se sepa cuáles son historia real
 * y cuáles una reconstrucción.
 *
 * Corre con la sesión del usuario logueado, como el resto de la app: no hace
 * falta una service-role key para una operación que se ejecuta una vez.
 *
 * Es idempotente: solo toca eventos finalizados SIN foto.
 */
export function BackfillCostosCard() {
  const { data: events } = useEvents();
  const { data: snapshotted } = useSnapshottedEventIds();
  const save = useSaveEventCostSnapshot();

  const [preview, setPreview] = useState<Map<string, number> | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [running, setRunning] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);
  const [done, setDone] = useState<Set<string>>(new Set());

  /** Eventos finalizados que todavía no tienen foto. */
  const pending = useMemo<EventRow[]>(() => {
    if (!events || !snapshotted) return [];
    return events
      .filter((e) => !isEventLive(e) && !snapshotted.has(e.id) && !done.has(e.id))
      .sort((a, b) => (b.event_date ?? "").localeCompare(a.event_date ?? ""));
  }, [events, snapshotted, done]);

  /**
   * Junta todo lo que hace falta para costear UN evento. Es una lectura suelta
   * (no un hook) porque la cantidad de eventos no se sabe de antemano y no se
   * pueden llamar hooks en un loop.
   */
  async function loadInputs(event: EventRow) {
    const [selections, costs, staff, tableware, settings, beverages] =
      await Promise.all([
        q.listEventRecipes(event.id),
        q.listEventCosts(event.id),
        q.listEventStaff(event.id),
        q.listEventTableware(event.id),
        q.getBarSettings(),
        q.listBarBeverages(),
      ]);
    return { event, selections, costs, staff, tableware, settings, beverages };
  }

  /** Paso 1: mostrar qué eventos se van a tocar y con qué número. No escribe. */
  async function runPreview() {
    setPreviewing(true);
    try {
      const totals = new Map<string, number>();
      for (const ev of pending) {
        const data = buildSnapshotData(await loadInputs(ev));
        totals.set(ev.id, data.summary.internalTotal);
      }
      setPreview(totals);
    } catch (e) {
      toast.error("No se pudo previsualizar", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setPreviewing(false);
    }
  }

  /** Paso 2: crear las fotos. `only` limita la corrida a un solo evento. */
  async function run(only?: EventRow) {
    const targets = only ? [only] : pending;
    setRunning(true);
    let ok = 0;
    const failed: string[] = [];
    try {
      for (const ev of targets) {
        try {
          await save.mutateAsync({
            eventId: ev.id,
            data: buildSnapshotData(await loadInputs(ev)),
            origin: "backfill",
            // Reconstruida: los precios son los de hoy, no los del evento.
            reliable: false,
            // El evento YA está finalizado; el backfill no cambia estados.
            finalize: false,
          });
          setDone((prev) => new Set(prev).add(ev.id));
          ok++;
        } catch {
          failed.push(ev.name);
        }
      }
      setConfirmAll(false);
      if (failed.length === 0) {
        toast.success(
          `${ok} evento${ok === 1 ? "" : "s"} reconstruido${ok === 1 ? "" : "s"}.`,
        );
      } else {
        toast.warning(`${ok} reconstruidos. Fallaron ${failed.length}.`, {
          description: failed.slice(0, 3).join(", "),
        });
      }
    } finally {
      setRunning(false);
    }
  }

  const loading = !events || !snapshotted;

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-start gap-2 border-b bg-muted/40 px-4 py-3">
        <History className="mt-0.5 size-4 shrink-0 text-primary" />
        <div>
          <div className="font-medium">Costos congelados</div>
          <p className="text-xs text-muted-foreground">
            Al finalizar un evento se guarda una foto de su costo, y a partir de
            ahí editar precios o recetas ya no lo modifica. Los eventos cerrados
            antes de que existiera esa foto necesitan que se les reconstruya una.
          </p>
        </div>
      </div>

      <CardContent className="flex flex-col gap-4 py-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : pending.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Check className="size-4 text-emerald-600" />
            Todos los eventos finalizados tienen su costo congelado. No hay nada
            que reconstruir.
          </p>
        ) : (
          <>
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-400">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              <div>
                <strong>
                  Hay {pending.length} evento{pending.length === 1 ? "" : "s"}{" "}
                  finalizado{pending.length === 1 ? "" : "s"} sin foto de costo.
                </strong>{" "}
                Sus números todavía se recalculan con el catálogo actual, así
                que cambian solos cada vez que se actualiza un precio.
                <p className="mt-1">
                  La reconstrucción los congela en su valor de{" "}
                  <strong>hoy</strong>, no en el que tuvieron el día del evento:
                  esos precios ya no existen en ningún lado. Por eso quedan
                  marcados como reconstruidos, con un aviso permanente en el
                  detalle del evento.
                </p>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Evento</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">
                    Costo que se congelaría
                  </TableHead>
                  <TableHead className="w-px" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.map((ev) => (
                  <TableRow key={ev.id}>
                    <TableCell className="font-medium">{ev.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(ev.event_date)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {preview?.has(ev.id) ? (
                        formatARS(preview.get(ev.id)!)
                      ) : (
                        <span className="text-muted-foreground">
                          — previsualizá para verlo —
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={running}
                        onClick={() => run(ev)}
                      >
                        Reconstruir
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                variant="outline"
                onClick={runPreview}
                disabled={previewing || running}
              >
                {previewing ? "Calculando…" : "Previsualizar"}
              </Button>
              <Button onClick={() => setConfirmAll(true)} disabled={running}>
                {running
                  ? "Reconstruyendo…"
                  : `Reconstruir los ${pending.length}`}
              </Button>
            </div>
          </>
        )}

        {done.size > 0 && (
          <p className="text-sm text-muted-foreground">
            <Badge variant="secondary" className="mr-2">
              {done.size}
            </Badge>
            reconstruido{done.size === 1 ? "" : "s"} en esta sesión.
          </p>
        )}
      </CardContent>

      <ConfirmDialog
        open={confirmAll}
        onOpenChange={setConfirmAll}
        title="Reconstruir los costos"
        description={`Se van a crear ${pending.length} fotos de costo, una por cada evento finalizado que no tenga.`}
        details={
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>
              No cambia el estado de ningún evento ni toca el catálogo: solo
              guarda el desglose.
            </li>
            <li>
              Los precios que se congelan son los de <strong>hoy</strong>. Las
              fotos quedan marcadas como reconstruidas.
            </li>
            <li>
              Los eventos que ya tienen foto no se tocan: se puede volver a
              correr sin riesgo.
            </li>
          </ul>
        }
        confirmLabel="Reconstruir"
        loadingLabel="Reconstruyendo…"
        variant="default"
        onConfirm={() => run()}
        loading={running}
      />
    </Card>
  );
}
