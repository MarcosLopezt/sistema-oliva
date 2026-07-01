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
  computeMateriaPrima,
  buildProviderOrderMessage,
  isSurplusSignificant,
  type MPGroup,
  type MPLine,
} from "@/lib/materia-prima";
import { useMarketPriceUpdater } from "@/lib/hooks";
import { isAutoMarket, marketPriceLabel } from "@/lib/market-price";
import { formatARS, formatNum } from "@/lib/format";
import type {
  EventRow,
  EventRecipeWithRecipe,
  IngredientWithProduct,
} from "@/lib/types";

export function MateriaPrimaSection({
  event,
  selections,
}: {
  event: EventRow;
  selections: EventRecipeWithRecipe[];
}) {
  const mp = useMemo(
    () => computeMateriaPrima(event, selections),
    [event, selections],
  );

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

  const failed = useMarketPriceUpdater(event.id, autoIngredients);

  const [orderGroup, setOrderGroup] = useState<MPGroup | null>(null);

  // Líneas con sobrante significativo (solo modelo tres capas).
  const surplusLines = useMemo(
    () =>
      mp.groups
        .flatMap((g) => g.lines)
        .filter(isSurplusSignificant),
    [mp.groups],
  );

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
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <BuyQtyCell line={l} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatARS(l.priceEach)}
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
