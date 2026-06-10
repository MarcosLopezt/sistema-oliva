# Guía de testing manual — Oliva Gastronomía

Esta guía te lleva paso a paso para probar la app en el navegador con datos reales.
Todos los resultados esperados ya están calculados: después de cada acción vas a ver
**qué tiene que mostrar la pantalla** para comparar.

> **Cómo usarla:** seguí los pasos en orden y tildá `[ ]` a medida que avanzás.
> Los montos están en pesos argentinos, con el formato que usa la app: `$1.234,56`
> (punto para los miles, coma para los decimales).

---

## ⚠️ Antes de empezar — leé esto

Durante la preparación encontré tres cosas sobre cómo funciona la app de verdad. No son
errores tuyos: la guía ya está adaptada para que todo dé exacto.

1. **Recetas (Excel):** el importador lee **una sola hoja** con una columna `receta` que
   se repite en cada fila. Por eso `recetas_prueba.xlsx` viene como una hoja plana (las 3
   recetas juntas), no una hoja por plato. La columna `proveedor` está solo como referencia:
   el importador la ignora (los ingredientes se vinculan a los productos en un paso aparte).

2. **Productos (Excel):** el importador **ahora lee las listas de precios completas**:
   detecta las columnas por su encabezado (producto, precio, **unidad de venta** y
   **cant. por unidad**) en cualquier orden, y deriva la unidad base + pack de cada fila.
   Por eso la Sección 1 importa los `proveedor_*.xlsx` directo, sin carga manual.

3. **Vajilla:** se carga como líneas de costo (cantidad × precio), **sin redondeo a cajas**.
   Elegiste cargarla **por caja/paquete**, así que la cantidad es "cuántas cajas comprar" y
   el precio es el de la caja.

**Login:** entrá a la app con tu usuario. Si es la primera vez, asegurate de haber corrido
las migraciones de Supabase (`supabase/migrations`), **incluida la `0006_producto_unidad_venta.sql`**
(agrega el campo "unidad de venta" a productos; sin ella la importación falla). Empezá con
la base vacía (sin proveedores ni recetas) para que los números coincidan.

---

## SECCIÓN 1 — Cargar proveedores y sus productos

Vamos a crear 4 proveedores e **importar** la lista de precios de cada uno desde su Excel.
El importador detecta las columnas solo (en cualquier orden) y calcula la unidad base, el
pack y el $/unidad. Las tablas de abajo son para **verificar** que lo importado quedó bien.

> 💡 Si preferís, también podés cargar productos a mano con **Nuevo producto**: poné
> Unidad de venta (ej: cabeza), Unidad base, Tamaño del pack y Precio. Da el mismo resultado.

### 1.1 — Crear los 4 proveedores

- [ ] Andá a **Proveedores** → botón **Nuevo proveedor**.
- [ ] Creá estos 4 (solo el nombre, sin notas):
  - [ ] `Distribuidora El Gaucho`
  - [ ] `Verdulería Don Roque`
  - [ ] `Almacén La Despensa`
  - [ ] `Vajillería Finos`
- [ ] **Esperado:** la lista de Proveedores muestra los 4, ordenados alfabéticamente
  (Almacén La Despensa, Distribuidora El Gaucho, Vajillería Finos, Verdulería Don Roque).

### 1.2 — Importar productos de **Distribuidora El Gaucho**

- [ ] En Proveedores, tocá **Productos** en la fila de *Distribuidora El Gaucho*.
- [ ] Tocá **Importar Excel** → elegí **`test-data/proveedor_gaucho.xlsx`**.
- [ ] **Esperado:** banner verde *"Columnas detectadas automáticamente"*. La vista previa
  muestra Unidad de venta, Pack (con su unidad) y $/unidad como en la tabla de abajo.
- [ ] Tocá **Importar 8 productos** → aviso "8 productos importados".
- [ ] **Esperado en la tabla** (la columna **Unidad** muestra la unidad de venta; **Pack**
  muestra el contenido en unidad base; **$/unidad** el costo por g/ml):

