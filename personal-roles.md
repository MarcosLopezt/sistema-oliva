# Personal — Roles con tarifa base y carga múltiple

Dos cambios en la sección Personal:

1. **Roles predeterminados** (Chef, Mozo, Ayudante…) con tarifa base propia, y
   una jerarquía de tarifas de tres niveles.
2. **Selección múltiple** de empleados al armar un evento, con carga masiva de
   horas.

Migración de base: [`supabase/migrations/0018_personal_roles.sql`](supabase/migrations/0018_personal_roles.sql).
Verificación automática: `scripts/verificar-personal-roles.ts` (41 chequeos).

---

## 1. Modelo de datos

```
staff_roles                        ← NUEVA
  id, name, category, hourly_rate, active
   ▲                    ▲
   │ role_id            │ role_id
   │ (rol habitual)     │ (rol puntual del evento)
staff                 event_staff
  role_id               role_id
  hourly_rate           rate_override
  category              hours, paid
```

### `staff_roles` (nueva)

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `name` | text | "Mozo", "Chef", "Bachero" |
| `category` | text | `produccion` \| `servicio`. Texto libre, extensible sin migración |
| `hourly_rate` | numeric | **Nivel 1** de la jerarquía |
| `active` | boolean | Se desactiva en vez de borrar |

Único por `(lower(name), category)`: "Ayudante" puede existir en Producción y en
Servicio como dos puestos distintos, pero no dos veces en la misma categoría.

### Cambios en `staff`

| Columna | Antes | Ahora |
|---|---|---|
| `role_id` | — | FK a `staff_roles`. Rol **habitual**. `null` = sin rol |
| `hourly_rate` | `not null default 0` | **nullable**. `null` = hereda la del rol (**nivel 2**) |
| `role` (texto) | rol como texto libre | se conserva intacta como respaldo histórico; la UI ya no la usa |
| `category` | igual | la define el rol cuando hay uno asignado; editable a mano solo si no hay rol |

### Cambios en `event_staff`

| Columna | Antes | Ahora |
|---|---|---|
| `role_id` | — | FK a `staff_roles`. Rol **solo para este evento**. `null` = usar el habitual |
| `rate_override` | igual | **Nivel 3**: ajuste puntual. `null` = resolver por jerarquía |
| `hours`, `paid` | igual | sin cambios |

Nada se borró ni se renombró.

---

## 2. Jerarquía de tarifas

Se resuelve en [`src/lib/personal.ts`](src/lib/personal.ts) con `resolveRate()`.
Cada nivel pisa al anterior:

| Nivel | Origen | Dónde se carga | Etiqueta en pantalla |
|---|---|---|---|
| 1 | Rol | Personal → Roles | `rol Mozo` — "hereda del rol Mozo" |
| 2 | Empleado | Personal → Empleados | `propia` — "tarifa propia del empleado" |
| 3 | Evento | Detalle del evento → editar fila | `ajustada` — "ajustada para este evento" |

Si no hay ninguna: `sin tarifa` (badge rojo), tarifa 0.

```
rate_override ?? staff.hourly_rate ?? rol.hourly_rate ?? 0
```

**Excepción deliberada:** si el evento le cambió el **rol** al empleado, su
tarifa propia no se arrastra — manda la del rol nuevo. Un mozo con tarifa propia
de $2.500 que trabaja de Ayudante ($2.400) cobra $2.400, porque su tarifa propia
se fijó pensando en su puesto habitual. El ajuste puntual (nivel 3) sigue
mandando sobre todo.

### Señalización visual

Cada tarifa se muestra siempre con un badge de origen
([`rate-origin.tsx`](src/components/personal/rate-origin.tsx)) — en la tabla del
evento, en la lista de empleados y en Pagos. El texto completo va en el tooltip.

