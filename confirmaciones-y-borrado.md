# Confirmaciones y borrado múltiple

Estado del trabajo pedido en dos partes: confirmaciones para cambios de estado
(Parte 1) y eliminación múltiple con archivado (Parte 2).

- **Parte 1** — implementada, incluidos los toggles aprobados.
- **Prioridad 0** — implementada: frenada la escritura automática de precios
  sobre eventos finalizados (ver abajo).
- **Congelamiento del costo** — implementado, con backfill y verificación:
  [congelamiento-costos.md](congelamiento-costos.md). Verificación crítica:
  20 OK · 0 fallos.
- **Parte 2 (archivado y selección múltiple)** — implementada. Verificación:
  34 OK · 0 fallos.
- **FKs endurecidas (0021)** — preparada, pendiente de correr.

---

# PRIORIDAD 0 — Frenada la mutación automática ✅

`useMarketPriceUpdater` y `useBeverageMarketPriceUpdater` escribían precios en
la base como efecto de **abrir la pantalla del evento**, sin mirar
`event.status`. Abrir un evento de hace seis meses le cambiaba el costo.

**El fix:** los dos hooks ahora reciben un `enabled` **obligatorio**. Que no sea
opcional es deliberado: un default silencioso deja que un call site futuro
reintroduzca el bug sin que nadie lo note. Ahora TypeScript obliga a cada
llamador a decidir. La condición se expresa con `isEventLive(event)`
([types.ts](src/lib/types.ts)), que es también el predicado que va a usar el
congelamiento.

**Barrido de otros efectos que escriben al abrir pantallas:** hay exactamente
tres `useEffect` en toda la app. Dos eran estos. El tercero registra el service
worker. `useRecalcNonManualTableware` también escribe, pero se dispara en el
`onBlur` de un campo que el usuario editó, no al montar — es intencional.

**Una fuga que quedó abierta a propósito, y ya está cerrada:** en
**Configuración** el actualizador de bebidas sigue habilitado, porque esa *es*
la pantalla de mantenimiento del catálogo y actualizar precios es lo que se va
a hacer ahí. Mientras no existió la foto de costos, un precio nuevo cargado ahí
les seguía moviendo la barra a los eventos finalizados. **El congelamiento lo
cerró:** los eventos cerrados leen de su foto, así que actualizar el catálogo
ya no los alcanza.

---

# PARTE 1 — Confirmaciones y deshacer

## Lo que ya está hecho

### Componentes compartidos (un solo estilo en todo el sistema)

**`src/components/confirm-dialog.tsx`** — ya existía y se reutilizó; se le
agregaron tres cosas sin romper ninguno de los 6 usos previos:

| Prop nuevo | Para qué |
|---|---|
| `details` | Bloque bajo la descripción: listas de afectados, dependencias detectadas, desglose de qué se borra y qué se archiva. Va fuera de `<DialogDescription>` para poder llevar `<ul>` sin anidar bloques dentro de un `<p>`. |
| `variant` | `destructive` para borrados (default, preserva lo anterior), `default` para cambios de estado que no destruyen nada. |
| `loadingLabel` | El botón decía "Eliminando…" siempre. Ahora dice lo que corresponde ("Finalizando…"). |

`description` pasó de `string` a `ReactNode`.

**`src/lib/undo.ts`** — nuevo, `toastUndo({ message, description, onUndo })`.
Es la contracara del diálogo: el cambio ya se aplicó y el toast ofrece
revertirlo durante 7 s. Detalles que importan:

- El valor previo se captura **antes** de mutar y se pasa por closure. Si se
  leyera de la caché al momento de deshacer, se restituiría lo que quedó, no lo
  que había.
- Una sola reversión por aviso (flag `undone`): dos clicks rápidos no mandan
  dos escrituras.
- Si el deshacer falla, avisa y no miente sobre el estado del dato.

### Acciones con confirmación

