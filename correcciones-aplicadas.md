# Correcciones aplicadas — flujo de medidas y costeo

Rama: `feature/contenido-por-unidad`

Origen: diagnóstico del caso "ACEITE OLIVA ZUELO VIRGEN EXTRA X 5 LT", donde la
pantalla de Ingredientes mostraba `$105.099,18` junto a un badge `ml` y marcaba
"revisar unidad", mientras la receta calculaba bien `$630,60` por 30 ml.

**Resultado:** el motor de costeo estaba bien; fallaban las pantallas que
recalculaban precios por su cuenta, más un bug de sobrecompra al consolidar y
un bug de fechas. Ningún precio cargado en la base fue modificado.

---

## Resumen por archivo

| Archivo | Qué cambió |
|---|---|
| `src/lib/cost.ts` | `itemCost` / `CostableItem` / `itemCostIssue` / `ingredientPriceIssue`; `recipeCost` pasa a ser la única suma |
| `src/lib/materia-prima.ts` | Consolidación por producto; bocados sobre pax+extra; desglose de IVA; `ceilQty`; pedido con nombre de producto |
| `src/lib/format.ts` | `parseDate` (fechas locales); `formatUnitContent` |
| `src/lib/resumen.ts` | `materiaPrimaIva` en `EventSummary` |
| `src/lib/types.ts` | Semántica de `price` / `price_includes_iva`; tipo `ContentUnit` |
| `src/lib/market-price.ts` | Etiqueta de fecha vía `formatDate` |
| `src/lib/queries.ts` | Import sin uso |
| `src/app/(app)/ingredientes/page.tsx` | `$/unidad` vía `ingredientUnitPrice`; alerta vía `ingredientPriceIssue` |
| `src/app/(app)/proveedores/[id]/page.tsx` | Columna Contenido; aviso de IVA mezclado |
| `src/components/recetas/recipe-editor.tsx` | Usa `recipeCost`; textos "por lote"; costo por porción |
| `src/components/eventos/materia-prima-section.tsx` | c/IVA por línea; nota de base de IVA |
| `src/components/eventos/event-summary.tsx` | Desglose de IVA |
| `src/components/eventos/event-params.tsx` | Etiqueta "Cubiertos extra" + `hint` |
| `src/components/ingredientes/product-link-dialog.tsx` | Contenido por unidad en el listado |
| `src/components/proveedores/product-dialog.tsx` | Tipo `ContentUnit`; comillas escapadas |
| `src/components/mobile-nav.tsx` | `setState` fuera del effect |
| `src/components/vajilla/tableware-item-dialog.tsx` | idem |
| `src/components/vajilla/tableware-provider-dialog.tsx` | idem |
| `src/components/vajilla/vajilla-excel-import-dialog.tsx` | Comillas escapadas; imports/directivas sin uso |
| `supabase/migrations/0016_unit_content_unit_constraint.sql` | **Nueva.** Acota `unit_content_unit` |

---

# BLOQUE 1 — Bugs que afectan el costo real

## 1.1 — Consolidación por producto (antes: por ingrediente)

**Problema.** `computeMateriaPrima` acumulaba en un `Map` con clave
`ingredient.id`. Dos ingredientes distintos ("Aceite" y "Aceite de oliva")
vinculados **al mismo producto** generaban dos líneas, cada una con su propio
`Math.ceil` y su propio `Math.max(1, …)` → se compraba de más y el pedido al
proveedor repetía el mismo producto.

**Cambio** — `src/lib/materia-prima.ts`. El cálculo pasa a tres fases:

1. Acumular por ingrediente, en su unidad base, con merma.
2. **Consolidar por producto**, sumando en `product.base_unit`.
3. Redondear **una sola vez** por producto y armar la línea de compra.

La unidad común de la fase 2 es `product.base_unit`, porque los dos caminos de
costeo desembocan ahí: el directo convierte, y el de tres capas divide por
`unit_content_value`, lo que da unidades individuales (= `'un'` = `base_unit`).
Por eso dos ingredientes en unidades distintas (ml y L) suman sin problema.

Funciones nuevas: `qtyInProductUnits()`, `isThreeLayer()` (type guard),
`conversionProblem()`, `ceilQty()`.

`ceilQty()` redondea con tolerancia de punto flotante (`toFixed(6)` antes del
`ceil`): al sumar varios ingredientes, un `2.0000000000000004` habría comprado
una unidad de más.