Para volver a un valor heredado hay un botón ↺ al lado del campo: vaciar el
campo, no ponerlo en cero. Está tanto en el empleado ("Volver a la tarifa del
rol") como en la fila del evento ("Volver a la tarifa heredada").

### Categoría y subtotales

La línea suma bajo la categoría del **rol del evento** si hay uno puntual; si no,
bajo la categoría del empleado. Un mozo que va a producción en un evento suma en
el subtotal de Producción de ese evento nada más.

---

## 3. Selección múltiple en el evento

[`event-staff-picker-dialog.tsx`](src/components/eventos/event-staff-picker-dialog.tsx).

- Lista de empleados activos no asignados, con checkbox.
- Buscar por nombre (ignora acentos), filtrar por categoría y por rol.
- Selección rápida: "Todos los de Producción", "Todos los de Servicio",
  "Seleccionar los N visibles", "Limpiar".
- Campo **"Horas para todos los seleccionados"**: se aplica a todos los que no
  hayas cambiado a mano. Cualquier fila se puede ajustar individualmente antes
  de confirmar; "Aplicar a todos" descarta esos ajustes.
- Cada fila muestra la tarifa resuelta con su badge de origen y el total de esa
  línea. El pie muestra cuántos van y cuánto suma.
- Al confirmar se hace **un solo insert** para las N filas
  (`addEventStaffBulk`).

**El caso común** — "vienen los 6 mozos de siempre, 5 horas cada uno":
filtrar por Servicio → *Todos los de Servicio* → escribir `5` → *Agregar 6*.
Cuatro interacciones.

Las filas se guardan con `rate_override = null` y `role_id = null` a propósito:
si se congelara la tarifa resuelta en el alta, las seis filas quedarían marcadas
como "ajustada para este evento" y el indicador perdería sentido.

Después de agregarlos, la tabla del evento permite editar **horas, tarifa y rol**
de cada uno por separado, y quitar varios de una con los checkboxes de la tabla.

---

## 4. Compatibilidad con lo que ya existía

### Qué hace la migración con los datos actuales

1. Saca una **foto del costo de personal de cada evento** antes de tocar nada
   (tabla `_personal_roles_check`).
2. Convierte el viejo `staff.role` (texto libre) en roles reales: un rol por
   cada par *(texto, categoría)* que exista. La tarifa del rol arranca en la
   **más frecuente** entre sus empleados, para que sea un default razonable en
   vez de $0.
3. Asigna a cada empleado el rol derivado de su texto. Los que tenían el campo
   vacío quedan **sin rol** y siguen funcionando con su tarifa propia.
4. Todos los empleados existentes **conservan su tarifa actual como tarifa
   propia** (nivel 2), que pisa a la del rol.
5. Recalcula el costo de cada evento con la jerarquía nueva y lo compara contra
   la foto. **La consulta final tiene que devolver cero filas.**

Los roles auto-creados se pueden renombrar y re-tarifar desde Personal → Roles;
no hace falta crearlos de nuevo.

### Por qué ningún costo cambia

| Riesgo | Por qué no se materializa |
|---|---|
| Tarifas ya cargadas | Quedan como tarifa propia (nivel 2), que pisa a la del rol. Un empleado en $0 sigue en $0 — `null` significa "hereda", `0` significa "cero" |
| Eventos ya creados | `rate_override` no se toca; sin `role_id` propio, la resolución cae al mismo número de antes |
| Subtotales por categoría | Sin rol puntual, la categoría sale de `staff.category`, igual que antes |
| Pagos pendiente/pagado | `event_staff.paid` no se toca |

Verificado en el script (bloque 7): para filas legacy, `staffLineTotal()` da
exactamente lo mismo que la fórmula anterior a los roles, incluidos los casos de
tarifa ajustada, empleado sin rol y empleado en $0.

---

## 5. Cómo probarlo

### Antes de nada

Ejecutar `supabase/migrations/0018_personal_roles.sql` en el SQL Editor y
**confirmar que la consulta final devuelve cero filas**. Si devuelve alguna, hay
un evento que cambió de costo: no seguir.

### Verificación de la lógica (sin base)

```bash
node -e "const {createJiti}=require('jiti');createJiti(process.cwd()+'/',{alias:{'@':process.cwd()+'/src'}})('./scripts/verificar-personal-roles.ts')"
```

Resultado esperado: `✓ TODO OK — 41 verificaciones pasaron, 0 fallaron`.

### En la app

| # | Prueba | Esperado |
|---|---|---|
| 1 | Personal → Roles → crear Chef $3.500 Producción, Ayudante $2.400 Producción, Mozo $2.200 Servicio | Los tres en la tabla, con la cuenta de empleados en 0 |
| 2 | Asignar el rol Mozo a un empleado sin tarifa propia | Su fila muestra $2.200 con badge `Mozo` |
| 3 | Cargarle tarifa propia $2.500 | Muestra $2.500 con badge `propia`. El botón ↺ la devuelve a $2.200 |
| 4 | En un evento: Agregar → filtrar Servicio → Todos los de Servicio → horas 5 → confirmar | Entran todos juntos, cada uno con su tarifa resuelta y total = 5 × tarifa |
| 5 | Editar una fila → Rol en este evento = Ayudante | La tarifa pasa a $2.400, aparece "(este evento)" y la línea salta al subtotal de Producción. En Personal, el rol habitual sigue siendo Mozo |
| 6 | Editar una fila → Tarifa para este evento = $3.000 | Badge `ajustada`. En Personal la tarifa del empleado y la del rol no se movieron |
| 7 | Abrir un evento viejo y comparar el costo de personal con el anterior al cambio | Idéntico |

---

## 6. Archivos tocados

| Archivo | Qué cambió |
|---|---|
| `supabase/migrations/0018_personal_roles.sql` | Esquema, migración de datos y verificación |
| `src/lib/types.ts` | `StaffRole`, `StaffWithRole`, `staff.role_id`, `hourly_rate` nullable, `event_staff.role_id` |
| `src/lib/personal.ts` | `resolveRate()`, `resolveStaffRate()`, `rateSourceLabel()`, `appliedRole()`, `lineCategory()` |
| `src/lib/queries.ts` | CRUD de roles, joins con `staff_roles`, alta y baja masivas |
| `src/lib/hooks.ts` | `useStaffRoles`, `useAddEventStaffBulk`, `useRemoveEventStaffBulk`, invalidaciones |
| `src/components/personal/rate-origin.tsx` | Badge y celda de origen de tarifa (nuevo) |
| `src/components/personal/staff-role-dialog.tsx` | Alta/edición de roles (nuevo) |
| `src/components/personal/staff-dialog.tsx` | Rol habitual, tarifa propia opcional, vista previa |
| `src/app/(app)/personal/page.tsx` | Pestañas Empleados / Roles, filtro por rol |
| `src/app/(app)/personal/pagos/page.tsx` | Tarifa con badge de origen |
| `src/components/eventos/event-staff-picker-dialog.tsx` | Selector múltiple (nuevo) |
| `src/components/eventos/event-staff-dialog.tsx` | Solo edición: rol del evento, tarifa puntual, reset |
| `src/components/eventos/event-staff-section.tsx` | Columna Rol, badges, selección múltiple para quitar |
| `scripts/verificar-personal-roles.ts` | Verificación de la jerarquía y de la compatibilidad (nuevo) |

---

## 7. Pendiente conocido

La tarifa se resuelve **en vivo**: si mañana cambiás la tarifa de un rol, los
eventos viejos de empleados que la heredan pasan a costar distinto. Es el mismo
comportamiento que ya tenía la tarifa del empleado antes de este cambio, así que
no se alteró la semántica. Si en algún momento hace falta que el costo de un
evento quede congelado al cerrarlo, es un cambio aparte: guardar la tarifa
resuelta en la fila al cerrar el evento.
