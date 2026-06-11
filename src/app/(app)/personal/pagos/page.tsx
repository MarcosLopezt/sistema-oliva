"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useStaffPayments, useUpdateEventStaff } from "@/lib/hooks";
import { formatARS, formatNum, formatDate } from "@/lib/format";
import { effectiveRate, staffLineTotal } from "@/lib/personal";
import { staffCategoryLabel, type EventStaffWithEvent } from "@/lib/types";

type StaffGroup = {
  staffId: string;
  name: string;
  category: string;
  active: boolean;
  rows: EventStaffWithEvent[];
  pending: number;
  paid: number;
};

export default function PagosPage() {
  const { data, isLoading, error } = useStaffPayments();

  const groups = useMemo<StaffGroup[]>(() => {
    const byStaff = new Map<string, StaffGroup>();
    for (const es of data ?? []) {
      if (!es.staff) continue;
      const key = es.staff.id;
      let g = byStaff.get(key);
      if (!g) {
        g = {
          staffId: key,
          name: es.staff.full_name,
          category: es.staff.category,
          active: es.staff.active,
          rows: [],
          pending: 0,
          paid: 0,
        };
        byStaff.set(key, g);
      }
      g.rows.push(es);
      const total = staffLineTotal(es);
      if (es.paid) g.paid += total;
      else g.pending += total;
    }
    for (const g of byStaff.values()) {
      g.rows.sort((a, b) =>
        (b.event?.event_date ?? "").localeCompare(a.event?.event_date ?? ""),
      );
    }
    return [...byStaff.values()].sort((a, b) => b.pending - a.pending);
  }, [data]);

  const totalPending = groups.reduce((s, g) => s + g.pending, 0);

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/personal"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Personal
      </Link>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-primary">Pagos</h1>
          <p className="text-muted-foreground">
            Lo que se le debe a cada empleado por evento.
          </p>
        </div>
        {groups.length > 0 && (
          <div className="text-right">
            <div className="text-sm text-muted-foreground">Total pendiente</div>
            <div className="text-2xl font-semibold text-primary">
              {formatARS(totalPending)}
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-destructive">Error al cargar: {error.message}</p>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : groups.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Todavía no hay personal asignado a eventos.
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((g) => (
            <StaffPaymentCard key={g.staffId} group={g} />
          ))}
        </div>
      )}
    </div>
  );
}

function StaffPaymentCard({ group }: { group: StaffGroup }) {
  const update = useUpdateEventStaff();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function togglePaid(es: EventStaffWithEvent) {
    if (!es.event) return;
    setBusyId(es.id);
    try {
      await update.mutateAsync({
        id: es.id,
        eventId: es.event.id,
        input: { paid: !es.paid },
      });
    } catch (e) {
      toast.error("No se pudo actualizar", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/40 px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="font-medium">{group.name}</span>
          <Badge variant="outline">{staffCategoryLabel(group.category)}</Badge>
          {!group.active && <Badge variant="secondary">Inactivo</Badge>}
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-muted-foreground">
            Pagado:{" "}
            <span className="font-medium text-foreground tabular-nums">
              {formatARS(group.paid)}
            </span>
          </span>
          <span className="text-muted-foreground">
            Pendiente:{" "}
            <span className="font-medium text-primary tabular-nums">
              {formatARS(group.pending)}
            </span>
          </span>
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Evento</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead className="text-right">Horas</TableHead>
            <TableHead className="text-right">$ / h</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {group.rows.map((es) => (
            <TableRow key={es.id}>
              <TableCell className="font-medium">
                {es.event ? (
                  <Link
                    href={`/eventos/${es.event.id}`}
                    className="hover:underline"
                  >
                    {es.event.name}
                  </Link>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDate(es.event?.event_date)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatNum(es.hours)}
              </TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                {formatARS(effectiveRate(es))}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatARS(staffLineTotal(es))}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant={es.paid ? "ghost" : "outline"}
                  size="sm"
                  disabled={busyId === es.id}
                  onClick={() => togglePaid(es)}
                >
                  {es.paid ? (
                    <>
                      <CheckCircle2 className="size-4 text-primary" />
                      Pagado
                    </>
                  ) : (
                    <>
                      <Circle className="size-4" />
                      Pendiente
                    </>
                  )}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
