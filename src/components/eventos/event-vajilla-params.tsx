"use client";

import { useState } from "react";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import {
  useUpdateEvent,
  useUpdateEventTableware,
  useRecalcNonManualTableware,
} from "@/lib/hooks";
import { calcSuggestedQty } from "@/lib/queries";
import { formatNum } from "@/lib/format";
import type { EventRow, EventTablewareWithItem } from "@/lib/types";

// Campo numérico inline que guarda en onBlur o Enter
function InlineNum({
  value,
  onCommit,
  placeholder,
  min,
}: {
  value: number;
  onCommit: (raw: string) => void;
  placeholder?: string;
  min?: number;
}) {
  const [edit, setEdit] = useState<string | null>(null);
  return (
    <Input
      className="ml-auto h-7 w-16 text-center text-sm"
      inputMode="decimal"
      value={edit ?? String(value)}
      placeholder={placeholder}
      min={min}
      onChange={(e) => setEdit(e.target.value)}
      onBlur={(e) => {
        onCommit(e.target.value);
        setEdit(null);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") setEdit(null);
      }}
    />
  );
}

export function EventVajillaParams({
  event,
  tableware,
}: {
  event: EventRow;
  tableware: EventTablewareWithItem[];
}) {
  const updateEvent = useUpdateEvent();
  const updateRow = useUpdateEventTableware();
  const recalc = useRecalcNonManualTableware();

  // Margen global —— guarda y recalcula no-manuales al confirmar
  async function commitGlobalMargin(raw: string) {
    const val = Number(raw.replace(",", "."));
    if (!Number.isFinite(val) || val < 0) return;
    if (val === event.vajilla_margin) return;
    try {
      await updateEvent.mutateAsync({
        id: event.id,
        input: { vajilla_margin: val },
      });
      // Con el nuevo margen, recalcular las filas automáticas
      await recalc.mutateAsync({
        eventId: event.id,
        pax: event.pax,
        globalMargin: val,
      });
    } catch (e) {
      toast.error("No se pudo actualizar el margen", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  // Multiplicador por ítem —— si no es manual también actualiza la cantidad
  async function commitMultiplier(row: EventTablewareWithItem, raw: string) {
    const val = Number(raw.replace(",", "."));
    if (!Number.isFinite(val) || val <= 0) return;
    if (val === row.multiplier) return;
    const margin = row.margin_override ?? event.vajilla_margin;
    try {
      await updateRow.mutateAsync({
        id: row.id,
        eventId: event.id,
        input: {
          multiplier: val,
          ...(row.quantity_manual ? {} : {
            quantity: calcSuggestedQty(event.pax, val, margin),
          }),
        },
      });
    } catch (e) {
      toast.error("No se pudo actualizar", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  // Margen por ítem —— vacío = usar margen global
  async function commitMarginOverride(row: EventTablewareWithItem, raw: string) {
    const isEmpty = raw.trim() === "";
    const val = isEmpty ? null : Number(raw.replace(",", "."));
    if (!isEmpty && (!Number.isFinite(val) || (val as number) < 0)) return;
    if (val === row.margin_override) return;
    const margin = val ?? event.vajilla_margin;
    try {
      await updateRow.mutateAsync({
        id: row.id,
        eventId: event.id,
        input: {
          margin_override: val,
          ...(row.quantity_manual ? {} : {
            quantity: calcSuggestedQty(event.pax, row.multiplier, margin),
          }),
        },
      });
    } catch (e) {
      toast.error("No se pudo actualizar", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  // Recalcular manual: aplica la fórmula a las filas no-manuales
  async function handleRecalc() {
    try {
      const n = await recalc.mutateAsync({
        eventId: event.id,
        pax: event.pax,
        globalMargin: event.vajilla_margin,
      });
      toast.success(
        n > 0
          ? `${n} ítem${n !== 1 ? "s" : ""} recalculado${n !== 1 ? "s" : ""}.`
          : "Todas las cantidades ya están al día.",
      );
    } catch (e) {
      toast.error("No se pudo recalcular", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  // Filas cuya cantidad automática difiere del valor sugerido
  const staleCount = tableware.filter((e) => {
    if (e.quantity_manual) return false;
    const margin = e.margin_override ?? event.vajilla_margin;
    return Math.round(e.quantity) !== calcSuggestedQty(event.pax, e.multiplier, margin);
  }).length;

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/40 px-4 py-2">
        <div className="flex flex-wrap items-center gap-4">
          <span className="font-medium">Parámetros de vajilla</span>
          <div className="flex items-center gap-1.5 text-sm">
            <Label className="shrink-0 text-xs text-muted-foreground">
              Margen global (un. extra):
            </Label>
            <Input
              className="h-7 w-16 text-center text-sm"
              inputMode="decimal"
              defaultValue={String(event.vajilla_margin)}
              onBlur={(e) => commitGlobalMargin(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
            />
          </div>
          <span className="text-xs text-muted-foreground">
            Fórmula: personas ({event.pax}) × mult. + margen = cantidad sugerida
          </span>
        </div>

        <div className="flex items-center gap-2">
          {staleCount > 0 && (
            <span className="text-xs text-amber-600">
              {staleCount} ítem{staleCount !== 1 ? "s" : ""} desactualizado{staleCount !== 1 ? "s" : ""}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRecalc}
            disabled={recalc.isPending}
          >
            <RotateCcw className="size-4" />
            Recalcular automáticos
          </Button>
        </div>
      </div>

      {tableware.length === 0 ? (
        <p className="px-4 py-4 text-sm text-muted-foreground">
          Agregá ítems en la sección Vajilla (abajo) para configurar sus parámetros.
        </p>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ítem</TableHead>
                <TableHead className="w-28 text-right">
                  <span title="Unidades por persona">× / persona</span>
                </TableHead>
                <TableHead className="w-28 text-right">
                  <span title="Unidades extra de reserva (vacío = global)">Margen</span>
                </TableHead>
                <TableHead className="w-28 text-right">Sugerida</TableHead>
                <TableHead className="w-28 text-right">Actual</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableware.map((e) => {
                const margin = e.margin_override ?? event.vajilla_margin;
                const suggested = calcSuggestedQty(event.pax, e.multiplier, margin);
                const isStale =
                  !e.quantity_manual && Math.round(e.quantity) !== suggested;
                return (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.item?.name ?? "—"}</TableCell>

                    <TableCell className="text-right">
                      <InlineNum
                        value={e.multiplier}
                        onCommit={(v) => commitMultiplier(e, v)}
                        min={0.01}
                      />
                    </TableCell>

                    <TableCell className="text-right">
                      <InlineNum
                        value={e.margin_override ?? event.vajilla_margin}
                        onCommit={(v) => commitMarginOverride(e, v)}
                        placeholder={String(event.vajilla_margin)}
                        min={0}
                      />
                    </TableCell>

                    <TableCell
                      className={`text-right tabular-nums ${
                        isStale
                          ? "font-semibold text-amber-600"
                          : "text-muted-foreground"
                      }`}
                    >
                      {formatNum(suggested)}
                    </TableCell>

                    <TableCell className="text-right tabular-nums">
                      <span>{formatNum(e.quantity)}</span>
                      {e.quantity_manual && (
                        <span
                          className="ml-1 text-xs text-muted-foreground"
                          title="Cantidad editada manualmente — no se recalcula sola"
                        >
                          ✍
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <p className="px-4 py-2 text-xs text-muted-foreground">
            Editá mult. y margen en la tabla. ✍ = cantidad editada a mano (no se recalcula automáticamente).
          </p>
        </>
      )}
    </Card>
  );
}