| Producto | Unidad | Pack | Precio | $/unidad |
|---|---|---|---|---|
| Lomo vacuno | kg | 1000 g | $12.500,00 | $12,50 / g |
| Pechuga de pollo | kg | 1000 g | $4.800,00 | $4,80 / g |
| Crema de leche | pote | 1000 ml | $1.200,00 | $1,20 / ml |
| Manteca | paquete | 500 g | $2.100,00 | $4,20 / g |
| Queso cremoso | kg | 1000 g | $3.400,00 | $3,40 / g |
| Queso mascarpone | pote | 250 g | $5.800,00 | $23,20 / g |
| Queso parmesano | kg | 1000 g | $6.200,00 | $6,20 / g |
| Huevos | docena | 720 g | $2.160,00 | $3,00 / g |

> ℹ️ **Huevos**: la receta usa huevos en **gramos**, por eso el Excel trae "720 g" en
> "Cant. por unidad" (≈ una docena) y la unidad de venta queda como "docena".

### 1.3 — Importar productos de **Verdulería Don Roque**

- [ ] **Productos** de *Verdulería Don Roque* → **Importar Excel** → **`proveedor_don_roque.xlsx`**.
  > Este archivo usa encabezados distintos a propósito (*Descripción / Precio venta /
  > Presentación / Contenido*); el importador igual los reconoce. Banner verde esperado.
- [ ] Importá los 7 productos. **Esperado en la tabla:**

| Producto | Unidad | Pack | Precio | $/unidad |
|---|---|---|---|---|
| Champignones frescos | kg | 1000 g | $2.800,00 | $2,80 / g |
| Pimiento rojo | kg | 1000 g | $1.500,00 | $1,50 / g |
| Espinaca | kg | 1000 g | $900,00 | $0,90 / g |
| Cebolla | bolsa | 1000 g | $600,00 | $0,60 / g |
| Ajo | cabeza | 100 g | $320,00 | $3,20 / g |
| Perejil | atado | 50 g | $400,00 | $8,00 / g |
| Hongos secos | bolsa | 100 g | $450,00 | $4,50 / g |

> ✅ Este es exactamente el caso que estaba fallando antes: ahora **Ajo** sale como
> *cabeza · 100 g · $3,20/g* y **Cebolla** como *bolsa · 1000 g · $0,60/g*, en vez de
> "un / pack 1" con el precio sin dividir.

### 1.4 — Importar productos de **Almacén La Despensa**

- [ ] **Productos** de *Almacén La Despensa* → **Importar Excel** → **`proveedor_despensa.xlsx`**.
  > Encabezados de este archivo: *Artículo / Costo / Unidad / Cantidad por unidad*. Reconocidos.
- [ ] Importá los 10 productos. **Esperado en la tabla:**

| Producto | Unidad | Pack | Precio | $/unidad |
|---|---|---|---|---|
| Arroz arbóreo | bolsa | 1000 g | $2.200,00 | $2,20 / g |
| Vino blanco | botella | 750 ml | $3.500,00 | $4,67 / ml |
| Aceite de girasol | botella | 1500 ml | $1.800,00 | $1,20 / ml |
| Aceite de oliva | botella | 500 ml | $5.200,00 | $10,40 / ml |
| Azúcar | paquete | 1000 g | $800,00 | $0,80 / g |
| Cacao amargo | paquete | 200 g | $3.100,00 | $15,50 / g |
| Vainillas | paquete | 200 g | $2.400,00 | $12,00 / g |
| Sal | paquete | 1000 g | $350,00 | $0,35 / g |
| Pimienta negra | frasco | 50 g | $4.800,00 | $96,00 / g |
| Licor de café | botella | 750 ml | $8.500,00 | $11,33 / ml |

### 1.5 — Productos de **Vajillería Finos** (opcional)

La vajilla **no** se vincula a ingredientes; se carga directo en el evento (Sección 7).
Podés importar **`vajilla_finos.xlsx`** igual como referencia (quedará como *caja · 6 un*,
etc.), pero **no es necesario** para el cálculo del evento.

