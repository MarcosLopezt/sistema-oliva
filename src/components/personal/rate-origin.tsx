"use client";

import { Badge } from "@/components/ui/badge";
import { formatARS } from "@/lib/format";
import { rateSourceLabel, type ResolvedRate } from "@/lib/personal";
import { cn } from "@/lib/utils";

/** Texto corto para la tabla; el largo va en el tooltip. */
function shortLabel(r: ResolvedRate): string {
  switch (r.source) {
    case "evento":
      return "ajustada";
    case "empleado":
      return "propia";
    case "rol":
      return r.role ? r.role.name : "rol";
    default:
      return "sin tarifa";
  }
}

function badgeVariant(r: ResolvedRate) {
  if (r.source === "sin-tarifa") return "destructive" as const;
  if (r.source === "evento") return "outline" as const;
  return "secondary" as const;
}

/**
 * De dónde sale la tarifa que se está mostrando. Sin este cartel el número
 * aparece sin explicación y el usuario no sabe qué tocar para cambiarlo.
 */
export function RateOriginBadge({
  resolved,
  className,
}: {
  resolved: ResolvedRate;
  className?: string;
}) {
  return (
    <Badge
      variant={badgeVariant(resolved)}
      title={rateSourceLabel(resolved)}
      className={cn(
        "font-normal",
        resolved.source === "evento" && "border-amber-500/60 text-amber-600",
        className,
      )}
    >
      {shortLabel(resolved)}
    </Badge>
  );
}

/** Tarifa + su origen, alineado a la derecha para celdas numéricas. */
export function RateCell({ resolved }: { resolved: ResolvedRate }) {
  return (
    <div className="flex flex-col items-end gap-0.5">
      <span className="tabular-nums">{formatARS(resolved.rate)}</span>
      <RateOriginBadge resolved={resolved} className="h-4 px-1.5 text-[10px]" />
    </div>
  );
}
