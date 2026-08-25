-- =====================================================================
-- Oliva — Endurecer las FK que borran o desvinculan en silencio
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query > Run
-- (INDEPENDIENTE de 0020: no se tocan las mismas cosas, el orden da igual)
--
-- POR QUÉ, SI LA INTERFAZ YA NO BORRA NADA
-- Porque la interfaz no es el único camino: el mantenimiento de esta base se
-- hace con SQL a mano desde el editor, incluidos borrados masivos. Ahí no hay
-- diálogo de confirmación ni chequeo de dependencias — solo lo que la base
-- misma esté dispuesta a impedir.
--
-- Hoy hay cinco FKs que, ante un DELETE, NO fallan: borran en cascada o dejan
-- la columna en NULL, sin decir nada. Son las que convierten un `delete from
-- products where ...` de más en pérdida de datos silenciosa.
--
-- RELACIÓN CON EL ARCHIVADO (0020)
-- No lo reemplaza: lo respalda. El camino de archivados sigue haciendo sus
-- chequeos explícitos, que son los que dan el mensaje útil ("2 ingredientes lo
-- usan y 1 sobrante salió de él"). RESTRICT es la red por debajo, para lo que
-- no pasa por ahí. Las dos capas se validan igual y no se estorban.
-- =====================================================================


-- =====================================================================
-- PASO 1 — PREFLIGHT. Correr ESTO SOLO Y LEER EL RESULTADO ANTES DE SEGUIR.
--
-- Tiene que devolver CERO filas. Si devuelve alguna, NO correr el paso 2:
-- hay filas huérfanas que apuntan a algo que ya no existe, y volver a crear
-- la constraint va a fallar. (No debería pasar: la FK ya estaba y las venía
-- validando. Pero si en algún borrado masivo se desactivaron los triggers de
-- replicación, sí puede haber quedado basura, y es mejor enterarse acá.)
-- =====================================================================

select 'ingredients.product_id' as fk, i.id::text as fila_huerfana
  from ingredients i
 where i.product_id is not null
   and not exists (select 1 from products p where p.id = i.product_id)
union all
select 'leftovers.product_id', l.id::text
  from leftovers l
 where not exists (select 1 from products p where p.id = l.product_id)
union all
select 'event_staff.staff_id', es.id::text
  from event_staff es
 where not exists (select 1 from staff s where s.id = es.staff_id)
union all
select 'staff.role_id', s.id::text
  from staff s
 where s.role_id is not null
   and not exists (select 1 from staff_roles r where r.id = s.role_id)
union all
select 'event_staff.role_id', es.id::text
  from event_staff es
 where es.role_id is not null
   and not exists (select 1 from staff_roles r where r.id = es.role_id);


-- =====================================================================
-- PASO 1b — DIAGNÓSTICO INFORMATIVO (no bloquea nada).
--
-- Muestra el daño que la vieja `on delete set null` de ingredients.product_id
-- YA pueda haber hecho: ingredientes que se quedaron sin producto y sin precio
-- de mercado, o sea que hoy no se pueden costear. Si aparecen varios, es la
-- huella de un borrado de productos anterior. Vale la pena mirarlos: las
-- recetas que los usan están costeando de menos sin avisar.
-- =====================================================================

select i.id, i.name, i.base_unit, i.created_at
  from ingredients i
 where i.product_id is null
   and i.market_price is null
 order by i.name;


-- =====================================================================
-- PASO 2 — LOS CAMBIOS. Correr solo si el PASO 1 dio cero filas.
--
-- Va todo en una transacción: o quedan las cinco, o ninguna. A mitad de
-- camino la base quedaría con la mitad de las FK viejas y la mitad nuevas,
-- que es peor que no haber empezado.
-- =====================================================================
begin;

-- ---------------------------------------------------------------------
-- 1) ingredients.product_id : SET NULL → RESTRICT
--
-- LA PEOR DE LAS CINCO. Borrar un producto dejaba el ingrediente en NULL:
-- perdía su precio y `ingredientUnitPrice` pasaba a devolver el precio de
-- mercado o null. La línea desaparecía del costo de los eventos ACTIVOS sin
-- ningún aviso — el evento simplemente costaba menos.
-- ---------------------------------------------------------------------
alter table ingredients
  drop constraint if exists ingredients_product_id_fkey;
alter table ingredients
  add constraint ingredients_product_id_fkey
  foreign key (product_id) references products(id) on delete restrict;

-- ---------------------------------------------------------------------
-- 2) leftovers.product_id : CASCADE → RESTRICT
--
-- Borrar un producto se llevaba puestos todos sus sobrantes registrados,
-- incluidos los snapshots de precio (`unit_cost`) que 0017 documenta como
-- IRRECUPERABLES. Se perdía el dato que permite calibrar la merma.
-- ---------------------------------------------------------------------
alter table leftovers
  drop constraint if exists leftovers_product_id_fkey;
