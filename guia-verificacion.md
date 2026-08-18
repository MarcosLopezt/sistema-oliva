# Guía de verificación — Oliva Gastronomía (datos REALES)

> **Objetivo:** verificar, con datos reales del cliente, que cada cálculo de la app
> coincide con la cuenta hecha a mano. No se usan datos de prueba inventados: vas
> cargando la info real que te pasa el dueño y comprobás cada resultado con calculadora.

## Cómo usar esta guía
- Seguí el orden de las secciones: respeta las **dependencias** (no podés cargar una
  receta sin los ingredientes; no podés armar un evento sin las recetas).
- Cada paso tiene: **qué dato pedir al cliente**, **qué hacer en la app** y **cómo
  verificar a mano** (la fórmula exacta que usa el código).
- Tildá los `[ ]` a medida que avanzás.
- Señales de riesgo:
  - 🔴 **CON LUPA** = punto más propenso a error. Verificá sí o sí con calculadora.
  - ⚠️ **OJO** = hueco típico de carga de datos que hace que algo aparezca "sin costo".

---

## Sección 0 — Preparación (antes de cargar nada)

- [ ] **Confirmar migraciones aplicadas en Supabase.** El esquema actual llega hasta
  `0015_vajilla_params.sql`. En el SQL Editor de Supabase deben estar corridas
  **0001 → 0015**. Si falta alguna, la sección correspondiente no va a funcionar.
- [ ] ⚠️ **Revisar si hay datos de prueba viejos cargados** (ver más abajo "Limpieza").
  Verificá en la app las listas de **Proveedores**, **Ingredientes**, **Recetas** y
  **Eventos**. Si aparecen datos que no cargaste vos con info real → son de prueba y
  conviene limpiarlos antes para no ensuciar la verificación.
- [ ] **La sección Comercial / CRM NO está en la versión actual (`main`).** No la
  busques: no existe la ruta `/comercial` ni las tablas del CRM en esta versión.
  (Ver Sección 11.)

### Modelo de datos clave (para entender todas las fórmulas)
Un **producto** de proveedor se define con:
- `base_unit`: unidad base — `g`, `kg`, `ml`, `l` o `un`.
- `pack_size`: cuánto **rinde** una unidad de compra en su `base_unit`
  (ej: bidón de 5 L → `base_unit='l'`, `pack_size=5`).
- `price`: precio de **esa** unidad de compra (el "pack" completo).
- `unit_content_value` + `unit_content_unit` (opcional, solo si `base_unit='un'`):
  el contenido de cada unidad individual (ej: botella de `700 ml`).
- `sale_unit`: etiqueta de la unidad de venta (ej: "caja", "bidón", "docena"). Es
  solo cosmética; el costeo usa `base_unit` + `pack_size`.

Factores de conversión que usa el motor: `kg = 1000 g`, `l = 1000 ml`, `un = 1`.
**Nunca convierte entre dimensiones distintas** (masa ↔ volumen ↔ conteo dan error).

---

## Sección 1 — Proveedores y Productos

**Dato a pedir al cliente:** lista de precios real de un proveedor concreto (nombre del
proveedor, teléfono, y para cada producto: nombre, unidad en que lo vende, cuánto rinde
esa unidad, y precio).

- [ ] Crear el proveedor real en **/proveedores** (con teléfono → habilita exportar por WhatsApp).
- [ ] Cargar 3–4 productos reales que después vas a usar en la receta. Para cada uno:
  - [ ] `base_unit` correcto (¿lo vende por kg, por litro, por unidad?).
  - [ ] `pack_size` = cuánto rinde la unidad de compra (🔴 el error más común es dejar
    `pack_size=1` cuando en realidad es un bidón de 5 L o una bolsa de 25 kg).
  - [ ] `price` = precio del pack completo (no el precio por kg/litro suelto).
  - [ ] Si el producto se vende por unidad con contenido (botella, lata, sachet):
    cargar `unit_content_value` + `unit_content_unit`. ⚠️ **Si es `un` y no cargás
    contenido, el ingrediente después va a aparecer "sin costo".**

