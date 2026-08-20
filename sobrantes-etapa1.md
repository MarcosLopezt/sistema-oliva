# Sobrantes — Etapa 1 (registro informativo)

Registro de lo que queda pago y sin usar después de cada evento.

**La Etapa 1 vive al costado del motor de costeo.** Registra datos y muestra
avisos, pero **no descuenta stock de ningún cálculo, no altera costos de
eventos y no cambia el precio sugerido por persona.** Verificado abajo.

---

## El hallazgo que motivó el cambio en `MPLine`

`computeMateriaPrima` ya exponía `surplusUnits`, pero **no es el sobrante que
hace falta registrar**. Son dos conceptos distintos:

| | qué mide | aceite (1,38 botellas de 5 L necesarias, compra 2) |
|---|---|---|
| `surplusUnits` | unidades **enteras sin abrir** que sobran al comprar packs completos | **0** |
| `totalBaseQty − neededBaseQty` | sobrante **real**, incluido el contenido de la unidad ya abierta | **0,62 botellas = 3,1 L** |

`surplusUnits` cuenta botellas cerradas. Lo que se guarda en la heladera es lo
que queda **dentro** de la botella abierta, y eso no estaba expuesto: el motor
calculaba la necesidad exacta (`need.productQty`) pero la descartaba después
del `ceil`.

### Qué se tocó del motor

Un solo cambio, **estrictamente aditivo**: el campo de salida
`MPLine.neededBaseQty` (necesidad con merma, consolidada por producto, sin
redondear a packs). Tres líneas de asignación y la declaración del tipo.

**No se tocó**: `ceilQty`, la consolidación por producto, el cálculo de `packs`,
los subtotales, el total, `perPerson` ni el desglose de IVA.

---

## Verificación

### 1. El motor da exactamente lo mismo que antes

Snapshot del resultado de `computeMateriaPrima` **antes** de tocar nada,
comparado campo por campo contra el **después**
(`scripts/verificar-motor-costeo.ts`):

```
Valores comparados: 73
OK — ningún valor preexistente cambió. Cambio estrictamente aditivo.
```

Caso de control del aceite, idéntico al documentado en
`correcciones-aplicadas.md` §1.1:

| | resultado |
|---|---|
| Líneas | **1 sola** ("Aceite + Aceite de oliva") |
| Comprar | **142 botellas** |
| Subtotal | **$14.924.083,56** (142 × $105.099,18) |
| Por persona (200 PAX) | **$74.620,4178** |

Los tres casos (tres capas consolidado, modelo directo, precio de mercado) dan
igual dígito por dígito.

### 2. La lógica de Sobrantes

`scripts/verificar-sobrantes.ts` — **29 verificaciones, 0 fallos**:

```
  ACEITE DE GIRASOL BIDON X 5LT: compró 142 · necesitó 141,87435 · sobra 628,25 ml
  Aceite bidón 5 L:              compró 10  · necesitó 6,90000   · sobra 3,1 L
  Precio de mercado:             0 líneas precargadas (sin packs, sin sobrante)
```

Cubre: coherencia de la precarga · ida y vuelta de unidades · cálculo de
vencimiento (incluido el cruce de año) · estado derivado · calibración de merma.

### 3. Lo que NO pude verificar

Los puntos del plan de testing que necesitan base de datos y navegador quedaron
sin ejecutar, porque **la migración `0017` no está aplicada** (este proyecto las
corre a mano desde el SQL Editor de Supabase) y no toqué la base:

- Confirmar/corregir/descartar en el paso de cierre y ver que se guardan ambas
  cantidades.
- Ver el aviso informativo con datos reales.
- El recorrido completo en pantalla.

**Para probarlo: correr `supabase/migrations/0017_sobrantes.sql` en el SQL
Editor de Supabase** y seguir el recorrido del final de este documento.

---

## Modelo de datos

### `products` — columna nueva