alter table leftovers
  add constraint leftovers_product_id_fkey
  foreign key (product_id) references products(id) on delete restrict;

-- ---------------------------------------------------------------------
-- 3) event_staff.staff_id : CASCADE → RESTRICT
--
-- Borrar un empleado borraba sus asignaciones a TODOS los eventos, con sus
-- horas, sus tarifas y su estado de pago. El costo de personal de cada evento
-- activo bajaba, y el historial de a quién se le pagó qué desaparecía.
-- Por eso existe `staff.active` desde 0007: el empleado se desactiva.
-- ---------------------------------------------------------------------
alter table event_staff
  drop constraint if exists event_staff_staff_id_fkey;
alter table event_staff
  add constraint event_staff_staff_id_fkey
  foreign key (staff_id) references staff(id) on delete restrict;

-- ---------------------------------------------------------------------
-- 4) staff.role_id : SET NULL → RESTRICT
-- 5) event_staff.role_id : SET NULL → RESTRICT
--
-- Borrar un rol dejaba en NULL el rol del empleado y el ajuste puntual del
-- evento. Como la tarifa se hereda del rol (jerarquía de tres niveles de
-- 0018), el empleado pasaba a cobrar su tarifa propia o 0: el costo de
-- personal de los eventos activos cambiaba solo.
-- `staff_roles.active` ya existe para esto — 0018 lo dice: "se desactiva en
-- vez de borrar, para no romper el historial".
-- ---------------------------------------------------------------------
alter table staff
  drop constraint if exists staff_role_id_fkey;
alter table staff
  add constraint staff_role_id_fkey
  foreign key (role_id) references staff_roles(id) on delete restrict;

alter table event_staff
  drop constraint if exists event_staff_role_id_fkey;
alter table event_staff
  add constraint event_staff_role_id_fkey
  foreign key (role_id) references staff_roles(id) on delete restrict;

commit;


-- =====================================================================
-- LO QUE NO SE TOCA, Y POR QUÉ
--
-- No toda cascada es un error. Estas doce se dejan a propósito:
--
-- HIJOS DEL EVENTO — cascade correcto. Son partes del evento, no entidades
-- propias: si el evento se borra, no tienen sentido por separado.
--   event_recipes.event_id, event_costs.event_id, event_staff.event_id,
--   event_tableware.event_id, event_cost_snapshots.event_id
--
-- HIJOS DE LA RECETA — mismo criterio.
--   recipe_items.recipe_id
--
-- YA ESTABAN BIEN (restrict): frenan y avisan.
--   recipe_items.ingredient_id, event_recipes.recipe_id, event_tableware.item_id
--
-- leftovers.origin_event_id (SET NULL) — DELIBERADO, ver 0017: el sobrante
-- físico sigue en la heladera aunque se borre el evento del que salió, y
-- `origin_event_name` guarda el rastro de dónde vino. Acá el NULL no pierde
-- información: la conserva en otra columna. Es la diferencia con los cinco
-- casos de arriba.
--
-- products.provider_id y tableware_items.provider_id (CASCADE) — se dejan,
-- pero OJO CON EL EFECTO DE ESTA MIGRACIÓN:
--   Borrar un proveedor sigue intentando borrar toda su lista de precios, y
--   ahora esa cascada choca contra el nuevo RESTRICT de ingredients y
--   leftovers. O sea: a partir de acá, borrar un proveedor FALLA si alguno de
--   sus productos está vinculado a un ingrediente o tiene sobrantes.
--   Es el comportamiento correcto —antes ese borrado se llevaba la lista
--   entera en silencio— pero el mensaje que va a salir es el error crudo de
--   Postgres, porque los proveedores no entraron en el archivado de 0020.
--   Si el borrado de proveedores se vuelve molesto, la salida es meterlos en
--   el archivado, no aflojar estas FKs.
-- =====================================================================


-- =====================================================================
-- PASO 3 — VERIFICACIÓN. Correr después del paso 2.
--
-- Lista todas las FK del esquema con su regla de borrado. Las cinco de arriba
-- tienen que figurar como NO ACTION/RESTRICT ('a' o 'r' en confdeltype).
-- Sirve además como foto del estado real, que es más confiable que leer las
-- migraciones una por una.
-- =====================================================================

select
    c.conrelid::regclass::text                       as tabla,
    a.attname                                        as columna,
    c.confrelid::regclass::text                      as referencia_a,
    case c.confdeltype
      when 'a' then 'NO ACTION'
      when 'r' then 'RESTRICT'
      when 'c' then 'CASCADE'
      when 'n' then 'SET NULL'
      when 'd' then 'SET DEFAULT'
    end                                              as al_borrar
  from pg_constraint c
  join pg_attribute a
    on a.attrelid = c.conrelid
   and a.attnum = any(c.conkey)
 where c.contype = 'f'
   and c.connamespace = 'public'::regnamespace
 order by 4 desc, 1, 2;
