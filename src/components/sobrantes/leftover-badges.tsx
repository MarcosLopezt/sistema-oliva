"use client";

import { CalendarClock, CircleHelp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { expiryInfo, type ExpiryState } from "@/lib/sobrantes";
import type { LeftoverStatus } from "@/lib/types";

/**
 * Paleta de vencimiento. Deliberadamente ÁMBAR y no rojo: que un sobrante esté
 * por vencer o vencido no es un fallo del sistema ni un error del usuario, es
 * información para decidir. El rojo queda reservado para acciones destructivas.
 */
const EXPIRY_TONE: Record<ExpiryState, string> = {
  "sin-definir":
    "border-muted-foreground/30 bg-muted/50 text-muted-foreground",
  ok: "border-transparent bg-muted text-muted-foreground",
  "por-vencer":
    "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400",
  vencido:
    "border-amber-400 bg-amber-100 text-amber-800 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
};

/** Clase de fondo para resaltar la fila entera de un sobrante que urge. */
export function rowTone(expiresAt: string | null, status: LeftoverStatus): string {
  if (status !== "disponible") return "";
  const { state } = expiryInfo(expiresAt);
  if (state === "vencido") return "bg-amber-100/60 dark:bg-amber-950/30";
  if (state === "por-vencer") return "bg-amber-50/60 dark:bg-amber-950/15";
  return "";
}

/** Texto humano del vencimiento: "vence en 3 días", "venció hace 2 días". */
export function expiryText(expiresAt: string | null): string {
  const { state, days } = expiryInfo(expiresAt);
  if (state === "sin-definir") return "sin vida útil definida";
  if (days === 0) return "vence hoy";
  if (days != null && days < 0) {
    const d = Math.abs(days);
    return `venció hace ${d} día${d === 1 ? "" : "s"}`;
  }
  return `vence en ${days} día${days === 1 ? "" : "s"}`;
}

export function ExpiryBadge({ expiresAt }: { expiresAt: string | null }) {
  const { state } = expiryInfo(expiresAt);

  if (state === "sin-definir") {
    return (
      <Badge
        variant="outline"
        className={EXPIRY_TONE["sin-definir"]}
        title="Cargá los días de vida útil en la ficha del producto para que se calcule el vencimiento."
      >
        <CircleHelp className="size-3" />
        sin vida útil definida
      </Badge>
    );
  }

  if (state === "ok") {
    return (
      <span className="text-xs text-muted-foreground">
        vence {formatDate(expiresAt)}
      </span>
    );
  }

  return (
    <Badge variant="outline" className={EXPIRY_TONE[state]}>
      <CalendarClock className="size-3" />
      {expiryText(expiresAt)}
    </Badge>
  );
}

const STATUS_TONE: Record<LeftoverStatus, string> = {
  disponible:
    "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400",
  vencido: EXPIRY_TONE.vencido,
  consumido: "border-transparent bg-muted text-muted-foreground",
  descartado: "border-transparent bg-muted text-muted-foreground",
};

const STATUS_LABEL: Record<LeftoverStatus, string> = {
  disponible: "Disponible",
  vencido: "Vencido",
  consumido: "Consumido",
  descartado: "Descartado",
};

export function StatusBadge({ status }: { status: LeftoverStatus }) {
  return (
    <Badge variant="outline" className={STATUS_TONE[status]}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}
