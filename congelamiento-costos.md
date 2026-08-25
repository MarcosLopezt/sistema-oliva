# Congelamiento del costo de eventos finalizados — DISEÑO

> **Estado: IMPLEMENTADO.** Los cuatro puntos marcados **[DECIDIR]** fueron
> aprobados; el #1 con el acotamiento que aparece en la §4. Este documento
> quedó como el diseño de referencia; el detalle de lo construido y cómo
> verificarlo está al final, en §11.

## El problema, en una línea

El costo de un evento no existe como dato: se recalcula desde el catálogo vivo
en cada render. `status = 'finalizado'` es una etiqueta que no congela nada.

## Principio de diseño

**Un evento finalizado no calcula: lee.** Toda la diferencia entre un evento
abierto y uno cerrado se reduce a de dónde salen los números — del catálogo o
de la foto — y esa decisión se toma **una sola vez, en la página del evento**.

---

## 1. Dónde se guarda

Tabla nueva, **no** una columna en `events`:

```sql
create table event_cost_snapshots (
  event_id        uuid primary key references events(id) on delete cascade,
  taken_at        timestamptz not null default now(),
  origin          text not null check (origin in ('finalizado','recalculado','backfill')),
  -- false = reconstruido a posteriori: los precios pueden no ser los del evento.
  reliable        boolean not null default true,
  -- Denormalizados para listados y badges sin parsear el JSON.
  internal_total   numeric not null,
  price_per_person numeric not null,
  total_to_client  numeric not null,
  -- El desglose completo.
  data            jsonb not null,
  -- Auditoría: una entrada por cada vez que se sacó o rehízo la foto.
  history         jsonb not null default '[]'::jsonb
);
```

**Por qué tabla y no columna:** `listEvents()` hace `select *`. Una columna
`jsonb` de decenas de KB por evento se bajaría entera cada vez que se abre la
lista de eventos, que es la home. Con tabla aparte, `events` queda liviano y la
foto se pide solo cuando se entra al evento.

**Por qué un solo `jsonb` y no tablas de líneas normalizadas:** las cuatro
secciones tienen líneas genuinamente distintas — una línea de materia prima
tiene `unitsPerPack` y `saleUnit`, una de barra tiene `bottles` y `sizeMl`, una
de personal tiene `hours` y el origen de la tarifa. Normalizarlas sería una
tabla con veinte columnas nullable. Y hay una ventaja mayor, abajo.

## 2. Qué se guarda

```ts
type EventCostSnapshot = {
  schema_version: 1;

  /** Foto de los parámetros con los que se calculó. Hace el documento
   *  autosuficiente: no depende de que `events` no se haya tocado. */
  event: Pick<EventRow,
    | "pax" | "duration_hours" | "merma_pct" | "veggie_pct"
    | "bocados_per_person" | "principal_extra" | "margin_pct"
    | "barra_service" | "barra_dia" | "barra_horario" | "vajilla_margin">;

  materiaPrima: MateriaPrimaResult;   // groups, problems, total, ivaBreakdown
  barra:        BarraResult;          // lines, total, factorDia, factorHorario
  personal:     EventStaffResult;     // groups por categoría, total
  vajilla:      { lines: EventTablewareWithItem[]; total: number };
  costs:        EventCost[];          // instalación / extras / adicionales
  summary:      EventSummary;         // secciones con %, total, precio por persona
};
```

**Los tipos son los que ya devuelven las funciones de cálculo.** El snapshot es
literalmente el resultado de `computeMateriaPrima`, `computeBarra`,
`computeEventStaff` y `computeVajillaTotal` serializado. Cero código de mapeo.

Eso trae la ventaja que justifica el diseño entero:

> **Los componentes de UI no se enteran de si están mostrando la foto o el
> cálculo vivo.** Reciben el mismo tipo en los dos casos.

Efecto lateral bienvenido: las líneas de personal y vajilla embeben el empleado
y el ítem completos, así que la foto conserva **el nombre del empleado y el
precio del ítem al momento del evento**, aunque después se los renombre o
archive.