---

## SECCIÓN 2 — Importar las recetas (Excel)

- [ ] Andá a **Recetas** → botón **Importar Excel**.
- [ ] Elegí el archivo **`test-data/recetas_prueba.xlsx`**.
- [ ] **Esperado:** la app detecta automáticamente las columnas. Verificá el mapeo:
  - Receta → `receta`
  - Ingrediente → `ingrediente`
  - Cantidad → `cantidad`
  - Unidad → `unidad`
  - Categoría → `categoria`
- [ ] Dejá tildado **"Crear ingredientes que no estén en el catálogo"**.
- [ ] **Esperado en la vista previa:** **3 recetas · 24 ingredientes** (líneas), todas con
  el triángulo ámbar de "sin vínculo (se crearán)" — es normal, todavía no existen.
  - Lomo al champignon — principal — rinde 1 — 9 ingredientes
  - Pollo relleno con verduras — principal — rinde 1 — 8 ingredientes
  - Tiramisú — postre — rinde 1 — 7 ingredientes
- [ ] Tocá **Importar 3 recetas**.
- [ ] **Esperado:** aparece el aviso verde **"3 recetas importadas · 22 ingredientes creados"**.
  (Son 22 y no 24 porque *Sal* y *Pimienta negra* se repiten entre dos recetas y se crean
  una sola vez.)
- [ ] **Esperado en la lista de Recetas:** las 3 recetas, cada una con **Rinde 1 un** y la
  cantidad de ingredientes (9, 8 y 7).

> ℹ️ **Por qué "rinde 1":** cada receta está cargada *por persona* (ej: 250 g de lomo por
> plato). Con rinde 1, la app entiende "esta receta = 1 porción", y al armar el evento la
> multiplica por la cantidad de porciones. Así los gramos por persona quedan correctos.

---

## SECCIÓN 3 — Vincular ingredientes con productos

La materia prima recién muestra precios cuando cada ingrediente está vinculado a su
producto. Vamos a vincular los 21 ingredientes (todos menos el café, que dejamos para el
final como prueba de "precio de mercado").

- [ ] Andá a **Ingredientes**. Vas a ver los 22 ingredientes, todos en **"sin vínculo"**.
- [ ] Para cada uno: tocá **Vincular** → la app ya busca por el nombre y sugiere el
  producto correcto → tocá **Vincular** en el producto sugerido.

Usá esta tabla para confirmar que cada ingrediente queda con el proveedor correcto. La
columna **$/unidad** te deja verificar de un vistazo que no hubo error de carga:

| Ingrediente | Proveedor / producto | $/unidad esperado |
|---|---|---|
| Lomo vacuno | El Gaucho · Lomo vacuno | $12,50 |
| Champignones frescos | Don Roque · Champignones frescos | $2,80 |
| Crema de leche | El Gaucho · Crema de leche | $1,20 |
| Vino blanco | La Despensa · Vino blanco | $4,67 |
| Manteca | El Gaucho · Manteca | $4,20 |
| Ajo | Don Roque · Ajo | $3,20 |
| Sal | La Despensa · Sal | $0,35 |
| Pimienta negra | La Despensa · Pimienta negra | $96,00 |
| Perejil | Don Roque · Perejil | $8,00 |
| Pechuga de pollo | El Gaucho · Pechuga de pollo | $4,80 |
| Pimiento rojo | Don Roque · Pimiento rojo | $1,50 |
| Espinaca | Don Roque · Espinaca | $0,90 |
| Queso cremoso | El Gaucho · Queso cremoso | $3,40 |
| Cebolla | Don Roque · Cebolla | $0,60 |
| Aceite de girasol | La Despensa · Aceite de girasol | $1,20 |
| Queso mascarpone | El Gaucho · Queso mascarpone | $23,20 |
| Huevos | El Gaucho · Huevos | $3,00 |
| Azúcar | La Despensa · Azúcar | $0,80 |
| Vainillas | La Despensa · Vainillas | $12,00 |
| Cacao amargo | La Despensa · Cacao amargo | $15,50 |
| Licor de café | La Despensa · Licor de café | $11,33 |
| **Café expreso** | **dejar SIN vincular** | (se carga en la Sección 8) |