Cambios en el tipo `MPLine`: se agrega `ingredientIds: string[]` (todos los
ingredientes de la línea) y `priceIncludesIva`. `ingredientId` se conserva como
el primero, que sigue sirviendo de clave de React y para las líneas de precio
de mercado. `ingredientName` ahora une los nombres con `" + "`.

Los ingredientes **sin producto** (precio de mercado) siguen agrupándose por
ingrediente, sin redondeo a packs.

**Cómo verificarlo.** Evento con dos recetas que usen el mismo producto de
aceite desde ingredientes distintos. Debe aparecer **una sola línea**
("Aceite + Aceite de oliva"), y el pedido al proveedor debe listar el producto
una sola vez.

Caso ejecutado: principal 3000 ml/porción × 205 + bocado 300 ml/lote de 100 ×
615, con 15 % de merma → 709.371,8 ml ÷ 5000 = **142 botellas**.
Antes: `ceil(707.250/5000) + ceil(2.121,75/5000)` = 141 + 1 = **143**.
**Una botella de más = $105.099,18 de sobrecosto.**

## 1.2 — IVA: trazabilidad, no recálculo

**Verificación previa (pedida antes de tocar nada): los cálculos NO estaban
errados.** Se siguió el precio de punta a punta:

1. El usuario elige **una** columna de precio — `excel-import-dialog.tsx:419`.
2. Se lee tal cual: `parsePrice(r[pi])` — línea 173.
3. Se guarda sin transformar: `price: a.price` — línea 270. El checkbox va a un
   campo aparte: `price_includes_iva: iva` — línea 272.
4. El upsert tampoco lo toca: `input: { price: row.price, … }` — `queries.ts:184`.

**No hay ninguna operación aritmética sobre `price` en todo el pipeline.**
`products.price` es exactamente lo que Oliva paga. El flag es informativo por
diseño. No se modificó ningún precio.

**(a) Semántica documentada** — `src/lib/types.ts`, en `Product.price` y
`Product.price_includes_iva`. Además, nota al tope de `src/lib/cost.ts`: es la
única fuente de verdad del costeo y ninguna pantalla debe recalcular a mano.

**(b) Flag visible.** Subtexto `c/IVA` / `s/IVA` bajo el precio en el detalle de
materia prima. En `buildProviderOrderMessage`: nota al pie si todo el proveedor
comparte base ("Precios de referencia c/IVA."), o tag `[c/IVA]` / `[s/IVA]` por
línea si están mezclados. El pedido ahora nombra el **producto**, no el
ingrediente, porque una línea puede abastecer varios.

**(c) Desglose en el resumen.** `IvaBreakdown { withIva, withoutIva, unknown }`
en `MateriaPrimaResult`, expuesto como `summary.materiaPrimaIva` y renderizado
en `event-summary.tsx`. Reparte el total ya calculado; **no lo altera**
(el test verifica que la suma de los tres da exactamente `mp.total`).
`unknown` son las líneas de precio de mercado, que no tienen el dato.

**(d) Aviso de importación.** En la página del proveedor, si hay productos con
distinto `price_includes_iva` aparece un aviso suave (azul, no error):
*"Este proveedor tiene productos cargados con y sin IVA…"*.

**Cómo verificarlo.** Abrir un evento → el detalle de materia prima muestra
`c/IVA` bajo cada precio, y el resumen muestra "Materia prima según base de
IVA". Exportar el pedido → aparece la nota de IVA. Cargar dos productos del
mismo proveedor con distinto flag → aparece el aviso.

## 1.3 — Bocados sobre pax + extras

**Cambio** — `materia-prima.ts`, en `selectionUnits`:
`bocados_per_person * event.pax` → `bocados_per_person * totalPrincipal`,
donde `totalPrincipal = pax + principal_extra`.

**Cómo verificarlo.** Evento de 200 PAX, 5 cubiertos extra, 3 bocados/persona →
**615** bocados (antes 600).

**Sobre el nombre de la columna:** se decidió **no renombrar** `principal_extra`.
La migración + rename en tipos y UI no aporta nada funcional. Se cambió solo la
etiqueta visible a **"Cubiertos extra"** con la ayuda *"Se suman a principales y
bocados"* (`event-params.tsx`), y la semántica quedó documentada en el comentario
de `selectionUnits`.

---

# FIX DE FECHAS (fuera de los bloques — detectado durante el Bloque 1)