**Verificación manual — precio por unidad base del producto:**
```
precio por unidad base = price / pack_size
```
- [ ] Ej real: bidón aceite $____ (`price`), `pack_size=5` L → precio por litro = price/5 = $____.
  Comparar con lo que sabés que sale el litro.

---

## Sección 2 — Ingredientes

Un **ingrediente** es el nombre canónico que usan las recetas. Se puede costear de 2 formas:
1. **Vinculado a un producto** (`product_id`): toma el precio del producto del proveedor.
2. **Precio de mercado** (`market_price`): precio por `base_unit`, sin proveedor fijo.

**Dato a pedir al cliente:** qué ingredientes usa la receta y, para cada uno, si tiene
proveedor fijo (→ vincular al producto) o es precio de mercado (→ cargar `market_price`).

- [ ] Crear cada ingrediente en **/ingredientes** con su `base_unit` (la unidad en que
  lo vas a expresar en la receta: g, ml o un).
- [ ] Vincular al producto del proveedor (match asistido) **o** cargar `market_price`.
- [ ] 🔴 **Verificar que la dimensión del ingrediente sea compatible con el producto.**
  Ej: ingrediente en `g` ↔ producto en `kg` = OK (misma dimensión, masa). Ingrediente
  en `ml` ↔ producto en `kg` = **incompatible** → dará error, salvo que el producto sea
  `un` con `unit_content` en `ml`.

---

## 🌟 Sección 3 — FOCO: Recetas y cadena de cálculo de ingredientes

> Esta es la parte más crítica. Verificá cada punto con calculadora usando números reales.

### 3.1 — Carga de la receta
**Dato a pedir al cliente:** una receta real completa: nombre, categoría, cuántas
unidades/porciones **rinde el lote** (`yield_units`), y cada ingrediente con su cantidad
y unidad (g, ml, un).

- [ ] Cargar la receta en **/recetas/nueva** con todos sus ítems.
- [ ] Verificar que `yield_units` (rinde del lote) esté bien cargado — es el divisor del
  costo por plato.
- [ ] Verificar que cada ítem quedó guardado con la **cantidad y unidad** correctas
  (reabrir la receta y comparar contra el papel del cliente).

### 3.2 — 🔴 Costo por plato (proporcional exacto)
El editor de receta muestra el **costo del lote** y el **costo por unidad**. Este costo
es **proporcional exacto** (NO redondea a packs, NO aplica merma — eso recién ocurre a
nivel evento).

**Fórmula de un ítem (cadena completa):**
```
1) cantidad en unidad base del ingrediente:
     qty_base = cantidad_receta convertida a base_unit del ingrediente
2) precio por unidad base del ingrediente:
     - si vinculado a producto (misma dimensión):
         precio_unit = (price / pack_size) × factor(base_ing → base_prod)
     - si precio de mercado:
         precio_unit = market_price
3) costo del ítem = qty_base × precio_unit
```
**Costo del lote** = suma de todos los ítems. **Costo por plato** = costo del lote / `yield_units`.

- [ ] Ejemplo genérico a comprobar: producto cuesta **$P** por una unidad de **C** (ml/g),
  y la receta usa **X** (ml/g) → costo del ítem = **(X / C) × P**.
- [ ] Tomá 1 ítem real, calculá a mano el costo del ítem y compará con lo que muestra la app.
- [ ] Sumá los ítems a mano → debe dar el **costo del lote** de la app.
- [ ] Costo del lote / `yield_units` → debe dar el **costo por plato** de la app.

### 3.3 — 🔴🔴 Conversión de unidades (los 4 casos críticos)
Probá **un ingrediente real de cada tipo** y verificá el precio por unidad base:

**Caso A — ingrediente en gramos, producto vendido por kg**
```
factor(g → kg) = 0,001
precio por g = (price / pack_size) × 0,001
```
- [ ] Ej: harina $____ la bolsa de `pack_size=25` kg. Precio por g = (price/25)×0,001 = $____/g.
  Si la receta usa 500 g → costo = 500 × ese valor. Comparar con app.

