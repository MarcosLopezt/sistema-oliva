"use client";

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  useEventRecipes,
  useEventCosts,
  useBarSettings,
  useBarBeverages,
} from "@/lib/hooks";
import { computeMateriaPrima } from "@/lib/materia-prima";
import { computeBarra } from "@/lib/barra";
import { computeEventSummary } from "@/lib/resumen";
import { formatARS } from "@/lib/format";
import type { EventRow } from "@/lib/types";

function pct(n: number): string {
  return `${n.toFixed(1).replace(".", ",")}%`;
}

export function EventSummary({ event }: { event: EventRow }) {
  const { data: selections } = useEventRecipes(event.id);
  const { data: costs } = useEventCosts(event.id);
  const { data: settings } = useBarSettings();
  const { data: beverages } = useBarBeverages();

  const summary = useMemo(() => {
    const mp = computeMateriaPrima(event, selections ?? []);
    const barra = computeBarra(event, settings, beverages ?? []);
    return computeEventSummary(event, mp, barra, costs ?? []);
  }, [event, selections, settings, beverages, costs]);

  return (
    <Card className="border-primary/30">
      <CardContent className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Metric
            label="Costo total interno"
            value={formatARS(summary.internalTotal)}
          />
          <Metric
            label="Costo por persona"
            value={formatARS(summary.costPerPerson)}
          />
          <Metric
            label={`Precio sugerido x persona (margen ${pct(summary.marginPct * 100)})`}
            value={formatARS(summary.pricePerPerson)}
            highlight
          />
        </div>

        <div className="flex flex-col gap-2">
          {summary.sections.map((s) => (
            <div key={s.key} className="flex items-center gap-3 text-sm">
              <span className="w-28 shrink-0 text-muted-foreground">
                {s.label}
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.min(100, s.pct)}%` }}
                />
              </div>
              <span className="w-12 shrink-0 text-right tabular-nums text-muted-foreground">
                {pct(s.pct)}
              </span>
              <span className="w-28 shrink-0 text-right tabular-nums font-medium">
                {formatARS(s.total)}
              </span>
            </div>
          ))}
        </div>

        {summary.additionalTotal > 0 && (
          <div className="border-t pt-3 text-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Costos adicionales (se cobran aparte)</span>
              <span className="tabular-nums">
                {formatARS(summary.additionalTotal)}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between font-medium">
              <span>Total estimado a cobrar ({event.pax} PAX + adicionales)</span>
              <span className="tabular-nums">
                {formatARS(summary.totalToClient)}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={
        highlight
          ? "rounded-lg bg-primary/10 p-3"
          : "rounded-lg bg-muted/40 p-3"
      }
    >
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={
          highlight
            ? "text-2xl font-semibold text-primary"
            : "text-2xl font-semibold"
        }
      >
        {value}
      </div>
    </div>
  );
}