**Problema.** `formatDate` hacía `new Date(iso)`. Para `event_date` —columna
`date`, que serializa `"2026-09-01"`— eso se interpreta como medianoche **UTC**,
y en Argentina (UTC−3) cae el **día anterior**. Todas las fechas de la app se
mostraban un día atrasado, **incluida la fecha del evento que se le manda al
proveedor por WhatsApp** → riesgo de pedir mercadería para el día equivocado.

**Cambio** — `src/lib/format.ts`, nueva `parseDate()`: si el string matchea
`^\d{4}-\d{2}-\d{2}$` construye la fecha con componentes **locales**; si no
(timestamps `timestamptz`, que ya traen offset), usa el parseo normal.
`formatDate` además devuelve `"—"` ante fechas inválidas en vez de
"Invalid Date". `market-price.ts` pasa a usar `formatDate` para unificar formato.

**Auditoría del resto de los puntos de fecha:**

| Punto | Estado |
|---|---|
| Orden de eventos por fecha | **Nunca afectado** — se ordena en SQL (`queries.ts:400-405`), no en JS |
| Carga/edición de fecha | **Nunca afectada** — `<input type="date">` atado al string, sin round-trip por `Date` |
| Datos guardados en la base | **Siempre estuvieron bien** — era solo visualización |
| `isPriceStale` | Correcto — opera sobre `timestamptz` |
| Etiqueta de última actualización | Corregida de formato (usaba `toLocaleDateString` suelto, sin padding) |
| Filtros por fecha | No existen en la app |
| CRM / recordatorios | No existe en esta rama (está en otra) |

**Cómo verificarlo.** Evento con `event_date = 2026-09-01` → debe mostrarse
`01/09/2026` en el listado, en la ficha del evento y en el mensaje al proveedor.

---

# BLOQUE 2 — Bugs de display

## 2.1 — `$/unidad` en Ingredientes

**Problema.** La columna usaba `pricePerBaseUnit(prod.price, prod.pack_size)`,
que ignora `unit_content_value` **y** la `base_unit` del ingrediente. Para el
aceite mostraba `$105.099,18` al lado de un badge `ml`, que se lee como
$105.099 por mililitro.

**Cambio** — `ingredientes/page.tsx`: pasa a usar `ingredientUnitPrice(ing)`, el
mismo motor de recetas y eventos, y muestra la unidad al lado. Si no se puede
costear, muestra `—` (antes mostraba un número aunque el costeo fallara).

**Cómo verificarlo.** "Aceite" debe mostrar **$21,02 / ml**.

**Decisión sobre `product-link-dialog.tsx:148`: se mantuvo `pricePerBaseUnit`.**
Ahí el subtexto describe **el producto**, no el ingrediente: "$105.099,18 / un"
es literalmente cierto y es el número que se compara contra la lista del
proveedor. Lo que faltaba era el dato que decide si el producto sirve, así que
se agregó el contenido: ahora dice `EL CRIOLLO · $105.099,18 / un · 5 L c/u`.

## 2.2 — "Revisar unidad" (falso positivo sistemático)

**Problema.** La condición era `unitDimension(prod.base_unit) !==
unitDimension(ing.base_unit)`, que ignora el modelo de tres capas. Se encendía
en **todos** los ingredientes bien configurados con producto en `'un'` +
contenido — justo los que funcionan.

**Cambio.** Nueva `ingredientPriceIssue(ing)` en `src/lib/cost.ts`, definida
como el **complemento exacto** de `ingredientUnitPrice`: devuelve texto **si y
solo si** el costeo devuelve `null`. La alerta se ata a esa función, así que
**no pueden desincronizarse por construcción**. Además el tooltip ahora explica
qué hacer en cada caso.

**Cómo verificarlo.** "Aceite" **no** debe mostrar la alerta. Un producto en
`'un'` sin contenido cargado sí, con el texto *"El producto se vende por unidad
y no tiene contenido cargado…"*.

## 2.3 — Columna Contenido en Proveedores

**Problema.** `unit_content_value` no aparecía en ninguna columna; solo se veía
abriendo el diálogo de edición. La columna **Pack** ("1 un") se leía como si
fuera el contenido.

**Cambio** — `proveedores/[id]/page.tsx`: columna nueva, con sub-encabezados que
separan los dos conceptos:

```
Pack                     Contenido
cuánto trae la compra    dentro de cada unidad
─────────────────────────────────────────────
1 un                     5 L          ← el aceite
25.000 g                 —            ← acá el contenido ES el pack
1 un                     sin cargar   ← producto roto, visible de un vistazo
```

Nueva `formatUnitContent()` en `format.ts`: humaniza el valor normalizado
(5000 ml → "5 L", 25000 g → "25 kg", 700 ml → "700 ml").