**Caso B — ingrediente en ml, producto vendido por unidad con contenido (botella/lata)**
```
precio por unidad individual = price / pack_size
precio por ml = (price / pack_size) / unit_content_value
```
- [ ] 🔴 **Doble verificación clave.** Ej: caja de vino `pack_size=6` botellas, `price`=$____
  la caja, `unit_content_value=700` ml. Precio por botella = price/6. Precio por ml =
  (price/6)/700. Si la receta usa 100 ml → costo = 100 × ese valor. Comparar con app.
- [ ] ⚠️ Ojo con el significado de `pack_size` acá: es cuántas **botellas trae la unidad de
  compra**. Si cargás una sola botella suelta, `pack_size=1` y `price` = precio de 1 botella.

**Caso C — ingrediente por unidad (huevos, etc.)**
```
factor(un → un) = 1
precio por unidad = price / pack_size
```
- [ ] Ej: huevos por maple de `pack_size=30`, `price`=$____. Precio por huevo = price/30.
  Receta usa 6 huevos → costo = 6 × (price/30). Comparar con app.

**Caso D — ingrediente sin proveedor fijo (precio de mercado)**
```
costo del ítem = qty_base × market_price
```
- [ ] `market_price` es el precio **por unidad base del ingrediente** (por g, por ml o por un).
  🔴 Verificá que cargaste el precio en la unidad correcta (ej: si el ingrediente está en
  `g`, el `market_price` debe ser $/g, no $/kg — un error de ×1000).

### 3.4 — 🔴 Merma del 15%
La merma **NO** se aplica en el costo por plato (Sección 3.2). Se aplica **solo a nivel
evento**, sobre la cantidad total de cada ingrediente.
```
cantidad con merma = cantidad_base × (1 + merma_pct)     // merma_pct default = 0,15
```
- [ ] Verificar en el evento (Sección 4.2) que la cantidad total de un ingrediente = base × 1,15.
- [ ] ⚠️ No esperes ver la merma reflejada en el costo por plato de la receta — ahí está a propósito sin merma.

---

## Sección 4 — Evento: materia prima con packs completos

**Dato a pedir al cliente:** un evento real → nombre, fecha, PAX (cantidad de personas),
duración en horas, y el menú (qué recetas van como bocado / principal / principal veggie /
postre). Confirmar los ratios: bocados por persona, extra de principales, % veggie, merma, margen.

- [ ] Crear el evento en **/eventos** con PAX y fecha reales.
- [ ] Verificar ratios del evento (editables): `bocados_per_person` (def. 2),
  `principal_extra` (def. 10), `veggie_pct` (def. 0,30), `merma_pct` (def. 0,15),
  `margin_pct` (def. 0 → cargar el margen real del cliente, ej 0,30 = 30%).
- [ ] Asignar las recetas reales a cada rol del menú.

### 4.1 — 🔴 Unidades a producir por rol
```
bocado          → units = bocados_per_person × PAX        (POR CADA receta de bocado)
postre          → units = PAX
principal+veggie → total = PAX + principal_extra
                   veggie_total = redondear(total × veggie_pct)
                   normal_total = total − veggie_total
                   cada receta principal:  normal_total / (nº recetas principales)
                   cada receta veggie:     veggie_total / (nº recetas veggie)
```
- [ ] 🔴 **OJO con bocados:** son `bocados_per_person × PAX` **por cada variedad**. Con 2
  por persona, 100 PAX y 4 bocados distintos = 4 × 200 = 800 bocados en total. Verificá que
  el cliente entiende que es por variedad, no repartido entre variedades.
- [ ] Ej: PAX=100, extra=10 → total principales=110. veggie=redondea(110×0,30)=33.
  normal=77. Con 1 receta principal y 1 veggie → 77 y 33 unidades. Comparar con app.

