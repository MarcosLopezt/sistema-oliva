"use client";

import { useMemo } from "react";
import { TriangleAlert, Store } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { computeMateriaPrima } from "@/lib/materia-prima";
import { formatARS, formatNum } from "@/lib/format";
import type { EventRow, EventRecipeWithRecipe } from "@/lib/types";

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

      {mp.groups.map((g) => (
        <Card key={g.provider} className="overflow-hidden p-0">
          <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-2">
            <span className="flex items-center gap-2 font-medium">
              <Store className="size-4 text-primary" />
              {g.provider}
            </span>
            <span className="text-sm font-medium">{formatARS(g.subtotal)}</span>
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
              {g.lines.map((l) => (
                <TableRow key={l.ingredientId}>
                  <TableCell className="font-medium">{l.ingredientName}</TableCell>
                  <TableCell className="max-w-[260px] truncate text-muted-foreground">
                    {l.productName ?? "precio de mercado"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNum(l.buyQty)} {l.buyUnitLabel}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatARS(l.priceEach)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatARS(l.subtotal)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ))}
    </div>
  );
}
