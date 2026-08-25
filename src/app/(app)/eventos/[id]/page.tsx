"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Users,
  CalendarDays,
  Clock,
  CheckCircle2,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EventDialog } from "@/components/eventos/event-dialog";
import { EventParams } from "@/components/eventos/event-params";
import { MenuSelection } from "@/components/eventos/menu-selection";
import { MateriaPrimaSection } from "@/components/eventos/materia-prima-section";
import { BarraSection } from "@/components/eventos/barra-section";
import { CostSection } from "@/components/eventos/cost-section";
import { EventStaffSection } from "@/components/eventos/event-staff-section";
import { EventVajillaSection } from "@/components/eventos/event-vajilla-section";
import { EventVajillaParams } from "@/components/eventos/event-vajilla-params";
import { EventSummary } from "@/components/eventos/event-summary";
import { LeftoverCloseDialog } from "@/components/eventos/leftover-close-dialog";
import {
  EventLockProvider,
  FrozenCostNotice,
} from "@/components/eventos/event-lock";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  useEvent,
  useEventRecipes,
  useEventCosts,
  useEventStaff,
  useEventTableware,
  useEventCostSnapshot,
  useBarSettings,
  useBarBeverages,
  useSaveEventCostSnapshot,
  useUpdateEvent,
  useDeleteEvent,
} from "@/lib/hooks";
import {
  buildSnapshotData,
  computeEventCost,
  readSnapshot,
  snapshotDelta,
  type CostInputs,
} from "@/lib/snapshot";
import { formatARS, formatDate } from "@/lib/format";
import { isEventLive } from "@/lib/types";

