-- =====================================================================
-- Oliva — Archivado en vez de borrado
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query > Run
-- (Requiere 0001–0019)
--
-- "Eliminar" pasa a archivar. Nada se borra desde la interfaz normal.
--
-- POR QUÉ `active boolean` Y NO UNA TABLA DE PAPELERA
-- El sistema ya archiva empleados y roles con `active boolean` (ver 0007 y
-- 0018). Reusar exactamente esa columna evita un segundo mecanismo que hubiera
-- que mantener en paralelo, y hace que deshacer sea un update de un booleano
-- en vez de una restauración con reconstrucción de FKs.
--
-- QUÉ PROTEGE ESTO Y QUÉ NO
-- Los eventos FINALIZADOS ya están protegidos por su foto de costo (0019):
-- leen del snapshot, así que archivar o incluso borrar no puede tocarlos.
-- Lo que esto protege es a los eventos ACTIVOS —que sí leen del catálogo
-- vivo— y a los datos que se perderían por un click equivocado.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) La columna, en las cinco entidades.
--    `archived_at` es informativo (ordenar la vista de archivados por lo más
--    reciente); la fuente de verdad es `active`, y el trigger de abajo se
--    encarga de mantenerlos coherentes para que ningún llamador tenga que
--    acordarse de escribir los dos.
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'ingredients', 'recipes', 'products', 'bar_beverages', 'leftovers'
  ] loop
    execute format(
      'alter table %I add column if not exists active boolean not null default true;', t);
    execute format(
      'alter table %I add column if not exists archived_at timestamptz;', t);
    execute format(
      'create index if not exists %I on %I (active);', t || '_active_idx', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 2) `archived_at` derivado de `active`.
-- ---------------------------------------------------------------------
create or replace function sync_archived_at()
returns trigger as $$
begin
  if new.active = false and (old.active is distinct from false) then
    new.archived_at = now();
  elsif new.active = true then
    new.archived_at = null;
  end if;
  return new;
end;
$$ language plpgsql;

do $$
declare t text;
begin
  foreach t in array array[
    'ingredients', 'recipes', 'products', 'bar_beverages', 'leftovers'
  ] loop
    execute format('drop trigger if exists %I on %I;', t || '_sync_archived_at', t);
    execute format(
      'create trigger %I before update on %I
         for each row execute function sync_archived_at();',
      t || '_sync_archived_at', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 3) Archivar / desarchivar en masa, ATÓMICO.
--
--    El cliente JS no puede abrir una transacción: manda un request por fila.
--    Archivando doce ingredientes de a uno, un fallo en el séptimo dejaría
--    seis archivados y seis no, y el "Deshacer" no sabría cuáles revertir.
--    Un solo UPDATE ... WHERE id = any(...) es atómico por definición.
--
--    `p_entity` NO se concatena: se traduce contra una lista blanca. Es la
--    única forma de usar SQL dinámico acá sin abrir una inyección.
-- ---------------------------------------------------------------------
create or replace function set_rows_active(
  p_entity  text,
  p_ids     uuid[],
  p_active  boolean
)
returns integer
language plpgsql
as $$
declare
  v_table text;
  v_count integer;
begin
  v_table := case p_entity
    when 'ingredients'   then 'ingredients'
    when 'recipes'       then 'recipes'
    when 'products'      then 'products'
    when 'bar_beverages' then 'bar_beverages'
    when 'leftovers'     then 'leftovers'
    else null
  end;

  if v_table is null then
    raise exception 'Entidad no archivable: %', p_entity;
  end if;

  if p_ids is null or array_length(p_ids, 1) is null then
    return 0;
  end if;

  execute format(
    'update %I set active = $1 where id = any($2) and active is distinct from $1',
    v_table
  ) using p_active, p_ids;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------
-- 4) Borrado definitivo — solo desde la vista de archivados, y SOLO de lo
--    que no está referenciado en ningún lado.
--
--    La condición se verifica ACÁ y no en el front. Si viviera solo en la UI,
--    cualquier camino que no pase por ese botón (un import, un script) podría
--    borrar algo referenciado. Las filas que no cumplen se saltean en silencio
--    y no entran en el conteo devuelto: la función borra lo que puede borrar,
--    nunca "casi todo".
--
--    Los eventos finalizados no entran en la cuenta: leen de su foto, así que
--    ningún borrado los alcanza. Lo que se protege son las referencias vivas.
-- ---------------------------------------------------------------------
create or replace function delete_archived_rows(
  p_entity  text,
  p_ids     uuid[]
)
returns integer
language plpgsql
as $$
declare
  v_sql   text;
  v_count integer;
begin
  if p_ids is null or array_length(p_ids, 1) is null then
    return 0;
  end if;

  v_sql := case p_entity
    -- Un ingrediente usado por cualquier receta se queda. (La FK ya es
    -- RESTRICT; esto lo hace explícito y saltea en vez de reventar.)
    when 'ingredients' then
      'delete from ingredients x where x.id = any($1) and x.active = false
         and not exists (select 1 from recipe_items ri where ri.ingredient_id = x.id)'

    -- Una receta usada por cualquier evento se queda. Sus recipe_items caen
    -- por cascada, que es lo correcto: son parte de la receta.
    when 'recipes' then
      'delete from recipes x where x.id = any($1) and x.active = false
         and not exists (select 1 from event_recipes er where er.recipe_id = x.id)'

    -- CRÍTICO: products tiene FKs que NO frenan nada por sí solas
    -- (ingredients.product_id es SET NULL y leftovers.product_id es CASCADE).
    -- Sin estos dos chequeos, borrar un producto dejaría ingredientes sin
    -- precio y se llevaría puestos sus sobrantes, en silencio.
    when 'products' then
      'delete from products x where x.id = any($1) and x.active = false
         and not exists (select 1 from ingredients i where i.product_id = x.id)
         and not exists (select 1 from leftovers l where l.product_id = x.id)'

    -- bar_beverages no tiene NINGUNA FK: el catálogo es global y la barra se
    -- calcula filtrándolo en cada render. Estar archivada ya la saca de todos
    -- los eventos activos (listBarBeverages filtra), y los finalizados leen de
    -- su foto. Por eso alcanza con exigir que esté archivada.
    when 'bar_beverages' then
      'delete from bar_beverages x where x.id = any($1) and x.active = false'

    -- Nada referencia a leftovers: es una hoja del grafo. Etapa 1 es registro
    -- informativo y no entra en ningún costeo.
    when 'leftovers' then
      'delete from leftovers x where x.id = any($1) and x.active = false'

    else null
  end;

  if v_sql is null then
    raise exception 'Entidad no borrable: %', p_entity;
  end if;

  execute v_sql using p_ids;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------
-- 5) VERIFICACIÓN — al recién correr la migración, todo tiene que dar 0
--    archivados y ningún NULL en `active`.
-- ---------------------------------------------------------------------
select 'ingredients' as entidad, count(*) filter (where not active) as archivados,
       count(*) as total from ingredients
union all select 'recipes',       count(*) filter (where not active), count(*) from recipes
union all select 'products',      count(*) filter (where not active), count(*) from products
union all select 'bar_beverages', count(*) filter (where not active), count(*) from bar_beverages
union all select 'leftovers',     count(*) filter (where not active), count(*) from leftovers;
