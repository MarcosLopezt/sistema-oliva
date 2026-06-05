import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// En Next.js 16 el antiguo "middleware" se llama "proxy".
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Aplica a todas las rutas salvo:
     * - _next/static, _next/image (assets de Next)
     * - favicon, manifest, service worker, íconos
     * - archivos estáticos comunes (imágenes, fuentes)
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
