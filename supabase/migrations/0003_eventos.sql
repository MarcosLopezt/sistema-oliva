-- =====================================================================
-- Oliva — Fase 4: Eventos + selección de menú (Materia Prima)
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query > Run
-- (Requiere 0001 y 0002)
-- =====================================================================

do $$ begin
  create type event_status as enum ('activo', 'finalizado');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type event_recipe_role as enum
    ('bocado', 'principal', 'principal_veggie', 'postre');
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------
-- Eventos
--   Los ratios de cálculo son editables por evento (defaults de Oliva).
-- ---------------------------------------------------------------------
create table if not exists events (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  event_date          date,
  pax                 integer not null default 0 check (pax >= 0),
  duration_hours      numeric not null default 5 check (duration_hours > 0),
  status              event_status not null default 'activo',
  -- Ratios de materia prima
  bocados_per_person  numeric not null default 2 check (bocados_per_person >= 0),
  principal_extra     integer not null default 10 check (principal_extra >= 0),
  veggie_pct          numeric not null default 0.30 check (veggie_pct >= 0 and veggie_pct <= 1),
  merma_pct           numeric not null default 0.15 check (merma_pct >= 0),
  -- Precio sugerido
  margin_pct          numeric not null default 0 check (margin_pct >= 0),
  notes               text,
  created_at          timestamptz not null default now()
);

create index if not exists events_status_date_idx on events (status, event_date);

-- ---------------------------------------------------------------------
-- Recetas elegidas para el evento (con su rol en el menú)
-- ---------------------------------------------------------------------
create table if not exists event_recipes (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references events(id) on delete cascade,
  recipe_id   uuid not null references recipes(id) on delete restrict,
  role        event_recipe_role not null,
  created_at  timestamptz not null default now(),
  unique (event_id, recipe_id, role)
);

create index if not exists event_recipes_event_id_idx on event_recipes (event_id);

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table events        enable row level security;
alter table event_recipes enable row level security;

do $$
declare t text;
begin
  foreach t in array array['events', 'event_recipes'] loop
    execute format('drop policy if exists "auth_all_%1$s" on %1$s;', t);
    execute format(
      'create policy "auth_all_%1$s" on %1$s
         for all to authenticated
         using (true) with check (true);', t);
  end loop;
end $$;
