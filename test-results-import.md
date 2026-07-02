# Test Results — Importación de Productos (proveedor_don_roque.xlsx)

Fecha: 2026-07-01  
Branch: feature/contenido-por-unidad

---

## Contexto del archivo de prueba

Columnas detectadas: **Descripción** · **Precio venta** · **Presentación** · **Contenido**

Mapeo automático esperado:
| Columna Excel | Campo detectado | Regex que matchea |
|---|---|---|
| Descripción | `name` | `descrip` |
| Precio venta | `price` | `precio` |
| Presentación | `presentation` | `presentaci[oó]n` |
| Contenido | `content` | `contenido` |

---

## Test 1 — Primer import: los 7 productos con contenido correcto

### Comportamiento esperado (lógica post-fix)

Para cada fila el sistema evalúa en este orden:
1. **Columna "Contenido"** → si parsea correctamente, la usa (máxima prioridad).
2. **Columna "Presentación"** → solo si no hubo contenido válido en (1).

| Producto | Presentación | Contenido | base_unit | pack_size | sale_unit | Estado |
|---|---|---|---|---|---|---|
| Champignones frescos | kg | 1 kg | g | 1000 | kg | ok |
| Pimiento rojo | kg | 1 kg | g | 1000 | kg | ok |
| Espinaca | kg | 1 kg | g | 1000 | kg | ok |
| Cebolla | bolsa | 1 kg | g | 1000 | bolsa | ok |
| Ajo | cabeza | 100 g | g | 100 | cabeza | ok |
| Perejil | atado | 50 g | g | 50 | atado | ok |
| Hongos secos | bolsa | 100 g | g | 100 | bolsa | ok |

**Costo por unidad esperado:**
- Champignones: $2800 / 1000 g = **$2.80 / g** = $2800 / kg
- Ajo: $320 / 100 g = **$3.20 / g** = $3200 / kg
- Perejil: $400 / 50 g = **$8.00 / g** = $8000 / kg

Toast esperado: `"Importación completada: 7 nuevos."`

### Resultado real
<!-- Completar después de ejecutar -->
- [ ] Todos los productos importados con pack_size correcto
- [ ] Sin productos en estado "revisión manual"
- [ ] Toast: "Importación completada: 7 nuevos."

---

## Test 2 — Reimport del mismo archivo: 0 duplicados, 7 actualizados

Al reimportar el mismo archivo sin cambios:

- El sistema busca cada producto por **nombre normalizado** dentro del mismo proveedor.
- Ejemplo: "Champignones frescos" → normalize → "champignones frescos" → match → update.
- Se actualizan los datos (price, base_unit, pack_size, sale_unit) pero se **preserva el ID**.

Toast esperado: `"Importación completada: 7 actualizados."`  
(Sin sección "Cambios de precio" porque los precios no cambiaron.)

### Resultado real
<!-- Completar después de ejecutar -->
- [ ] 0 productos duplicados en la lista
- [ ] 7 actualizados (sin nuevos)
- [ ] Toast: "Importación completada: 7 actualizados."

---

## Test 3 — Reimport con precio de Cebolla cambiado ($600 → $650)

Modificar el archivo: Cebolla pasa de $600 a $650 y reimportar.

Toast esperado:  
```
"Importación completada: 7 actualizados."
Cambios de precio: Cebolla: $600 → $650.
```

### Resultado real
<!-- Completar después de ejecutar -->
- [ ] Cebolla actualizada a $650 en la base
- [ ] Los otros 6 productos no cambian de precio
- [ ] Toast muestra el cambio de precio correctamente

---

## Test 4 — Receta con ajo (5 g): costo correcto

Con ajo importado: precio $320, pack_size 100 g, base_unit "g".

Cálculo esperado para una receta que usa **5 g de ajo**:
```
precio_por_g = 320 / 100 = 3.20 ARS/g
costo_5g    = 5 × 3.20 = 16.00 ARS
```

(Aplica para cualquier ingrediente vinculado al producto "Ajo" de Don Roque.)

### Resultado real
<!-- Completar después de ejecutar -->
- [ ] Costo para 5 g de ajo = $16.00

---

## Fixes implementados

### Problema 1 — Columna "Contenido" ignorada

**Root cause:** el bloque `else if (cti >= 0)` solo corría cuando NO había columna "Presentación".  
Para Don Roque, ambas columnas existen, por lo que "Contenido" nunca se leía.

**Fix:** reestructurar la lógica en `analyzed` para evaluar la columna "Contenido" primero (prioridad 1) y la columna "Presentación" solo si el contenido no pudo resolverse.

Archivo: [excel-import-dialog.tsx](src/components/proveedores/excel-import-dialog.tsx) líneas 184–227.

### Problema 2 — Reimport duplica productos

**Root cause:** `bulkInsertProducts` hacía un INSERT puro, sin verificar existencia.

**Fix:** nueva función `bulkUpsertProducts` ([queries.ts](src/lib/queries.ts)):
1. Carga los productos existentes del proveedor.
2. Para cada fila entrante: busca match por código (si hay) o por nombre normalizado.
3. Match → UPDATE (preserva ID). Sin match → INSERT.
4. Devuelve `{ inserted, updated, priceChanges }` para el toast.

### Mejoras adicionales

- Nuevos sinónimos en `HEADER_SYNONYMS.content`: `^cont\.?$`, `cantidad neta`.
- Nuevos sinónimos en `HEADER_SYNONYMS.code`: `^art\.?$`, `referencia`, `^ref\.?$`.
- Toast post-importación con reporte detallado: N nuevos, M actualizados, cambios de precio.
