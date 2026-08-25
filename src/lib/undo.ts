"use client";

import { toast } from "sonner";

/**
 * Aviso de "hecho — y se puede deshacer" para los cambios REVERSIBLES.
 *
 * Es la contracara de `ConfirmDialog`: donde el cambio se revierte con un
 * click, pedir confirmación es fricción pura sobre una acción que se repite
 * mucho (marcar pagos uno por uno, por ejemplo). El cambio se aplica al
 * instante y el toast ofrece revertirlo. Cero fricción, sigue siendo
 * recuperable.
 *
 * IMPORTANTE: llamarla DESPUÉS de que el cambio se guardó. `onUndo` tiene que
 * dejar el dato exactamente como estaba antes (guardar el valor previo antes
 * de mutar, no leerlo de la caché después).
 */
export function toastUndo({
  message,
  description,
  onUndo,
  undoneMessage = "Cambio deshecho.",
  duration = 7000,
}: {
  /** Qué se hizo, ya en pasado: "Marcado como pagado." */
  message: string;
  /** Contexto de una línea: sobre qué elemento se hizo. */
  description?: string;
  /** Revierte el cambio. Si falla, se avisa y el dato queda como quedó. */
  onUndo: () => Promise<unknown>;
  /** Confirmación de que la reversión salió bien. */
  undoneMessage?: string;
  /** Ventana para reaccionar. Más corta que esto no llega a leerse. */
  duration?: number;
}) {
  // Una sola reversión por aviso: dos clicks rápidos no deben mandar dos
  // escrituras (la segunda "desharía el deshacer" o pisaría un cambio nuevo).
  let undone = false;

  return toast.success(message, {
    description,
    duration,
    action: {
      label: "Deshacer",
      onClick: () => {
        if (undone) return;
        undone = true;
        void (async () => {
          try {
            await onUndo();
            toast.success(undoneMessage);
          } catch (e) {
            toast.error("No se pudo deshacer", {
              description: e instanceof Error ? e.message : undefined,
            });
          }
        })();
      },
    },
  });
}