| columna | tipo | nota |
|---|---|---|
| `leftover_shelf_life_days` | `integer` nullable | Días que dura el sobrante. `null` = sin definir → sin fecha de vencimiento. |

Editable en la ficha del producto (Proveedores → producto → *Días de vida útil
del sobrante*).

### `leftovers` — tabla nueva

**Tres columnas de cantidad, siempre en `base_unit`** (nunca porcentaje: el % es
solo una forma de mostrarlo):

| columna | qué es |
|---|---|
| `qty_calculated` | lo que calculó el sistema. `null` si es carga manual |
| `qty_confirmed` | lo que confirmó el usuario **al registrar**. **Congelada** |
| `qty_remaining` | stock actual. Es la que se edita y se consume |

`qty_confirmed` no se pisa nunca al editar stock: es el par de `qty_calculated`
y sin ella se pierde la calibración de merma.

**Snapshots del momento** — datos irrecuperables si después cambia el producto,
el precio o el evento:

| columna | por qué se captura |
|---|---|
| `unit_cost` | `price / pack_size` al registrar. Si el proveedor actualiza la lista, el precio histórico no se puede reconstruir. Sin uso en Etapa 1; lo necesita la Etapa 2 |
| `base_unit`, `unit_content_value`, `unit_content_unit` | si se reconfigura el producto (de "botella de 5 L" a "bidón de 20 L"), los sobrantes viejos no se reinterpretan mal |
| `purchased_qty` | total comprado en el evento. Habilita el "% de lo comprado" |
| `merma_pct` | la merma con la que se calculó. Si después se edita la del evento, la comparación mediría contra otra base |
| `origin_event_name` | si se borra el evento, es el único rastro de dónde vino |

**Estado y vencimiento**:

| columna | nota |
|---|---|
| `status` | `disponible` \| `vencido` \| `consumido` \| `descartado` |
| `expires_at` | fecha del evento + vida útil. `null` = sin vida útil definida |
| `expiry_manual` | `true` = el usuario la sobrescribió; no recalcular |

**`vencido` no se persiste.** La fuente de verdad es `expires_at` y el estado se
deriva al leer (`effectiveStatus` en `lib/sobrantes.ts`). Sin cron y sin drift:
si mañana se corrige la fecha, el estado se acomoda solo.

**Relaciones**: `product_id → products` (`on delete cascade`) ·
`origin_event_id → events` (`on delete set null`, nullable — el sobrante físico
existe aunque se borre el evento, y `null` además significa carga manual).

---

## Qué se implementó

### Sección Sobrantes (`/sobrantes`)

- Listado agrupado por proveedor, filtrable por estado, proveedor y producto.
- Por sobrante: producto, cantidad restante (con % de lo comprado), evento de
  origen, fecha de registro y vencimiento.
- **Tono ámbar, nunca rojo**, para lo que vence pronto (7 días) y lo vencido: no
  es un fallo, es información. El rojo queda para acciones destructivas.
- Marca explícita **"sin vida útil definida"** cuando falta configurar el
  producto, con un aviso en la cabecera que dice cuántos hay.
- Editar cantidad (consumo parcial fuera de un evento), marcar consumido, marcar
  descartado con motivo opcional, eliminar.
- Alta manual sin pasar por el cierre de un evento.
- **Vista "Calculado vs. confirmado"** (Tarea 5): promedio por producto y la
  diferencia. Negativa = sobró menos de lo calculado = la merma real es mayor.
  Las cargas manuales se excluyen (no tienen con qué comparar).

### Precarga al finalizar un evento

Al marcar el evento como finalizado se abre un paso **opcional y salteable** —
el evento ya quedó cerrado antes de mostrarlo, así que saltear no cuesta nada.

- Lista precalculada: sobrante teórico = comprado en packs − necesario con merma.
- Cada línea es editable, con la cantidad en la unidad que se mide (ml/L/g/kg),
  no en "unidades base".