## 3. Cómo se lee — el cambio de forma en la UI

Hoy cada sección calcula por su cuenta: `MateriaPrimaSection` recibe `event` +
`selections` y llama a `computeMateriaPrima` adentro. Con eso, hacer que lea de
la foto obligaría a tocar cada componente.

**El refactor:** subir el cálculo a la página y pasar resultados hacia abajo.

```ts
// eventos/[id]/page.tsx — el ÚNICO lugar donde se decide vivo vs. foto.
const view = snapshot
  ? fromSnapshot(snapshot)
  : computeLive(event, selections, settings, beverages, staff, tableware, costs);
```

Las secciones pasan a recibir `mp`, `barra`, `personal`, `vajilla` ya
calculados. Es más código movido que código nuevo, y deja el sistema en un
estado mejor que el actual: hoy `EventSummary` recalcula por su cuenta las
mismas cuatro cosas que las secciones ya calcularon, cinco veces por render.

## 4. **[DECIDIR]** Un evento finalizado queda de solo lectura

Es la consecuencia que quiero que veas antes de que la implemente.

Si el evento finalizado lee de la foto pero **sigue dejando editar** el menú,
el personal, la vajilla y las líneas de costo, el usuario edita y no pasa nada:
los números no se mueven. Eso es peor que el bug actual — parece roto.

Mi propuesta: **finalizado ⇒ se deshabilitan todas las ediciones que alimentan
el costo** (menú, ratios, personal, vajilla, líneas de costo, params de barra),
con un cartel que dice por qué y ofrece las dos salidas: *Reabrir* o
*Recalcular con precios actuales*. Los sobrantes siguen editables, porque son
un registro posterior al cierre y no entran al costeo.

Es más restrictivo que hoy. Es también lo que hace que "es información
contable" sea cierto y no un deseo.

## 5. Cuándo se saca la foto

Al finalizar, **antes** de abrir el registro de sobrantes, como pediste — los
drafts de sobrantes salen de `computeMateriaPrima`, así que tienen que salir de
la misma foto que quedó guardada, no de un segundo cálculo que podría diferir.

```
confirmar Finalizar
  └─ 1. calcular las 4 secciones
     2. INSERT event_cost_snapshots  ← si esto falla, el evento NO se finaliza
     3. UPDATE events SET status='finalizado'
     4. abrir LeftoverCloseDialog, alimentado por la foto del paso 1
```

El orden importa: la foto primero. Si se finaliza y después falla el insert,
queda un evento cerrado sin foto, que es justo el estado que estamos tratando
de eliminar. Los pasos 2 y 3 van juntos en una función RPC para que sean
atómicos (el cliente JS de Supabase no puede abrir una transacción).

## 6. Recalcular con precios actuales

Acción explícita en el evento finalizado. El diálogo muestra el delta antes de
ejecutar, que sale gratis porque tenemos los dos números:

> **Recalcular el costo de "Olivera 40"**
> Se reemplaza la foto tomada el 12/03/2026 por una nueva con los precios de hoy.
> - Costo interno: **$1.284.500 → $1.503.200** (+17,0 %)
> - Precio por persona: **$14.272 → $16.702**
> - Queda registrado que este evento se recalculó.
> Esto no se puede deshacer: la foto anterior se pierde.

Cada recálculo agrega una entrada a `history`:
`{ at, origin, internal_total, price_per_person }`. La pantalla del evento
muestra "Costo recalculado el 24/08/2026" cuando `history.length > 1`.

## 7. **[DECIDIR]** Reabrir conserva la foto — coincido con vos

Coincido, y tengo un motivo concreto además del tuyo:

**Si reabrir descartara la foto, un click accidental en "Reabrir" destruiría el
registro contable de forma irreversible** — exactamente el daño que estamos
tratando de evitar. Conservándola, reabrir es una acción inofensiva.

Comportamiento: mientras está reabierto, el evento muestra números **vivos**
(volvió a planificación) con un aviso de que hay una foto guardada del cierre
anterior. Al re-finalizar, la confirmación muestra el delta contra esa foto
antes de reemplazarla, igual que el recálculo.

