"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RecipePickerDialog } from "@/components/eventos/recipe-picker-dialog";
import { useAddEventRecipe, useRemoveEventRecipe } from "@/lib/hooks";
import { selectionUnits } from "@/lib/materia-prima";
import { formatNum } from "@/lib/format";
import type {
  EventRow,
  EventRecipeRole,
  EventRecipeWithRecipe,
} from "@/lib/types";

const ROLES: { role: EventRecipeRole; label: string; hint: string }[] = [
  { role: "bocado", label: "Bocados", hint: "El cliente suele elegir ~6 variedades." },
  { role: "principal", label: "Plato principal", hint: "Opción no vegetariana." },
  { role: "principal_veggie", label: "Principal veggie", hint: "Opción vegetariana." },
  { role: "postre", label: "Postre", hint: "Suele ser uno." },
];

export function MenuSelection({
  event,
  selections,
}: {
  event: EventRow;
  selections: EventRecipeWithRecipe[];
}) {
  const add = useAddEventRecipe();
  const remove = useRemoveEventRecipe();
  const [pickerRole, setPickerRole] = useState<EventRecipeRole | null>(null);

  const unitsById = new Map(
    selectionUnits(event, selections).map((s) => [s.eventRecipeId, s.units]),
  );

  async function handleAdd(recipeId: string) {
    if (!pickerRole) return;
    try {
      await add.mutateAsync({ eventId: event.id, recipeId, role: pickerRole });
    } catch (e) {
      toast.error("No se pudo agregar", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  async function handleRemove(id: string) {
    try {
      await remove.mutateAsync({ id, eventId: event.id });
    } catch (e) {
      toast.error("No se pudo quitar", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-5">
        <h2 className="font-medium">Menú elegido</h2>

        {ROLES.map(({ role, label, hint }) => {
          const items = selections.filter((s) => s.role === role);
          return (
            <div key={role} className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium">{label}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {hint}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPickerRole(role)}
                >
                  <Plus className="size-4" />
                  Agregar
                </Button>
              </div>

              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground">— sin elegir —</p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {items.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center gap-2 rounded-md border bg-muted/40 py-1 pr-1 pl-3 text-sm"
                    >
                      <span>{s.recipe?.name ?? "—"}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatNum(unitsById.get(s.id) ?? 0)} u
                      </span>
                      <button
                        onClick={() => handleRemove(s.id)}
                        className="rounded p-0.5 text-muted-foreground hover:bg-background hover:text-destructive"
                        aria-label="Quitar"
                      >
                        <X className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </CardContent>

      <RecipePickerDialog
        open={pickerRole !== null}
        onOpenChange={(o) => !o && setPickerRole(null)}
        role={pickerRole ?? "bocado"}
        excludeIds={selections.map((s) => s.recipe_id)}
        onPick={handleAdd}
      />
    </Card>
  );
}
