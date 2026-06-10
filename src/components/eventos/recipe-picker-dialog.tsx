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
import { useRecipes } from "@/lib/hooks";
import type { EventRecipeRole, RecipeListRow } from "@/lib/types";

const ROLE_TITLE: Record<EventRecipeRole, string> = {
  bocado: "Agregar bocado",
  principal: "Agregar plato principal",
  principal_veggie: "Agregar principal veggie",
  postre: "Agregar postre",
};

function matchesRole(r: RecipeListRow, role: EventRecipeRole): boolean {
  if (role === "bocado") return r.category === "bocado";
  if (role === "postre") return r.category === "postre";
  if (role === "principal") return r.category === "principal" && !r.is_veggie;
  if (role === "principal_veggie")
    return r.category === "principal" && r.is_veggie;
  return false;
}

export function RecipePickerDialog({
  open,
  onOpenChange,
  role,
  excludeIds,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: EventRecipeRole;
  excludeIds: string[];
  onPick: (recipeId: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {open && (
          <Picker
            role={role}
            excludeIds={excludeIds}
            onPick={(id) => {
              onPick(id);
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
  role,
  excludeIds,
  onPick,
  onClose,
}: {
  role: EventRecipeRole;
  excludeIds: string[];
  onPick: (recipeId: string) => void;
  onClose: () => void;
}) {
  const { data: recipes } = useRecipes();
  const [query, setQuery] = useState("");

  const available = useMemo(
    () =>
      (recipes ?? []).filter(
        (r) => matchesRole(r, role) && !excludeIds.includes(r.id),
      ),
    [recipes, role, excludeIds],
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
        <DialogTitle>{ROLE_TITLE[role]}</DialogTitle>
        <DialogDescription>
          Elegí una receta del catálogo para sumarla al menú.
        </DialogDescription>
      </DialogHeader>

      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar receta…"
        autoFocus
      />

      <div className="max-h-[45vh] overflow-y-auto rounded-md border">
        {results.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            No hay recetas para esta categoría. Cargalas en la sección Recetas
            (recordá marcar “veggie” en los principales vegetarianos).
          </p>
        ) : (
          <ul className="divide-y">
            {results.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 p-3 text-sm hover:bg-muted/50"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{r.name}</div>
                  {r.subcategory && (
                    <div className="text-xs text-muted-foreground">
                      {r.subcategory}
                    </div>
                  )}
                </div>
                <Button variant="outline" size="sm" onClick={() => onPick(r.id)}>
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
