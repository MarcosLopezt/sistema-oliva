"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Archive,
  Check,
  Info,
  Pencil,
  Plus,
  Store,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/native-select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LeftoverDialog } from "@/components/sobrantes/leftover-dialog";
import { ArchiveDialog } from "@/components/archivado/archive-dialog";
import { ArchivedPanel } from "@/components/archivado/archived-panel";
import {
  ArchiveTabs,
  BulkActionBar,
  RowCheckbox,
  SelectAllCheckbox,
} from "@/components/archivado/bulk-bar";
import { useBulkSelection } from "@/components/archivado/use-bulk-selection";
import { toRow } from "@/lib/archivado";
import {
  ExpiryBadge,
  StatusBadge,
  rowTone,
} from "@/components/sobrantes/leftover-badges";
import {
  useLeftovers,
  useUpdateLeftover,
  useArchivedLeftovers,
} from "@/lib/hooks";
import { toastUndo } from "@/lib/undo";
import { formatDate, formatNum, unitLabel } from "@/lib/format";
import {
  calibrationByProduct,
  displayScale,
  effectiveStatus,
  expiryInfo,
  formatQty,
  pctOfPack,
  todayISO,
} from "@/lib/sobrantes";
import type { LeftoverStatus, LeftoverWithProduct } from "@/lib/types";

type StatusFilter = "activos" | LeftoverStatus | "todos";

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "activos", label: "Activos (disponibles y vencidos)" },
  { value: "disponible", label: "Solo disponibles" },
  { value: "vencido", label: "Solo vencidos" },
  { value: "consumido", label: "Consumidos" },
  { value: "descartado", label: "Descartados" },
  { value: "todos", label: "Todos" },
];

