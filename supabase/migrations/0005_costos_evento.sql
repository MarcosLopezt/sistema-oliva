-- =====================================================================
-- Oliva — Fase 6: Personal, Vajilla, Instalación, Extras, Costos adicionales
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query > Run
-- (Requiere 0001–0004)
-- =====================================================================

do $$ begin
  create type event_cost_section as enum
    ('personal', 'vajilla', 'instalacion', 'extra', 'adicional');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- Líneas de costo del evento (modelo unificado para las 5 secciones).
--   quantity × unit_price = subtotal.
--   'extra'     = costos internos de Oliva (entran al precio por persona).
--   'adicional' = se cobran aparte al cliente (NO entran al precio por persona).
-- ---------------------------------------------------------------------
create table if not exists event_costs (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references events(id) on delete cascade,
  section     event_cost_section not null,
  name        text not null,
  detail      text,
  quantity    numeric not null default 1 check (quantity >= 0),
  unit_price  numeric not null default 0 check (unit_price >= 0),
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists event_costs_event_section_idx
  on event_costs (event_id, section);

alter table event_costs enable row level security;

drop policy if exists "auth_all_event_costs" on event_costs;
create policy "auth_all_event_costs" on event_costs
  for all to authenticated using (true) with check (true);
