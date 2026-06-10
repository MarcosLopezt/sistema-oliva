"use client";

import { useMemo, useState } from "react";
import Fuse from "fuse.js";
import { Plus } from "lucide-react";
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
import { useIngredients } from "@/lib/hooks";
import { unitLabel } from "@/lib/format";
import type { IngredientWithProduct } from "@/lib/types";

export function IngredientPickerDialog({
  open,
  onOpenChange,
  excludeIds,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  excludeIds: string[];
  onPick: (ingredient: IngredientWithProduct) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {open && (
          <Picker
            excludeIds={excludeIds}
            onPick={(ing) => {
              onPick(ing);
              onOpenChange(false);
            }}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function Picker({
  excludeIds,
  onPick,
  onClose,
}: {
  excludeIds: string[];
  onPick: (ingredient: IngredientWithProduct) => void;
  onClose: () => void;
}) {
  const { data: ingredients } = useIngredients();
  const [query, setQuery] = useState("");

  const available = useMemo(
    () => (ingredients ?? []).filter((i) => !excludeIds.includes(i.id)),
    [ingredients, excludeIds],
  );

  const fuse = useMemo(
    () =>
      new Fuse(available, {
        keys: ["name"],
        threshold: 0.45,
        ignoreLocation: true,
        minMatchCharLength: 2,
      }),
    [available],
  );

  const results = useMemo(() => {
    const qq = query.trim();
    if (!qq) return available;
    return fuse.search(qq, { limit: 30 }).map((r) => r.item);
  }, [query, fuse, available]);

  return (
    <>
      <DialogHeader>
        <DialogTitle>Agregar ingrediente</DialogTitle>
        <DialogDescription>
          Buscá un ingrediente del catálogo para sumarlo a la receta.
        </DialogDescription>
      </DialogHeader>

      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar ingrediente…"
        autoFocus
      />

      <div className="max-h-[45vh] overflow-y-auto rounded-md border">
        {results.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            Sin ingredientes disponibles. Crealos en la sección Ingredientes.
          </p>
        ) : (
          <ul className="divide-y">
            {results.map((ing) => (
              <li
                key={ing.id}
                className="flex items-center justify-between gap-3 p-3 text-sm hover:bg-muted/50"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{ing.name}</div>
                  <div className="text-xs text-muted-foreground">
                    en {unitLabel(ing.base_unit)}
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => onPick(ing)}>
                  <Plus className="size-4" />
                  Agregar
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cerrar
        </Button>
      </DialogFooter>
    </>
  );
}
