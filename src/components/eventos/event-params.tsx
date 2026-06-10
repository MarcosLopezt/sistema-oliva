"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useUpdateEvent } from "@/lib/hooks";
import type { EventRow } from "@/lib/types";

export function EventParams({ event }: { event: EventRow }) {
  const update = useUpdateEvent();
  const [bocados, setBocados] = useState(String(event.bocados_per_person));
  const [extra, setExtra] = useState(String(event.principal_extra));
  const [veggie, setVeggie] = useState(String(Math.round(event.veggie_pct * 100)));
  const [merma, setMerma] = useState(String(Math.round(event.merma_pct * 100)));
  const [margin, setMargin] = useState(String(Math.round(event.margin_pct * 100)));

  const n = (s: string) => Number(s.replace(",", ".")) || 0;

  async function save() {
    try {
      await update.mutateAsync({
        id: event.id,
        input: {
          bocados_per_person: n(bocados),
          principal_extra: Math.trunc(n(extra)),
          veggie_pct: n(veggie) / 100,
          merma_pct: n(merma) / 100,
          margin_pct: n(margin) / 100,
        },
      });
      toast.success("Parámetros guardados.");
    } catch (e) {
      toast.error("No se pudo guardar", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div>
          <h2 className="font-medium">Parámetros del cálculo</h2>
          <p className="text-sm text-muted-foreground">
            Valores por defecto de Oliva, editables para este evento.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Field label="Bocados x persona" value={bocados} onChange={setBocados} />
          <Field label="Extra principal" value={extra} onChange={setExtra} />
          <Field label="% Veggie" value={veggie} onChange={setVeggie} suffix="%" />
          <Field label="% Merma" value={merma} onChange={setMerma} suffix="%" />
          <Field label="% Margen" value={margin} onChange={setMargin} suffix="%" />
        </div>
        <div className="flex justify-end">
          <Button onClick={save} disabled={update.isPending}>
            {update.isPending ? "Guardando…" : "Guardar parámetros"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  value,
  onChange,
  suffix,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  suffix?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="relative">
        <Input
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={suffix ? "pr-6" : ""}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}
