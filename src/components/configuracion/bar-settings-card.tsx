"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useUpdateBarSettings } from "@/lib/hooks";
import type { BarSettings } from "@/lib/types";

export function BarSettingsCard({ settings }: { settings: BarSettings }) {
  const update = useUpdateBarSettings();
  const [v, setV] = useState({
    dia_semana: String(settings.dia_semana),
    dia_jueves: String(settings.dia_jueves),
    dia_finde: String(settings.dia_finde),
    hor_mediodia: String(settings.hor_mediodia),
    hor_cena: String(settings.hor_cena),
    hor_nocturno: String(settings.hor_nocturno),
  });

  const n = (s: string) => Number(s.replace(",", ".")) || 0;
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setV((prev) => ({ ...prev, [k]: e.target.value }));

  async function save() {
    try {
      await update.mutateAsync({
        dia_semana: n(v.dia_semana),
        dia_jueves: n(v.dia_jueves),
        dia_finde: n(v.dia_finde),
        hor_mediodia: n(v.hor_mediodia),
        hor_cena: n(v.hor_cena),
        hor_nocturno: n(v.hor_nocturno),
      });
      toast.success("Factores guardados.");
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
          <h2 className="font-medium">Factores de consumo de la barra</h2>
          <p className="text-sm text-muted-foreground">
            Multiplican el consumo según el día y el horario del evento.
          </p>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">Día</p>
          <div className="grid grid-cols-3 gap-3">
            <F label="Semana" value={v.dia_semana} onChange={set("dia_semana")} />
            <F label="Jueves" value={v.dia_jueves} onChange={set("dia_jueves")} />
            <F label="Vie / Sáb" value={v.dia_finde} onChange={set("dia_finde")} />
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">Horario</p>
          <div className="grid grid-cols-3 gap-3">
            <F label="Mediodía" value={v.hor_mediodia} onChange={set("hor_mediodia")} />
            <F label="Cena" value={v.hor_cena} onChange={set("hor_cena")} />
            <F label="Nocturno" value={v.hor_nocturno} onChange={set("hor_nocturno")} />
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={save} disabled={update.isPending}>
            {update.isPending ? "Guardando…" : "Guardar factores"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function F({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs">{label}</Label>
      <Input inputMode="decimal" value={value} onChange={onChange} />
    </div>
  );
}
