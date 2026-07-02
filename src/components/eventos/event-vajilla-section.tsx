"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  Send,
  MessageCircle,
  Copy,
  Check,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/native-select";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  useAllTablewareItems,
  useEventTableware,
  useAddEventTableware,
  useUpdateEventTableware,
  useRemoveEventTableware,
} from "@/lib/hooks";
import {
  computeVajillaTotal,
  buildVajillaOrderMessage,
  calcSuggestedQty,
} from "@/lib/queries";
import { formatARS, formatNum } from "@/lib/format";
import { whatsappDigits } from "@/lib/materia-prima";
import type {
  EventRow,
  EventTablewareWithItem,
  EventTablewareInput,
} from "@/lib/types";

// ─── Diálogo agregar / editar ítem ──────────────────────────────────────────

type EntryForm = {
  item_id: string;
  quantity: string;
  breakage_qty: string;
  charge_purchase: boolean;
  multiplier: string;
  margin_override: string; // vacío = usar margen global del evento
  quantity_manual: boolean;
};

function blankForm(pax: number, globalMargin: number): EntryForm {
  return {
    item_id: "",
    quantity: "",
    breakage_qty: "0",
    charge_purchase: false,
    multiplier: "1",
    margin_override: "",
    quantity_manual: false,
  };
}

function fromEntry(entry: EventTablewareWithItem): EntryForm {
  return {
    item_id: entry.item_id,
    quantity: String(entry.quantity),
    breakage_qty: String(entry.breakage_qty),
    charge_purchase: entry.charge_purchase,
    multiplier: String(entry.multiplier),
    margin_override:
      entry.margin_override !== null ? String(entry.margin_override) : "",
    quantity_manual: entry.quantity_manual,
  };
}