- [ ] **Esperado:** todos vinculados muestran el nombre del proveedor en "Origen del precio"
  y su $/unidad. **Café expreso** queda en **"sin vínculo"** con $/unidad en `—`.
- [ ] **Que NO aparezca** el aviso ámbar "revisar unidad" en ninguno (significaría que la
  unidad base del producto no coincide con la del ingrediente).

> 💡 Los ingredientes del pollo (Pechuga, Pimiento rojo, Espinaca, Queso cremoso, Cebolla,
> Aceite de girasol) solo se usan en el 2º evento, que únicamente vamos a verificar en la
> lista. Vincularlos es recomendable pero no afecta los números del casamiento.

---

## SECCIÓN 4 — Crear el evento "Casamiento García - López"

### 4.1 — Datos básicos

- [ ] Andá a **Eventos** (pantalla principal) → **Nuevo evento**.
- [ ] Cargá:
  - **Nombre:** `Casamiento García - López`
  - **Fecha:** `29/06/2026` (3 semanas desde hoy, 08/06/2026)
  - **PAX (invitados):** `80`
  - **Duración (horas):** `5` (dejá el valor por defecto)
- [ ] Tocá **Guardar**.
- [ ] **Esperado:** se abre la página del evento. Arriba: estado **activo**, **80 invitados**,
  fecha 29/06/2026.

### 4.2 — Parámetros del cálculo

En la tarjeta **"Parámetros del cálculo"** poné exactamente:

- [ ] **Bocados x persona:** `2` (dejá el default; no usamos bocados)
- [ ] **Extra principal:** `5`
- [ ] **% Veggie:** `0`
- [ ] **% Merma:** `15`
- [ ] **% Margen:** `35`
- [ ] Tocá **Guardar parámetros** → aviso verde "Parámetros guardados".

> ℹ️ **Por qué Veggie 0 y Extra 5:** el menú no tiene opción vegetariana, así que ponemos
> Veggie en 0 para que **todas** las porciones de principal sean de lomo. Con Extra principal
> = 5, la app produce **80 + 5 = 85 porciones de lomo**. El postre siempre se calcula = PAX
> (80 porciones).

### 4.3 — Elegir el menú

En **"Menú elegido"**:

- [ ] En **Plato principal** → **Agregar** → elegí **Lomo al champignon**.
- [ ] En **Postre** → **Agregar** → elegí **Tiramisú**.
- [ ] **Esperado:** junto a cada plato aparece la cantidad de unidades a producir:
  - **Lomo al champignon → 85 u**
  - **Tiramisú → 80 u**

> Si el lomo muestra otro número (por ej. 63), revisá que **% Veggie = 0** y
> **Extra principal = 5** estén guardados.

### 4.4 — Verificar la Materia prima

Bajá a la sección **Materia prima**.

- [ ] **Esperado:** aparece un **aviso ámbar**: *"1 ingrediente sin costear (total parcial)
  — Café expreso — sin precio cargado"*. Es correcto: el café todavía no tiene precio (lo
  cargamos en la Sección 8).
- [ ] **Esperado — total parcial (sin café):**
  - **Costo materia prima: `$654.030,00`**
  - **Por persona (80 PAX): `$8.175,38`**

Las compras se agrupan por proveedor. Verificá cada bloque (la app ordena proveedores e
ingredientes alfabéticamente):

**Almacén La Despensa — subtotal `$107.850,00`**

| Ingrediente | Comprar | Precio | Subtotal |
|---|---|---|---|
| Azúcar | 3 pack 1000 g | $800,00 | $2.400,00 |
| Cacao amargo | 3 pack 200 g | $3.100,00 | $9.300,00 |
| Licor de café | 2 pack 750 ml | $8.500,00 | $17.000,00 |
| Pimienta negra | 4 pack 50 g | $4.800,00 | $19.200,00 |
| Sal | 1 pack 1000 g | $350,00 | $350,00 |
| Vainillas | 19 pack 200 g | $2.400,00 | $45.600,00 |
| Vino blanco | 4 pack 750 ml | $3.500,00 | $14.000,00 |

