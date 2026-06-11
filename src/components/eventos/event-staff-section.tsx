"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Users } from "lucide-react";
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
import { EventStaffDialog } from "@/components/eventos/event-staff-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useStaff, useEventStaff, useRemoveEventStaff } from "@/lib/hooks";
import { computeEventStaff, effectiveRate, staffLineTotal } from "@/lib/personal";
import { formatARS, formatNum } from "@/lib/format";
import type { EventStaffWithStaff } from "@/lib/types";

export function EventStaffSection({ eventId }: { eventId: string }) {
  const { data: allStaff } = useStaff();
  const { data: assignments } = useEventStaff(eventId);
  const remove = useRemoveEventStaff();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EventStaffWithStaff | null>(null);
  const [toDelete, setToDelete] = useState<EventStaffWithStaff | null>(null);

  const result = useMemo(
    () => computeEventStaff(assignments ?? []),
    [assignments],
  );

  // Empleados activos que todavía no están asignados a este evento.
  const available = useMemo(() => {
    const taken = new Set((assignments ?? []).map((a) => a.staff_id));
    return (allStaff ?? []).filter((s) => s.active && !taken.has(s.id));
  }, [allStaff, assignments]);

  function openNew() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(es: EventStaffWithStaff) {
    setEditing(es);
    setDialogOpen(true);
  }

  async function confirmDelete() {
    if (!toDelete) return;
    try {
      await remove.mutateAsync({ id: toDelete.id, eventId });
      toast.success("Empleado quitado del evento.");
      setToDelete(null);
    } catch (e) {
      toast.error("No se pudo quitar", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between gap-3 border-b bg-muted/40 px-4 py-2">
        <span className="flex items-center gap-2 font-medium">
          <Users className="size-4 text-primary" />
          Personal
        </span>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">{formatARS(result.total)}</span>
          <Button variant="outline" size="sm" onClick={openNew}>
            <Plus className="size-4" />
            Agregar
          </Button>
        </div>
      </div>

      {result.groups.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">
          Elegí los empleados que participan en este evento y cargá sus horas.
          {(allStaff?.length ?? 0) === 0 &&
            " Primero creá empleados en la sección Personal."}
        </p>
      ) : (
        result.groups.map((g) => (
          <div key={g.category}>
            <div className="flex items-center justify-between border-b bg-background px-4 py-1.5 text-xs font-medium text-muted-foreground">
              <span>{g.categoryLabel}</span>
              <span className="tabular-nums">{formatARS(g.subtotal)}</span>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empleado</TableHead>
                  <TableHead className="text-right">Horas</TableHead>
                  <TableHead className="text-right">$ / h</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Pago</TableHead>
                  <TableHead className="w-px" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {g.lines.map((es) => (
                  <TableRow key={es.id}>
                    <TableCell className="font-medium">
                      {es.staff?.full_name ?? "—"}
                      {es.staff?.role && (
                        <span className="text-xs text-muted-foreground">
                          {" "}
                          · {es.staff.role}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNum(es.hours)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatARS(effectiveRate(es))}
                      {es.rate_override != null && (
                        <span className="ml-1 text-xs text-amber-600">★</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatARS(staffLineTotal(es))}
                    </TableCell>
                    <TableCell>
                      <Badge variant={es.paid ? "default" : "secondary"}>
                        {es.paid ? "Pagado" : "Pendiente"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => openEdit(es)}
                          aria-label="Editar"
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setToDelete(es)}
                          aria-label="Quitar"
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ))
      )}

      <p className="border-t px-4 py-2 text-xs text-muted-foreground">
        La tarifa con ★ es puntual de este evento. El seguimiento de pagos también
        está en Personal → Pagos.
      </p>

      <EventStaffDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        eventId={eventId}
        editing={editing}
        available={available}
      />
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Quitar del evento"
        description={`Se quitará "${toDelete?.staff?.full_name ?? ""}" de este evento.`}
        onConfirm={confirmDelete}
        loading={remove.isPending}
      />
    </Card>
  );
}
