"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CostLineDialog } from "@/components/eventos/cost-line-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useDeleteEventCost } from "@/lib/hooks";
import { formatARS, formatNum } from "@/lib/format";
import { COST_SECTIONS, type EventCost, type EventCostSection } from "@/lib/types";

export function CostSection({
  eventId,
  section,
  costs,
}: {
  eventId: string;
  section: EventCostSection;
  costs: EventCost[];
}) {
  const cfg = COST_SECTIONS[section];
  const del = useDeleteEventCost();
  const lines = costs.filter((c) => c.section === section);
  const subtotal = lines.reduce((s, c) => s + c.quantity * c.unit_price, 0);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EventCost | null>(null);
  const [toDelete, setToDelete] = useState<EventCost | null>(null);

  async function confirmDelete() {
    if (!toDelete) return;
    try {
      await del.mutateAsync({ id: toDelete.id, eventId });
      toast.success("Línea eliminada.");
      setToDelete(null);
    } catch (e) {
      toast.error("No se pudo eliminar", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between gap-3 border-b bg-muted/40 px-4 py-2">
        <div>
          <span className="font-medium">{cfg.title}</span>
          {!cfg.countsTowardPrice && (
            <span className="ml-2 text-xs text-muted-foreground">
              (no entra en el precio por persona)
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">{formatARS(subtotal)}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="size-4" />
            Agregar
          </Button>
        </div>
      </div>

      {lines.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">
          {cfg.description}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Concepto</TableHead>
              <TableHead className="text-right">{cfg.qtyLabel}</TableHead>
              <TableHead className="text-right">{cfg.priceLabel}</TableHead>
              <TableHead className="text-right">Subtotal</TableHead>
              <TableHead className="w-px" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <span className="font-medium">{c.name}</span>
                  {c.detail && (
                    <span className="text-xs text-muted-foreground"> · {c.detail}</span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatNum(c.quantity)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {formatARS(c.unit_price)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatARS(c.quantity * c.unit_price)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        setEditing(c);
                        setDialogOpen(true);
                      }}
                      aria-label="Editar"
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setToDelete(c)}
                      aria-label="Eliminar"
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <CostLineDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        eventId={eventId}
        section={section}
        cost={editing}
      />
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Eliminar línea"
        description={`Se eliminará "${toDelete?.name}".`}
        onConfirm={confirmDelete}
        loading={del.isPending}
      />
    </Card>
  );
}