**Distribuidora El Gaucho — subtotal `$518.180,00`**

| Ingrediente | Comprar | Precio | Subtotal |
|---|---|---|---|
| Crema de leche | 5 pack 1000 ml | $1.200,00 | $6.000,00 |
| Huevos | 8 pack 720 g | $2.160,00 | $17.280,00 |
| Lomo vacuno | 25 pack 1000 g | $12.500,00 | $312.500,00 |
| Manteca | 4 pack 500 g | $2.100,00 | $8.400,00 |
| Queso mascarpone | 30 pack 250 g | $5.800,00 | $174.000,00 |

**Verdulería Don Roque — subtotal `$28.000,00`**

| Ingrediente | Comprar | Precio | Subtotal |
|---|---|---|---|
| Ajo | 5 pack 100 g | $320,00 | $1.600,00 |
| Champignones frescos | 8 pack 1000 g | $2.800,00 | $22.400,00 |
| Perejil | 10 pack 50 g | $400,00 | $4.000,00 |

> ℹ️ **Cómo se calcula cada "Comprar":** necesidad = (cantidad por persona × porciones) ×
> 1,15 de merma; luego se redondea **hacia arriba** al pack del producto. Ejemplo lomo:
> 250 g × 85 = 21.250 g; × 1,15 = 24.437,5 g; ÷ 1000 g por pack = 24,44 → **25 packs**;
> 25 × $12.500 = **$312.500**.

### 4.5 — Cargar el Personal

En **Otros costos → Personal**, con **Agregar** cargá 5 líneas (Horas / $ por hora):

- [ ] `Carlos Gómez` — Zona/rol: `producción` — Horas `8` — $/hora `2800` → **$22.400,00**
- [ ] `María Suárez` — `producción (senior)` — Horas `8` — $/hora `3200` → **$25.600,00**
- [ ] `Pedro Ríos` — `servicio` — Horas `5` — $/hora `2200` → **$11.000,00**
- [ ] `Ana Flores` — `servicio` — Horas `5` — $/hora `2200` → **$11.000,00**
- [ ] `Roberto Paz` — `servicio` — Horas `5` — $/hora `2200` → **$11.000,00**
- [ ] **Esperado — subtotal Personal: `$81.000,00`**

### 4.6 — Cargar Instalación / Planta

En **Instalación / Planta** → **Agregar**:

- [ ] Concepto `Planta de producción` — Detalle (opcional) `uso de planta` — Horas `10` —
  $/hora `4500`.
- [ ] **Esperado — subtotal Instalación: `$45.000,00`**

### 4.7 — Cargar Extras

En **Extras** → **Agregar** (Cantidad `1`, Monto = el valor):

- [ ] `Nafta` — Cantidad `1` — Monto `8500` → **$8.500,00**
- [ ] `Hielo` — Cantidad `1` — Monto `12000` → **$12.000,00**
- [ ] **Esperado — subtotal Extras: `$20.500,00`**

### 4.8 — Cargar la Vajilla (por caja)

En **Vajilla** → **Agregar**. Cantidad = **cajas/paquetes** a comprar; Precio unit. =
precio de la caja. (Se necesitan 85 piezas de cada cosa y 90 servilletas; ya está
redondeado a cajas.)

- [ ] `Plato playo` — Cantidad `15` — Precio `850` → **$12.750,00**
- [ ] `Plato de postre` — Cantidad `15` — Precio `620` → **$9.300,00**
- [ ] `Copa de vino` — Cantidad `15` — Precio `950` → **$14.250,00**
- [ ] `Copa de agua` — Cantidad `15` — Precio `750` → **$11.250,00**
- [ ] `Tenedor` — Cantidad `8` — Precio `380` → **$3.040,00**
- [ ] `Cuchillo` — Cantidad `8` — Precio `420` → **$3.360,00**
- [ ] `Cuchara` — Cantidad `8` — Precio `360` → **$2.880,00**
- [ ] `Cucharita de postre` — Cantidad `8` — Precio `280` → **$2.240,00**
- [ ] `Servilleta de tela` — Cantidad `9` — Precio `450` → **$4.050,00**
- [ ] **Esperado — subtotal Vajilla: `$63.120,00`**