### 4.2 — 🔴 Cantidad total de cada ingrediente (con merma)
```
scale = units_receta / yield_units_receta
qty_ingrediente = cantidad_en_receta × scale
qty_base = qty_ingrediente convertida a base_unit del ingrediente
cantidad total del ingrediente = Σ (qty_base) × (1 + merma_pct)
```
(La merma se aplica al acumulado por ingrediente. Si el mismo ingrediente aparece en
varias recetas, primero se suma y el total lleva merma.)
- [ ] Tomá 1 ingrediente real, calculá su cantidad total a mano y compará con la app.

### 4.3 — 🔴🔴 Redondeo a unidad de venta y a packs (modelo 3 capas)
**Producto con dimensión directa (ej: kg ↔ g):**
```
unidades_producto = cantidad_total_base × factor(base_ing → base_prod)
packs = techo( unidades_producto / pack_size )     // mínimo 1
subtotal = packs × price
```
- [ ] Ej: necesito 3.200 g de harina, bolsa de 25 kg (`pack_size=25`, base `kg`).
  unidades = 3200 × 0,001 = 3,2 kg. packs = techo(3,2 / 25) = 1. subtotal = 1 × price.

**Producto en `un` con contenido (botella/caja) → 3 capas:**
```
1) contenido_necesario = cantidad_total_base × factor(base_ing → unit_content_unit)
2) unidades_necesarias = techo( contenido_necesario / unit_content_value )   // mínimo 1
3) packs = techo( unidades_necesarias / pack_size )                          // mínimo 1
subtotal = packs × price
sobrante = packs × pack_size − unidades_necesarias
```
- [ ] 🔴 Ej: necesito 1.150 ml de vino, botella 700 ml, caja de 6 (`pack_size=6`).
  unidades = techo(1150/700) = techo(1,64) = **2 botellas**. packs = techo(2/6) = **1 caja**.
  sobrante = 1×6 − 2 = **4 botellas**. subtotal = 1 × price de la caja.
- [ ] Verificar que la app muestra **unidades necesarias** (2 botellas) **Y** los **packs/cajas**
  a pedir (1 caja) por separado.

### 4.4 — Alerta de sobrante (recomendación, no error)
La app marca el sobrante como **aviso informativo** (no bloquea) cuando:
```
sobra_significativo = (sobrante > 1 unidad)  OR  (sobrante / (packs×pack_size) > 30%)
```
- [ ] En el ejemplo anterior: sobrante 4 > 1 → debe aparecer la recomendación de sobrante.
- [ ] Confirmar que aparece como sugerencia/aviso, **no** como error rojo.
- [ ] ⚠️ El aviso de sobrante **solo existe** para productos con contenido (Caso B, 3 capas).
  Para productos por kg/l directos no hay aviso de sobrante.

### 4.5 — 🔴 Costo del evento usa packs completos (no proporcional)
- [ ] Verificar que el costo de materia prima del evento suma **packs completos**
  (`packs × price`), es decir lo que **realmente se gasta**, NO el costo proporcional del
  plato de la Sección 3.2. Por eso el costo del evento suele ser **mayor** que
  (costo por plato × cantidad de platos): el redondeo a packs infla el gasto real.
- [ ] ⚠️ **Excepción — precio de mercado:** los ingredientes con `market_price` **sí** usan
  cantidad proporcional (sin packs): `subtotal = cantidad_total_base × market_price`.
  Es la única línea que no se redondea a packs. Verificalo aparte.

### 4.6 — Lista de pedido por proveedor
- [ ] Verificar que la lista de compra **agrupa los ingredientes por proveedor**
  (y agrupa aparte los de "Precio de mercado").
- [ ] Verificar que la cantidad de cada línea coincide con lo calculado en 4.3.
- [ ] Verificar que el subtotal por proveedor = suma de subtotales de sus líneas, y el
  total del evento = suma de todos los grupos.

---

## Sección 5 — Barra

