-- =====================================================================
-- Oliva — Congelamiento del costo de los eventos finalizados
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query > Run
-- (Requiere 0001–0018)
--
-- EL PROBLEMA QUE RESUELVE
-- Hasta acá el costo de un evento no existía como dato: se recalculaba desde
-- el catálogo vivo en cada render. De las 6 secciones que lo componen, 4 salen
-- del catálogo (materia prima, barra, personal, vajilla). `status='finalizado'`
-- era una etiqueta que no congelaba nada, así que editar el precio de un
-- producto, reimportar una lista o borrar una bebida le cambiaba los números a
-- eventos cerrados meses atrás. Es información contable: no puede moverse.
--
-- LA SOLUCIÓN
-- Al finalizar, se guarda una FOTO completa del desglose. El evento finalizado
-- lee de la foto y nunca del catálogo. Mismo criterio que ya usa `leftovers`
-- con `unit_cost` y `merma_pct` (ver 0017), llevado al costo entero.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) La foto
--
--    Tabla aparte y NO una columna en `events` a propósito: `listEvents()`
--    hace `select *` y la lista de eventos es la home. Una columna jsonb de
--    decenas de KB por evento se bajaría entera en cada visita a la home.
--    Así `events` queda liviano y la foto se pide solo al abrir el evento.
-- ---------------------------------------------------------------------
create table if not exists event_cost_snapshots (
  event_id  uuid primary key references events(id) on delete cascade,

  taken_at  timestamptz not null default now(),

  -- Cómo se generó esta foto:
  --   finalizado   → al cerrar el evento por primera vez.
  --   refinalizado → se reabrió y se volvió a cerrar (la foto anterior se pisó).
  --   recalculado  → el usuario pidió rehacerla con los precios de hoy.
  --   backfill     → reconstruida a posteriori para un evento que se finalizó
  --                  antes de que existiera este mecanismo.
  origin    text not null
    check (origin in ('finalizado','refinalizado','recalculado','backfill')),

  -- false = los precios de la foto NO son los del día del evento.
  -- Solo puede pasar con 'backfill': no hay historial de precios en la base
  -- (products.price es un único valor que se pisa en cada importación), así
  -- que los precios originales de esos eventos están perdidos y no hay forma
  -- de recuperarlos. La foto congela lo mejor disponible y se marca como tal.
  reliable  boolean not null default true,

  -- Denormalizados para listados, badges y verificaciones en SQL sin tener
  -- que parsear el jsonb. Son copia de lo que hay adentro de `data.summary`.
  internal_total    numeric not null,
  price_per_person  numeric not null,
  total_to_client   numeric not null,

  -- El desglose completo (ver EventCostSnapshot en src/lib/types.ts).
  -- Documento: se escribe entero y se lee entero, nunca campo por campo.
  data      jsonb not null,

  -- Auditoría: una entrada por cada vez que se sacó o rehízo la foto, para
  -- que quede rastro de que un evento se tocó después de cerrado.
  --   [{ at, origin, internal_total, price_per_person }, ...]
  history   jsonb not null default '[]'::jsonb
);

comment on table event_cost_snapshots is
  'Foto del costo de un evento al cerrarlo. Es la fuente de verdad de los '
  'números de todo evento finalizado: no se recalculan desde el catálogo.';

alter table event_cost_snapshots enable row level security;

drop policy if exists "auth_all_event_cost_snapshots" on event_cost_snapshots;
create policy "auth_all_event_cost_snapshots" on event_cost_snapshots
  for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------
-- 2) Guardar la foto (y opcionalmente finalizar) en UNA transacción
--
--    El cliente JS de Supabase no puede abrir una transacción: manda un
--    request por operación. Si la foto se guardara desde el front en dos
--    pasos y el segundo fallara, quedaría un evento finalizado SIN foto —
--    exactamente el estado que esta migración viene a eliminar. Por eso las
--    dos escrituras van adentro de una función.
--
--    `security invoker` (el default): la RLS del usuario sigue aplicando.
-- ---------------------------------------------------------------------
create or replace function save_event_cost_snapshot(
  p_event_id          uuid,
  p_data              jsonb,
  p_internal_total    numeric,
  p_price_per_person  numeric,
  p_total_to_client   numeric,
  p_origin            text,
  p_reliable          boolean default true,
  -- true solo cuando la llamada viene de "Finalizar": recalcular o hacer
  -- backfill no deben cambiarle el estado a nada.
  p_finalize          boolean default false
)
returns event_cost_snapshots
language plpgsql
as $$
declare
  v_entry  jsonb;
  v_result event_cost_snapshots;
begin
  v_entry := jsonb_build_object(
    'at',               now(),
    'origin',           p_origin,
    'internal_total',   p_internal_total,
    'price_per_person', p_price_per_person
  );

  insert into event_cost_snapshots as s (
    event_id, taken_at, origin, reliable,
    internal_total, price_per_person, total_to_client,
    data, history
  )
  values (
    p_event_id, now(), p_origin, p_reliable,
    p_internal_total, p_price_per_person, p_total_to_client,
    p_data, jsonb_build_array(v_entry)
  )
  on conflict (event_id) do update set
    taken_at         = now(),
    origin           = excluded.origin,
    reliable         = excluded.reliable,
    internal_total   = excluded.internal_total,
    price_per_person = excluded.price_per_person,
    total_to_client  = excluded.total_to_client,
    data             = excluded.data,
    -- La foto se pisa, pero el rastro de que se pisó NO: se acumula.
    history          = s.history || v_entry
  returning * into v_result;

  if p_finalize then
    update events set status = 'finalizado' where id = p_event_id;
  end if;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------
-- 3) VERIFICACIÓN — tiene que devolver CERO filas.
--    Cualquier evento finalizado sin foto sigue expuesto a que le cambien
--    los números. Después de correr el backfill desde la app
--    (Configuración → Costos congelados), esto tiene que quedar vacío.
-- ---------------------------------------------------------------------
select e.id, e.name, e.event_date
  from events e
  left join event_cost_snapshots s on s.event_id = e.id
 where e.status = 'finalizado'
   and s.event_id is null;
