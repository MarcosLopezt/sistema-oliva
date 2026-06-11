"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BarSettingsCard } from "@/components/configuracion/bar-settings-card";
import { BeverageDialog } from "@/components/configuracion/beverage-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  useBarSettings,
  useBarBeverages,
  useDeleteBarBeverage,
  useUpdateBarBeverage,
  useBeverageMarketPriceUpdater,
} from "@/lib/hooks";
import { beverageMarketLabel, fetchMarketPrice } from "@/lib/market-price";
import { formatARS, formatNum } from "@/lib/format";
import type { BarBeverage } from "@/lib/types";

export default function ConfiguracionPage() {
  const { data: settings, isLoading } = useBarSettings();
  const { data: beverages } = useBarBeverages();
  const del = useDeleteBarBeverage();
  const updateBev = useUpdateBarBeverage();
  // Actualiza en background el precio de las bebidas con búsqueda automática
  // (al activar el flag acá mismo se refresca el precio sin abrir un evento).
  const failed = useBeverageMarketPriceUpdater(beverages ?? []);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BarBeverage | null>(null);
  const [toDelete, setToDelete] = useState<BarBeverage | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Fuerza la re-búsqueda del precio de mercado de todas las bebidas auto
  // (ignora el vencimiento de 7 días; respeta las de precio manual).
  async function refreshPrices() {
    const autos = (beverages ?? []).filter(
      (b) => b.market_auto && b.market_price_source !== "manual",
    );
    if (autos.length === 0) {
      toast.info("No hay bebidas con búsqueda automática activada.");
      return;
    }
    setRefreshing(true);
    let ok = 0;
    let fail = 0;
    for (const b of autos) {
      const price = await fetchMarketPrice(b.name, { sizeMl: b.size_ml });
      if (price == null) {
        fail++;
        continue;
      }
      try {
        await updateBev.mutateAsync({
          id: b.id,
          input: {
            price,
            market_price_source: "auto",
            market_price_updated_at: new Date().toISOString(),
          },
        });
        ok++;
      } catch {
        fail++;
      }
    }
    setRefreshing(false);
    toast.success(`Precios actualizados: ${ok}.` + (fail ? ` Sin resultado: ${fail}.` : ""));
  }

  async function confirmDelete() {
    if (!toDelete) return;
    try {
      await del.mutateAsync(toDelete.id);
      toast.success("Bebida eliminada.");
      setToDelete(null);
    } catch (e) {
      toast.error("No se pudo eliminar", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-primary">Configuración</h1>
        <p className="text-muted-foreground">
          Parámetros de la barra: factores de consumo y catálogo de bebidas.
        </p>
      </div>

      {isLoading || !settings ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : (
        <BarSettingsCard settings={settings} />
      )}

      <section>
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-primary">
              Bebidas de la barra
            </h2>
            <p className="text-sm text-muted-foreground">
              Consumo (ml/persona/hora), tamaño de botella y precio.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={refreshPrices}
              disabled={refreshing}
            >
              <RefreshCw
                className={"size-4" + (refreshing ? " animate-spin" : "")}
              />
              {refreshing ? "Actualizando…" : "Actualizar precios"}
            </Button>
            <Button
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="size-4" />
              Nueva bebida
            </Button>
          </div>
        </div>

        {!beverages || beverages.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            Sin bebidas cargadas.
          </Card>
        ) : (
          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bebida</TableHead>
                  <TableHead>Servicio</TableHead>
                  <TableHead className="text-right">Botella</TableHead>
                  <TableHead className="text-right">ml/pers/h</TableHead>
                  <TableHead className="text-right">Precio</TableHead>
                  <TableHead className="w-px text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {beverages.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {b.service === "ambos"
                          ? "Ambos"
                          : b.service === "con_alcohol"
                            ? "Con alcohol"
                            : "Sin alcohol"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNum(b.size_ml)} ml
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNum(b.ml_per_person_hour)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {b.price > 0 ? (
                        formatARS(b.price)
                      ) : b.market_auto ? (
                        <span className="text-muted-foreground">buscando…</span>
                      ) : (
                        <span className="text-amber-600">sin precio</span>
                      )}
                      {(() => {
                        const label = beverageMarketLabel(b, failed.has(b.id));
                        return label ? (
                          <span
                            className={
                              "mt-0.5 block text-xs font-normal " +
                              (label.tone === "stale"
                                ? "text-amber-600"
                                : label.tone === "manual"
                                  ? "text-muted-foreground"
                                  : "text-emerald-600")
                            }
                          >
                            {label.text}
                          </span>
                        ) : null;
                      })()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => {
                            setEditing(b);
                            setDialogOpen(true);
                          }}
                          aria-label="Editar"
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setToDelete(b)}
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
        )}
      </section>

      <BeverageDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        beverage={editing}
      />
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Eliminar bebida"
        description={`Se eliminará "${toDelete?.name}".`}
        onConfirm={confirmDelete}
        loading={del.isPending}
      />
    </div>
  );
}
