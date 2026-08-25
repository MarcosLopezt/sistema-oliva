"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Info, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCreateLeftovers, useEventLeftovers } from "@/lib/hooks";
import type { MateriaPrimaResult } from "@/lib/materia-prima";
import { formatDate, unitLabel } from "@/lib/format";
import {
  buildLeftoverDrafts,
  displayScale,
  productsByIngredient,
  toBaseQty,
  toDisplayQty,
  todayISO,
  type LeftoverDraft,
} from "@/lib/sobrantes";
import type {
  EventRecipeWithRecipe,
  EventRow,
  LeftoverInput,
} from "@/lib/types";

/**
 * Paso opcional al finalizar un evento: registrar lo que sobró.
 *
 * La lista viene PRECALCULADA porque nadie cuenta todo desde cero después de
 * un evento, pero sí revisa una lista ya armada. Cada línea se puede confirmar,
 * corregir o descartar, y el paso entero se puede saltear.
 *
 * Es un cálculo de LECTURA: usa `computeMateriaPrima` tal como está y le resta
 * `neededBaseQty` a `totalBaseQty`. No modifica el motor ni el costo del evento
 * (que ya quedó cerrado con lo que efectivamente se compró).
 */
export function LeftoverCloseDialog({
  open,
  onOpenChange,
  event,
  selections,
  mp,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: EventRow;
  selections: EventRecipeWithRecipe[];
  /**
   * El cálculo de materia prima que ya hizo la página — el MISMO que quedó
   * guardado en la foto al finalizar. Antes este diálogo lo recalculaba por su
   * cuenta, así que si un precio cambiaba entre el cierre y este paso, los
   * sobrantes salían de una base distinta de la que registró el costo.
   */
  mp: MateriaPrimaResult | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        {open && mp && (
          <CloseForm
            event={event}
            selections={selections}
            mp={mp}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Estado editable de cada línea precargada. */
type Row = {
  draft: LeftoverDraft;
  /** Cantidad en la unidad que se muestra (ml/L/g/kg), como texto editable. */
  qty: string;
  /** false = se descarta: se registra en 0 para dejar constancia. */
  keep: boolean;
};

function CloseForm({
  event,
  selections,
  mp,
  onDone,
}: {
  event: EventRow;
  selections: EventRecipeWithRecipe[];
  mp: MateriaPrimaResult;
  onDone: () => void;
}) {
  const create = useCreateLeftovers();
  const { data: alreadySaved } = useEventLeftovers(event.id);

  const drafts = useMemo(
    () => buildLeftoverDrafts(event, mp, productsByIngredient(selections)),
    [event, mp, selections],
  );

  // Productos ya registrados en un cierre anterior: no se vuelven a ofrecer.
  const savedProductIds = useMemo(
    () => new Set((alreadySaved ?? []).map((l) => l.product_id)),
    [alreadySaved],
  );

  const pending = useMemo(
    () => drafts.filter((d) => !savedProductIds.has(d.productId)),
    [drafts, savedProductIds],
  );

  const [rows, setRows] = useState<Row[] | null>(null);
  // La precarga se inicializa una sola vez, cuando llegan los datos, para no
  // pisar lo que el usuario ya editó si se revalida la query de fondo.
  const current: Row[] =
    rows ??
    pending.map((draft) => ({
      draft,
      qty: String(Number(toDisplayQty(draft.calculatedQty, draft).toFixed(3))),
      keep: true,
    }));

  function patch(productId: string, patch: Partial<Row>) {
    setRows(
      current.map((r) =>
        r.draft.productId === productId ? { ...r, ...patch } : r,
      ),
    );
  }

  function discardAll() {
    setRows(current.map((r) => ({ ...r, keep: false })));
  }

  function restoreAll() {
    setRows(
      current.map((r) => ({
        ...r,
        keep: true,
        qty: String(
          Number(toDisplayQty(r.draft.calculatedQty, r.draft).toFixed(3)),
        ),
      })),
    );
  }

  const kept = current.filter((r) => r.keep).length;
  const discarded = current.length - kept;

  async function handleSave() {
    const rowsToSave: LeftoverInput[] = current.map((r) => {
      const d = r.draft;
      const display = r.keep ? Number(r.qty.replace(",", ".")) : 0;
      const confirmed =
        Number.isFinite(display) && display > 0 ? toBaseQty(display, d) : 0;

      return {
        product_id: d.productId,
        origin_event_id: event.id,
        // Nombre del evento congelado: si mañana se borra el evento, es lo
        // único que queda para saber de dónde vino el sobrante.
        origin_event_name: event.name,

        // Ambas cantidades, siempre. La comparación entre las dos es lo que
        // después permite saber si la merma está bien calibrada.
        qty_calculated: d.calculatedQty,
        qty_confirmed: confirmed,
        qty_remaining: confirmed,

        base_unit: d.baseUnit,
        unit_content_value: d.unitContentValue,
        unit_content_unit: d.unitContentUnit,
        purchased_qty: d.purchasedQty,
        // Snapshots irrecuperables: el precio cambia con cada lista nueva y la
        // merma del evento se puede editar después.
        unit_cost: d.unitCost,
        merma_pct: event.merma_pct,

        status: r.keep && confirmed > 0 ? "disponible" : "descartado",
        registered_at: todayISO(),
        expires_at: d.expiresAt,
        expiry_manual: false,
        note: null,
      };
    });

    try {
      await create.mutateAsync({ rows: rowsToSave, eventId: event.id });
      const okCount = rowsToSave.filter((r) => r.status === "disponible").length;
      toast.success(
        okCount > 0
          ? `${okCount} sobrante${okCount > 1 ? "s" : ""} registrado${okCount > 1 ? "s" : ""}.`
          : "Registrado: no quedó nada aprovechable.",
      );
      onDone();
    } catch (e) {
      toast.error("No se pudieron guardar los sobrantes", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  // ------------------------------ Vistas vacías ------------------------------

  if (pending.length === 0) {
    const yaRegistrados = drafts.length > 0 && savedProductIds.size > 0;
    return (
      <>
        <DialogHeader>
          <DialogTitle>Registrar sobrantes</DialogTitle>
          <DialogDescription>{event.name}</DialogDescription>
        </DialogHeader>
        <p className="py-4 text-sm text-muted-foreground">
          {yaRegistrados
            ? "Los sobrantes de este evento ya estaban registrados. Podés verlos y editarlos en la sección Sobrantes."
            : "Este evento no dejó sobrante calculable: o se compró exactamente lo necesario, o los ingredientes van por precio de mercado (sin packs)."}
        </p>
        <DialogFooter>
          <Button onClick={onDone}>Listo</Button>
        </DialogFooter>
      </>
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Registrar sobrantes</DialogTitle>
        <DialogDescription>
          {event.name}
          {event.event_date ? ` · ${formatDate(event.event_date)}` : ""} — revisá
          lo que quedó. Podés corregir las cantidades o saltear este paso.
        </DialogDescription>
      </DialogHeader>

      <div className="flex items-start gap-2 rounded-md border border-sky-200 bg-sky-50 p-3 text-xs text-sky-700 dark:border-sky-900 dark:bg-sky-950/20 dark:text-sky-400">
        <Info className="mt-0.5 size-4 shrink-0" />
        <span>
          Las cantidades salen de comparar lo que se compró (packs completos)
          contra lo que se necesitaba con {Math.round(event.merma_pct * 100)}% de
          merma. El costo del evento no cambia: lo comprado ya está pago.
        </span>
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        <span className="text-xs text-muted-foreground">
          {kept} para guardar
          {discarded > 0 && ` · ${discarded} descartado${discarded > 1 ? "s" : ""}`}
        </span>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={restoreAll}>
            <RotateCcw className="size-4" />
            Restaurar
          </Button>
          <Button variant="outline" size="sm" onClick={discardAll}>
            <Trash2 className="size-4" />
            No quedó nada
          </Button>
        </div>
      </div>

      <div className="max-h-[45vh] overflow-y-auto rounded-md border">
        <ul className="divide-y">
          {current.map((r) => {
            const d = r.draft;
            const scale = displayScale(d);
            return (
              <li
                key={d.productId}
                className={
                  "flex flex-wrap items-center justify-between gap-3 p-3 text-sm " +
                  (r.keep ? "" : "bg-muted/40 opacity-60")
                }
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{d.productName}</span>
                    {d.expiresAt == null && (
                      <Badge
                        variant="outline"
                        className="border-muted-foreground/30 text-muted-foreground"
                        title="Cargá los días de vida útil en la ficha del producto."
                      >
                        sin vida útil
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {d.providerName} · {d.ingredientName}
                    {d.expiresAt && <> · vence {formatDate(d.expiresAt)}</>}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Input
                    inputMode="decimal"
                    value={r.keep ? r.qty : ""}
                    disabled={!r.keep}
                    onChange={(e) => patch(d.productId, { qty: e.target.value })}
                    className="w-28 text-right"
                    aria-label={`Cantidad sobrante de ${d.productName}`}
                  />
                  <span className="w-8 text-xs text-muted-foreground">
                    {unitLabel(scale.unit)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => patch(d.productId, { keep: !r.keep })}
                    aria-label={r.keep ? "Descartar" : "Recuperar"}
                    title={r.keep ? "No quedó nada de este" : "Volver a incluir"}
                  >
                    {r.keep ? (
                      <Trash2 className="size-4" />
                    ) : (
                      <RotateCcw className="size-4" />
                    )}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <DialogFooter>
        {/* Salteable: el evento ya quedó finalizado igual. */}
        <Button variant="outline" onClick={onDone}>
          Saltear
        </Button>
        <Button onClick={handleSave} disabled={create.isPending}>
          {create.isPending ? "Guardando…" : "Registrar sobrantes"}
        </Button>
      </DialogFooter>
    </>
  );
}
