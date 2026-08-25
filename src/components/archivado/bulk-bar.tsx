"use client";

import { Archive, X, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Checkbox de encabezado: selecciona todo LO VISIBLE (respeta los filtros).
 * En estado indeterminado cuando hay algunos seleccionados pero no todos, que
 * es la señal de que "seleccionar todos" va a agregar, no a quitar.
 */
export function SelectAllCheckbox({
  checked,
  indeterminate,
  onToggle,
  disabled,
}: {
  checked: boolean;
  indeterminate: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <input
      type="checkbox"
      className="size-4"
      checked={checked}
      disabled={disabled}
      ref={(el) => {
        if (el) el.indeterminate = indeterminate;
      }}
      onChange={onToggle}
      aria-label="Seleccionar todos los visibles"
    />
  );
}

/** Checkbox de fila. */
export function RowCheckbox({
  checked,
  onToggle,
  label,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <input
      type="checkbox"
      className="size-4"
      checked={checked}
      onChange={onToggle}
      aria-label={`Seleccionar ${label}`}
    />
  );
}

/**
 * Barra de acciones que aparece al haber selección.
 *
 * Sticky abajo: con una tabla larga, una barra al tope se pierde de vista justo
 * cuando el usuario terminó de tildar filas y necesita el botón.
 */
export function BulkActionBar({
  count,
  noun,
  onClear,
  onArchive,
  onUnarchive,
  onDelete,
  busy,
}: {
  count: number;
  /** Cómo se llaman los elementos: "ingrediente" / "ingredientes". */
  noun: { singular: string; plural: string };
  onClear: () => void;
  onArchive?: () => void;
  onUnarchive?: () => void;
  onDelete?: () => void;
  busy?: boolean;
}) {
  if (count === 0) return null;

  return (
    <div className="sticky bottom-4 z-10 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-popover px-4 py-2.5 shadow-lg">
      <span className="text-sm">
        <strong className="tabular-nums">{count}</strong>{" "}
        {count === 1 ? noun.singular : noun.plural}
        <span className="text-muted-foreground"> seleccionado{count === 1 ? "" : "s"}</span>
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onClear} disabled={busy}>
          <X className="size-4" />
          Deseleccionar
        </Button>
        {onUnarchive && (
          <Button variant="outline" size="sm" onClick={onUnarchive} disabled={busy}>
            <RotateCcw className="size-4" />
            Desarchivar
          </Button>
        )}
        {onDelete && (
          <Button variant="destructive" size="sm" onClick={onDelete} disabled={busy}>
            <Trash2 className="size-4" />
            Borrar definitivamente
          </Button>
        )}
        {onArchive && (
          <Button variant="destructive" size="sm" onClick={onArchive} disabled={busy}>
            <Archive className="size-4" />
            Eliminar
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Selector Vigentes / Archivados. Mismo patrón visual que las pestañas de
 * Personal, para no introducir un tercer estilo de tabs en el sistema.
 */
export function ArchiveTabs({
  value,
  onChange,
  archivedCount,
}: {
  value: "vigentes" | "archivados";
  onChange: (v: "vigentes" | "archivados") => void;
  archivedCount?: number;
}) {
  return (
    <div className="inline-flex rounded-md border p-1">
      {(
        [
          ["vigentes", "Vigentes"],
          ["archivados", "Archivados"],
        ] as const
      ).map(([v, labelText]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={
            "rounded px-3 py-1 text-sm font-medium transition-colors " +
            (value === v
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground")
          }
        >
          {labelText}
          {v === "archivados" && archivedCount ? (
            <span className="ml-1.5 text-xs opacity-70">{archivedCount}</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}