## 8. Backfill de los eventos ya finalizados

**Lo que hay que decir de frente: no se pueden recuperar los precios originales.**
No existe historial de precios en la base — `products.price` es un solo valor
que se pisa en cada importación. Los eventos finalizados de hace meses ya
tienen, hoy, un costo distinto del que tuvieron el día que se cerraron. Eso ya
pasó y no tiene arreglo.

Lo mejor disponible: **congelarlos en su valor de hoy y marcarlos como no
confiables.** Congela el daño donde está en vez de dejarlo seguir corriendo, y
deja explícito cuáles son historia real y cuáles una reconstrucción.

- `origin: 'backfill'`, `reliable: false`.
- La pantalla del evento muestra una advertencia permanente:
  *"Costo reconstruido el 24/08/2026 a partir de los precios de esa fecha, no
  de los del evento. Los precios pueden haber cambiado desde entonces."*
- Los eventos que se finalicen de acá en adelante quedan `reliable: true` y sin
  advertencia.

**Cómo ejecutarlo — [DECIDIR]:** no como script de Node. El backfill necesita
las funciones de cálculo (TypeScript) *y* credenciales de escritura, y el
proyecto no tiene service-role key configurada (solo `ANON_KEY`). Meter una
clave nueva por una operación que se corre una vez es peor negocio que la
alternativa: **una pantalla de mantenimiento, protegida, que corre con la
sesión del usuario logueado** — que es como escribe todo el resto de la app y
lo que la RLS ya permite.

Flujo en dos pasos, sin sorpresas:

1. **Previsualizar**: lista los eventos finalizados sin foto, con el costo que
   les daría hoy. No escribe nada.
2. **Ejecutar**: crea las fotos. Informa "14 eventos reconstruidos".

Idempotente: solo toca eventos finalizados **sin** foto, así que correrlo dos
veces no pisa nada.

## 9. Qué resuelve esto de la Parte 2

**Bebidas — sí, el congelamiento lo resuelve entero.** Era el caso peor porque
no hay ninguna FK que avise (no existe tabla "bebidas de este evento"), pero
una vez que la barra de un evento cerrado sale de la foto, archivar o borrar
una bebida no puede tocarlo. No hace falta nada adicional del lado de bebidas.

Con la foto en su lugar, el archivado de la Parte 2 pasa a proteger una sola
cosa, mucho más chica: **que no se rompan los eventos ACTIVOS** y que no se
pierdan datos por error. Eso es exactamente lo que archivar hace bien.

## 10. Cómo se verifica

Tu verificación crítica, como script en `scripts/` siguiendo el patrón de los
`verificar-*.ts` que ya existen:

1. Tomar un evento finalizado, anotar `internal_total` y `price_per_person`.
2. Cambiar el precio de un producto que usa. Releer → **igual**.
3. Archivar un ingrediente que usa. Releer → **igual**.
4. Cambiar los ítems de una receta que usa. Releer → **igual**.
5. Cambiar la tarifa de un rol de su personal. Releer → **igual**.
6. Borrar una bebida de su barra. Releer → **igual**.
7. Control negativo: el mismo evento **activo** sí tiene que cambiar en los 5
   casos. Si no cambia, la foto está tapando un cálculo roto.

El paso 7 es el que evita el falso positivo de "no cambia nada porque nada
funciona".

---

## Resumen de lo que necesito que apruebes

| # | Decisión | Mi propuesta |
|---|---|---|
| 1 | Evento finalizado de **solo lectura** (§4) | Sí — sin esto, el usuario edita y no pasa nada |
| 2 | Reabrir **conserva** la foto (§7) | Sí, coincido con vos |
| 3 | Backfill desde una **pantalla de mantenimiento**, no script (§8) | Sí — evita agregar una service-role key |
| 4 | Backfill marca `reliable: false` con aviso permanente (§8) | Sí |

Con esos cuatro OK, arranco por la migración y la función RPC de finalizar.

