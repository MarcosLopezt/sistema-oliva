"use client";

import { useMemo, useState } from "react";
import Fuse from "fuse.js";
import { toast } from "sonner";
import { Link2Off, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  useLinkIngredientProduct,
} from "@/lib/hooks";
import { formatARS, pricePerBaseUnit, unitLabel } from "@/lib/format";
import type { IngredientWithProduct } from "@/lib/types";

export function ProductLinkDialog({
  open,
  onOpenChange,
  ingredient,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ingredient: IngredientWithProduct | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        {open && ingredient && (
          <LinkForm
            ingredient={ingredient}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function LinkForm({
  ingredient,
  onDone,
}: {
  ingredient: IngredientWithProduct;
  onDone: () => void;
}) {
  const { data: products } = useAllProducts();
  const { data: providers } = useProviders();
  const link = useLinkIngredientProduct();
  const [query, setQuery] = useState(ingredient.name);

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
    if (!q) return (products ?? []).slice(0, 20);
    return fuse.search(q, { limit: 20 }).map((r) => r.item);
  }, [query, fuse, products]);

  async function choose(productId: string | null) {
    try {
      await link.mutateAsync({ ingredientId: ingredient.id, productId });
      toast.success(productId ? "Producto vinculado." : "Vínculo quitado.");
      onDone();
    } catch (e) {
      toast.error("No se pudo vincular", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Vincular “{ingredient.name}”</DialogTitle>
        <DialogDescription>
          Buscá el producto del proveedor que corresponde. Sugerencias ordenadas
          por similitud.
        </DialogDescription>
      </DialogHeader>

      {ingredient.product && (
        <div className="flex items-center justify-between rounded-md border bg-muted/40 p-3 text-sm">
          <div className="min-w-0">
            <span className="text-muted-foreground">Vinculado a: </span>
            <span className="font-medium">{ingredient.product.name}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => choose(null)}
            disabled={link.isPending}
          >
            <Link2Off className="size-4" />
            Quitar
          </Button>
        </div>
      )}

      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar producto…"
        autoFocus
      />

      <div className="max-h-[45vh] overflow-y-auto rounded-md border">
        {results.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            Sin coincidencias. Probá con otras palabras o cargá el producto en el
            proveedor.
          </p>
        ) : (
          <ul className="divide-y">
            {results.map((p) => {
              const isCurrent = ingredient.product_id === p.id;
              return (
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
                    variant={isCurrent ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => choose(p.id)}
                    disabled={link.isPending}
                  >
                    {isCurrent ? <Check className="size-4" /> : "Vincular"}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Cerrar
        </Button>
      </DialogFooter>
    </>
  );
}
