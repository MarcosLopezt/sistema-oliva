"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { Lock, RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { isEventLive, type EventRow } from "@/lib/types";
import { wasTouchedAfterClosing, type EventCostSnapshot } from "@/lib/snapshot";

/**
 * QUÉ QUEDA BLOQUEADO EN UN EVENTO FINALIZADO — y qué no.
 *
 * El bloqueo está acotado A LO QUE LA FOTO CONGELA, no a la pantalla entera.
 * Un evento cerrado sigue teniendo vida operativa: los pagos al personal y el
 * registro de sobrantes ocurren DESPUÉS del evento por definición, y bloquear
 * eso rompería justamente las funciones para las que se hicieron.
 *
 *   BLOQUEADO (entra al costo, está en la foto)
 *     · PAX, cubiertos extra, % veggie / merma / margen
 *     · menú (recetas elegidas)
 *     · personal asignado, horas y tarifas
 *     · vajilla: ítems, cantidades y roturas
 *     · barra: servicio, día y horario
 *     · líneas de instalación, extras y adicionales
 *
 *   EDITABLE (operativa posterior, no toca el costo)
 *     · marcar empleados como pagado / pendiente
 *     · registrar, editar y descartar sobrantes
 *     · notas y observaciones del evento
 *
 * Es un contexto y no un prop porque "este evento está cerrado" es estado
 * ambiente de todo el árbol de la pantalla: pasarlo a mano por ocho
 * componentes y sus diálogos anidados es la forma segura de olvidárselo en uno.
 */
type EventLock = {
  /** true = el costo está congelado y no se puede editar lo que lo compone. */
  locked: boolean;
  /** Cuándo se sacó la foto vigente. */
  frozenAt: string | null;
  /** false = foto reconstruida por backfill, precios no garantizados. */
  reliable: boolean;
};

const Ctx = createContext<EventLock>({
  locked: false,
  frozenAt: null,
  reliable: true,
});

export function EventLockProvider({
  event,
  snapshot,
  children,
}: {
  event: EventRow;
  snapshot: EventCostSnapshot | null | undefined;
  children: ReactNode;
}) {
  const value = useMemo<EventLock>(
    () => ({
      // El candado lo pone el ESTADO del evento, no la existencia de la foto:
      // un evento finalizado al que todavía no se le hizo el backfill también
      // tiene que quedar quieto, aunque sus números sean los del catálogo.
      locked: !isEventLive(event),
      frozenAt: snapshot?.taken_at ?? null,
      reliable: snapshot?.reliable ?? true,
    }),
    [event, snapshot],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** true si esta parte de la pantalla no se puede editar. */
export function useEventLocked(): boolean {
  return useContext(Ctx).locked;
}

export function useEventLock(): EventLock {
  return useContext(Ctx);
}

/**
 * El cartel que explica el bloqueo. Va una sola vez, arriba de todo.
 *
 * Campos grises sin explicación se leen como una app rota. Este dice por qué
 * están bloqueados y deja a la vista las dos salidas, que es lo que el usuario
 * necesita cuando de verdad tiene que corregir algo.
 */
export function FrozenCostNotice({
  snapshot,
  onReopen,
  onRecalculate,
}: {
  snapshot: EventCostSnapshot | null | undefined;
  onReopen: () => void;
  onRecalculate: () => void;
}) {
  const reconstructed = snapshot != null && !snapshot.reliable;

  return (
    <Card
      className={
        reconstructed
          ? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20"
          : "border-muted-foreground/20 bg-muted/40"
      }
    >
      <CardContent className="flex flex-col gap-3 py-4">
        <div className="flex items-start gap-2 text-sm">
          {reconstructed ? (
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
          ) : (
            <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          )}
          <div className="flex flex-col gap-1">
            {snapshot ? (
              <span>
                Este evento está finalizado. Sus costos quedaron congelados el{" "}
                <strong>{formatDate(snapshot.taken_at)}</strong> y no cambian
                aunque después se editen precios, recetas o ingredientes.
              </span>
            ) : (
              <span>
                Este evento está finalizado, pero <strong>no tiene foto de
                costos</strong>: sus números todavía se recalculan con el
                catálogo actual. Corré la reconstrucción desde Configuración →
                Costos congelados.
              </span>
            )}

            {reconstructed && (
              <span className="text-amber-700 dark:text-amber-400">
                Costo <strong>reconstruido</strong> a partir de los precios de
                esa fecha, no de los del evento. Los precios pueden haber
                cambiado desde entonces: tomalo como referencia, no como el
                número exacto que se pagó.
              </span>
            )}

            {snapshot && wasTouchedAfterClosing(snapshot) && (
              <span className="text-muted-foreground">
                Este evento se modificó después de cerrado (
                {snapshot.history.length} versiones de la foto).
              </span>
            )}

            <span className="text-muted-foreground">
              Para cambiar algo que afecte el costo, reabrí el evento. Los pagos
              al personal y los sobrantes se siguen pudiendo editar.
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={onReopen}>
            <RotateCcw className="size-4" />
            Reabrir evento
          </Button>
          {snapshot && (
            <Button variant="ghost" size="sm" onClick={onRecalculate}>
              Recalcular con precios actuales
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
