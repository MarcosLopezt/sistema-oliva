"use client";

import { useMemo } from "react";
import { toast } from "sonner";
import { Wine } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useBarSettings,
  useBarBeverages,
  useUpdateEvent,
  useBeverageMarketPriceUpdater,
} from "@/lib/hooks";
import { computeBarra } from "@/lib/barra";
import { beverageMarketLabel } from "@/lib/market-price";
import { formatARS, formatNum } from "@/lib/format";
import {
  BARRA_SERVICES,
  BARRA_DIAS,
  BARRA_HORARIOS,
  type EventRow,
  type BarraService,
  type BarraDia,
  type BarraHorario,
} from "@/lib/types";

export function BarraSection({ event }: { event: EventRow }) {
  const { data: settings } = useBarSettings();
  const { data: beverages } = useBarBeverages();
  const update = useUpdateEvent();

  const result = useMemo(
    () => computeBarra(event, settings, beverages ?? []),
    [event, settings, beverages],
  );

  // Actualiza en background el precio de las bebidas con búsqueda automática.
  const failed = useBeverageMarketPriceUpdater(beverages ?? []);
  const beveragesById = useMemo(() => {
    const map = new Map((beverages ?? []).map((b) => [b.id, b]));
    return map;
  }, [beverages]);

  async function patch(input: Partial<EventRow>) {
    try {
      await update.mutateAsync({ id: event.id, input });
    } catch (e) {
      toast.error("No se pudo actualizar la barra", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  const showList = event.barra_service !== "ninguna";

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label>Servicio</Label>
            <NativeSelect
              value={event.barra_service}
              onChange={(e) =>
                patch({ barra_service: e.target.value as BarraService })
              }
            >
              {BARRA_SERVICES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Día</Label>
            <NativeSelect
              value={event.barra_dia}
              disabled={!showList}
              onChange={(e) =>
                patch({ barra_dia: e.target.value as BarraDia })
              }
            >
              {BARRA_DIAS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Horario</Label>
            <NativeSelect
              value={event.barra_horario}
              disabled={!showList}
              onChange={(e) =>
                patch({ barra_horario: e.target.value as BarraHorario })
              }
            >
              {BARRA_HORARIOS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </NativeSelect>
          </div>
        </CardContent>
      </Card>

      {!showList ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Este evento no tiene servicio de barra.
          </CardContent>
        </Card>
      ) : result.lines.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No hay bebidas para este servicio (o el consumo da 0). Cargá bebidas y
            sus consumos en Configuración.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-muted-foreground">
                Costo barra
                <div className="text-2xl font-semibold text-foreground">
                  {formatARS(result.total)}
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                Por persona
                <div className="text-2xl font-semibold text-primary">
                  {formatARS(result.perPerson)}
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                Factores aplicados: día ×{formatNum(result.factorDia)} · horario ×
                {formatNum(result.factorHorario)}
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden p-0">
            <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2 font-medium">
              <Wine className="size-4 text-primary" />
              Botellas a comprar
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bebida</TableHead>
                  <TableHead className="text-right">Comprar</TableHead>
                  <TableHead className="text-right">Precio</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.lines.map((l) => {
                  const bev = beveragesById.get(l.id);
                  const label = bev
                    ? beverageMarketLabel(bev, failed.has(l.id))
                    : null;
                  return (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">
                      {l.name}
                      {label && (
                        <span
                          className={
                            "mt-0.5 block text-xs font-normal " +
                            (label.tone === "stale"
                              ? "text-amber-600"
                              : label.tone === "manual"
                                ? "text-muted-foreground"
                                : "text-emerald-600")
                          }
                        >
                          {label.text}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {l.bottles} × {formatNum(l.sizeMl)} ml
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {l.price > 0 ? formatARS(l.price) : "— sin precio —"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatARS(l.subtotal)}
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}