export default function SobrantesPage() {
  const { data: leftovers, isLoading } = useLeftovers();
  const { data: archived, isLoading: loadingArchived } = useArchivedLeftovers();
  const update = useUpdateLeftover();

  const [tab, setTab] = useState<"vigentes" | "archivados">("vigentes");
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("activos");
  const [providerFilter, setProviderFilter] = useState("todos");
  const [search, setSearch] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<LeftoverWithProduct | null>(null);
  const [discarding, setDiscarding] = useState<LeftoverWithProduct | null>(null);

  const today = todayISO();
  const all = useMemo(() => leftovers ?? [], [leftovers]);

  // El estado que se muestra es el DERIVADO: 'vencido' sale de comparar
  // expires_at contra hoy, no de una columna que haya que mantener al día.
  const withStatus = useMemo(
    () => all.map((l) => ({ l, status: effectiveStatus(l, today) })),
    [all, today],
  );

  const providers = useMemo(() => {
    const m = new Map<string, string>();
    for (const { l } of withStatus) {
      const p = l.product?.provider;
      if (p) m.set(p.id, p.name);
    }
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [withStatus]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return withStatus.filter(({ l, status }) => {
      if (statusFilter === "activos") {
        if (status !== "disponible" && status !== "vencido") return false;
      } else if (statusFilter !== "todos" && status !== statusFilter) {
        return false;
      }
      if (
        providerFilter !== "todos" &&
        l.product?.provider?.id !== providerFilter
      )
        return false;
      if (q && !(l.product?.name ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [withStatus, statusFilter, providerFilter, search]);

  // La selección se calcula sobre lo filtrado, así que "seleccionar todos"
  // toma solo lo que coincide con estado, proveedor y búsqueda.
  const visibleRows = useMemo(() => filtered.map(({ l }) => l), [filtered]);
  const sel = useBulkSelection(visibleRows);

  // Agrupado por proveedor, que es como se sale a buscar la mercadería.
  const groups = useMemo(() => {
    const m = new Map<
      string,
      { name: string; rows: { l: LeftoverWithProduct; status: LeftoverStatus }[] }
    >();
    for (const row of filtered) {
      const p = row.l.product?.provider;
      const key = p?.id ?? "sin-proveedor";
      const name = p?.name ?? "Sin proveedor";
      const g = m.get(key);
      if (g) g.rows.push(row);
      else m.set(key, { name, rows: [row] });
    }
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [filtered]);

  // Resumen para la cabecera: cuántos urgen y cuántos no se pueden fechar.
  const counts = useMemo(() => {
    let disponibles = 0;
    let porVencer = 0;
    let vencidos = 0;
    let sinVidaUtil = 0;
    for (const { l, status } of withStatus) {
      if (status === "vencido") vencidos++;
      if (status !== "disponible") continue;
      disponibles++;
      const { state } = expiryInfo(l.expires_at, today);
      if (state === "por-vencer") porVencer++;
      if (state === "sin-definir") sinVidaUtil++;
    }
    return { disponibles, porVencer, vencidos, sinVidaUtil };
  }, [withStatus, today]);

  const calibration = useMemo(() => calibrationByProduct(all), [all]);

  /**
   * Marcar consumido es reversible, así que no pide confirmación: se aplica y
   * se ofrece deshacer. OJO — también pone el stock en cero, así que deshacer
   * tiene que restituir la cantidad además del estado. Por eso se capturan los
   * DOS valores previos antes de mutar.
   */
  async function setStatus(l: LeftoverWithProduct, status: LeftoverStatus) {
    const previous = { status: l.status, qty_remaining: l.qty_remaining };
    try {
      await update.mutateAsync({
        id: l.id,
        eventId: l.origin_event_id,
        input:
          status === "consumido"
            ? // Consumido = se usó todo: el stock queda en cero.
              { status, qty_remaining: 0 }
            : { status },
      });
      toastUndo({
        message:
          status === "consumido"
            ? "Marcado como consumido."
            : "Marcado como descartado.",
        description: l.product?.name ?? undefined,
        onUndo: () =>
          update.mutateAsync({
            id: l.id,
            eventId: l.origin_event_id,
            input: previous,
          }),
        undoneMessage: "El sobrante volvió a estar disponible.",
      });
    } catch (e) {
      toast.error("No se pudo actualizar", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-primary">
            <Archive className="size-6" />
            Sobrantes
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Lo que quedó pago y sin usar después de cada evento. Es un registro
            informativo: no descuenta stock de ningún cálculo ni modifica el
            costo de los eventos.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="size-4" />
          Cargar sobrante
        </Button>
      </div>

      {/* Resumen */}
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <SummaryTile label="Disponibles" value={counts.disponibles} />
        <SummaryTile label="Por vencer (7 días)" value={counts.porVencer} amber />
        <SummaryTile label="Vencidos" value={counts.vencidos} amber />
        <SummaryTile label="Sin vida útil definida" value={counts.sinVidaUtil} />
      </div>

      {counts.sinVidaUtil > 0 && (
        <Card className="mb-4 border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
          <CardContent className="flex items-start gap-2 py-4 text-sm text-amber-700 dark:text-amber-400">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <span>
              Hay {counts.sinVidaUtil} sobrante
              {counts.sinVidaUtil > 1 ? "s" : ""} sin fecha de vencimiento
              porque su producto no tiene cargados los días de vida útil.
              Editá el producto en Proveedores para que se calcule solo.
            </span>
          </CardContent>
        </Card>
      )}

      <div className="mb-4">
        <ArchiveTabs
          value={tab}
          onChange={setTab}
          archivedCount={archived?.length}
        />
      </div>

      {tab === "archivados" ? (
        <ArchivedPanel
          entity="leftovers"
          isLoading={loadingArchived}
          rows={(archived ?? []).map((l) => ({
            ...toRow.leftover(l),
            archived_at: l.archived_at,
            detail: l.origin_event_name ?? "carga manual",
          }))}
        />
      ) : (
        <>
      {/* Filtros */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="f-status" className="text-xs">
            Estado
          </Label>
          <NativeSelect
            id="f-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="w-64"
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="f-provider" className="text-xs">
            Proveedor
          </Label>
          <NativeSelect
            id="f-provider"
            value={providerFilter}
            onChange={(e) => setProviderFilter(e.target.value)}
            className="w-52"
          >
            <option value="todos">Todos</option>
            {providers.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="f-search" className="text-xs">
            Producto
          </Label>
          <Input
            id="f-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar…"
            className="w-52"
          />
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}

      {!isLoading && groups.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Archive className="mx-auto mb-3 size-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {all.length === 0
                ? "Todavía no hay sobrantes registrados. Se cargan solos al finalizar un evento, o podés agregar uno a mano."
                : "Ningún sobrante coincide con los filtros."}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-4">
        {groups.map((g) => (
          <Card key={g.name} className="overflow-hidden p-0">
            <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-2">
              <span className="flex items-center gap-2 font-medium">
                <Store className="size-4 text-primary" />
                {g.name}
              </span>
              <Badge variant="secondary">{g.rows.length}</Badge>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-px">
                    <SelectAllCheckbox
                      checked={sel.allVisibleSelected}
                      indeterminate={sel.someVisibleSelected}
                      onToggle={sel.toggleAll}
                    />
                  </TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-right">Restante</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-px" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {g.rows.map(({ l, status }) => (
                  <TableRow key={l.id} className={rowTone(l.expires_at, status)}>
                    <TableCell>
                      <RowCheckbox
                        checked={sel.isSelected(l.id)}
                        onToggle={() => sel.toggle(l.id)}
                        label={l.product?.name ?? "sobrante"}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="max-w-[240px] truncate">
                        {l.product?.name ?? "—"}
                      </div>
                      {l.note && (
                        <div className="max-w-[240px] truncate text-xs text-muted-foreground">
                          {l.note}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <QtyCell leftover={l} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <div className="max-w-[180px] truncate text-sm">
                        {l.origin_event_name ?? "carga manual"}
                      </div>
                      <div className="text-xs">
                        reg. {formatDate(l.registered_at)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <ExpiryBadge expiresAt={l.expires_at} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={status} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => {
                            setEditing(l);
                            setDialogOpen(true);
                          }}
                          aria-label="Editar cantidad"
                        >
                          <Pencil className="size-4" />
                        </Button>
                        {l.status === "disponible" && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => setStatus(l, "consumido")}
                              aria-label="Marcar como consumido"
                              title="Marcar como consumido"
                            >
                              <Check className="size-4 text-emerald-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => setDiscarding(l)}
                              aria-label="Marcar como descartado"
                              title="Marcar como descartado"
                            >
                              <Archive className="size-4 text-amber-600" />
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => {
                            sel.clear();
                            sel.toggle(l.id);
                            setArchiveOpen(true);
                          }}
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
          </Card>
        ))}
      </div>

      <BulkActionBar
        count={sel.count}
        noun={{ singular: "sobrante", plural: "sobrantes" }}
        onClear={sel.clear}
        onArchive={() => setArchiveOpen(true)}
      />

      {calibration.length > 0 && <CalibrationCard rows={calibration} />}
        </>
      )}

      <LeftoverDialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setEditing(null);
        }}
        leftover={editing}
      />
      <DiscardDialog
        leftover={discarding}
        onOpenChange={(o) => !o && setDiscarding(null)}
        onDone={() => setDiscarding(null)}
      />
      <ArchiveDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        entity="leftovers"
        rows={sel.selected.map(toRow.leftover)}
        onDone={sel.clear}
      />
    </div>
  );
}

// ------------------------------- Auxiliares -------------------------------

function SummaryTile({
  label,
  value,
  amber,
}: {
  label: string;
  value: number;
  amber?: boolean;
}) {
  const highlight = amber && value > 0;
  return (
    <Card
      className={
        highlight
          ? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20"
          : ""
      }
    >
      <CardContent className="py-3">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div
          className={
            "text-2xl font-semibold " +
            (highlight ? "text-amber-700 dark:text-amber-400" : "")
          }
        >
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

/** Cantidad restante en la unidad legible, con el % del pack si se conoce. */
function QtyCell({ leftover }: { leftover: LeftoverWithProduct }) {
  const pct = pctOfPack(leftover.qty_remaining, leftover.purchased_qty);
  return (
    <div className="flex flex-col items-end gap-0.5">
      <span>{formatQty(leftover.qty_remaining, leftover)}</span>
      {pct != null && (
        <span className="text-xs text-muted-foreground">
          {formatNum(Math.round(pct))}% de lo comprado
        </span>
      )}
    </div>
  );
}

/** Descartar pide (opcionalmente) el motivo: es el dato que explica la pérdida. */
function DiscardDialog({
  leftover,
  onOpenChange,
  onDone,
}: {
  leftover: LeftoverWithProduct | null;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const update = useUpdateLeftover();
  const [reason, setReason] = useState("");

  async function handleDiscard() {
    if (!leftover) return;
    try {
      await update.mutateAsync({
        id: leftover.id,
        eventId: leftover.origin_event_id,
        input: {
          status: "descartado",
          qty_remaining: 0,
          note: [leftover.note, reason.trim()].filter(Boolean).join(" · ") || null,
        },
      });
      toast.success("Marcado como descartado.");
      setReason("");
      onDone();
    } catch (e) {
      toast.error("No se pudo actualizar", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  return (
    <Dialog open={!!leftover} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Descartar sobrante</DialogTitle>
          <DialogDescription>
            {leftover?.product?.name} — el registro queda en el historial con el
            motivo.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="discard-reason">Motivo (opcional)</Label>
          <Textarea
            id="discard-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ej: se cortó la cadena de frío, quedó fuera de la heladera…"
            rows={2}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleDiscard} disabled={update.isPending}>
            {update.isPending ? "Guardando…" : "Descartar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Calibración de la merma (Tarea 5). Compara lo que calculó el sistema contra
 * lo que confirmó el usuario. Solo informa: no ajusta merma_pct de nada.
 */
function CalibrationCard({
  rows,
}: {
  rows: ReturnType<typeof calibrationByProduct>;
}) {
  return (
    <Card className="mt-6 overflow-hidden p-0">
      <div className="flex items-start gap-2 border-b bg-muted/40 px-4 py-3">
        <Info className="mt-0.5 size-4 shrink-0 text-primary" />
        <div>
          <div className="font-medium">Calculado vs. confirmado</div>
          <p className="text-xs text-muted-foreground">
            Si sobra sistemáticamente MENOS de lo calculado, la merma real es
            mayor que la configurada. Si sobra MÁS, se está comprando de más.
            Por ahora es solo información.
          </p>
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Producto</TableHead>
            <TableHead className="text-right">Registros</TableHead>
            <TableHead className="text-right">Calculado (prom.)</TableHead>
            <TableHead className="text-right">Confirmado (prom.)</TableHead>
            <TableHead className="text-right">Diferencia</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const scale = displayScale(r);
            const u = unitLabel(scale.unit);
            return (
              <TableRow key={r.productId}>
                <TableCell className="font-medium">{r.productName}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {r.samples}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatNum(r.avgCalculated * scale.factor)} {u}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatNum(r.avgConfirmed * scale.factor)} {u}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  <span
                    className={
                      r.avgDiff < 0
                        ? "text-amber-700 dark:text-amber-400"
                        : "text-muted-foreground"
                    }
                  >
                    {r.avgDiff > 0 ? "+" : ""}
                    {formatNum(r.avgDiff * scale.factor)} {u}
                    {r.avgDiffPct != null && (
                      <span className="ml-1 text-xs">
                        ({r.avgDiffPct > 0 ? "+" : ""}
                        {formatNum(Math.round(r.avgDiffPct))}%)
                      </span>
                    )}
                  </span>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}
