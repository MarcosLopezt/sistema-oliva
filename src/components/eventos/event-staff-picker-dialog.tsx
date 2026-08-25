"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/native-select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RateOriginBadge } from "@/components/personal/rate-origin";
import { useAddEventStaffBulk, useStaffRoles } from "@/lib/hooks";
import { resolveStaffRate } from "@/lib/personal";
import { formatARS } from "@/lib/format";
import {
  STAFF_CATEGORIES,
  staffCategoryLabel,
  type StaffWithRole,
} from "@/lib/types";

/** Sin acentos y en minúscula, para que "Perez" encuentre a "Pérez". */
function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function parseHours(raw: string): number {
  if (!raw.trim()) return 0;
  return Number(raw.replace(",", "."));
}

export function EventStaffPickerDialog({
  open,
  onOpenChange,
  eventId,
  available,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  /** Empleados activos que todavía no están en el evento. */
  available: StaffWithRole[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        {open && (
          <Picker
            eventId={eventId}
            available={available}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function Picker({
  eventId,
  available,
  onDone,
}: {
  eventId: string;
  available: StaffWithRole[];
  onDone: () => void;
}) {
  const addBulk = useAddEventStaffBulk();
  const { data: roles } = useStaffRoles();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [roleId, setRoleId] = useState("all");

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkHours, setBulkHours] = useState("");
  /** Horas por empleado; solo las de los que se editaron a mano. */
  const [hours, setHours] = useState<Record<string, string>>({});

  const visible = useMemo(() => {
    const term = fold(search.trim());
    return available.filter((s) => {
      if (category !== "all" && s.category !== category) return false;
      if (roleId !== "all" && (s.role_id ?? "") !== roleId) return false;
      if (term && !fold(s.full_name).includes(term)) return false;
      return true;
    });
  }, [available, search, category, roleId]);

  /** Las horas de alguien: las suyas si las tocó, si no las del campo masivo. */
  function hoursOf(id: string): string {
    return hours[id] ?? bulkHours;
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll(ids: string[]) {
    setSelected((prev) => new Set([...prev, ...ids]));
  }

  const selectedList = useMemo(
    () => available.filter((s) => selected.has(s.id)),
    [available, selected],
  );

  const total = useMemo(
    () =>
      selectedList.reduce((sum, s) => {
        const h = parseHours(hoursOf(s.id));
        return sum + (Number.isFinite(h) ? h * resolveStaffRate(s).rate : 0);
      }, 0),
    // hoursOf depende de hours y bulkHours
    [selectedList, hours, bulkHours], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const allVisibleSelected =
    visible.length > 0 && visible.every((s) => selected.has(s.id));

  async function handleConfirm() {
    if (selectedList.length === 0) {
      toast.error("No seleccionaste a nadie.");
      return;
    }
    const inputs = [];
    for (const s of selectedList) {
      const h = parseHours(hoursOf(s.id));
      if (!Number.isFinite(h) || h < 0) {
        toast.error(`Horas inválidas en ${s.full_name}.`);
        return;
      }
      // rate_override y role_id en null: que la tarifa se herede de la
      // jerarquía. Congelarla acá marcaría todas las filas como "ajustada".
      inputs.push({ staff_id: s.id, hours: h, rate_override: null, role_id: null });
    }
    try {
      await addBulk.mutateAsync({ eventId, inputs });
      toast.success(
        inputs.length === 1
          ? "Empleado agregado al evento."
          : `${inputs.length} empleados agregados al evento.`,
      );
      onDone();
    } catch (e) {
      toast.error("No se pudo agregar", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Agregar personal al evento</DialogTitle>
        <DialogDescription>
          Marcá a todos los que participan y cargá las horas de una. La tarifa
          se hereda del rol o del empleado; después se puede ajustar fila por
          fila.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-40 flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre…"
            className="pl-9"
            autoFocus
          />
        </div>
        <NativeSelect
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-40"
          aria-label="Filtrar por categoría"
        >
          <option value="all">Todas las categorías</option>
          {STAFF_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          value={roleId}
          onChange={(e) => setRoleId(e.target.value)}
          className="w-40"
          aria-label="Filtrar por rol"
        >
          <option value="all">Todos los roles</option>
          <option value="">Sin rol</option>
          {(roles ?? []).map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground">Selección rápida:</span>
        {STAFF_CATEGORIES.map((c) => (
          <Button
            key={c.value}
            variant="outline"
            size="sm"
            onClick={() =>
              selectAll(
                available.filter((s) => s.category === c.value).map((s) => s.id),
              )
            }
          >
            Todos los de {c.label}
          </Button>
        ))}
        <Button
          variant="outline"
          size="sm"
          onClick={() => selectAll(visible.map((s) => s.id))}
          disabled={allVisibleSelected}
        >
          Seleccionar los {visible.length} visibles
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelected(new Set())}
          disabled={selected.size === 0}
        >
          Limpiar
        </Button>
      </div>

      <div className="flex items-end gap-3 rounded-md bg-muted/40 px-3 py-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="bulk-hours" className="text-xs">
            Horas para todos los seleccionados
          </Label>
          <Input
            id="bulk-hours"
            inputMode="decimal"
            value={bulkHours}
            onChange={(e) => setBulkHours(e.target.value)}
            placeholder="Ej: 5"
            className="h-8 w-28"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setHours({})}
          disabled={Object.keys(hours).length === 0}
          title="Descarta los ajustes individuales de horas"
        >
          Aplicar a todos
        </Button>
        <p className="pb-1 text-xs text-muted-foreground">
          Se aplica a todos menos a los que hayas cambiado a mano.
        </p>
      </div>

      <div className="max-h-[38vh] overflow-y-auto rounded-md border">
        {visible.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            {available.length === 0
              ? "No quedan empleados activos sin asignar a este evento."
              : "Ningún empleado coincide con el filtro."}
          </p>
        ) : (
          <ul className="divide-y">
            {visible.map((s) => {
              const isSel = selected.has(s.id);
              const resolved = resolveStaffRate(s);
              const h = parseHours(hoursOf(s.id));
              return (
                <li
                  key={s.id}
                  className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted/50"
                >
                  <input
                    type="checkbox"
                    checked={isSel}
                    onChange={() => toggle(s.id)}
                    className="size-4 shrink-0"
                    aria-label={`Seleccionar ${s.full_name}`}
                    id={`pick-${s.id}`}
                  />
                  <label
                    htmlFor={`pick-${s.id}`}
                    className="min-w-0 flex-1 cursor-pointer"
                  >
                    <div className="truncate font-medium">{s.full_name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {s.staff_role?.name ?? "sin rol"} ·{" "}
                      {staffCategoryLabel(s.category)}
                    </div>
                  </label>
                  <div className="flex shrink-0 flex-col items-end gap-0.5">
                    <span className="tabular-nums">
                      {formatARS(resolved.rate)}/h
                    </span>
                    <RateOriginBadge
                      resolved={resolved}
                      className="h-4 px-1.5 text-[10px]"
                    />
                  </div>
                  <Input
                    inputMode="decimal"
                    value={hoursOf(s.id)}
                    onChange={(e) =>
                      setHours((prev) => ({ ...prev, [s.id]: e.target.value }))
                    }
                    placeholder="hs"
                    disabled={!isSel}
                    aria-label={`Horas de ${s.full_name}`}
                    className="h-8 w-16 shrink-0 text-right"
                  />
                  <span className="w-24 shrink-0 text-right tabular-nums text-muted-foreground">
                    {isSel && Number.isFinite(h)
                      ? formatARS(h * resolved.rate)
                      : "—"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <DialogFooter className="items-center sm:justify-between">
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="size-4" />
          {selected.size} seleccionado{selected.size === 1 ? "" : "s"} ·{" "}
          <span className="font-semibold text-foreground tabular-nums">
            {formatARS(total)}
          </span>
        </span>
        <span className="flex gap-2">
          <Button variant="outline" onClick={onDone}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={addBulk.isPending || selected.size === 0}
          >
            {addBulk.isPending
              ? "Agregando…"
              : `Agregar ${selected.size || ""}`.trim()}
          </Button>
        </span>
      </DialogFooter>
    </>
  );
}
