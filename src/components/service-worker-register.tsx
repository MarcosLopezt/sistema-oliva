"use client";

import { useEffect } from "react";

/**
 * Registra el service worker para habilitar la PWA y la consulta offline.
 * Solo en producción para no interferir con el hot-reload en desarrollo.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (
      process.env.NODE_ENV === "production" &&
      "serviceWorker" in navigator
    ) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Falla silenciosa: la app sigue funcionando sin offline.
      });
    }
  }, []);

  return null;
}
