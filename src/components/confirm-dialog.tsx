"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Único diálogo de confirmación del sistema.
 *
 * CRITERIO — se confirma lo DIFÍCIL DE DESHACER, no lo importante:
 *   · eliminar cualquier cosa,
 *   · finalizar o reabrir un evento (arrastra el paso de sobrantes).
 * Lo reversible (pagado/pendiente, activo/inactivo, consumido) NO pasa por
 * acá: se aplica al instante y se ofrece deshacer con `toastUndo`
 * (src/lib/undo.ts). Confirmar todo genera fatiga, el usuario clickea "sí"
 * sin leer y el diálogo deja de proteger justo cuando hace falta.
 *
 * La descripción dice QUÉ VA A PASAR, no "¿estás seguro?".
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  details,
  confirmLabel = "Eliminar",
  loadingLabel = "Eliminando…",
  variant = "destructive",
  onConfirm,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Consecuencia concreta de la acción, en una o dos frases. */
  description: ReactNode;
  /**
   * Bloque opcional debajo de la descripción: listas de elementos afectados,
   * dependencias detectadas, desglose de qué se borra y qué se archiva.
   * Va fuera de <DialogDescription> para poder llevar listas y no anidar
   * bloques dentro de un <p>.
   */
  details?: ReactNode;
  confirmLabel?: string;
  /** Texto del botón mientras la acción corre. */
  loadingLabel?: string;
  /** 'destructive' para borrados; 'default' para cambios de estado. */
  variant?: "destructive" | "default";
  onConfirm: () => void;
  loading?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {details}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant={variant} onClick={onConfirm} disabled={loading}>
            {loading ? loadingLabel : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
