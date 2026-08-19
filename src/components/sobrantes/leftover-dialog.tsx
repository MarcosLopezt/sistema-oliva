"use client";

import { useMemo, useState } from "react";
import Fuse from "fuse.js";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useAllProducts,
  useProviders,
  useCreateLeftover,
  useUpdateLeftover,
} from "@/lib/hooks";
import {
  formatARS,
  formatUnitContent,
  pricePerBaseUnit,
  unitLabel,
} from "@/lib/format";
import {
  computeExpiry,
  displayScale,
  toBaseQty,
  toDisplayQty,
  todayISO,
} from "@/lib/sobrantes";
import type { LeftoverWithProduct, Product } from "@/lib/types";

/**
 * Alta manual y edición de un sobrante.
 *
 * Al EDITAR solo se toca `qty_remaining` (el stock actual), la fecha de
 * vencimiento y la nota. `qty_confirmed` y `qty_calculated` quedan congeladas:
 * son el par que sirve para calibrar la merma y se perderían si se pisaran.
 */
export function LeftoverDialog({
  open,
  onOpenChange,
  leftover,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leftover?: LeftoverWithProduct | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        {open &&
          (leftover ? (
            <EditForm leftover={leftover} onDone={() => onOpenChange(false)} />
          ) : (
            <CreateForm onDone={() => onOpenChange(false)} />
          ))}
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------ Alta manual ------------------------------

function CreateForm({ onDone }: { onDone: () => void }) {
  const { data: products } = useAllProducts();
  const { data: providers } = useProviders();
  const create = useCreateLeftover();

  const [product, setProduct] = useState<Product | null>(null);
  const [query, setQuery] = useState("");
  const [qty, setQty] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [expiryTouched, setExpiryTouched] = useState(false);
  const [note, setNote] = useState("");

  const providerName = useMemo(() => {
    const m = new Map((providers ?? []).map((p) => [p.id, p.name]));
    return (id: string) => m.get(id) ?? "—";
  }, [providers]);

  const fuse = useMemo(
    () =>
      new Fuse(products ?? [], {
        keys: ["name"],
        threshold: 0.45,
        ignoreLocation: true,
        minMatchCharLength: 2,
      }),
    [products],
  );

  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return (products ?? []).slice(0, 15);
    return fuse.search(q, { limit: 15 }).map((r) => r.item);
  }, [query, fuse, products]);

  function choose(p: Product) {
    setProduct(p);
    // Sugerir el vencimiento desde hoy (no hay evento de origen), salvo que el
    // usuario ya haya escrito una fecha a mano.
    if (!expiryTouched) {
      setExpiresAt(computeExpiry(todayISO(), p.leftover_shelf_life_days) ?? "");
    }
  }

  async function handleSave() {
    if (!product) {
      toast.error("Elegí el producto del que sobró.");
      return;
    }
    const display = Number(qty.replace(",", "."));
    if (!Number.isFinite(display) || display <= 0) {
      toast.error("Poné una cantidad mayor a 0.");
      return;
    }
    const base = toBaseQty(display, product);

    try {
      await create.mutateAsync({
        product_id: product.id,
        origin_event_id: null,
        // Carga manual: el sistema no calculó nada, así que no hay con qué
        // comparar. Queda null para que no ensucie la calibración de merma.
        qty_calculated: null,
        qty_confirmed: base,
        qty_remaining: base,
        base_unit: product.base_unit,
        unit_content_value: product.unit_content_value,
        unit_content_unit: product.unit_content_unit,
        purchased_qty: null,
        // Snapshot de precio: irrecuperable si el proveedor actualiza la lista.
        unit_cost: pricePerBaseUnit(product.price, product.pack_size),
        merma_pct: null,
        origin_event_name: null,
        status: "disponible",
        registered_at: todayISO(),
        expires_at: expiresAt || null,
        expiry_manual: expiryTouched,
        note: note.trim() || null,
      });
      toast.success("Sobrante registrado.");
      onDone();
    } catch (e) {
      toast.error("No se pudo guardar", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  const scale = product ? displayScale(product) : null;

  return (
    <>
      <DialogHeader>
        <DialogTitle>Cargar sobrante</DialogTitle>
        <DialogDescription>
          Para sobrantes que no vienen del cierre de un evento. Solo queda
          registrado: no modifica costos ni pedidos.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="lo-product">Producto</Label>
          {product ? (
            <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/40 p-3 text-sm">
              <div className="min-w-0">
                <div className="truncate font-medium">{product.name}</div>
                <div className="text-xs text-muted-foreground">
                  {providerName(product.provider_id)}
                  {formatUnitContent(
                    product.unit_content_value,
                    product.unit_content_unit,
                  ) && (
                    <>
                      {" · "}
                      {formatUnitContent(
                        product.unit_content_value,
                        product.unit_content_unit,
                      )}{" "}
                      c/u
                    </>
                  )}
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setProduct(null)}>
                Cambiar
              </Button>
            </div>
          ) : (
            <>
              <Input
                id="lo-product"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar producto…"
                autoFocus
              />
              <div className="max-h-56 overflow-y-auto rounded-md border">
                {results.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">
                    Sin coincidencias.
                  </p>
                ) : (
                  <ul className="divide-y">
                    {results.map((p) => (
                      <li
                        key={p.id}
                        className="flex items-center justify-between gap-3 p-3 text-sm hover:bg-muted/50"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-medium">{p.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {providerName(p.provider_id)} ·{" "}
                            {formatARS(pricePerBaseUnit(p.price, p.pack_size))} /{" "}
                            {unitLabel(p.base_unit)}
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => choose(p)}
                        >
                          <Check className="size-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>

        {product && (
          <>
            <div className="flex flex-col gap-2">
              <Label htmlFor="lo-qty">
                Cantidad que sobró ({unitLabel(scale!.unit)})
              </Label>
              <Input
                id="lo-qty"
                inputMode="decimal"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                placeholder={scale!.unit === "ml" ? "Ej: 3100" : "Ej: 3,1"}
                className="w-40"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="lo-exp">Vence el</Label>
              <Input
                id="lo-exp"
                type="date"
                value={expiresAt}
                onChange={(e) => {
                  setExpiresAt(e.target.value);
                  setExpiryTouched(true);
                }}
                className="w-48"
              />
              <p className="text-xs text-muted-foreground">
                {product.leftover_shelf_life_days != null
                  ? `Sugerido: hoy + ${product.leftover_shelf_life_days} días de vida útil del producto.`
                  : "Este producto no tiene días de vida útil cargados. Podés poner la fecha a mano o dejarlo vacío."}
              </p>
            </div>
          </>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="lo-note">Nota (opcional)</Label>
          <Textarea
            id="lo-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Dónde quedó guardado, en qué estado, etc."
            rows={2}
          />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button onClick={handleSave} disabled={create.isPending}>
          {create.isPending ? "Guardando…" : "Guardar"}
        </Button>
      </DialogFooter>
    </>
  );
}

// -------------------------------- Edición --------------------------------

function EditForm({
  leftover,
  onDone,
}: {
  leftover: LeftoverWithProduct;
  onDone: () => void;
}) {
  const update = useUpdateLeftover();
  const scale = displayScale(leftover);

  const [qty, setQty] = useState(
    String(Number(toDisplayQty(leftover.qty_remaining, leftover).toFixed(4))),
  );
  const [expiresAt, setExpiresAt] = useState(leftover.expires_at ?? "");
  const [note, setNote] = useState(leftover.note ?? "");

  async function handleSave() {
    const display = Number(qty.replace(",", "."));
    if (!Number.isFinite(display) || display < 0) {
      toast.error("Cantidad inválida.");
      return;
    }
    const base = toBaseQty(display, leftover);
    const expiryChanged = (expiresAt || null) !== leftover.expires_at;

    try {
      await update.mutateAsync({
        id: leftover.id,
        eventId: leftover.origin_event_id,
        input: {
          // Solo el stock actual. qty_confirmed y qty_calculated NO se tocan.
          qty_remaining: base,
          expires_at: expiresAt || null,
          // Si el usuario cambió la fecha, queda marcada como manual para que
          // ningún recálculo futuro la pise.
          ...(expiryChanged ? { expiry_manual: true } : {}),
          note: note.trim() || null,
        },
      });
      toast.success("Sobrante actualizado.");
      onDone();
    } catch (e) {
      toast.error("No se pudo guardar", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{leftover.product?.name ?? "Sobrante"}</DialogTitle>
        <DialogDescription>
          Ajustá el stock si se consumió parte fuera de un evento.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="lo-edit-qty">
            Cantidad restante ({unitLabel(scale.unit)})
          </Label>
          <Input
            id="lo-edit-qty"
            inputMode="decimal"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="w-40"
            autoFocus
          />
          <p className="text-xs text-muted-foreground">
            Al registrarse quedaron{" "}
            {Number(toDisplayQty(leftover.qty_confirmed, leftover).toFixed(4))}{" "}
            {unitLabel(scale.unit)}. Ese valor no cambia: sirve para comparar
            contra lo que había calculado el sistema.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="lo-edit-exp">Vence el</Label>
          <Input
            id="lo-edit-exp"
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="w-48"
          />
          {!leftover.expires_at && (
            <p className="text-xs text-muted-foreground">
              Sin vida útil definida. Cargá los días en la ficha del producto
              para que se calcule solo, o poné la fecha a mano acá.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="lo-edit-note">Nota (opcional)</Label>
          <Textarea
            id="lo-edit-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
          />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button onClick={handleSave} disabled={update.isPending}>
          {update.isPending ? "Guardando…" : "Guardar"}
        </Button>
      </DialogFooter>
    </>
  );
}