- Por línea: confirmar, corregir la cantidad o descartar.
- Botón **"No quedó nada"** para descartar todo de una, y **"Restaurar"** para
  volver a los valores calculados.
- Las líneas descartadas **se guardan igual**, con `qty_confirmed = 0` y estado
  `descartado`: "el sistema calculó 3,1 L y no quedó nada" es justamente la
  señal más fuerte para calibrar la merma.
- Los productos ya registrados en un cierre anterior no se vuelven a ofrecer.

### Aviso al planificar (Materia Prima)

Junto a la línea del ingrediente, cuando hay sobrante disponible de ese producto:

> ℹ️ Hay **3,1 L** de este producto disponible (sobrante de Casamiento García,
> vence el 25/09)

**Estrictamente informativo.** No descuenta la cantidad, no cambia el costo del
evento, no altera el pedido al proveedor ni el precio por persona. Los vencidos
no llegan a mostrarse (`usableByProduct` los filtra), así que nunca se ofrece
algo que no sirve. Tono neutro, no de alerta.

### Archivos

| archivo | qué |
|---|---|
| `supabase/migrations/0017_sobrantes.sql` | migración (**correr a mano**) |
| `src/lib/sobrantes.ts` | toda la lógica: precarga, vencimiento, unidades, calibración |
| `src/lib/types.ts` | `Leftover`, `LeftoverInput`, `LeftoverWithProduct`, `LeftoverStatus` |
| `src/lib/queries.ts`, `src/lib/hooks.ts` | CRUD y hooks |
| `src/app/(app)/sobrantes/page.tsx` | la sección |
| `src/components/sobrantes/` | diálogo de alta/edición y badges |
| `src/components/eventos/leftover-close-dialog.tsx` | paso de cierre de evento |
| `src/lib/materia-prima.ts` | **único archivo del motor**: campo `neededBaseQty` |
| `scripts/verificar-motor-costeo.ts` | arnés de regresión del motor |
| `scripts/verificar-sobrantes.ts` | verificación de la lógica de sobrantes |
| `scripts/fixtures-costeo.ts` | casos de control compartidos |

Los scripts se corren con:

```bash
node -e "const {createJiti}=require('jiti');createJiti(process.cwd()+'/',{alias:{'@':process.cwd()+'/src'}})('./scripts/verificar-sobrantes.ts')"
```

---

## Qué queda explícitamente para la Etapa 2

Nada de esto está implementado. El modelo de datos ya está preparado para
recibirlo sin migrar de nuevo lo existente.

1. **Consumir sobrantes en un evento.** Falta la tabla
   `leftover_consumptions (leftover_id, event_id, qty, created_at)`. **Se decidió
   no crearla ahora**: una tabla sin código que la use es peso muerto y el diseño
   puede cambiar cuando se vea el uso real. Se crea el día que se necesite.

2. **Los dos números por evento.**
   - *Costo real de caja*: lo que efectivamente se compró para ese evento.
   - *Costo de referencia*: lo que habría costado comprando todo, sumando
     `qty × unit_cost` de los sobrantes consumidos.
   `unit_cost` ya se está guardando desde ahora justamente para esto.

3. **Sobrante a costo cero.** El costo total de lo comprado queda asociado
   siempre al evento que lo compró, aunque sobre; el evento futuro que use ese
   sobrante no carga ese costo. Hoy no se aplica en ningún lado.

4. **Descuento automático del pedido al proveedor.** Hoy el aviso es solo
   informativo y el usuario decide. Que el sistema descuente solo es Etapa 2 —
   y ahí sí toca el motor de costeo.

5. **Ajuste de merma a partir de la calibración.** Hoy la vista solo muestra la
   diferencia. Proponer o aplicar un `merma_pct` corregido queda pendiente.

6. **Vencimiento como estado persistido.** Si la Etapa 2 necesita congelar el
   estado (por ejemplo, para un histórico inmutable), el valor `vencido` ya
   existe en el enum. Hoy se deriva.