**Cómo verificarlo.** El aceite debe mostrar `5 L` en Contenido y `1 un` en Pack.

## 2.4 — La receta no aclaraba que es por lote

**Problema.** El renglón mostraba `$630,60` pelado; se lee como costo por plato.
Fue lo que hizo sospechar de un bug de cálculo que no existía.

**Cambio** — `recipe-editor.tsx`, tres cosas:

1. Texto de ayuda: *"Las cantidades son para UN LOTE COMPLETO, no por porción.
   El rinde define cuántas porciones salen de ese lote: hoy, este lote rinde N
   porciones."*
2. Encabezado de columnas: `Ingrediente · Cantidad por lote · Costo del lote`.
3. Equivalente por porción bajo cada costo (si el rinde es > 1).

```
Aceite     [30] [ml]        $630,60
                            $63,06/porción
```

**Cómo verificarlo.** Receta con rinde 10 y 30 ml de aceite → `$630,60` con
`$63,06/porción` debajo.

---

# BLOQUE 3 — Menores

## 3.1 — Código muerto unificado

**Problema.** `recipeCost()` en `cost.ts` no lo usaba nadie; el editor
reimplementaba la misma suma inline, con riesgo de divergir.

**Cambio.** En `cost.ts`:
- `CostableItem` — forma mínima (`quantity` + `unit` + `ingredient`) que cumplen
  tanto los ítems guardados como las filas en edición.
- `itemCost(item)` — el cálculo real. `recipeItemCost` queda como alias tipado.
- `itemCostIssue(item)` — complemento exacto de `itemCost`; reemplaza al
  `costUnavailableReason` local del editor (otro duplicado).
- `recipeCost(items, yieldUnits)` — ahora acepta `CostableItem[]`.

El editor pasa a `recipeCost(rows.map(toCostable), yieldN)` y `itemCost(...)`.
Se eliminaron `rowCost` y `costUnavailableReason` locales.

**Verificación de equivalencia numérica.** Se reimplementó el `rowCost` y la
suma inline **viejos, copiados literalmente**, y se compararon contra los nuevos
en un barrido de **905 casos** (9 ingredientes × 5 unidades × 9 cantidades —
incluyendo `""`, `"abc"` y decimales con coma — más 500 recetas aleatorias con
rindes 0/1/10/200/3,5). Resultado: **idénticos bit a bit** (`Object.is`, que
distingue `-0` y `NaN`).

## 3.2 — Constraint de `unit_content_unit`

**Hallazgo previo.** El diálogo de producto ofrece **ml, g, L, kg** — no `'un'`.
Y se verificó que **L y kg son matemáticamente correctos** en ambos caminos del
costeo (`convert` los maneja bien; solo no están normalizados). El único valor
roto es `'un'`.

**Decisión: acotar la constraint quitando solo `'un'`, no restringir a ml/g.**

Motivos:

1. `'un'` es el único **semánticamente vacío**: "cada unidad contiene N
   unidades" ya es `pack_size`. Deja el producto medio configurado — parece
   tener contenido pero no se puede costear contra un ingrediente en ml o g.
2. `'l'` y `'kg'` son **alcanzables desde la UI** y dan el resultado correcto.
   Restringir a ml/g sería una regresión para quien cargó "5" + "L" a mano.
3. Es el cambio mínimo que cierra el agujero real.

Manejar `'un'` en el Camino 2 se descartó: no hay comportamiento correcto que
implementar, porque el dato no significa nada.

**Cambio** — `supabase/migrations/0016_unit_content_unit_constraint.sql`:
1. Limpia los `unit_content_unit = 'un'` existentes (a `null`).
2. Limpia el contenido a medio cargar (valor sin unidad o al revés).
3. Reemplaza la constraint por `in ('g','kg','ml','l')`.
4. Agrega una constraint de coherencia del par: o están los dos campos, o ninguno.

Los pasos 1 y 2 son necesarios: un `ALTER TABLE … ADD CONSTRAINT` falla si hay
filas que la violan.

**A nivel de tipos** — `types.ts`: nuevo `ContentUnit = "g" | "kg" | "ml" | "l"`,
usado en `Product.unit_content_unit` y `ProductInput`. El compilador encontró
inmediatamente el único punto que podía guardar `'un'` (`product-dialog.tsx`),
que quedó corregido. Como beneficio, se pudieron eliminar dos casts
`as UnitKind` en `cost.ts` y `materia-prima.ts`, e `isThreeLayer` pasó a ser un
type guard que garantiza el contenido no-nulo.

