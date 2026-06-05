# Oliva Gastronomía — Sistema de Gestión de Eventos

> Documento de especificación y arquitectura. Estado: **requerimientos cerrados, listo para construir.**
> Fecha: 2026-06-04.

## 1. Objetivo

Sistema para presupuestar eventos gastronómicos: a partir de un menú elegido y la
cantidad de invitados (PAX), calcula el **costo interno total** desglosado por sección
y sugiere un **precio por persona** a cobrar. Reemplaza el Google Sheets actual
(desordenado) por una herramienta clara, guiada y precisa.

**Alcance v1:** solo costeo interno + precio sugerido. **No** se trackean ingresos,
cobranzas ni medios de pago.

## 2. Perfil de uso

- **Usuarios:** 2-4 personas con login (dueño + cocinera/encargado). Datos compartidos en la nube.
- **Dispositivos:** PC y celular por igual → PWA responsive.
- **Offline:** consulta offline (ver eventos/listas ya cargados sin señal). Editar requiere conexión.
- **Restricción dura:** deploy y operación a **costo $0**.

## 3. Estructura del evento

Un evento tiene: nombre, fecha, PAX, duración (horas, default 5), estado
(`activo` / `finalizado`), categoría de día y horario (para la barra), y margen de
ganancia (%) elegido por el usuario.

- Eventos ordenados por **proximidad de fecha** (el más cercano primero).
- Secciones separadas: **activos** y **finalizados**. Historial completo.
- Múltiples eventos simultáneos.

### Dashboard del evento
Costo total desglosado por sección con su % sobre el total, y total final:
Materia Prima · Barra · Vajilla · Personal · Instalación · Extras.
Más: PAX, costo por persona, margen %, **precio sugerido por persona**, y
**costos adicionales** (líneas aparte, no entran en el precio por persona).

## 4. Menú y elección del cliente

El cliente elige sobre una propuesta:
- **Bocados:** ~6 variedades, agrupadas en categorías (Pesca, Proteínas, Vegetales/Sopas, Picaditas/Tapeo).
- **Plato principal:** 1 opción + 1 opción veggie.
- **Postre:** 1.
- **Torta de celebración:** servicio adicional con precio fijo → va a *Costos adicionales*.
- **Barra:** con o sin alcohol (sección propia, ver §6).

## 5. Sección Materia Prima

### Recetas
Cada receta rinde un **lote de N unidades** (bocado / plato / postre) y lista sus
ingredientes con cantidad + unidad. El cálculo escala la receta proporcionalmente:
`ingrediente_necesario = ingrediente_receta × (unidades_necesarias / N_lote)`.

### Ratios por persona (defaults editables por evento)
- **Bocados:** `2 × PAX` unidades por cada variedad elegida.
- **Principal:** `PAX + 10` platos, de los cuales **30% veggie** y el resto normal.
- **Postre:** `1 × PAX`.

### Reglas de costeo
- **Merma:** +15% automático sobre cantidades (editable).
- **Redondeo a unidad de venta del proveedor:** si necesito 1,5 L y se vende en 3 L → se cobra/compra 3 L.
- **Ingredientes sin proveedor fijo:** precio de referencia ingresado a mano por el usuario (con fecha de última actualización).
- **Cantidades exactas:** el usuario carga equivalencias exactas (kg por caja/bolsón/penca, etc.). El sistema no maneja "a ojo".

### Listas de precios de proveedores
- Formatos reales: **Excel** (ej. Cabañas: tabla limpia `Código·Nombre·Unidad·Peso aprox·Precio s/IVA·Precio c/IVA·EAN`) y **PDF** (ej. El Criollo: layout a 2 columnas, nombres partidos → frágil).
- Importación: Excel = mapeo de columnas directo. PDF = parseo + **pantalla de revisión** para corregir antes de guardar.
- Se actualizan cada ~2 meses.
- **Cambio de proveedor por ingrediente** soportado.
- Salida: **lista de ingredientes a pedir por proveedor**.

### Match ingrediente ↔ producto del proveedor
1. **Fuzzy matching** (similitud tipo Fuse.js) tolerante a errores de tipeo.
2. **Mapeo persistente:** la vinculación se guarda y se reutiliza (trabajo manual una sola vez; al actualizar precios queda re-enlazado).
3. **Confirmación asistida:** "¿Quisiste decir…?" con los 3 candidatos más parecidos.
4. IA por API = mejora futura opcional (tiene costo, va contra el $0).

## 6. Sección Barra

Output: **lista de botellas a comprar por cada bebida** + costo estimado global.

### Cartas
- **Sin alcohol:** Coca Zero, Coca regular, Sprite, agua con/sin gas.
- **Con alcohol (tragos):** Gin Tonic (Gordons), Vermouth Martini Rosso, Campari, Cynar Julep, Fernet, Aperol Spritz, cervezas (Corona, 0.0); con mixers (tónica, soda, Coca) y garnishes (pepino, limón, lima, naranja, pomelo, hierbas).

### Modelo de cálculo (todos los valores = defaults editables)
```
bebidas_totales = PAX × consumo_base × horas × factor_día × factor_horario
```
- **consumo_base:** bebidas por persona por hora.
- **factor_horario:** mediodía / cena / nocturno.
- **factor_día:** semana (dom-mié) / jueves / viernes-sábado. (jue>semana, vie-sáb>jue).
- El total se reparte por **mix %** entre las bebidas, y cada trago tiene una
  **mini-receta** (ml de alcohol + mixer + garnish) para convertir a **botellas a comprar**.

