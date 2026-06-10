"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, CalendarClock, CheckCircle2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EventDialog } from "@/components/eventos/event-dialog";
import { useEvents } from "@/lib/hooks";
import { formatDate } from "@/lib/format";
import type { EventRow } from "@/lib/types";

export default function EventosPage() {
  const { data: events, isLoading } = useEvents();
  const [dialogOpen, setDialogOpen] = useState(false);

  const activos = (events ?? []).filter((e) => e.status === "activo");
  const finalizados = (events ?? []).filter((e) => e.status === "finalizado");

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Eventos</h1>
          <p className="text-muted-foreground">
            Próximos primero. Creá un evento para empezar a costear.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="size-4" />
          Nuevo evento
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : (
        <div className="flex flex-col gap-8">
          <Section
            title="Activos"
            icon={<CalendarClock className="size-4 text-primary" />}
            events={activos}
            empty="No hay eventos activos."
          />
          {finalizados.length > 0 && (
            <Section
              title="Finalizados"
              icon={<CheckCircle2 className="size-4 text-muted-foreground" />}
              events={finalizados}
              empty="Sin eventos finalizados."
            />
          )}
        </div>
      )}

      <EventDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}

function Section({
  title,
  icon,
  events,
  empty,
}: {
  title: string;
  icon: React.ReactNode;
  events: EventRow[];
  empty: string;
}) {
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        {icon}
        {title} ({events.length})
      </h2>
      {events.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          {empty}
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {events.map((e) => (
            <Link key={e.id} href={`/eventos/${e.id}`}>
              <Card className="transition-colors hover:border-primary/50">
                <CardContent className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{e.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {formatDate(e.event_date)}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                      <Users className="size-4" />
                      {e.pax}
                    </span>
                    <Badge
                      variant={e.status === "activo" ? "default" : "secondary"}
                    >
                      {e.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