> ℹ️ Cajas necesarias: platos y copas vienen de a 6 → 85 ÷ 6 = 14,2 → **15 cajas**.
> Cubiertos de a 12 → 85 ÷ 12 = 7,1 → **8 cajas**. Servilletas de a 10 → 90 ÷ 10 → **9 paquetes**.

### 4.9 — Verificar el Resumen (todavía sin café)

Subí a la tarjeta **Resumen** (arriba de todo).

⚠️ En este punto el café **todavía no tiene precio**, así que este total es **parcial** y va
a subir en la Sección 8.

- [ ] **Costo total interno: `$863.650,00`**
- [ ] **Costo por persona: `$10.795,63`**
- [ ] **Precio sugerido x persona (margen 35,0%): `$14.574,09`**

Barras por sección (porcentaje sobre el total interno):

| Sección | % | Monto |
|---|---|---|
| Materia prima | 75,7% | $654.030,00 |
| Barra | 0,0% | $0,00 |
| Personal | 9,4% | $81.000,00 |
| Vajilla | 7,3% | $63.120,00 |
| Instalación | 5,2% | $45.000,00 |
| Extras | 2,4% | $20.500,00 |

---

## SECCIÓN 5 — Prueba de cambio de proveedor (café → precio de mercado)

El café expreso estaba "sin proveedor fijo". Le vamos a poner un **precio de mercado** de
**$1.200 el litro** y verificar que **todos los totales se actualizan solos**.

- [ ] Andá a **Ingredientes** → buscá **Café expreso** → tocá el lápiz (**Editar**).
- [ ] En **Precio mercado**, escribí **`1.2`**.
  > El campo es **por mililitro** (la unidad base del café). $1.200 por litro = **$1,20 por ml**.
- [ ] **Guardar**.
- [ ] **Esperado en Ingredientes:** Café expreso pasa a **"precio mercado"** con
  **$/unidad `$1,20`**.

Volvé al **Casamiento García - López** → sección **Materia prima**:

- [ ] **Esperado:** desaparece el aviso ámbar (ya no hay ingredientes sin costear).
- [ ] Aparece un grupo nuevo **"Precio de mercado"** con subtotal **`$6.624,00`**:

| Ingrediente | Comprar | Precio | Subtotal |
|---|---|---|---|
| Café expreso | 5.520 ml | $1,20 | $6.624,00 |

  > Cálculo: 60 ml × 80 porciones = 4.800 ml; × 1,15 merma = 5.520 ml; × $1,20 = **$6.624,00**.
  > (El precio de mercado **no** se redondea a packs; se cobra la cantidad exacta.)

- [ ] **Esperado — Materia prima actualizada:**
  - **Costo materia prima: `$660.654,00`** (subió $6.624)
  - **Por persona (80 PAX): `$8.258,18`**

Subí al **Resumen** y confirmá que también se actualizó:

- [ ] **Costo total interno: `$870.274,00`**
- [ ] **Costo por persona: `$10.878,43`**
- [ ] **Precio sugerido x persona (margen 35,0%): `$14.685,87`**

✅ Si el precio sugerido pasó de **$14.574,09** a **$14.685,87**, la prueba de actualización
es correcta.

---

## SECCIÓN 6 — Segundo evento "Almuerzo corporativo Banco Nación"

Solo vamos a verificar que aparece **después** del casamiento en la lista.

- [ ] **Eventos** → **Nuevo evento**:
  - **Nombre:** `Almuerzo corporativo Banco Nación`
  - **Fecha:** `20/07/2026` (6 semanas desde hoy)
  - **PAX:** `40`
  - **Duración:** `5`
