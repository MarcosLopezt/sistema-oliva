# Test Results: Parámetros de Vajilla

## Funcionalidades implementadas

### 1. Columnas nuevas en DB (`0015_vajilla_params.sql`)
- `events.vajilla_margin NUMERIC(10,2) DEFAULT 5`
- `event_tableware.multiplier NUMERIC(10,4) DEFAULT 1`
- `event_tableware.margin_override NUMERIC(10,2)` (nullable → usa margen global)
- `event_tableware.quantity_manual BOOLEAN DEFAULT FALSE`

### 2. Fórmula de autocálculo
```
calcSuggestedQty(pax, multiplier, margin) = Math.ceil(pax × multiplier) + Math.round(margin)
```
Ejemplo: 80 pax, multiplier 1, margin 5 → ceil(80) + 5 = **85**

### 3. Componente `EventVajillaParams`
Ubicación: sobre `EventVajillaSection` en la página del evento.

**Encabezado:**
- Margen global editable inline (guarda en `events.vajilla_margin` al blur/Enter)
- Muestra fórmula con pax actuales
- Botón "Recalcular automáticos" (recalcula filas `quantity_manual = false`)
- Alerta de N ítems desactualizados (cantidad actual ≠ sugerida)

**Tabla:**
| Ítem | × / persona | Margen | Sugerida | Actual |
|------|-------------|--------|----------|--------|
| Plato | [editable] | [editable] | 85 | 85 ✍ |

- Sugerida en amber si difiere de actual (solo para automáticas)
- ✍ indica cantidad editada manualmente

### 4. Auto-fill al agregar ítems (EntryDialog)
- Al seleccionar ítem → cantidad se completa con `calcSuggestedQty(pax, mult, margin)`
- Cambiar multiplicador → actualiza cantidad automáticamente (si no es manual)
- Cambiar margen propio → actualiza cantidad automáticamente (si no es manual)
- Editar cantidad directamente → marca `quantity_manual = true`, borde amber
- Botón "↩ Usar auto (N)" aparece cuando manual, vuelve a calculada

### 5. Indicador manual en tabla de vajilla
- ✍ visible junto a cantidad en `EventVajillaSection` cuando `quantity_manual = true`

## Escenarios a probar

### Escenario 1: Flujo base (sin edición manual)
1. Ir a un evento con 80 pax
2. Sección "Vajilla" → "Agregar"
3. Seleccionar "Plato" → verificar que cantidad = ceil(80×1)+5 = 85
4. Guardar → la fila aparece sin indicador ✍
5. "Parámetros de vajilla" muestra Sugerida=85, Actual=85 (sin amber)

### Escenario 2: Cambiar multiplicador
1. En "Parámetros de vajilla", editar mult. del ítem Plato a 1.2
2. Cantidad se actualiza a ceil(80×1.2)+5 = ceil(96)+5 = 101
3. Columna "Sugerida" = 101, "Actual" = 101 (sin desactualización)

### Escenario 3: Edición manual de cantidad
1. En dialog "Agregar", seleccionar ítem, luego escribir 90 en el campo Cantidad
2. Aparece borde amber + "✍ manual" + botón "↩ Usar auto (85)"
3. Guardar → fila en tabla muestra "90 ✍"
4. En "Parámetros de vajilla", Actual=90 ✍, Sugerida=85 (amber si difiere)
5. Botón "Recalcular automáticos" NO toca esta fila
6. Clic "↩ Usar auto" → cantidad vuelve a 85, quantity_manual=false

### Escenario 4: Cambiar margen global
1. Editar "Margen global" de 5 a 10
2. Sistema guarda `events.vajilla_margin = 10` y recalcula automáticas
3. Ítems con `quantity_manual=false` y sin `margin_override` → nueva cantidad = ceil(pax×mult)+10
4. Ítems con `quantity_manual=true` → NO cambian

### Escenario 5: Margen propio por ítem
1. En tabla de Parámetros, editar columna "Margen" de un ítem de 5 a 15
2. Solo ese ítem usa margen 15; los demás siguen usando el global
3. Cantidad del ítem = ceil(80×1)+15 = 95

### Escenario 6: Botón "Recalcular automáticos"
1. Cambiar pax del evento (ej: de 80 a 100)
2. "Parámetros de vajilla" muestra ítems automáticos como desactualizados (amber)
3. Clic "Recalcular automáticos" → actualiza cantidades no-manuales
4. Ítems manuales permanecen igual

## Archivos creados/modificados

### Nuevos
- `supabase/migrations/0015_vajilla_params.sql`
- `src/components/eventos/event-vajilla-params.tsx`
- `test-results-parametros-vajilla.md`

### Modificados
- `src/lib/types.ts` — EventRow, EventInput, EventTableware, EventTablewareInput
- `src/lib/queries.ts` — calcSuggestedQty(), recalcNonManualTableware()
- `src/lib/hooks.ts` — useRecalcNonManualTableware()
- `src/components/eventos/event-vajilla-section.tsx` — EntryDialog con autofill y tracking manual
- `src/app/(app)/eventos/[id]/page.tsx` — agrega EventVajillaParams + hook useEventTableware

## Notas de migración
Ejecutar en Supabase antes de desplegar:
```sql
-- 0015_vajilla_params.sql
ALTER TABLE events ADD COLUMN vajilla_margin NUMERIC(10,2) NOT NULL DEFAULT 5;
ALTER TABLE event_tableware ADD COLUMN multiplier      NUMERIC(10,4) NOT NULL DEFAULT 1;
ALTER TABLE event_tableware ADD COLUMN margin_override NUMERIC(10,2);
ALTER TABLE event_tableware ADD COLUMN quantity_manual BOOLEAN       NOT NULL DEFAULT FALSE;
```
Los eventos y ítems existentes reciben los defaults automáticamente.