---

# 11. Lo construido

## Archivos

| Archivo | Qué hace |
|---|---|
| [0019_costos_congelados.sql](supabase/migrations/0019_costos_congelados.sql) | Tabla `event_cost_snapshots` + RPC `save_event_cost_snapshot` (foto y cierre en una transacción) + query de verificación |
| [snapshot.ts](src/lib/snapshot.ts) | Único lugar donde se calcula, arma e interpreta el costo. `computeEventCost`, `buildSnapshotData`, `readSnapshot`, `snapshotDelta` |
| [event-lock.tsx](src/components/eventos/event-lock.tsx) | Contexto de bloqueo + el cartel que lo explica |
| [backfill-costos-card.tsx](src/components/configuracion/backfill-costos-card.tsx) | Reconstrucción, en Configuración |
| [verificar-costos-congelados.ts](scripts/verificar-costos-congelados.ts) | La verificación crítica |

## Diferencias con el diseño

**El origen `refinalizado` no estaba en el diseño.** Pediste que quedara rastro
de las re-finalizaciones; con un solo valor `finalizado` no se distinguía un
cierre normal de uno posterior a una reapertura. Son cuatro orígenes, no tres.

**El bloqueo lo pone `status`, no la existencia de la foto.** Un evento
finalizado al que todavía no se le corrió el backfill también queda quieto,
aunque sus números salgan del catálogo. Si se dejara editable "porque no tiene
foto", sería justo el evento más frágil el único desprotegido.

**El diálogo de sobrantes recibe la materia prima ya calculada.** Antes la
recalculaba por su cuenta. Como se abre después de cerrar el evento, si un
precio cambiaba entremedio los sobrantes salían de una base distinta de la que
registró el costo. Ahora los dos salen de la misma foto.

## El bloqueo, acotado

Bloqueado (está en la foto): PAX y ratios, menú, personal (asignaciones, horas,
tarifas), vajilla (ítems, cantidades, roturas, parámetros), barra (servicio,
día, horario), líneas de instalación / extras / adicionales, y el botón Editar
del evento.

Editable (operativa posterior): **marcar pagado / pendiente**, **registrar,
editar y descartar sobrantes**, y el pedido de vajilla al proveedor (es una
lectura, no modifica nada).

## Cómo verificar

```
node -e "const {createJiti}=require('jiti');createJiti(process.cwd()+'/',{alias:{'@':process.cwd()+'/src'}})('./scripts/verificar-costos-congelados.ts')"
```

Resultado actual: **20 OK · 0 fallos**.

Cubre los cinco casos que pediste —editar el precio de un producto, archivar un
ingrediente, cambiar una receta, cambiar la tarifa de un rol, borrar una
bebida— más tres que agregué:

- **Control negativo (6):** el mismo evento *abierto* tiene que cambiar en los
  cinco casos. Sin esto, un cálculo que devolviera siempre cero pasaría los
  cinco primeros y el test no probaría nada. Los cinco cambian.
- **El bloqueo acotado (7):** marcar un empleado como pagado no mueve el costo,
  y la foto no contiene sobrantes. Es la comprobación de que las dos cosas que
  quedaron editables efectivamente no pueden alterar el número congelado.
- **Versionado (8):** una foto con una forma que este código no sabe leer cae
  al cálculo vivo en vez de romper la pantalla.

La foto pasa por `JSON.parse(JSON.stringify(...))` antes de compararse, para
que cualquier cosa que no sobreviva a la serialización falle en el test y no en
producción.

## Para poner en marcha

1. Correr [0019_costos_congelados.sql](supabase/migrations/0019_costos_congelados.sql)
   en el SQL Editor de Supabase. La query del final tiene que devolver la lista
   de eventos finalizados sin foto (todavía no vacía).
2. En la app: **Configuración → Costos congelados** → *Previsualizar* para ver
   qué eventos se van a tocar y con qué número, después *Reconstruir* (todos o
   de a uno).
3. Volver a correr la query de verificación del paso 1: ahora sí, cero filas.
