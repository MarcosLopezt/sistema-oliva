-- =====================================================================
-- Oliva — Personal como módulo global (Mejora 1)
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query > Run
-- (Requiere 0001–0006)
--
-- Reemplaza el viejo "Personal" como línea de costos del evento por un
-- catálogo global de empleados (staff) + la asignación de empleados a
-- cada evento (event_staff) con horas, tarifa puntual y estado de pago.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Catálogo global de empleados.
--   category: texto libre (no enum) para mantenerlo extensible sin migración.
--             Hoy: 'produccion' | 'servicio'. El front define la lista.
--   active:   se desactiva en vez de borrar, para conservar el historial.
-- ---------------------------------------------------------------------
create table if not exists staff (
  id           uuid primary key default gen_random_uuid(),
  full_name    text not null,
  category     text not null default 'produccion',
  role         text,
  hourly_rate  numeric not null default 0 check (hourly_rate >= 0),
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

create index if not exists staff_active_idx on staff (active);

alter table staff enable row level security;
drop policy if exists "auth_all_staff" on staff;
create policy "auth_all_staff" on staff
  for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------
-- Empleados asignados a un evento.
--   hours:         horas trabajadas en ese evento.
--   rate_override: tarifa puntual para ese evento (null = usar staff.hourly_rate).
--   paid:          estado de pago (false = pendiente, true = pagado).
-- ---------------------------------------------------------------------
create table if not exists event_staff (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references events(id) on delete cascade,
  staff_id       uuid not null references staff(id) on delete cascade,
  hours          numeric not null default 0 check (hours >= 0),
  rate_override  numeric check (rate_override >= 0),
  paid           boolean not null default false,
  created_at     timestamptz not null default now(),
  unique (event_id, staff_id)
);

create index if not exists event_staff_event_idx on event_staff (event_id);
create index if not exists event_staff_staff_idx on event_staff (staff_id);

alter table event_staff enable row level security;
drop policy if exists "auth_all_event_staff" on event_staff;
create policy "auth_all_event_staff" on event_staff
  for all to authenticated using (true) with check (true);
