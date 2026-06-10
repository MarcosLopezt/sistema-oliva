-- =====================================================================
-- Oliva — Fase 5: Barra
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query > Run
-- (Requiere 0001–0003)
-- =====================================================================

do $$ begin
  create type barra_service as enum ('ninguna', 'sin_alcohol', 'con_alcohol');
exception when duplicate_object then null; end $$;

do $$ begin
  create type barra_dia as enum ('semana', 'jueves', 'finde');
exception when duplicate_object then null; end $$;

do $$ begin
  create type barra_horario as enum ('mediodia', 'cena', 'nocturno');
exception when duplicate_object then null; end $$;

-- Campos de barra en el evento.
alter table events add column if not exists barra_service barra_service not null default 'ninguna';
alter table events add column if not exists barra_dia     barra_dia     not null default 'finde';
alter table events add column if not exists barra_horario barra_horario not null default 'cena';

-- ---------------------------------------------------------------------
-- Configuración global de factores (una sola fila). Editable en Configuración.
-- ---------------------------------------------------------------------
create table if not exists bar_settings (
  id            boolean primary key default true check (id),  -- garantiza fila única
  dia_semana    numeric not null default 1.0,
  dia_jueves    numeric not null default 1.2,
  dia_finde     numeric not null default 1.4,
  hor_mediodia  numeric not null default 0.8,
  hor_cena      numeric not null default 1.0,
  hor_nocturno  numeric not null default 1.3
);

insert into bar_settings (id) values (true)
  on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Catálogo de bebidas de barra.
--   ml_per_person_hour = consumo base por persona por hora (editable).
--   size_ml = tamaño de la botella/lata a comprar.
-- ---------------------------------------------------------------------
create table if not exists bar_beverages (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  service              barra_service not null,  -- 'sin_alcohol' | 'con_alcohol'
  size_ml              numeric not null default 1000 check (size_ml > 0),
  price                numeric not null default 0 check (price >= 0),
  ml_per_person_hour   numeric not null default 0 check (ml_per_person_hour >= 0),
  sort_order           integer not null default 0,
  created_at           timestamptz not null default now()
);

-- Seed de bebidas (solo si la tabla está vacía). Precios en 0: completar luego.
insert into bar_beverages (name, service, size_ml, ml_per_person_hour, sort_order)
select * from (values
  ('Coca-Cola Regular',          'sin_alcohol'::barra_service, 2250, 60,  1),
  ('Coca-Cola Zero',             'sin_alcohol'::barra_service, 2250, 60,  2),
  ('Sprite Regular',             'sin_alcohol'::barra_service, 2250, 40,  3),
  ('Agua sin gas',               'sin_alcohol'::barra_service, 1500, 120, 4),
  ('Agua con gas',               'sin_alcohol'::barra_service, 1500, 40,  5),
  ('Gin Gordons',                'con_alcohol'::barra_service, 700,  12,  10),
  ('Aperol',                     'con_alcohol'::barra_service, 750,  8,   11),
  ('Fernet',                     'con_alcohol'::barra_service, 750,  10,  12),
  ('Campari',                    'con_alcohol'::barra_service, 750,  5,   13),
  ('Vermouth Martini Rosso',     'con_alcohol'::barra_service, 1000, 5,   14),
  ('Cynar',                      'con_alcohol'::barra_service, 750,  4,   15),
  ('Agua tónica',                'con_alcohol'::barra_service, 1500, 30,  16),
  ('Soda',                       'con_alcohol'::barra_service, 1500, 25,  17),
  ('Coca-Cola (barra)',          'con_alcohol'::barra_service, 2250, 40,  18),
  ('Cerveza Corona (porrón)',    'con_alcohol'::barra_service, 330,  80,  19),
  ('Cerveza 0.0',                'con_alcohol'::barra_service, 330,  15,  20),
  ('Agua sin gas (barra)',       'con_alcohol'::barra_service, 1500, 80,  21)
) as v(name, service, size_ml, ml_per_person_hour, sort_order)
where not exists (select 1 from bar_beverages limit 1);

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table bar_settings  enable row level security;
alter table bar_beverages enable row level security;

do $$
declare t text;
begin
  foreach t in array array['bar_settings', 'bar_beverages'] loop
    execute format('drop policy if exists "auth_all_%1$s" on %1$s;', t);
    execute format(
      'create policy "auth_all_%1$s" on %1$s
         for all to authenticated using (true) with check (true);', t);
  end loop;
end $$;