**Finalizar / Reabrir evento** — [eventos/[id]/page.tsx](src/app/(app)/eventos/[id]/page.tsx).
Antes el botón ejecutaba directo. El diálogo explica las consecuencias reales,
no pregunta "¿estás seguro?":

> **Finalizar evento** — "Olivera 40" se cierra y su costo queda congelado.
> - Se guarda una foto del desglose completo. A partir de ahí editar precios,
>   recetas o ingredientes **no le cambia los números** a este evento.
> - Se abre el registro de sobrantes con las cantidades ya calculadas. Es el
>   único momento en que el sistema lo ofrece: si lo cerrás sin guardar, después
>   hay que cargarlos a mano desde Sobrantes.
> - El menú, el personal, la vajilla y los costos quedan de solo lectura. Los
>   pagos y los sobrantes se siguen editando.

Si el evento ya se había cerrado antes, el diálogo agrega el delta contra la
foto anterior: *"el costo interno pasa de $X a $Y"*. Para reabrir, el texto
aclara que la foto **se conserva** — reabrir no destruye el registro contable —
y que al volver a finalizar queda registrado que el evento se tocó después de
cerrado. El botón es `variant="default"`, no rojo: cerrar un evento no es
destruir nada.

### Acciones con deshacer (sin confirmación)

**Pagado / pendiente** — [personal/pagos/page.tsx](src/app/(app)/personal/pagos/page.tsx).
Se aplica al instante y aparece "Marcado como pagado. · Juan Pérez · Olivera 40"
con botón Deshacer. Es la acción que más se repite en el sistema: una
confirmación acá sería fricción pura.

## Relevamiento de toggles — aprobado y aplicado

| Acción | Dónde | Resultado | Por qué |
|---|---|---|---|
| **Pagado / pendiente** | Pagos | **Deshacer** ✅ | Toggle puro, alta frecuencia. |
| **Sobrante → consumido** | Sobrantes | **Deshacer** ✅ | Es reversible pero **pone `qty_remaining` en 0**: el deshacer restituye estado *y* cantidad, capturando los dos valores antes de mutar. |
| **Activar / desactivar empleado** | Personal | **Sin cambios** | No es un toggle de fila: es un checkbox dentro del formulario de edición. Ya se confirma con "Guardar". |
| **Sobrante → descartado** | Sobrantes | **Sin cambios** | Ya abre un diálogo que pide el motivo, y el motivo se concatena a `note`. Deshacer tendría que revertir estado, cantidad **y** recortar la nota. Frágil, y no es frecuente. |

---

# PARTE 2 — PASO 0: análisis de dependencias

## Resumen en una línea

**Sí, hoy ya se puede corromper el historial contable borrando de a uno.** Es un
bug real y es más urgente que la mejora que pediste. Peor: **el borrado no es la
única forma de corromperlo, ni la más probable.**

## El mapa de dependencias

| Entidad | Quién la referencia | Política | Qué pasa HOY al borrar uno |
|---|---|---|---|
| **ingredients** | `recipe_items.ingredient_id` | `RESTRICT` | **Bloquea** si está en cualquier receta. Sale el error crudo de Postgres en el toast. Si no está en ninguna, borra limpio. |
| **recipes** | `recipe_items.recipe_id`<br>`event_recipes.recipe_id` | `CASCADE`<br>`RESTRICT` | **Bloquea** si está en cualquier evento. Si no, borra la receta y sus ítems. |
| **products** | `ingredients.product_id`<br>`leftovers.product_id` | `SET NULL` ⚠️<br>`CASCADE` ⚠️ | **No bloquea nada.** El ingrediente queda sin producto y sus sobrantes se borran, en silencio. |
| **bar_beverages** | *nadie* | — | **No bloquea nada.** No hay ninguna FK: el catálogo es global. |
| **leftovers** | *nadie* | — | Borra el registro. No afecta costos. |
| **providers** | `products.provider_id` | `CASCADE` | Borra toda su lista de precios → dispara el efecto de `products` multiplicado por N. |