## 7. Sección Personal

Dos lógicas:
- **Personal del evento:** por **zona** (Cocina, Camareros, Barra/Caja, Limpieza),
  con nombre, categoría/nivel, entrada/salida, horas, pago por hora → costo por empleado.
- **Planta de producción:** grilla semanal (días) con personas, pago por hora, total horas.

Carga por tipo (producción / servicio): horas, cantidad de personas, pago por hora.
Detalle de pago por empleado (nombre + monto), con costo diferenciado por nivel.

## 8. Sección Vajilla

- Pedido de vajilla (platos, vasos, cubiertos, etc.).
- Precios desde Excel/PDF del proveedor.
- Cálculo de gasto según pedido. Campo de **pérdidas/roturas**.

## 9. Sección Instalación / Planta

- Costos fijos de la planta.
- Horas de uso × precio por hora (precio varía periódicamente).

## 10. Sección Extras (costos internos)

Costos libres internos de Oliva (nafta, hielo, etc.). Carga manual.
**Entran** en el costo del evento → afectan el precio por persona.

## 11. Sección Costos Adicionales (cara al cliente)

Productos/servicios cobrados al cliente **por separado** (ej. torta $150.000).
El usuario ingresa el precio. **No** entran en el precio por persona; se muestran
como línea aparte en la cotización. Distinto de *Extras* (que son costos internos).

## 12. Precio sugerido

```
costo_total_interno = Σ secciones (MP + Barra + Vajilla + Personal + Instalación + Extras)
costo_por_persona   = costo_total_interno / PAX
precio_por_persona  = costo_por_persona × (1 + margen%)   // margen elegido por el usuario por evento
```
Costos adicionales se suman aparte, fuera del precio por persona.

## 13. Datos iniciales

Histórico arranca de cero. Recetas estandarizadas (~5 menús por cuatrimestre) y
listas de precios se cargan cuando estén listas.

---

## 14. Arquitectura técnica (stack $0)

### Tipo de solución: PWA responsive

| Capa | Tecnología | Por qué / costo |
|---|---|---|
| Frontend | **Next.js (React) + TypeScript** | PWA, deploy gratis en Vercel, un solo código PC+celular |
| UI | **Tailwind CSS + shadcn/ui** | UI limpia y simple rápido, apta para usuario no técnico |
| Estado/datos | **TanStack Query** con persistencia local | Cache + **consulta offline** (IndexedDB) |
| PWA / offline | **Service Worker (Workbox / next-pwa)** | "Instalar" en escritorio/celu + cache de lectura |
| Backend + DB | **Supabase** (Postgres + Auth + Storage) | Free tier: auth 2-4 users, DB 500MB, storage 1GB. Sin servidor propio |
| Auth | **Supabase Auth** (email/password) | Login simple para 2-4 usuarios |
| Parseo Excel | **SheetJS (xlsx)** en el navegador | Lee .xls y .xlsx, gratis, sin servidor |
| Parseo PDF | **pdfjs-dist** + pantalla de revisión | Extrae texto; los PDF frágiles se revisan a mano |
| Fuzzy match | **Fuse.js** (cliente) | Match ingrediente↔producto, gratis, offline |
| Generación PDF propuesta (Fase 2) | **@react-pdf/renderer** | Cuando se sume la propuesta al cliente |

- **Hosting:** Vercel (frontend) + Supabase (datos/auth/storage). Ambos **$0**.
- El **motor de cálculo** es determinístico y corre en el cliente (no requiere servidor).

### Modelo de datos (entidades principales)
- `providers` — proveedores.
- `products` — ítems de lista de precios (nombre, unidad, precio, peso aprox, actualizado_en, provider_id).
- `ingredients` — ingrediente canónico; unidad base; precio de referencia manual (si no tiene proveedor).
- `ingredient_product_map` — vínculo persistente ingrediente↔producto (el match recordado).
- `recipes` — plato (nombre, categoría, subcategoría de bocado, unidades_de_lote).
- `recipe_items` — receta→ingrediente (cantidad, unidad).
- `events` — nombre, fecha, pax, duración, estado, día/horario, margen%.
- `event_selection` — bocados elegidos, principal, veggie, postre, tipo de barra.
- `event_params` — overrides de ratios (bocados/persona, principal+N, %veggie, %merma).
- `barra_config` — defaults: consumo base, factores día/horario, mix%, recetas de tragos.
- `event_personal` — staff del evento (zona, nombre, nivel, horas, pago/hora).
- `produccion_planta` — grilla semanal de producción.
- `event_vajilla` — ítems, precio, cantidad, roturas.
- `event_instalacion` — horas, precio/hora.
- `event_extras` — costos internos libres.
- `event_costos_adicionales` — add-ons al cliente (precio manual).

### Plan de construcción por fases
1. **Setup:** repo + Next.js + Tailwind + Supabase + auth + PWA shell.
2. **Catálogos:** proveedores, productos (import Excel/PDF), ingredientes, match fuzzy persistente.
3. **Recetas:** ABM de recetas con lotes e ingredientes.
4. **Evento + Materia Prima:** crear evento, elegir menú, motor de cálculo MP (merma, redondeo, lista por proveedor).
5. **Barra:** modelo paramétrico → botellas a comprar + costo.
6. **Personal / Vajilla / Instalación / Extras / Costos adicionales.**
7. **Dashboard:** desglose por sección, %, precio sugerido. Listado activos/finalizados, orden por fecha.
8. **Offline read + pulido UX.**
9. **Fase 2:** generación de propuesta PDF al cliente.