**Dato a pedir al cliente:** tipo de servicio (sin alcohol / con alcohol / ambos), día
(semana/jueves/finde), horario (mediodía/cena/nocturno), y la carta de bebidas con
consumo por persona/hora, tamaño de botella y precio (se configura en **/configuracion**).

- [ ] Configurar los 6 factores de barra en **/configuracion** y las bebidas reales.
- [ ] Elegir servicio/día/horario en el evento.

**Verificación manual:**
```
ml_totales por bebida = PAX × duración_horas × factor_día × factor_horario × ml_persona_hora
botellas = techo( ml_totales / tamaño_botella )
subtotal = botellas × precio
```
- [ ] Ej: PAX=100, 5 h, factor_día=1, factor_horario=1, bebida 50 ml/pers/h, botella 750 ml.
  ml = 100×5×1×1×50 = 25.000. botellas = techo(25000/750) = techo(33,3) = 34. Comparar.
- [ ] Total barra = suma de subtotales. Verificar.

---

## Sección 6 — Personal

**Dato a pedir al cliente:** empleados reales (nombre, categoría producción/servicio,
tarifa por hora), y para el evento: quién trabaja y cuántas horas.

- [ ] Cargar empleados en **/personal** con su `hourly_rate`.
- [ ] Asignarlos al evento con las horas reales (y `rate_override` si esta vez cobra distinto).

**Verificación manual:**
```
tarifa efectiva = rate_override (si existe) ; si no, hourly_rate del empleado
pago del empleado = horas × tarifa efectiva
total personal = Σ pagos
```
- [ ] Ej: mozo 8 h × $____ /h = $____. Comparar con app.
- [ ] **Seguimiento de pagos** en **/personal/pagos**: verificar que la deuda por empleado
  = suma de sus asignaciones no pagadas, y que el toggle "pagado" mueve el monto de
  pendiente a pagado correctamente.

---

## Sección 7 — Vajilla

**Dato a pedir al cliente:** proveedor de vajilla, ítems (nombre, tipo alquiler/compra,
precio unitario), y por persona: cuántas unidades de cada ítem (multiplicador) + margen
de reserva.

- [ ] Cargar catálogo en **/vajilla** (ítems con `cost_type` alquiler/compra y `unit_price`).
- [ ] Asignar ítems al evento con su `multiplier` y margen.

**Verificación manual — cantidad sugerida (autocálculo):**
```
cantidad = techo(PAX × multiplicador) + redondear(margen)
```
- [ ] Ej: PAX=100, multiplicador=1, margen=5 → 100 + 5 = 105. Ej: multiplicador=2 → 205.
  Comparar con la cantidad que autocompleta la app.
- [ ] ⚠️ Si editás la cantidad a mano, queda marcada como ✍ manual y **deja de recalcularse**.

**Verificación manual — costo:**
```
alquiler → costo = (cantidad + roturas) × unit_price
compra   → costo = unit_price × cantidad SOLO si "cargar compra a este evento" está tildado
                   (si no, cuenta 0 — son bienes reutilizables)
```
- [ ] Ej alquiler: 105 platos + 5 roturas × $____ = 110 × precio. Comparar.
- [ ] Verificar que un ítem de **compra sin tildar** "cargar" suma **$0** al evento.

---

## Sección 8 — Instalación / Planta y Extras

Estas dos son secciones de "Otros costos" del evento (líneas manuales cantidad × precio).

**Instalación / Planta** (horas × precio/hora y costos fijos):
```
subtotal línea = horas × ($ / hora)
```
- [ ] Ej: planta de producción 6 h × $____ /h = $____. Comparar.

**Extras** (costos internos: nafta, hielo, etc.):
```
subtotal línea = cantidad × monto
```
- [ ] Cargar 1 extra real y verificar el subtotal.
- [ ] Ambas secciones **cuentan** para el precio por persona.

---

## Sección 9 — 🔴 Costo total del evento y precio sugerido