function EntryDialog({
  open,
  onOpenChange,
  eventId,
  pax,
  globalMargin,
  entry,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  eventId: string;
  pax: number;
  globalMargin: number;
  entry: EventTablewareWithItem | null;
}) {
  const { data: allItems } = useAllTablewareItems();
  const add = useAddEventTableware();
  const update = useUpdateEventTableware();

  const [form, setForm] = useState<EntryForm>(() =>
    entry ? fromEntry(entry) : blankForm(pax, globalMargin),
  );

  const selectedItem = allItems?.find((i) => i.id === form.item_id);
  const isAlquiler = selectedItem?.cost_type === "alquiler";

  // Cantidad sugerida según parámetros actuales del formulario
  const effectiveMargin =
    form.margin_override.trim() !== ""
      ? Number(form.margin_override.replace(",", "."))
      : globalMargin;
  const suggestedQty = form.item_id
    ? calcSuggestedQty(pax, Number(form.multiplier) || 1, effectiveMargin)
    : 0;

  function handleOpen(o: boolean) {
    if (!o) setForm(entry ? fromEntry(entry) : blankForm(pax, globalMargin));
    onOpenChange(o);
  }

  // Cuando cambia el ítem: autofill de cantidad
  function handleItemChange(newId: string) {
    const qty = newId ? calcSuggestedQty(pax, Number(form.multiplier) || 1, effectiveMargin) : 0;
    setForm((f) => ({
      ...f,
      item_id: newId,
      quantity: newId ? String(qty) : "",
      quantity_manual: false,
      breakage_qty: "0",
      charge_purchase: false,
    }));
  }

  // Cuando cambia el multiplicador: si no es manual, recalcular cantidad
  function handleMultiplierChange(raw: string) {
    setForm((f) => {
      const mult = Number(raw.replace(",", ".")) || 1;
      const margin =
        f.margin_override.trim() !== ""
          ? Number(f.margin_override.replace(",", "."))
          : globalMargin;
      const qty = calcSuggestedQty(pax, mult, margin);
      return {
        ...f,
        multiplier: raw,
        quantity: f.quantity_manual ? f.quantity : String(qty),
      };
    });
  }

  // Cuando cambia el margen propio: si no es manual, recalcular cantidad
  function handleMarginOverrideChange(raw: string) {
    setForm((f) => {
      const margin =
        raw.trim() !== "" ? Number(raw.replace(",", ".")) : globalMargin;
      const qty = calcSuggestedQty(pax, Number(f.multiplier) || 1, margin);
      return {
        ...f,
        margin_override: raw,
        quantity: f.quantity_manual ? f.quantity : String(qty),
      };
    });
  }

  // Cuando el usuario toca el campo de cantidad directamente → marca como manual
  function handleQuantityChange(raw: string) {
    setForm((f) => ({ ...f, quantity: raw, quantity_manual: true }));
  }

  // Botón "↩ Auto": vuelve a la cantidad sugerida
  function resetToAuto() {
    setForm((f) => ({ ...f, quantity: String(suggestedQty), quantity_manual: false }));
  }

  async function handleSave() {
    const qty = Number(form.quantity.replace(",", "."));
    if (!form.item_id || !Number.isFinite(qty) || qty <= 0) {
      toast.error("Elegí un ítem y una cantidad válida.");
      return;
    }
    const mult = Number(form.multiplier.replace(",", "."));
    const marginOv =
      form.margin_override.trim() !== ""
        ? Number(form.margin_override.replace(",", "."))
        : null;

    const input: EventTablewareInput = {
      item_id: form.item_id,
      quantity: qty,
      breakage_qty: isAlquiler ? Number(form.breakage_qty) || 0 : 0,
      charge_purchase: isAlquiler ? false : form.charge_purchase,
      multiplier: Number.isFinite(mult) && mult > 0 ? mult : 1,
      margin_override: marginOv !== null && Number.isFinite(marginOv) ? marginOv : null,
      quantity_manual: form.quantity_manual,
    };
    try {
      if (entry) {
        await update.mutateAsync({ id: entry.id, eventId, input });
        toast.success("Ítem actualizado.");
      } else {
        await add.mutateAsync({ eventId, input });
        toast.success("Ítem agregado.");
      }
      handleOpen(false);
    } catch (e) {
      toast.error("No se pudo guardar", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  const pending = add.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {entry ? "Editar ítem de vajilla" : "Agregar vajilla"}
          </DialogTitle>
          <DialogDescription>
            La cantidad se calcula automáticamente según personas × multiplicador + margen.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Selección de ítem */}
          <div className="flex flex-col gap-1.5">
            <Label>Ítem de vajilla *</Label>
            <NativeSelect
              value={form.item_id}
              onChange={(e) => handleItemChange(e.target.value)}
            >
              <option value="">— elegí un ítem —</option>
              {(allItems ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}{" "}
                  {item.cost_type === "alquiler" ? "(Alquiler)" : "(Compra)"}
                </option>
              ))}
            </NativeSelect>
          </div>

          {selectedItem && (
            <div className="rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              <span className="font-medium">{selectedItem.name}</span>
              {" · "}
              <Badge variant="outline" className="text-xs">
                {selectedItem.cost_type === "alquiler" ? "Alquiler" : "Compra"}
              </Badge>
              {" · "}
              {formatARS(selectedItem.unit_price)} / un
            </div>
          )}

          {/* Parámetros de autocálculo */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label title="Unidades de este ítem por persona">
                Multiplicador (× persona)
              </Label>
              <Input
                inputMode="decimal"
                value={form.multiplier}
                onChange={(e) => handleMultiplierChange(e.target.value)}
                placeholder="1"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label title="Unidades extra de reserva. Vacío = margen global del evento">
                Margen propio (vacío = global {globalMargin})
              </Label>
              <Input
                inputMode="decimal"
                value={form.margin_override}
                onChange={(e) => handleMarginOverrideChange(e.target.value)}
                placeholder={String(globalMargin)}
              />
            </div>
          </div>

          {/* Cantidad: autofill + indicador manual */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label>
                  Cantidad{" "}
                  {form.quantity_manual && (
                    <span className="text-xs font-normal text-amber-600">
                      ✍ manual
                    </span>
                  )}
                </Label>
                {form.quantity_manual && form.item_id && (
                  <button
                    type="button"
                    onClick={resetToAuto}
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <RotateCcw className="size-3" />
                    Usar auto ({suggestedQty})
                  </button>
                )}
              </div>
              <Input
                inputMode="decimal"
                value={form.quantity}
                onChange={(e) => handleQuantityChange(e.target.value)}
                placeholder={form.item_id ? String(suggestedQty) : "ej: 85"}
                className={form.quantity_manual ? "border-amber-400" : ""}
              />
              {!form.quantity_manual && form.item_id && (
                <p className="text-xs text-muted-foreground">
                  Auto: {pax} × {form.multiplier || 1} + {form.margin_override || globalMargin} = {suggestedQty}
                </p>
              )}
            </div>

            {isAlquiler && (
              <div className="flex flex-col gap-1.5">
                <Label>Roturas estimadas</Label>
                <Input
                  inputMode="decimal"
                  value={form.breakage_qty}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, breakage_qty: e.target.value }))
                  }
                  placeholder="0"
                />
              </div>
            )}
          </div>

          {isAlquiler && (
            <p className="text-xs text-muted-foreground">
              Las roturas se suman al costo del alquiler (misma tarifa por unidad).
            </p>
          )}

          {selectedItem?.cost_type === "compra" && (
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.charge_purchase}
                onChange={(e) =>
                  setForm((f) => ({ ...f, charge_purchase: e.target.checked }))
                }
                className="mt-0.5 size-4"
              />
              <span>
                Cargar el costo de compra a este evento{" "}
                <span className="text-xs text-muted-foreground">
                  (por defecto no se carga — son bienes reutilizables)
                </span>
              </span>
            </label>
          )}

          {/* Costo estimado */}
          {selectedItem && (
            <div className="rounded-md border px-3 py-2 text-sm">
              <span className="text-muted-foreground">Costo estimado: </span>
              <span className="font-medium">
                {formatARS(
                  (() => {
                    const qty = Number(form.quantity.replace(",", ".")) || 0;
                    const bkq = Number(form.breakage_qty) || 0;
                    if (isAlquiler) return (qty + bkq) * selectedItem.unit_price;
                    return form.charge_purchase ? qty * selectedItem.unit_price : 0;
                  })(),
                )}
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={pending}>
            {pending ? "Guardando…" : entry ? "Guardar" : "Agregar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Diálogo de pedido / exportar ───────────────────────────────────────────

function OrderDialog({
  open,
  onOpenChange,
  eventName,
  tableware,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  eventName: string;
  tableware: EventTablewareWithItem[];
}) {
  const [copied, setCopied] = useState(false);

  const byProvider = useMemo(() => {
    const map = new Map<
      string,
      { name: string; phone: string | null; items: EventTablewareWithItem[] }
    >();
    for (const e of tableware) {
      if (!e.item?.provider) continue;
      const pid = e.item.provider.id;
      if (!map.has(pid)) {
        map.set(pid, { name: e.item.provider.name, phone: e.item.provider.phone ?? null, items: [] });
      }
      map.get(pid)!.items.push(e);
    }
    return [...map.values()];
  }, [tableware]);

  const [selectedProvider, setSelectedProvider] = useState(0);
  const prov = byProvider[selectedProvider];
  const message = prov ? buildVajillaOrderMessage(prov.name, eventName, prov.items) : "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      toast.success("Pedido copiado.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("No se pudo copiar.");
    }
  }

  function shareWhatsApp() {
    const digits = whatsappDigits(prov?.phone ?? null);
    if (!digits) return;
    window.open(`https://wa.me/${digits}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  }

  const digits = whatsappDigits(prov?.phone ?? null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pedido de vajilla</DialogTitle>
        </DialogHeader>

        {byProvider.length > 1 && (
          <div className="flex flex-col gap-1.5">
            <Label>Proveedor</Label>
            <NativeSelect
              value={String(selectedProvider)}
              onChange={(e) => setSelectedProvider(Number(e.target.value))}
            >
              {byProvider.map((p, i) => (
                <option key={p.name} value={i}>
                  {p.name}
                </option>
              ))}
            </NativeSelect>
          </div>
        )}

        {byProvider.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No hay ítems con proveedor asignado.
          </p>
        )}

        {message && (
          <textarea
            value={message}
            readOnly
            rows={Math.min(16, message.split("\n").length + 1)}
            className="w-full rounded-md border bg-muted/30 p-2 font-mono text-xs"
            onFocus={(e) => e.currentTarget.select()}
          />
        )}

        {!digits && prov && (
          <p className="text-xs text-muted-foreground">
            Agregá el teléfono del proveedor de vajilla para habilitar WhatsApp.
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
          {message && (
            <>
              <Button variant="outline" onClick={copy}>
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                Copiar
              </Button>
              {digits && (
                <Button onClick={shareWhatsApp}>
                  <MessageCircle className="size-4" />
                  WhatsApp
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Sección principal ───────────────────────────────────────────────────────

export function EventVajillaSection({ event }: { event: EventRow }) {
  const { data: tableware, isLoading } = useEventTableware(event.id);
  const del = useRemoveEventTableware();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EventTablewareWithItem | null>(null);
  const [toDelete, setToDelete] = useState<EventTablewareWithItem | null>(null);
  const [orderOpen, setOrderOpen] = useState(false);

  const items = tableware ?? [];
  const subtotal = useMemo(() => computeVajillaTotal(items), [items]);

  async function confirmDelete() {
    if (!toDelete) return;
    try {
      await del.mutateAsync({ id: toDelete.id, eventId: event.id });
      toast.success("Ítem eliminado.");
      setToDelete(null);
    } catch (e) {
      toast.error("No se pudo eliminar", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  if (isLoading)
    return <p className="text-sm text-muted-foreground">Cargando vajilla…</p>;

  return (
    <>
      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between gap-3 border-b bg-muted/40 px-4 py-2">
          <div>
            <span className="font-medium">Vajilla</span>
            <span className="ml-2 text-xs text-muted-foreground">
              Alquiler y utensilios del evento
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">{formatARS(subtotal)}</span>
            {items.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => setOrderOpen(true)}>
                <Send className="size-4" />
                Pedido
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="size-4" />
              Agregar
            </Button>
          </div>
        </div>

        {items.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            Seleccioná ítems del catálogo de vajilla para calcular el costo.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ítem</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Cant.</TableHead>
                <TableHead className="text-right">Roturas</TableHead>
                <TableHead className="text-right">$/un</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
                <TableHead className="w-px" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((e) => {
                const item = e.item;
                const isAlquiler = item?.cost_type === "alquiler";
                const lineTotal = (() => {
                  if (!item) return 0;
                  if (isAlquiler) return (e.quantity + e.breakage_qty) * item.unit_price;
                  return e.charge_purchase ? e.quantity * item.unit_price : 0;
                })();
                return (
                  <TableRow key={e.id}>
                    <TableCell>
                      <span className="font-medium">{item?.name ?? "—"}</span>
                      {!isAlquiler && !e.charge_purchase && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          (no cargado)
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {isAlquiler ? "Alquiler" : "Compra"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNum(e.quantity)}
                      {e.quantity_manual && (
                        <span
                          className="ml-1 text-xs text-muted-foreground"
                          title="Cantidad editada manualmente"
                        >
                          ✍
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {isAlquiler ? formatNum(e.breakage_qty) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {item ? formatARS(item.unit_price) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatARS(lineTotal)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => {
                            setEditing(e);
                            setDialogOpen(true);
                          }}
                          aria-label="Editar"
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setToDelete(e)}
                          aria-label="Eliminar"
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <EntryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        eventId={event.id}
        pax={event.pax}
        globalMargin={event.vajilla_margin}
        entry={editing}
      />
      <OrderDialog
        open={orderOpen}
        onOpenChange={setOrderOpen}
        eventName={event.name}
        tableware={items}
      />
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Eliminar ítem de vajilla"
        description={`Se eliminará "${toDelete?.item?.name}" del evento.`}
        onConfirm={confirmDelete}
        loading={del.isPending}
      />
    </>
  );
}