**Cómo verificarlo.** Correr la migración 0016 en el SQL Editor de Supabase.
Después, intentar guardar `unit_content_unit = 'un'` por SQL directo debe fallar.

> **PENDIENTE:** la migración 0016 todavía **no fue ejecutada** en Supabase.

## 3.3 — Errores de lint preexistentes (9 → 0)

**Comillas sin escapar** (6 errores) — `product-dialog.tsx:281` y
`vajilla-excel-import-dialog.tsx:217`: `"` → `&quot;`.

**`setState` dentro de effect** (3 errores) — `mobile-nav.tsx:15`,
`tableware-item-dialog.tsx:64`, `tableware-provider-dialog.tsx:46`.

*Se revisó primero si escondían un bug real, como se pidió.* En los dos diálogos
de vajilla el efecto era `useEffect(() => { if (open) setForm(...) }, [open, item])`.
El riesgo teórico es que `item` cambie de identidad mientras el diálogo está
abierto (por un refetch de react-query) y **borre lo que el usuario está
tipeando**. Se verificó que **no ocurre**: el padre (`vajilla/page.tsx`) guarda
`editingItem` / `editingProvider` en `useState`, un snapshot congelado al hacer
clic en Editar, que no se actualiza con los refetches del listado.

**Conclusión: no había bug, solo un render extra.** Por eso se aplicó el patrón
de ajuste durante el render que documenta React, sin cambio de comportamiento:

```tsx
const [wasOpen, setWasOpen] = useState(false);
if (open !== wasOpen) {
  setWasOpen(open);
  if (open) setForm(item ? fromItem(item) : blank());
}
```

Único efecto observable, y es una mejora: el formulario ya sale correcto en el
primer pintado, sin el parpadeo del contenido anterior. Mismo patrón en
`mobile-nav.tsx`, comparando contra la ruta anterior.

**Warnings triviales** limpiados de paso, en los mismos archivos: import `Badge`
sin uso, directiva `eslint-disable` obsoleta, import `EventTableware` sin uso.

**Quedan 5 warnings sin tocar** (no eran parte del pedido): dos `<img>` vs
`next/image` (`layout.tsx`, `login-form.tsx`) y tres en
`event-vajilla-section.tsx` (dos parámetros sin usar y un `useMemo` con
dependencia inestable).

---

# Verificación final ejecutada

Compilando `src/lib/*` a JS y corriendo el caso real punta a punta:

```
1) INGREDIENTES
  OK   "Aceite" muestra $ 21,02 / ml
  OK   NO muestra "revisar unidad"
2) PROVEEDORES
  OK   Contenido = "5 L"  (Pack sigue siendo "1 un")
3) RECETA
  OK   Costo del lote = $ 630,60
  OK   Equivalente por porción = $ 63,06
  OK   recipeCost coincide con el ítem
4) EVENTO (2 recetas, mismo producto)
  OK   Una sola línea para el producto
  OK   La línea agrupa los 2 ingredientes: "Aceite + Aceite de oliva"
  OK   Unidades necesarias = 142 (a mano: ceil(709371.8/5000) = 142)
  OK   Sin consolidar habrían sido 143 → se evita $ 105.099,18
  OK   Subtotal = $ 14.924.083,56
5) BOCADOS
  OK   Bocados = 615  (3 × (200 + 5), antes eran 600)
6) RESUMEN
  OK   c/IVA $ 14.924.083,56 · sin IVA $ 0,00 · sin dato $ 0,00
  OK   El desglose suma exactamente el total — no altera nada
BONUS) FECHAS
  OK   formatDate("2026-09-01") = 01/09/2026
  OK   El mensaje al proveedor lleva 01/09/2026
```

Además: `tsc --noEmit` sin errores, `eslint src/` con **0 errores**, y
`next build` de producción completo.

---

# Pendientes

1. **Ejecutar la migración `0016` en Supabase** (SQL Editor → New query → Run).
   Es el único cambio que no está aplicado todavía.
2. **Revisar el rinde de "Parmentier de pescado".** El diagnóstico determinó que
   `yield_units ≥ 2` (si fuera 1, el sistema pediría 2 botellas y no 1). Si la
   intención era 30 ml **por plato**, el dato mal cargado es el rinde o la
   cantidad — no el cálculo. Con los cambios de 2.4 esto ahora se ve en pantalla.
3. Opcionales, no pedidos: los 5 warnings de lint restantes.
