# Oliva — Gestión de Eventos

Sistema de costeo de eventos gastronómicos y precio sugerido por persona para
**Oliva Gastronomía**. PWA responsive, stack de costo $0.

> Especificación funcional completa en [`ESPECIFICACION.md`](./ESPECIFICACION.md).

## Stack

- **Next.js 16** (App Router) + **TypeScript**
- **Tailwind v4** + **shadcn/ui**
- **Supabase** (Postgres + Auth + Storage)
- **TanStack Query** (datos + offline)
- **SheetJS / pdfjs-dist** (import de listas de precios), **Fuse.js** (match ingrediente↔producto)
- PWA: manifest + service worker (consulta offline)

## Puesta en marcha

1. Instalar dependencias:
   ```bash
   npm install
   ```
2. Copiar `.env.example` a `.env.local` y completar con las credenciales del
   proyecto Supabase (Dashboard > Project Settings > API):
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   ```
3. Levantar en desarrollo:
   ```bash
   npm run dev
   ```
   → http://localhost:3000 (redirige a `/login` si no hay sesión).

> Los usuarios se crean desde el panel de Supabase (Authentication > Users)
> mientras no exista pantalla de alta. El registro abierto está deshabilitado a propósito.

## Estructura

```
src/
  app/
    (app)/            # rutas autenticadas (con shell: sidebar + header)
      page.tsx        # Dashboard de eventos
      recetas/ proveedores/ ingredientes/ configuracion/
    login/            # pantalla de login (pública)
    layout.tsx        # layout raíz (providers, toasts, service worker)
  components/         # UI (shadcn en components/ui) + componentes de la app
  lib/
    supabase/         # clientes browser / server / middleware
    nav.ts            # secciones de navegación
  middleware.ts       # refresco de sesión + protección de rutas
public/
  manifest.webmanifest, sw.js, icons/   # PWA
referencia/           # material del cliente (no versionado)
```

## Scripts

- `npm run dev` — desarrollo
- `npm run build` — build de producción
- `npm run start` — servir el build
- `npm run lint` — ESLint

## Roadmap (fases)

1. **Setup** ✅ — Next + Supabase + auth + PWA shell
2. Catálogos: proveedores, productos (import Excel/PDF), ingredientes, match fuzzy
3. Recetas (lotes + ingredientes)
4. Evento + Materia Prima (motor de cálculo)
5. Barra (modelo paramétrico → botellas)
6. Personal / Vajilla / Instalación / Extras / Costos adicionales
7. Dashboard (desglose, %, precio sugerido)
8. Offline read + pulido UX
9. Fase 2: generación de propuesta PDF al cliente