**Verificación manual:**
```
costo_interno = materia_prima + barra + personal + vajilla + instalación + extras
costo_por_persona = costo_interno / PAX
precio_por_persona = costo_por_persona × (1 + margin_pct)
adicionales = Σ costos "adicionales"        (NO entran al precio por persona)
total_a_cobrar = precio_por_persona × PAX + adicionales
```
- [ ] Sumá a mano las 6 secciones internas → debe dar el **costo interno** de la app.
- [ ] costo interno / PAX → **costo por persona**.
- [ ] costo por persona × (1 + margen) → **precio sugerido por persona** (🔴 verificá que
  el margen esté como fracción: 30% = 0,30, no 30).
- [ ] Verificar que los **costos adicionales** (ej: torta) se cobran aparte y **no** inflan
  el precio por persona.
- [ ] Verificar los **% por sección** = total_sección / costo_interno × 100.

---

## Sección 10 — Estados, orden e historial

- [ ] **Estado** activo/finalizado: cambiar el toggle y verificar que el evento se mueve
  entre las listas de activos y finalizados.
- [ ] **Orden** de los eventos activos por **proximidad de fecha** (el más próximo primero).
- [ ] **Historial**: los finalizados quedan accesibles y conservan sus cálculos.

---

## Sección 11 — Comercial / CRM ⚠️ NO DISPONIBLE en esta versión

- [ ] ⚠️ **No verificable ahora.** La sección Comercial/CRM (crear cliente, generar
  propuesta desde el costo del evento, recordatorios) **no está en la versión actual
  (`main`)**. Existe en una rama aparte sin integrar (`Seccion comercial`) y sus tablas
  (0016/0017) no están en la base. Si el cliente la necesita para esta verificación,
  hay que decidir primero si se integra esa rama. **Avisar al dueño.**

---

## Sección 12 — Exportar pedido a proveedor

- [ ] Desde la lista de materia prima, botón **Exportar pedido** por proveedor → verificar
  que el mensaje arma bien las cantidades definitivas (ya con merma y redondeo a packs).
- [ ] Para productos de 3 capas, el mensaje muestra **unidades reales** y **packs** entre
  paréntesis (ej: "2 un (1 caja)").
- [ ] Botón WhatsApp: verificar que abre `wa.me` con el teléfono del proveedor (requiere
  teléfono cargado).
- [ ] Ídem para el pedido de **vajilla** (Sección 7).

---

## 📋 Tabla de registro de resultados

Anotá cada verificación para detectar discrepancias entre app y cuenta manual:

| # | Sección | Dato real cargado | Resultado app | Resultado a mano | ¿Coincide? | Notas |
|---|---------|-------------------|---------------|------------------|:----------:|-------|
| 1 | 1 Producto — precio/unidad base | | | | | |
| 2 | 3.2 Costo por plato | | | | | |
| 3 | 3.3-A g ↔ kg | | | | | |
| 4 | 3.3-B ml ↔ botella (contenido) | | | | | |
| 5 | 3.3-C por unidad | | | | | |
| 6 | 3.3-D precio de mercado | | | | | |
| 7 | 3.4 Merma ×1,15 | | | | | |
| 8 | 4.1 Unidades por rol | | | | | |
| 9 | 4.2 Cantidad total c/merma | | | | | |
| 10 | 4.3 Redondeo packs (3 capas) | | | | | |
| 11 | 4.4 Alerta sobrante | | | | | |
| 12 | 4.5 Costo evento (packs) | | | | | |
| 13 | 4.6 Lista por proveedor | | | | | |
| 14 | 5 Barra (botellas) | | | | | |
| 15 | 6 Personal (horas×tarifa) | | | | | |
| 16 | 7 Vajilla (autocálculo) | | | | | |
| 17 | 7 Vajilla (costo alq./compra) | | | | | |
| 18 | 8 Instalación/Extras | | | | | |
| 19 | 9 Costo total + precio/persona | | | | | |
| 20 | 12 Exportar pedido | | | | | |

> Cualquier fila con "¿Coincide? = No" es un bug a reportar: anotá en Notas el dato
> exacto cargado y ambos resultados para poder reproducirlo.
