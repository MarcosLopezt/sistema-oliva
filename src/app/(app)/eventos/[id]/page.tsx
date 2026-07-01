"use client";

import { useState } from "react";
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
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  useEvent,
  useEventRecipes,
  useEventCosts,
  useEventTableware,
  useUpdateEvent,
  useDeleteEvent,
} from "@/lib/hooks";
import { formatDate } from "@/lib/format";

export default function EventoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: event, isLoading } = useEvent(id);
  const { data: selections } = useEventRecipes(id);
  const { data: costs } = useEventCosts(id);
  const { data: tableware } = useEventTableware(id);
  const update = useUpdateEvent();
  const del = useDeleteEvent();

  const [editOpen, setEditOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  if (isLoading)
    return <p className="text-sm text-muted-foreground">Cargando evento…</p>;
  if (!event)
    return <p className="text-sm text-muted-foreground">Evento no encontrado.</p>;

  const isActive = event.status === "activo";

  async function toggleStatus() {
    if (!event) return;
    try {
      await update.mutateAsync({
        id: event.id,
        input: { status: isActive ? "finalizado" : "activo" },
      });
      toast.success(isActive ? "Evento finalizado." : "Evento reactivado.");
    } catch (e) {
      toast.error("No se pudo cambiar el estado", {
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
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="size-4" />
            Editar
          </Button>
          <Button variant="outline" size="sm" onClick={toggleStatus}>
            {isActive ? (
              <>
                <CheckCircle2 className="size-4" />
                Finalizar
              </>
            ) : (
              <>
                <RotateCcw className="size-4" />
                Reactivar
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
        <EventSummary event={event} />
        <EventParams event={event} />
        <MenuSelection event={event} selections={selections ?? []} />

        <div>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">
            Materia prima
          </h2>
          <MateriaPrimaSection event={event} selections={selections ?? []} />
        </div>

        <div>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">Barra</h2>
          <BarraSection event={event} />
        </div>

        <div>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">Personal</h2>
          <EventStaffSection eventId={event.id} />
        </div>

        <div>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">
            Vajilla
          </h2>
          <div className="flex flex-col gap-4">
            <EventVajillaParams event={event} tableware={tableware ?? []} />
            <EventVajillaSection event={event} />
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">
            Otros costos
          </h2>
          <div className="flex flex-col gap-4">
            <CostSection eventId={event.id} section="instalacion" costs={costs ?? []} />
            <CostSection eventId={event.id} section="extra" costs={costs ?? []} />
            <CostSection eventId={event.id} section="adicional" costs={costs ?? []} />
          </div>
        </div>
      </div>

      <EventDialog open={editOpen} onOpenChange={setEditOpen} event={event} />
      <ConfirmDialog
        open={confirmDel}
        onOpenChange={setConfirmDel}
        title="Eliminar evento"
        description={`Se eliminará "${event.name}" y su menú. Esta acción no se puede deshacer.`}
        onConfirm={confirmDelete}
        loading={del.isPending}
      />
    </div>
  );
}