- [ ] **Guardar** (te lleva a la página del evento).
- [ ] Parámetros: **% Margen `28`**, **% Veggie `0`** → **Guardar parámetros**.
- [ ] Menú → **Plato principal** → **Agregar** → **Pollo relleno con verduras**.
  - [ ] **Esperado:** muestra **40 u** si dejaste Extra principal en 0, o **50 u** si quedó en
    10 (el valor por defecto). Cualquiera está bien: este evento es solo para la lista.
- [ ] Volvé a **Eventos** (link "Eventos" arriba a la izquierda).
- [ ] **Esperado en la sección "Activos (2)":** los dos eventos ordenados por fecha,
  **primero el Casamiento (29/06/2026)** y **debajo el Corporativo (20/07/2026)**.

---

## SECCIÓN 7 — Evento finalizado "Cumpleaños 50 — Sra. Rodríguez"

- [ ] **Eventos** → **Nuevo evento**:
  - **Nombre:** `Cumpleaños 50 — Sra. Rodríguez`
  - **Fecha:** `25/05/2026` (2 semanas atrás)
  - **PAX:** `30` (cualquier número sirve)
  - **Duración:** `5`
- [ ] **Guardar**.
- [ ] En la página del evento, arriba a la derecha, tocá **Finalizar**.
- [ ] **Esperado:** el estado cambia a **finalizado** (aviso "Evento finalizado.").
- [ ] Volvé a **Eventos**.
- [ ] **Esperado:** ahora hay **dos secciones separadas**:
  - **Activos (2):** Casamiento y Corporativo.
  - **Finalizados (1):** Cumpleaños 50 — Sra. Rodríguez (con la etiqueta gris "finalizado").

---

## SECCIÓN 8 — Resultados esperados (resumen para verificación rápida)

Casamiento García - López · 80 PAX · merma 15% · margen 35% · lomo 85 porciones / tiramisú 80.

### Materia prima por proveedor (estado final, con café)

| Proveedor | Subtotal |
|---|---|
| Distribuidora El Gaucho | $518.180,00 |
| Almacén La Despensa | $107.850,00 |
| Verdulería Don Roque | $28.000,00 |
| Precio de mercado (café) | $6.624,00 |
| **Materia prima total** | **$660.654,00** |

### Totales por sección (costo interno)

| Sección | Monto | % |
|---|---|---|
| Materia prima | $660.654,00 | 75,9% |
| Barra | $0,00 | 0,0% |
| Personal | $81.000,00 | 9,3% |
| Vajilla | $63.120,00 | 7,3% |
| Instalación | $45.000,00 | 5,2% |
| Extras | $20.500,00 | 2,4% |
| **Costo total interno** | **$870.274,00** | 100% |

### Indicadores finales

| Indicador | Valor |
|---|---|
| Costo total interno | **$870.274,00** |
| Costo por persona (÷ 80) | **$10.878,43** |
| **Precio sugerido x persona (×1,35)** | **$14.685,87** |
| Precio total estimado (× 80 PAX) | **$1.174.869,90** |

### Hitos del café (prueba de actualización)

| Momento | Materia prima | Costo interno | Precio x persona |
|---|---|---|---|
| Antes (café sin precio) | $654.030,00 | $863.650,00 | $14.574,09 |
| Después (café $1,20/ml) | $660.654,00 | $870.274,00 | $14.685,87 |
| Diferencia | +$6.624,00 | +$6.624,00 | +$111,78 |

---

### Checklist final

- [ ] 4 proveedores y 25 productos cargados (8 + 7 + 10, + vajilla opcional).
- [ ] 3 recetas importadas, 22 ingredientes creados.
- [ ] 21 ingredientes vinculados; café con precio de mercado.
- [ ] Casamiento con precio sugerido **$14.685,87** por persona.
- [ ] Café actualizó el total correctamente (+$6.624,00).
- [ ] Lista de eventos: Activos (Casamiento antes que Corporativo) y Finalizados (Cumpleaños) separados.
```