Extra, fuera de tu lista pero del mismo problema:
`tableware_items` ← `event_tableware` es `RESTRICT` (bloquea, bien), y
`staff` ← `event_staff` es **`CASCADE`**: borrar un empleado se lleva puestas
sus asignaciones y su historial de pagos. La UI no ofrece borrarlo (por eso
existe `staff.active`), pero la FK está mal puesta.

## La respuesta a la pregunta importante

> ¿El borrado puede alterar o romper el costo de un evento ya finalizado?

**Sí.** Y la causa de fondo es más grande que el borrado:

**El costo de un evento no está guardado en ninguna parte. Se recalcula desde
el catálogo vivo cada vez que se abre la pantalla.**

De las seis secciones que componen el costo interno en
[resumen.ts:49-60](src/lib/resumen.ts#L49-L60), **cuatro son derivadas en vivo**:

| Sección | De dónde sale el número |
|---|---|
| Materia prima | `computeMateriaPrima` → `products.price` de hoy |
| Barra | `computeBarra` → `bar_beverages.price` de hoy |
| Personal | `resolveRate` → `staff_roles` / `staff.hourly_rate` de hoy |
| Vajilla | `computeVajillaTotal` → `tableware_items.unit_price` de hoy |
| Instalación / Extras / Adicionales | `event_costs` — **este sí guarda su monto** |

El evento guarda sus *ratios* (`merma_pct`, `veggie_pct`, `margin_pct`, PAX) y
sus líneas de `event_costs`, pero **ningún precio**. `status = 'finalizado'` es
una etiqueta: no congela nada.

### Los tres caminos concretos, de más grave a menos

**1. Borrar un producto — corrupción silenciosa, sin ningún aviso.**
`ingredients.product_id` pasa a `NULL` por la FK `SET NULL`. El ingrediente cae
a `market_price`, y si no tiene, `ingredientUnitPrice` devuelve `null` y la
línea **desaparece del total** — pasa a la lista de "problemas". El costo del
evento finalizado baja y nadie se entera. Además los sobrantes de ese producto
se borran en cascada.

**2. Borrar una bebida — corrupción silenciosa, sin ningún aviso.**
No hay FK que avise porque no hay tabla de "bebidas de este evento":
`computeBarra` filtra el catálogo global por `event.barra_service` en cada
render. Borrar una bebida la saca de la barra de **todos** los eventos, pasados
y finalizados. El total de barra baja.

**3. Y el que no tiene nada que ver con borrar:**
`useMarketPriceUpdater` y `useBeverageMarketPriceUpdater`
([hooks.ts:838](src/lib/hooks.ts#L838), [hooks.ts:893](src/lib/hooks.ts#L893))
salen a buscar precios de mercado **al abrir la pantalla del evento** y
**escriben** el precio nuevo en la base. No miran `event.status`. Abrir un
evento finalizado de hace seis meses puede cambiarle el costo solo con mirarlo.
Lo mismo pasa al reimportar una lista de precios por Excel (`bulkUpsertProducts`)
o al editar la tarifa de un rol.

**En términos contables: los números de un evento finalizado hoy no son un
registro, son una estimación recalculada.** Lo que documenta
[0018_personal_roles.sql:20-21](supabase/migrations/0018_personal_roles.sql#L20-L21)
("los eventos ya cargados conservan exactamente el mismo costo") fue verdad
para esa migración puntual, pero no es una propiedad del sistema.

## Por qué esto cambia el diseño de la Parte 2

Tu criterio era: *si está referenciado por eventos pasados → archivar; si no →
borrar*. Es el criterio correcto, pero **archivar solo no alcanza**, porque el
problema no es que el registro desaparezca: es que el precio se lee en vivo.

Archivar un producto lo saca de los listados, sí — pero si mañana alguien le
edita el precio a un producto **activo**, el evento de marzo cambia igual.
La eliminación múltiple sin resolver esto sería ponerle una puerta con llave a
una casa sin paredes.

## Lo que propongo, en orden

**Antes de la Parte 2 — congelar el costo de los eventos finalizados.** Es el
bug urgente que pediste que te avisara. La forma que mejor encaja con cómo está
construido el sistema, y que ya tiene precedente acá (`leftovers` guarda
`unit_cost` y `merma_pct` justamente por esto, y explica por qué en
[0017_sobrantes.sql:79-87](supabase/migrations/0017_sobrantes.sql#L79-L87)):

Al finalizar un evento, guardar una **foto del costo** — las líneas con su
precio del momento, no solo el total. El evento finalizado muestra la foto; el
activo sigue calculando en vivo como ahora. Reabrir un evento vuelve al cálculo
vivo y descarta la foto (o la conserva para comparar). Con eso:

- Borrar o archivar deja de poder tocar el historial, por construcción.
- El actualizador automático de precios deja de ser un problema.
- La verificación #5 de tu plan de testing pasa a ser trivialmente cierta en
  vez de una coincidencia.

**Después, la Parte 2 completa**, que necesita además:

1. **Columna de archivado** en `ingredients`, `recipes`, `products` y
   `bar_beverages` (mismo patrón que `staff.active`), más el filtrado en todos
   los listados y selectores.
2. **Arreglar las FK mal puestas**: `products` ← `ingredients` de `SET NULL` a
   `RESTRICT`, y `staff` ← `event_staff` de `CASCADE` a `RESTRICT`.
3. **Función RPC en Postgres** para el borrado múltiple. El cliente de Supabase
   no puede abrir una transacción desde JS: hoy `bulkUpsertProducts` hace un
   `update` por fila en un `for` y si falla a mitad deja las cosas por la mitad.
   Para que la operación sea atómica como pediste, la decisión de qué borrar y
   qué archivar tiene que ejecutarse del lado del servidor, en una sola función.
4. **Un chequeo de dependencias previo** que alimente el diálogo detallado
   ("3 de estos ingredientes se usan en 5 recetas"), como consulta de solo
   lectura antes de confirmar.

**Sobre deshacer la operación completa:** con archivado es viable y barato
(revertir un flag). Con borrado real no lo es — restituir filas borradas y sus
FK es reconstruir una papelera. Mi propuesta es: deshacer para lo archivado,
y para lo borrado de verdad, apoyarse en el diálogo detallado como la red de
seguridad. Si querés deshacer para todo, el camino es que **nada** se borre
nunca y que "eliminar" sea siempre archivar. Es una decisión tuya.

---

# PARTE 2 — Archivado y selección múltiple ✅

> Todo el análisis de arriba sigue siendo válido como diagnóstico, pero el
> alcance cambió: **con el costo congelado (0019), los eventos finalizados ya
> no pueden verse afectados por nada de esto.** Lo que la Parte 2 protege son
> los eventos ACTIVOS y los datos que se perderían por un click equivocado.

## Decisiones aplicadas

- **"Eliminar" siempre archiva.** No hay borrado real desde la interfaz normal.
- **Cinco entidades**: ingredientes, recetas, productos, bebidas y sobrantes.
- **`active boolean` + `archived_at`**, el mismo patrón que ya usan `staff` y
  `staff_roles` desde 0007/0018. `active` es la fuente de verdad; `archived_at`
  lo mantiene un trigger, así que ningún llamador tiene que escribir los dos.

## Archivos

| Archivo | Qué hace |
|---|---|
| [0020_archivado.sql](supabase/migrations/0020_archivado.sql) | Columnas + trigger + RPC `set_rows_active` y `delete_archived_rows` |
| [archivado.ts](src/lib/archivado.ts) | Grafo de dependencias, impacto sobre eventos activos, plan de borrado |
| [use-bulk-selection.ts](src/components/archivado/use-bulk-selection.ts) | Selección múltiple que respeta filtros |
| [archive-dialog.tsx](src/components/archivado/archive-dialog.tsx) | El diálogo de "eliminar", con impacto y deshacer |
| [archived-panel.tsx](src/components/archivado/archived-panel.tsx) | Vista de archivados: desarchivar y borrado definitivo |
| [bulk-bar.tsx](src/components/archivado/bulk-bar.tsx) | Checkboxes, barra de acciones y tabs |
| [verificar-archivado.ts](scripts/verificar-archivado.ts) | La verificación |

## Un filtro, no cinco

Los archivados desaparecen de **todos** los listados y selectores por el filtro
`.eq("active", true)` en las cinco funciones de listado de `queries.ts`. No hay
que acordarse de filtrar en cada pantalla: el picker de recetas del evento, el
de ingredientes de la receta, el vínculo producto-ingrediente y `computeBarra`
salen todos de esas mismas funciones.

**Lo que ese filtro NO alcanza, y es a propósito:** los joins anidados
(evento → receta → ítems → ingrediente → producto) traen la fila por FK sin
pasar por el listado. Por eso **un elemento archivado sigue funcionando en los
eventos que ya lo usaban** — que es lo que propusiste y quedó implementado sin
código extra.

## El impacto en eventos activos

El diálogo detecta y nombra los eventos activos afectados antes de archivar:

> ⚠ **2 eventos activos los usan:**
> **Casamiento García** · 14/09/2026 — usa: Aceite, Sal
> **Corporativo Banco Nación** · 02/10/2026 — usa: Aceite
> Esos eventos **siguen funcionando igual**: conservan estos elementos y su
> costo no cambia. Lo único que pasa es que no vas a poder volver a elegirlos
> al armar un evento nuevo.

Los eventos **finalizados no se listan**, y no es que se los esconda: no pueden
verse afectados. El test lo demuestra en vez de afirmarlo — un evento cerrado
que usa la misma receta que uno activo mantiene su costo exacto mientras el
cálculo vivo del mismo escenario se desploma a 0.

Rastreo por entidad: un **producto** llega al evento a través de los
ingredientes que abastece; una **bebida** no tiene ninguna FK, así que el
impacto se decide por el servicio del evento (`con_alcohol` / `sin_alcohol` /
`ambos`), que es exactamente como lo resuelve `computeBarra`; un **sobrante** no
afecta a ningún evento.

## Selección múltiple

`useBulkSelection` recibe **la lista filtrada**, no el catálogo. De ahí sale
gratis que "seleccionar todos" respete los filtros. Además la selección se
**poda contra lo visible en cada render**, que evita el bug de seleccionar 5,
cambiar el filtro y archivar cosas que ya no están en pantalla.

Filtros agregados donde no había: ingredientes (búsqueda + proveedor + origen
del precio), recetas (búsqueda + categoría), productos (búsqueda por nombre o
código), bebidas (servicio). Sobrantes ya tenía tres.

## Confirmación

Se reutiliza el `ConfirmDialog` con `details`, sin variantes nuevas. Muestra
cuántos y cuáles (los primeros 8 y "y N más"), el impacto en eventos activos, y
lo que no se pueda archivar con su motivo. Arriba de **10 elementos** pide
escribir la cantidad: un "aceptar" a secas se clickea sin leer, escribir el
número obliga a mirar cuántos son.

## Deshacer

`toastUndo`, con el detalle que marcaste: **los ids se capturan antes de mutar**,
así que el deshacer restituye exactamente los de esa operación. El test lo
comprueba archivando algo ajeno entremedio y verificando que el deshacer no lo
toca ni resucita los que ya estaban archivados de antes.

## Atomicidad

`set_rows_active` es un solo `UPDATE ... WHERE id = any($2)`: no puede quedar a
mitad de camino. Es la razón de que sea una RPC y no N updates desde el cliente
— archivando doce de a uno, un fallo en el séptimo dejaría seis y seis, y el
deshacer no sabría cuáles revertir.

## Borrado definitivo — sí lo implementé

Desde la vista de archivados, solo para elementos sin ninguna referencia, con
doble confirmación (escribir la cantidad). **La condición se valida en la base**
(`delete_archived_rows`), no en el front: si viviera solo en la UI, cualquier
otro camino podría borrar algo referenciado.

El caso que lo justifica es `products`: sus FKs son `SET NULL` y `CASCADE`, así
que un borrado sin chequeo explícito **no fallaría** — dejaría ingredientes sin
precio y se llevaría puestos sus sobrantes en silencio. Los chequeos explícitos
son lo que convierte eso en un "no se puede borrar: 2 ingredientes lo usan y 1
sobrante salió de él".

## Verificación

```
node -e "const {createJiti}=require('jiti');createJiti(process.cwd()+'/',{alias:{'@':process.cwd()+'/src'}})('./scripts/verificar-archivado.ts')"
```

**29 OK · 0 fallos.** Cubre: detección y nombrado de eventos activos por las
cuatro rutas (ingrediente, producto, bebida, sobrante); que el evento
finalizado no aparece *y* no se mueve, con control negativo; que el deshacer
restituye exactamente los ids de la operación; que "seleccionar todos" respeta
filtros y se poda al cambiarlos; y el plan de borrado definitivo.

Los scripts existentes siguen pasando: costos-congelados 20, sobrantes 29,
personal-roles 41, motor-costeo OK.

## Para poner en marcha

Correr [0020_archivado.sql](supabase/migrations/0020_archivado.sql) en el SQL
Editor de Supabase. La query del final tiene que devolver las cinco entidades
con 0 archivados.

## Pendiente, no incluido

Las **FK mal puestas** que aparecieron en el PASO 0 siguen como estaban:
`ingredients.product_id` es `SET NULL` y `event_staff.staff_id` es `CASCADE`.
Ya no son un riesgo desde la interfaz —nada borra de verdad salvo el camino de
archivados, que las chequea—, pero siguen siendo trampas para un script o un
import futuro. Endurecerlas es una migración corta; decime si la querés.

---

# FKs endurecidas — migración 0021

> **Preparada, sin correr.** Es independiente de 0020: no tocan las mismas
> cosas, el orden da igual.

## Por qué cambió el cálculo

En el cierre de la Parte 2 dije que estas FKs "ya no son un riesgo desde la
interfaz". Sigue siendo cierto, pero era la mitad del análisis: **el
mantenimiento de esta base se hace con SQL a mano**, incluidos borrados
masivos. Ahí no hay diálogo ni chequeo de dependencias — solo lo que la base
esté dispuesta a impedir. El escenario que yo trataba como hipotético es el
modo de trabajo habitual.

## Relevamiento completo: las 17 FKs del esquema

### Se endurecen (5)

| FK | Antes | Ahora | Qué pasaba en silencio |
|---|---|---|---|
| `ingredients.product_id` | SET NULL | **RESTRICT** | El ingrediente perdía su precio. La línea desaparecía del costo de los eventos activos: el evento simplemente costaba menos. |
| `leftovers.product_id` | CASCADE | **RESTRICT** | Se borraban todos los sobrantes del producto, con sus `unit_cost` — que 0017 documenta como irrecuperables. |
| `event_staff.staff_id` | CASCADE | **RESTRICT** | Se borraban las asignaciones a todos los eventos: horas, tarifas y estado de pago. |
| `staff.role_id` | SET NULL | **RESTRICT** | El empleado perdía el rol del que hereda la tarifa: pasaba a cobrar su tarifa propia o 0. |
| `event_staff.role_id` | SET NULL | **RESTRICT** | Igual, para el ajuste puntual del evento. |

Las tres últimas tienen **impacto cero en la interfaz**: la app nunca ofreció
borrar empleados ni roles, justamente porque `staff.active` y
`staff_roles.active` existen desde 0007/0018 para eso.

### Se dejan como están (12), y por qué

**Hijos del evento** — `event_recipes`, `event_costs`, `event_staff.event_id`,
`event_tableware.event_id`, `event_cost_snapshots.event_id`: son partes del
evento, no entidades propias. Cascade correcto.

**Hijos de la receta** — `recipe_items.recipe_id`: mismo criterio.

**Ya estaban bien** — `recipe_items.ingredient_id`, `event_recipes.recipe_id`,
`event_tableware.item_id`: ya eran RESTRICT.

**`leftovers.origin_event_id` (SET NULL) — se queda, y es deliberado.** 0017 lo
explica: el sobrante físico sigue en la heladera aunque se borre el evento del
que salió, y `origin_event_name` guarda el rastro. **Acá el NULL no pierde
información: la conserva en otra columna.** Es exactamente lo que distingue
este caso de los cinco de arriba.

**`products.provider_id` y `tableware_items.provider_id` (CASCADE) — se quedan,
con un efecto que hay que saber:** ver abajo.

## El efecto en el borrado de proveedores

Borrar un proveedor sigue arrastrando su lista de precios, pero ahora esa
cascada choca contra el nuevo RESTRICT. **A partir de 0021, borrar un proveedor
falla si alguno de sus productos está vinculado a un ingrediente o tiene
sobrantes.** Es el comportamiento correcto — antes se llevaba la lista entera
sin decir nada — pero el mensaje sería el error crudo de Postgres.

Para no dejar eso así, el diálogo de borrar proveedor ahora dice cuántos
productos se van a borrar y avisa de antemano que la operación puede
rechazarse, y el error se traduce a algo legible. No metí a los proveedores en
el archivado: si el borrado se vuelve molesto en la práctica, esa es la salida,
no aflojar las FKs.

## Las dos condiciones que pusiste

**1. El camino de archivados sigue igual.** `delete_archived_rows` ya hacía los
chequeos explícitos antes de intentar el DELETE, así que nunca llega a chocar
con RESTRICT: sigue dando el mensaje útil ("2 ingredientes lo usan y 1 sobrante
salió de él"). RESTRICT es la red por debajo, para lo que no pasa por ahí.

Está verificado, no supuesto: el punto 8 de `verificar-archivado.ts` recorre
cada FK ahora en RESTRICT y comprueba que el plan de borrado la frena antes —
y que sin referencias el borrado definitivo sigue disponible, o sea que el
endurecimiento no convirtió al archivado en un callejón sin salida.

**2. La migración no puede fallar por datos existentes.** Cambiar la regla
`ON DELETE` obliga a recrear la constraint, y al recrearla Postgres revalida
las filas. En teoría no puede fallar (la FK ya estaba, y los NULL siempre
pasan), pero si en algún borrado masivo se desactivaron los triggers de
replicación puede haber quedado basura. Por eso 0021 arranca con un
**preflight** que busca huérfanos reales en las cinco FKs y **tiene que
devolver cero filas** antes de correr el paso 2.

Hay además un **diagnóstico informativo** que no bloquea: lista los
ingredientes que quedaron sin producto **y** sin precio de mercado. Esos son la
huella del daño que la vieja `SET NULL` ya pueda haber hecho — hoy no se pueden
costear, y las recetas que los usan están costeando de menos sin avisar. Si
aparecen varios, vale la pena mirarlos.

El paso 2 va entero en una transacción: o quedan las cinco o ninguna.

## Cómo correrla

1. **Paso 1** solo, y leer el resultado. Cero filas → seguir. Si devuelve algo,
   parar y avisame.
2. **Paso 1b**, informativo: los ingredientes sin precio que quedaron de antes.
3. **Paso 2**: los cinco `ALTER`, en transacción.
4. **Paso 3**: lista todas las FKs con su regla real. Es una foto del estado de
   la base, más confiable que leer las migraciones una por una.
