-- =====================================================================
-- Oliva — Roles de personal con tarifa base
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query > Run
-- (Requiere 0007_personal.sql)
--
-- Introduce el catálogo global de ROLES (Chef, Mozo, Bachero…) y arma la
-- jerarquía de tarifas de tres niveles, donde cada nivel pisa al anterior:
--
--   1) staff_roles.hourly_rate  → tarifa por defecto del rol
--   2) staff.hourly_rate        → tarifa propia del empleado (opcional)
--   3) event_staff.rate_override→ ajuste puntual para un evento (opcional)
--
-- El empleado tiene un ROL HABITUAL (staff.role_id) que se puede cambiar
-- puntualmente en un evento (event_staff.role_id) sin tocar el habitual.
-- Cuando el evento cambia el rol, la base pasa a ser la del rol nuevo: la
-- tarifa propia se fijó pensando en el rol habitual y no se arrastra a un
-- puesto distinto (ver resolveRate() en src/lib/personal.ts).
--
-- COMPATIBILIDAD: no se borra ni se renombra ninguna columna. Los eventos
-- ya cargados conservan exactamente el mismo costo — el paso 0 saca una
-- foto y el paso 6 la compara.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0) Foto del costo de personal ANTES del cambio, para verificar al final.
--    Sin políticas RLS: solo se lee desde el SQL Editor, no por la API.
-- ---------------------------------------------------------------------
create table if not exists _personal_roles_check as
  select
    es.event_id,
    sum(es.hours * coalesce(es.rate_override, s.hourly_rate, 0)) as cost_before
  from event_staff es
  join staff s on s.id = es.staff_id
  group by es.event_id;

alter table _personal_roles_check enable row level security;

-- ---------------------------------------------------------------------
-- 1) Catálogo global de roles.
--    category: mismo texto libre que staff.category ('produccion' |
--              'servicio'), extensible sin migración.
--    active:   se desactiva en vez de borrar, para no romper el historial.
--    El nombre es único DENTRO de la categoría: "Ayudante" puede existir
--    en Producción y en Servicio y ser dos puestos distintos.
-- ---------------------------------------------------------------------
create table if not exists staff_roles (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  category     text not null default 'produccion',
  hourly_rate  numeric not null default 0 check (hourly_rate >= 0),
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

create unique index if not exists staff_roles_name_category_key
  on staff_roles (lower(name), category);
create index if not exists staff_roles_active_idx on staff_roles (active);

alter table staff_roles enable row level security;
drop policy if exists "auth_all_staff_roles" on staff_roles;
create policy "auth_all_staff_roles" on staff_roles
  for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------
-- 2) Empleado: rol habitual + tarifa propia AHORA OPCIONAL.
--    hourly_rate null = hereda la tarifa del rol. Las filas existentes
--    conservan su número, así que nada cambia de costo.
--    on delete set null: si algún día se borra un rol, el empleado queda
--    sin rol en vez de desaparecer.
-- ---------------------------------------------------------------------
alter table staff
  add column if not exists role_id uuid references staff_roles(id) on delete set null;

alter table staff alter column hourly_rate drop not null;
alter table staff alter column hourly_rate drop default;

create index if not exists staff_role_idx on staff (role_id);

-- ---------------------------------------------------------------------
-- 3) Asignación al evento: rol puntual.
--    null = usar el rol habitual del empleado. NO modifica staff.role_id.
--    rate_override (nivel 3) ya existe desde 0007 y no se toca.
-- ---------------------------------------------------------------------
alter table event_staff
  add column if not exists role_id uuid references staff_roles(id) on delete set null;

create index if not exists event_staff_role_idx on event_staff (role_id);

-- ---------------------------------------------------------------------
-- 4) Migración de datos: convertir el viejo staff.role (texto libre) en
--    roles reales, uno por cada par (texto, categoría) que exista.
--    La tarifa del rol arranca en la MÁS FRECUENTE entre sus empleados,
--    para que sea un default razonable en vez de $0. Esto no altera
--    ningún costo: todos los empleados existentes tienen tarifa propia
--    (nivel 2), que pisa a la del rol.
--    La columna staff.role se conserva intacta como respaldo histórico.
-- ---------------------------------------------------------------------
insert into staff_roles (name, category, hourly_rate)
  select
    btrim(s.role),
    s.category,
    coalesce(mode() within group (order by s.hourly_rate), 0)
  from staff s
  where nullif(btrim(s.role), '') is not null
  group by btrim(s.role), s.category
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 5) Asignar a cada empleado el rol derivado de su texto.
--    Los que tenían el campo vacío quedan sin rol (role_id null) y siguen
--    funcionando con su tarifa propia hasta que se les configure uno.
-- ---------------------------------------------------------------------
update staff s
   set role_id = r.id
  from staff_roles r
 where s.role_id is null
   and nullif(btrim(s.role), '') is not null
   and lower(r.name) = lower(btrim(s.role))
   and r.category = s.category;

-- ---------------------------------------------------------------------
-- 6) VERIFICACIÓN — tiene que devolver CERO filas.
--    Recalcula el costo de personal de cada evento con la jerarquía nueva
--    y lo compara contra la foto del paso 0. Cualquier fila que aparezca
--    acá es un evento que cambió de costo: NO seguir hasta entenderlo.
-- ---------------------------------------------------------------------
select
    c.event_id,
    c.cost_before,
    x.cost_after,
    x.cost_after - c.cost_before as diferencia
  from _personal_roles_check c
  join (
    select
      es.event_id,
      sum(es.hours * coalesce(
        es.rate_override,
        case
          when es.role_id is not null and es.role_id is distinct from s.role_id
          then er.hourly_rate
        end,
        s.hourly_rate,
        hr.hourly_rate,
        0
      )) as cost_after
    from event_staff es
    join staff s on s.id = es.staff_id
    left join staff_roles er on er.id = es.role_id
    left join staff_roles hr on hr.id = s.role_id
    group by es.event_id
  ) x on x.event_id = c.event_id
 where abs(c.cost_before - x.cost_after) > 0.0001;

-- Cuando la verificación dé cero filas, la foto ya no hace falta:
--   drop table _personal_roles_check;
