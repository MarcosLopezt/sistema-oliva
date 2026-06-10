-- =====================================================================
-- Oliva — Fase 3: Recetas
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query > Run
-- (Requiere haber corrido antes 0001_catalogos.sql)
-- =====================================================================

-- Categoría del plato dentro del menú.
do $$ begin
  create type recipe_category as enum ('bocado', 'principal', 'postre', 'guarnicion', 'otro');
exception
  when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------
-- Recetas
--   yield_units = cuántas unidades (bocados / platos / porciones) rinde
--                 la receta con las cantidades cargadas en recipe_items.
--   is_veggie   = marca la opción vegetariana (para el principal veggie).
-- ---------------------------------------------------------------------
create table if not exists recipes (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  category     recipe_category not null default 'bocado',
  subcategory  text,
  is_veggie    boolean not null default false,
  yield_units  numeric not null default 1 check (yield_units > 0),
  description  text,
  notes        text,
  created_at   timestamptz not null default now()
);

create index if not exists recipes_category_idx on recipes (category);

-- ---------------------------------------------------------------------
-- Ítems de la receta (ingrediente + cantidad para el lote completo)
-- ---------------------------------------------------------------------
create table if not exists recipe_items (
  id             uuid primary key default gen_random_uuid(),
  recipe_id      uuid not null references recipes(id) on delete cascade,
  ingredient_id  uuid not null references ingredients(id) on delete restrict,
  quantity       numeric not null default 0 check (quantity >= 0),
  unit           unit_kind not null,
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now()
);

create index if not exists recipe_items_recipe_id_idx on recipe_items (recipe_id);

-- ---------------------------------------------------------------------
-- RLS: acceso total para usuarios autenticados (equipo chico).
-- ---------------------------------------------------------------------
alter table recipes      enable row level security;
alter table recipe_items enable row level security;

do $$
declare t text;
begin
  foreach t in array array['recipes', 'recipe_items'] loop
    execute format('drop policy if exists "auth_all_%1$s" on %1$s;', t);
    execute format(
      'create policy "auth_all_%1$s" on %1$s
         for all to authenticated
         using (true) with check (true);', t);
  end loop;
end $$;
