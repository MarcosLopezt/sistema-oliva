# Test Results — Sección Vajilla

**Rama:** feature/contenido-por-unidad  
**Fecha:** 2026-07-01  
**Estado:** Implementación completa — pendiente ejecución de migración en Supabase Dashboard

---

## Checklist de implementación

### TAREA 1 — Sección Vajilla (menú principal)

- [x] Entrada "Vajilla" agregada al nav (`src/lib/nav.ts`) con ícono `UtensilsCrossed`
- [x] Página `/vajilla` creada (`src/app/(app)/vajilla/page.tsx`)
- [x] Catálogo de proveedores de vajilla con CRUD completo
- [x] Por proveedor: lista de ítems con nombre, categoría, tipo (Alquiler/Compra), precio/un
- [x] Botón "Importar Excel" por proveedor
- [x] Botón "Agregar ítem" manual por proveedor

### TAREA 1.1 — Importación Excel (Lista_Precios_Celebro)

**Comportamiento esperado al importar Lista_Precios_Celebro_JUN.xlsx:**

- `guessHeaderRow` detecta la fila con encabezados "ITEM | PRECIO UN" (mayor score de texto)
- `autoMapProductColumns` mapea automáticamente:
  - "ITEM" → nombre (regex `^item$` en minúsculas)
  - "PRECIO UN" → precio (regex `precio`)
- Todos los ítems se importan con `base_unit = "un"` (1 unidad por ítem)
- El mensaje "sin contenido, unidad por defecto: un" NO aplica aquí ya que el importador
  de vajilla no usa esa lógica — siempre es 1 unidad
- Por defecto todo se marca como **Alquiler**
- El usuario puede cambiar tipo ítem por ítem en la tabla de preview (dropdowns)
- O usar el selector "Tipo por defecto" para cambiar todos de una vez

**Pasos de test manual:**
1. Ir a `/vajilla` → "Nuevo proveedor" → crear "Celebro"
2. En el card de Celebro → "Importar Excel"
3. Subir Lista_Precios_Celebro_JUN.xlsx
4. Verificar que detecta la fila de encabezado correcta (saltando filas de título/vacías)
5. Verificar que mapea ITEM → Nombre y PRECIO UN → Precio automáticamente
6. Cambiar los ítems de ollas/utensilios a tipo "Compra"
7. Asignar categorías: Platos, Cubiertos, Cristalería, etc.
8. Importar y verificar el catálogo

### TAREA 2 — Sección Vajilla dentro del evento

- [x] Sección "Vajilla" propia en el evento (`src/components/eventos/event-vajilla-section.tsx`)
- [x] Separada de "Otros costos" — aparece como sección de primer nivel
- [x] Diálogo para seleccionar ítems del catálogo global
- [x] Campo Cantidad (todos los ítems)
- [x] Campo Roturas estimadas (solo ítems de Alquiler)
- [x] Toggle "Cargar al evento" (solo ítems de Compra, default: NO cargar)

**Fórmulas de cálculo:**
- Alquiler: `(cantidad + roturas) × precio_unitario`
- Compra con `charge_purchase = true`: `cantidad × precio_unitario`
- Compra con `charge_purchase = false`: $0 (no entra en el costo del evento)

**Test scenario Tarea 2:**

| Ítem          | Tipo     | Cant. | Roturas | Precio/un | Subtotal             |
|---------------|----------|-------|---------|-----------|----------------------|
| Plato de mesa | Alquiler | 85    | 3       | $X        | 88 × $X              |
| Copa de agua  | Alquiler | 85    | 3       | $Y        | 88 × $Y              |
| Olla grande   | Compra   | 1     | —       | $Z        | $0 (no cargada) ó $Z |

### TAREA 3 — Integración con el costo total del evento

- [x] `computeVajillaTotal()` en `src/lib/queries.ts` calcula el total según tipo
- [x] `computeEventSummary()` en `src/lib/resumen.ts` recibe `vajillaTotal` como parámetro
- [x] `EventSummary` en `src/components/eventos/event-summary.tsx` pasa `vajillaTotal`
- [x] El subtotal de Vajilla aparece en el desglose de secciones del resumen del evento
- [x] Entra en el costo interno total y en el precio por persona

### TAREA 4 — Exportar pedido de vajilla

- [x] Botón "Pedido" en la sección Vajilla del evento (visible cuando hay ítems)
- [x] Agrupa ítems por proveedor (selector si hay más de uno)
- [x] Mensaje con formato: `• [ítem]: [cantidad] un.`
- [x] Botón "Copiar texto"
- [x] Botón "WhatsApp" (si el proveedor tiene teléfono cargado)
- [x] Cantidad en el pedido = `quantity + breakage_qty` para alquileres

---

## Archivos creados/modificados

### Nuevos archivos
| Archivo | Descripción |
|---------|-------------|
| `supabase/migrations/0014_vajilla.sql` | Tablas: tableware_providers, tableware_items, event_tableware |
| `src/app/(app)/vajilla/page.tsx` | Página catálogo de vajilla |
| `src/components/vajilla/tableware-provider-dialog.tsx` | CRUD proveedor de vajilla |
| `src/components/vajilla/tableware-item-dialog.tsx` | CRUD ítem de vajilla |
| `src/components/vajilla/vajilla-excel-import-dialog.tsx` | Importador Excel con asignación de tipo |
| `src/components/eventos/event-vajilla-section.tsx` | Sección vajilla dentro del evento |

### Archivos modificados
| Archivo | Cambio |
|---------|--------|
| `src/lib/types.ts` | +8 tipos Tableware (TablewareProvider, TablewareItem, EventTableware, etc.) |
| `src/lib/queries.ts` | +Queries CRUD vajilla + computeVajillaTotal + buildVajillaOrderMessage |
| `src/lib/hooks.ts` | +12 hooks vajilla |
| `src/lib/nav.ts` | +Entrada "Vajilla" con ícono UtensilsCrossed |
| `src/lib/resumen.ts` | vajillaTotal como parámetro (antes sumaba de event_costs) |
| `src/components/eventos/event-summary.tsx` | Conecta vajillaTotal desde useEventTableware |
| `src/app/(app)/eventos/[id]/page.tsx` | Reemplaza CostSection vajilla → EventVajillaSection |

---

## IMPORTANTE: Migración pendiente

**Antes de usar en producción ejecutar en Supabase Dashboard → SQL Editor:**

```sql
-- Contenido de supabase/migrations/0014_vajilla.sql
```

La migración crea:
- `tableware_providers` — proveedores de vajilla
- `tableware_items` — catálogo de ítems con cost_type (alquiler/compra) y category
- `event_tableware` — vajilla asignada a cada evento (cantidad, roturas, charge_purchase)

---

## Notas de diseño

- **Anti-duplicados en import:** upsert por nombre normalizado (lowercase + trim) dentro del mismo proveedor
- **Sin contenido por unidad:** la vajilla siempre es "1 un" — no se usa el parser de contenido (correcto para Celebro)
- **Compatibilidad backward:** `event_costs` con `section='vajilla'` ya no se usa en la UI pero el tipo sigue existiendo para datos históricos
- **Pedido de vajilla:** agrupa por proveedor para poder enviar un mensaje por WhatsApp a cada uno
