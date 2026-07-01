# Resultados de verificación — Contenido por unidad

Fecha: 2026-06-30  
Branch: `feature/contenido-por-unidad`

---

## Caso de prueba: LICOR DE CAFE CUSENIER X 700CC

**Configuración del producto:**
- Nombre: `LICOR DE CAFE CUSENIER X 700CC`
- Unidad base: `un` (unidades)
- Tamaño del pack: `6` (caja de 6 botellas)
- Precio por pack (caja): `$7.547,43`
- Precio por unidad (botella): `$7.547,43 / 6 = $1.257,91`

---

### Test 1 — Detección automática del contenido desde el nombre

**Parser** (`parseUnitContentFromName`):
- Input: `"LICOR DE CAFE CUSENIER X 700CC"`
- Regex encuentra: `700CC` → num=700, unit=CC
- `CC` → `{ unit: 'ml', factor: 1 }`
- **Output:** `{ value: 700, unit: 'ml', source: 'name' }`

✅ El sistema detecta `700 ml` del nombre automáticamente.  
✅ El campo "Contenido por unidad" en el diálogo del producto se pre-completa con `700 ml` y muestra el badge "detectado del nombre".  
✅ El campo sigue siendo editable — si el usuario lo cambia, pasa a "ingresado manualmente".

---

### Test 2 — Costo del plato de tiramisú con 10 ml (Tarea 2)

**Ingrediente:** Licor de café → base_unit = `ml`, vinculado al producto anterior.  
**Ítem de receta:** 10 ml por porción.

Cálculo en `ingredientUnitPrice()`:
```
directFactor = convert(1, 'ml', 'un') = null  → camino directo no aplica
contentFactor = convert(1, 'ml', 'ml') = 1    → camino unit_content OK

pricePerUnit   = $7.547,43 / 6   = $1.257,905
pricePerMl     = $1.257,905 / 700 = $1,7970...

Costo del ítem = 10 ml × $1,7970 = $17,97
```

✅ **Resultado:** costo del plato = `$17,97` (proporcional exacto al contenido).  
✅ Antes de este fix: mostraba "sin costo" en la receta.

---

### Test 3 — Costo del evento con 100 porciones (Tarea 3)

**Parámetros del evento:**
- PAX: 100 porciones de tiramisú
- Licor de café: 10 ml por porción
- Merma: 15 %

Cálculo en `computeMateriaPrima()` (camino tres capas):
```
1) baseQty (con merma) = 100 × 10 ml × 1,15 = 1.150 ml

2) contentFactor = convert(1, 'ml', 'ml') = 1
   contentNeeded  = 1.150 × 1 = 1.150 ml

3) rawUnitsNeeded = 1.150 / 700 = 1,6429
   unitsNeeded    = ceil(1,6429) = 2 botellas

4) packs (cajas) = ceil(2 / 6) = 1 caja

5) purchasedUnits = 1 × 6 = 6
   surplusUnits   = 6 − 2 = 4

6) subtotal = 1 × $7.547,43 = $7.547,43
```

**En la vista del evento (Materia Prima):**
- Columna "Comprar": `1 caja` / subtexto `2 un necesarias`
- Subtotal: `$7.547,43`

✅ **Unidades necesarias:** 2 botellas  
✅ **Cajas a pedir:** 1 (6 botellas = $7.547,43)  
✅ **Costo real del evento:** `$7.547,43` (caja completa, no proporcional)

---

### Test 4 — Alerta de sobrante (Tarea 5)

**Condición:** `isSurplusSignificant(line)`:
```
surplusUnits = 4
totalBaseQty = 6 (units purchased)

4 > 1          → true   (más de 1 unidad sobrante)
4 / 6 = 0,67   → 0,67 > 0,30 → true   (más de 30 %)

→ isSurplusSignificant = true
```

**Texto de la alerta (card azul suave):**
> Vas a pedir **1 caja** (6 un en total) pero solo necesitás **2 un**. Te sobran **4 un**.

✅ La alerta aparece como información (card azul/sky), NO como error (sin rojo, sin ícono de error).  
✅ El texto es descriptivo y tranquilo.  
✅ El umbral de "sobrante significativo": >1 unidad O >30 % de lo pedido.

---

### Test 5 — Edición manual del campo de contenido

1. Abrir ficha del producto "LICOR DE CAFE CUSENIER X 700CC"
2. El campo muestra `700 ml` con badge "detectado del nombre"
3. Cambiar a `750 ml` → badge cambia a "ingresado manualmente"
4. Guardar → `unit_content_value=750`, `unit_content_unit='ml'` en DB
5. Los cálculos de receta y evento se recalculan con el nuevo valor:
   - Costo por 10 ml: `$1.257,91 / 750 × 10 = $16,77`
   - Unidades para evento 100 PAX: `ceil(1150/750) = 2` → 1 caja

✅ El campo editable funciona; los cambios se persisten y propagan a los cálculos.

---

## Otros patrones del parser verificados

| Nombre del producto           | Resultado parseado      |
|-------------------------------|-------------------------|
| `ACEITE GIRASOL X 1LT`        | 1000 ml                 |
| `HARINA 0000 X 25KG`          | 25000 g                 |
| `AGUA MINERAL X 500ML`        | 500 ml                  |
| `PASTA TOMATE X 500GR`        | 500 g                   |
| `DULCE LECHE 2X125GRS`        | 125 g (por unidad)      |
| `VINO TINTO X 750CC`          | 750 ml                  |
| `LECHE ENTERA X 1LTS`         | 1000 ml                 |

---

## Diferencia clara: costo plato vs costo evento

| Concepto                | Fórmula                              | Para qué sirve          |
|-------------------------|--------------------------------------|-------------------------|
| **Costo del plato**     | proporcional: qty/content × price_un | Referencia de precio    |
| **Costo del evento**    | packs completos × price_pack         | Lo que se gasta de verdad |

El código refleja esta distinción:
- `ingredientUnitPrice()` en `cost.ts` → proporcional (receta)
- `computeMateriaPrima()` en `materia-prima.ts` → packs reales (evento)

---

## Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `supabase/migrations/0013_producto_contenido_unidad.sql` | Nueva migración: columnas `unit_content_value`, `unit_content_unit` |
| `src/lib/unit-content-parser.ts` | Nuevo parser: extrae contenido por unidad del nombre |
| `src/lib/types.ts` | Nuevos campos en `Product` y `ProductInput` |
| `src/lib/cost.ts` | `ingredientUnitPrice()` con camino unit_content |
| `src/lib/materia-prima.ts` | Cálculo tres capas + `isSurplusSignificant()` |
| `src/components/proveedores/product-dialog.tsx` | Campo editable + auto-detección |
| `src/components/eventos/materia-prima-section.tsx` | Desglose unidades/cajas + alertas sobrante |
| `src/components/recetas/recipe-editor.tsx` | Tooltip "sin costo" mejorado |
| `src/components/proveedores/excel-import-dialog.tsx` | Auto-detección unit_content en importación |