export default function EventoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data: event, isLoading } = useEvent(id);
  const { data: selections } = useEventRecipes(id);
  const { data: costs } = useEventCosts(id);
  const { data: staff } = useEventStaff(id);
  const { data: tableware } = useEventTableware(id);
  const { data: settings } = useBarSettings();
  const { data: beverages } = useBarBeverages();
  const { data: snapshot, isLoading: snapshotLoading } =
    useEventCostSnapshot(id);

  const update = useUpdateEvent();
  const del = useDeleteEvent();
  const saveSnapshot = useSaveEventCostSnapshot();

  const [editOpen, setEditOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [confirmStatus, setConfirmStatus] = useState(false);
  const [confirmRecalc, setConfirmRecalc] = useState(false);
  const [leftoverOpen, setLeftoverOpen] = useState(false);

  /** Todo lo que hace falta del catálogo vivo para costear. */
  const inputs: CostInputs | null = useMemo(
    () =>
      event
        ? {
            event,
            selections: selections ?? [],
            settings,
            beverages: beverages ?? [],
            staff: staff ?? [],
            tableware: tableware ?? [],
            costs: costs ?? [],
          }
        : null,
    [event, selections, settings, beverages, staff, tableware, costs],
  );

  // El cálculo vivo se hace SIEMPRE, incluso en un evento cerrado: es lo que
  // alimenta el "recalcular con precios actuales" y el delta que se muestra
  // antes de pisar la foto. Lo que cambia es si se muestra o no.
  const live = useMemo(
    () => (inputs ? computeEventCost(inputs) : null),
    [inputs],
  );
  const frozen = useMemo(() => readSnapshot(snapshot), [snapshot]);

  // LA DECISIÓN, EN UN SOLO LUGAR: un evento cerrado lee de la foto y nunca del
  // catálogo. Si está cerrado y todavía no tiene foto (finalizado antes de que
  // existiera este mecanismo, o backfill pendiente) cae al cálculo vivo, que es
  // lo que venía mostrando; el cartel de arriba avisa que le falta la foto.
  const locked = event ? !isEventLive(event) : false;
  const view = locked && frozen ? frozen : live;

  if (isLoading || snapshotLoading)
    return <p className="text-sm text-muted-foreground">Cargando evento…</p>;
  if (!event)
    return <p className="text-sm text-muted-foreground">Evento no encontrado.</p>;

  const isActive = isEventLive(event);
  const delta = snapshot && live ? snapshotDelta(snapshot, live) : null;

  /**
   * Finalizar saca la foto y cierra el evento en UNA transacción (RPC).
   * El orden importa: si se cerrara primero y la foto fallara, quedaría un
   * evento finalizado sin foto — el estado que este mecanismo elimina.
   */
  async function finalize() {
    if (!event || !inputs) return;
    try {
      await saveSnapshot.mutateAsync({
        eventId: event.id,
        data: buildSnapshotData(inputs),
        origin: snapshot ? "refinalizado" : "finalizado",
        reliable: true,
        finalize: true,
      });
      setConfirmStatus(false);
      toast.success("Evento finalizado. Su costo quedó congelado.");
      // Recién con el evento cerrado se ofrece registrar los sobrantes.
      setLeftoverOpen(true);
    } catch (e) {
      toast.error("No se pudo finalizar", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  /** Reabrir NO toca la foto: se conserva hasta que se vuelva a finalizar. */
  async function reopen() {
    if (!event) return;
    try {
      await update.mutateAsync({ id: event.id, input: { status: "activo" } });
      setConfirmStatus(false);
      toast.success("Evento reabierto. Vuelve a calcular con precios actuales.");
    } catch (e) {
      toast.error("No se pudo reabrir", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  /** Rehace la foto con los precios de hoy, sin cambiar el estado del evento. */
  async function recalculate() {
    if (!event || !inputs) return;
    try {
      await saveSnapshot.mutateAsync({
        eventId: event.id,
        data: buildSnapshotData(inputs),
        origin: "recalculado",
        // Recalcular a pedido produce una foto tan confiable como los precios
        // de hoy: deja de ser una reconstrucción automática.
        reliable: true,
        finalize: false,
      });
      setConfirmRecalc(false);
      toast.success("Costo recalculado con los precios actuales.");
    } catch (e) {
      toast.error("No se pudo recalcular", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  async function confirmDelete() {
    if (!event) return;
    try {
      await del.mutateAsync(event.id);
      toast.success("Evento eliminado.");
      router.push("/");
    } catch (e) {
      toast.error("No se pudo eliminar", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  return (
    <EventLockProvider event={event} snapshot={snapshot}>
      <div className="mx-auto max-w-4xl">
        <Link
          href="/"
          className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Eventos
        </Link>

        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-primary">
                {event.name}
              </h1>
              <Badge variant={isActive ? "default" : "secondary"}>
                {event.status}
              </Badge>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="size-4" />
                {formatDate(event.event_date)}
              </span>
              <span className="inline-flex items-center gap-1">
                <Users className="size-4" />
                {event.pax} invitados
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="size-4" />
                {event.duration_hours} h
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditOpen(true)}
              disabled={!isActive}
              title={
                isActive ? undefined : "El evento está finalizado: reabrilo para editarlo."
              }
            >
              <Pencil className="size-4" />
              Editar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmStatus(true)}
            >
              {isActive ? (
                <>
                  <CheckCircle2 className="size-4" />
                  Finalizar
                </>
              ) : (
                <>
                  <RotateCcw className="size-4" />
                  Reabrir
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setConfirmDel(true)}
              aria-label="Eliminar"
            >
              <Trash2 className="size-4 text-destructive" />
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {!isActive && (
            <FrozenCostNotice
              snapshot={snapshot}
              onReopen={() => setConfirmStatus(true)}
              onRecalculate={() => setConfirmRecalc(true)}
            />
          )}

          {view && <EventSummary event={event} view={view} />}
          <EventParams event={event} />
          <MenuSelection event={event} selections={selections ?? []} />

          <div>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">
              Materia prima
            </h2>
            <MateriaPrimaSection
              event={event}
              selections={selections ?? []}
              mp={view?.materiaPrima ?? null}
            />
          </div>

          <div>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">Barra</h2>
            <BarraSection event={event} barra={view?.barra ?? null} />
          </div>

          <div>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">Personal</h2>
            <EventStaffSection
              eventId={event.id}
              personal={view?.personal ?? null}
            />
          </div>

          <div>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">
              Vajilla
            </h2>
            <div className="flex flex-col gap-4">
              <EventVajillaParams event={event} tableware={tableware ?? []} />
              <EventVajillaSection
                event={event}
                vajilla={view?.vajilla ?? null}
              />
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">
              Otros costos
            </h2>
            <div className="flex flex-col gap-4">
              <CostSection
                eventId={event.id}
                section="instalacion"
                costs={view?.costs ?? []}
              />
              <CostSection
                eventId={event.id}
                section="extra"
                costs={view?.costs ?? []}
              />
              <CostSection
                eventId={event.id}
                section="adicional"
                costs={view?.costs ?? []}
              />
            </div>
          </div>
        </div>

        <EventDialog open={editOpen} onOpenChange={setEditOpen} event={event} />
        <LeftoverCloseDialog
          open={leftoverOpen}
          onOpenChange={setLeftoverOpen}
          event={event}
          selections={selections ?? []}
          mp={view?.materiaPrima ?? null}
        />

        <ConfirmDialog
          open={confirmStatus}
          onOpenChange={setConfirmStatus}
          title={isActive ? "Finalizar evento" : "Reabrir evento"}
          description={
            isActive
              ? `“${event.name}” se cierra y su costo queda congelado.`
              : `“${event.name}” vuelve a la lista de eventos activos.`
          }
          details={
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {isActive ? (
                <>
                  <li>
                    Se guarda una foto del desglose completo. A partir de ahí
                    editar precios, recetas o ingredientes{" "}
                    <strong>no le cambia los números</strong> a este evento.
                  </li>
                  {delta && (
                    <li>
                      Ya existe una foto de un cierre anterior y se va a
                      reemplazar: el costo interno pasa de{" "}
                      <strong>{formatARS(delta.before.internalTotal)}</strong> a{" "}
                      <strong>{formatARS(delta.after.internalTotal)}</strong>.
                    </li>
                  )}
                  <li>
                    Se abre el registro de sobrantes con las cantidades ya
                    calculadas. Es el único momento en que el sistema lo ofrece:
                    si lo cerrás sin guardar, después hay que cargarlos a mano
                    desde Sobrantes.
                  </li>
                  <li>
                    El menú, el personal, la vajilla y los costos quedan de solo
                    lectura. Los pagos y los sobrantes se siguen editando.
                  </li>
                </>
              ) : (
                <>
                  <li>
                    La foto del costo <strong>se conserva</strong>: reabrir no
                    borra el registro contable.
                  </li>
                  <li>
                    Mientras esté abierto, los números vuelven a calcularse con
                    los precios actuales.
                  </li>
                  <li>
                    Al volver a finalizarlo se saca una foto nueva y queda
                    registrado que el evento se tocó después de cerrado.
                  </li>
                </>
              )}
            </ul>
          }
          confirmLabel={isActive ? "Finalizar" : "Reabrir"}
          loadingLabel={isActive ? "Finalizando…" : "Reabriendo…"}
          variant="default"
          onConfirm={isActive ? finalize : reopen}
          loading={saveSnapshot.isPending || update.isPending}
        />

        <ConfirmDialog
          open={confirmRecalc}
          onOpenChange={setConfirmRecalc}
          title="Recalcular con precios actuales"
          description={`Se reemplaza la foto de “${event.name}” por una nueva con los precios de hoy.`}
          details={
            <div className="flex flex-col gap-2 text-sm">
              {delta && (
                <div className="rounded-lg bg-muted/50 p-3">
                  <DeltaRow
                    label="Costo interno"
                    before={delta.before.internalTotal}
                    after={delta.after.internalTotal}
                    pct={delta.pct}
                  />
                  <DeltaRow
                    label="Precio por persona"
                    before={delta.before.pricePerPerson}
                    after={delta.after.pricePerPerson}
                  />
                </div>
              )}
              <p className="text-muted-foreground">
                Queda registrado que este evento se recalculó y cuándo. La foto
                anterior se pierde: esto no se puede deshacer.
              </p>
            </div>
          }
          confirmLabel="Recalcular"
          loadingLabel="Recalculando…"
          variant="default"
          onConfirm={recalculate}
          loading={saveSnapshot.isPending}
        />

        <ConfirmDialog
          open={confirmDel}
          onOpenChange={setConfirmDel}
          title="Eliminar evento"
          description={`Se eliminará “${event.name}”, su menú y la foto de su costo. Esta acción no se puede deshacer.`}
          onConfirm={confirmDelete}
          loading={del.isPending}
        />
      </div>
    </EventLockProvider>
  );
}

/** Una línea "antes → después" del diálogo de recálculo. */
function DeltaRow({
  label,
  before,
  after,
  pct,
}: {
  label: string;
  before: number;
  after: number;
  pct?: number | null;
}) {
  const up = after > before;
  const changed = Math.abs(after - before) > 0.005;
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">
        <span className="text-muted-foreground">{formatARS(before)}</span>
        <span className="mx-1.5 text-muted-foreground">→</span>
        <strong>{formatARS(after)}</strong>
        {changed && pct != null && (
          <span
            className={
              up
                ? "ml-1.5 text-xs text-amber-700 dark:text-amber-400"
                : "ml-1.5 text-xs text-emerald-700 dark:text-emerald-400"
            }
          >
            ({up ? "+" : ""}
            {pct.toFixed(1).replace(".", ",")}%)
          </span>
        )}
      </span>
    </div>
  );
}
