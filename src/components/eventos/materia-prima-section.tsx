"use client";

import { useMemo, useState } from "react";
import { TriangleAlert, Store, Send, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ProviderOrderDialog } from "@/components/eventos/provider-order-dialog";
import {
  buildProviderOrderMessage,
  isSurplusSignificant,
  type MateriaPrimaResult,
  type MPGroup,
  type MPLine,
  type IvaBreakdown,
} from "@/lib/materia-prima";
import { useMarketPriceUpdater, useLeftovers } from "@/lib/hooks";
import { isAutoMarket, marketPriceLabel } from "@/lib/market-price";
import { formatARS, formatDate, formatNum } from "@/lib/format";
import {
  formatQty,
  productsByIngredient,
  usableByProduct,
} from "@/lib/sobrantes";
import {
  isEventLive,
  type EventRow,
  type EventRecipeWithRecipe,
  type IngredientWithProduct,
  type LeftoverWithProduct,
} from "@/lib/types";

/**
 * `mp` viene calculado de afuera: del catálogo vivo si el evento está abierto,
 * o de la foto del cierre si está finalizado. Esta sección no distingue una
 * cosa de la otra, que es lo que garantiza que un evento cerrado muestre
 * exactamente los números con los que se cerró.
 */
export function MateriaPrimaSection({
  event,
  selections,
  mp,
}: {
  event: EventRow;
  selections: EventRecipeWithRecipe[];
  mp: MateriaPrimaResult | null;
}) {
  const ingredientsById = useMemo(() => {
    const map = new Map<string, IngredientWithProduct>();
    for (const sel of selections) {
      for (const item of sel.recipe?.items ?? []) {
        if (item.ingredient) map.set(item.ingredient.id, item.ingredient);
      }
    }
    return map;
  }, [selections]);

  const autoIngredients = useMemo(
    () => [...ingredientsById.values()].filter(isAutoMarket),
    [ingredientsById],
  );

  // Solo mientras el evento está abierto: buscar precios ESCRIBE en la base, y
  // sobre un evento finalizado eso le movía el costo a algo ya cerrado.
  const failed = useMarketPriceUpdater(
    event.id,
    autoIngredients,
    isEventLive(event),
  );

  const [orderGroup, setOrderGroup] = useState<MPGroup | null>(null);

  // AVISO DE SOBRANTES — estrictamente informativo.
  // El sistema NO descuenta estas cantidades: el costo del evento, el pedido al
  // proveedor y el precio por persona salen igual que si no existieran. Es el
  // usuario el que decide qué hacer con el dato.
  const { data: leftovers } = useLeftovers();
  const productByIngredient = useMemo(
    () => productsByIngredient(selections),
    [selections],
  );
  const leftoversByProduct = useMemo(
    () => usableByProduct(leftovers ?? []),
    [leftovers],
  );
  /** Sobrantes disponibles del producto que abastece esta línea. */
  const leftoversForLine = (line: MPLine): LeftoverWithProduct[] => {
    for (const id of line.ingredientIds) {
      const prod = productByIngredient.get(id);
      if (prod) return leftoversByProduct.get(prod.id) ?? [];
    }
    return [];
  };

  // Líneas con sobrante significativo (solo modelo tres capas).
  const surplusLines = useMemo(
    () =>
      (mp?.groups ?? [])
        .flatMap((g) => g.lines)
        .filter(isSurplusSignificant),
    [mp],
  );

  if (!mp) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Calculando…
        </CardContent>
      </Card>
    );
  }

  if (selections.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Elegí el menú para calcular la materia prima.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">
            Costo materia prima
            <div className="text-2xl font-semibold text-foreground">
              {formatARS(mp.total)}
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            Por persona ({event.pax} PAX)
            <div className="text-2xl font-semibold text-primary">
              {formatARS(mp.perPerson)}
            </div>
          </div>
          <IvaBreakdownNote breakdown={mp.ivaBreakdown} />
        </CardContent>
      </Card>

      {mp.problems.length > 0 && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="flex flex-col gap-1 py-4 text-sm">
            <div className="flex items-center gap-2 font-medium text-amber-700">
              <TriangleAlert className="size-4" />
              {mp.problems.length} ingrediente
              {mp.problems.length > 1 ? "s" : ""} sin costear (total parcial)
            </div>
            <ul className="ml-6 list-disc text-amber-700/90">
              {mp.problems.map((p, i) => (
                <li key={i}>
                  {p.ingredientName} — {p.reason}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Alerta informativa de sobrante (color suave, nunca de error) */}
      {surplusLines.length > 0 && (
        <Card className="border-sky-200 bg-sky-50 dark:bg-sky-950/20">
          <CardContent className="flex flex-col gap-1 py-4 text-sm">
            <div className="flex items-center gap-2 font-medium text-sky-700 dark:text-sky-400">
              <Info className="size-4" />
              Sobrante previsto — info para decidir
            </div>
            <ul className="ml-6 list-disc text-sky-700/90 dark:text-sky-400/90">
              {surplusLines.map((l) => (
                <li key={l.ingredientId}>
                  <span className="font-medium">{l.ingredientName}</span>: vas a
                  pedir{" "}
                  <span className="font-medium">
                    {formatNum(l.buyQty)} {l.saleUnit ?? l.buyUnitLabel}
                  </span>{" "}
                  ({formatNum(l.totalBaseQty)} un en total) pero solo necesitás{" "}
                  <span className="font-medium">
                    {formatNum(l.unitsNeeded!)} un
                  </span>
                  . Te sobran{" "}
                  <span className="font-medium">
                    {formatNum(l.surplusUnits!)} un
                  </span>
                  .
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {mp.groups.map((g) => (
        <Card key={g.providerId ?? g.provider} className="overflow-hidden p-0">
          <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-2">
            <span className="flex items-center gap-2 font-medium">
              <Store className="size-4 text-primary" />
              {g.provider}
            </span>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">{formatARS(g.subtotal)}</span>
              {g.providerId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOrderGroup(g)}
                >
                  <Send className="size-4" />
                  Exportar pedido
                </Button>
              )}
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ingrediente</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead className="text-right">Comprar</TableHead>
                <TableHead className="text-right">Precio</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {g.lines.map((l) => {
                const ing = ingredientsById.get(l.ingredientId);
                const label =
                  ing && !l.productName
                    ? marketPriceLabel(ing, failed.has(l.ingredientId))
                    : null;
                return (
                  <TableRow key={l.ingredientId}>
                    <TableCell className="font-medium">
                      {l.ingredientName}
                    </TableCell>
                    <TableCell className="max-w-[260px] truncate text-muted-foreground">
                      {l.productName ?? "precio de mercado"}
                      {label && (
                        <span
                          className={
                            "mt-0.5 block text-xs " +
                            (label.tone === "stale"
                              ? "text-amber-600"
                              : label.tone === "manual"
                                ? "text-muted-foreground"
                                : "text-emerald-600")
                          }
                        >
                          {label.text}
                        </span>
                      )}
                      <LeftoverNote leftovers={leftoversForLine(l)} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <BuyQtyCell line={l} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatARS(l.priceEach)}
                      {l.priceIncludesIva != null && (
                        <span className="mt-0.5 block text-xs">
                          {l.priceIncludesIva ? "c/IVA" : "s/IVA"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatARS(l.subtotal)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      ))}

      <ProviderOrderDialog
        open={!!orderGroup}
        onOpenChange={(o) => !o && setOrderGroup(null)}
        provider={orderGroup?.provider ?? ""}
        phone={orderGroup?.phone ?? null}
        message={
          orderGroup
            ? buildProviderOrderMessage(event.name, event.event_date, orderGroup)
            : ""
        }
      />
    </div>
  );
}

/**
 * Aviso de que hay sobrante disponible de este producto en otro evento.
 *
 * SOLO INFORMATIVO. No descuenta la cantidad, no cambia el costo del evento, no
 * altera el pedido al proveedor ni el precio sugerido por persona: el usuario
 * decide por su cuenta si lo usa. Los sobrantes vencidos ni siquiera llegan acá
 * (`usableByProduct` los filtra), así que nunca se ofrece algo que no sirve.
 *
 * Tono neutro a propósito: no es una alerta, es un dato.
 */
function LeftoverNote({ leftovers }: { leftovers: LeftoverWithProduct[] }) {
  if (leftovers.length === 0) return null;

  // El primero es el que vence antes (usableByProduct los ordena así).
  const [first, ...rest] = leftovers;

  return (
    <span className="mt-1 flex items-start gap-1 text-xs text-sky-700 dark:text-sky-400">
      <Info className="mt-0.5 size-3 shrink-0" />
      <span>
        Hay{" "}
        <span className="font-medium">
          {formatQty(first.qty_remaining, first)}
        </span>{" "}
        de este producto disponible
        {first.origin_event_name && <> (sobrante de {first.origin_event_name}</>}
        {first.origin_event_name && first.expires_at && (
          <>, vence el {formatDate(first.expires_at)}</>
        )}
        {first.origin_event_name && <>)</>}
        {!first.origin_event_name && first.expires_at && (
          <> (vence el {formatDate(first.expires_at)})</>
        )}
        {rest.length > 0 && <> · y {rest.length} sobrante{rest.length > 1 ? "s" : ""} más</>}
      </span>
    </span>
  );
}

/**
 * Desglose informativo del gasto según la base de IVA de cada producto.
 * No cambia el total: solo indica qué parte del costo ya tiene IVA incluido.
 */
function IvaBreakdownNote({ breakdown }: { breakdown: IvaBreakdown }) {
  const parts: string[] = [];
  if (breakdown.withIva > 0) parts.push(`c/IVA ${formatARS(breakdown.withIva)}`);
  if (breakdown.withoutIva > 0)
    parts.push(`sin IVA ${formatARS(breakdown.withoutIva)}`);
  if (breakdown.unknown > 0)
    parts.push(`sin dato ${formatARS(breakdown.unknown)}`);
  if (parts.length === 0) return null;

  return (
    <div className="text-sm text-muted-foreground">
      Base de IVA
      <div className="text-xs">{parts.join(" · ")}</div>
    </div>
  );
}

/**
 * Celda "Comprar" que muestra:
 * - Modelo directo: "X pack Y kg" (comportamiento anterior).
 * - Modelo tres capas: "X caja" con subtexto "Y un necesarias".
 */
function BuyQtyCell({ line }: { line: MPLine }) {
  if (line.unitsNeeded != null && line.unitsPerPack != null) {
    // Tres capas: mostrar cajas + unidades por separado.
    return (
      <div className="flex flex-col items-end gap-0.5">
        <span>
          {formatNum(line.buyQty)} {line.saleUnit ?? line.buyUnitLabel}
        </span>
        <span className="text-xs text-muted-foreground">
          {formatNum(line.unitsNeeded)} un necesarias
        </span>
      </div>
    );
  }
  return (
    <span>
      {formatNum(line.buyQty)} {line.buyUnitLabel}
    </span>
  );
}
