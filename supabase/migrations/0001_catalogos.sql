-- =====================================================================
-- Oliva — Fase 2: Catálogos (proveedores, productos, ingredientes)
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query > Run
-- =====================================================================

-- Unidades base soportadas (masa, volumen, conteo).
do $$ begin
  create type unit_kind as enum ('g', 'kg', 'ml', 'l', 'un');
exception
  when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------
-- Proveedores
-- ---------------------------------------------------------------------
create table if not exists providers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  notes       text,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Productos (ítems de la lista de precios de cada proveedor)
--   pack_size = cantidad de base_unit por unidad de compra
--               (ej: bidón de 5 L -> base_unit='l', pack_size=5)
--   price     = precio de esa unidad de compra (el "pack")
-- ---------------------------------------------------------------------
create table if not exists products (
  id                  uuid primary key default gen_random_uuid(),
  provider_id         uuid not null references providers(id) on delete cascade,
  code                text,
  name                text not null,
  base_unit           unit_kind not null,
  pack_size           numeric not null default 1 check (pack_size > 0),
  price               numeric not null default 0 check (price >= 0),
  price_includes_iva  boolean not null default false,
  updated_at          timestamptz not null default now(),
  created_at          timestamptz not null default now()
);

create index if not exists products_provider_id_idx on products (provider_id);
create index if not exists products_name_idx on products (name);

-- ---------------------------------------------------------------------
-- Ingredientes (nombre canónico de receta)
--   product_id  = producto de proveedor vinculado (mapeo persistente del match)
--   market_price = precio de referencia por base_unit cuando NO hay proveedor fijo
-- ---------------------------------------------------------------------
create table if not exists ingredients (
  id                       uuid primary key default gen_random_uuid(),
  name                     text not null,
  base_unit                unit_kind not null,
  product_id               uuid references products(id) on delete set null,
  market_price             numeric check (market_price >= 0),
  market_price_updated_at  timestamptz,
  notes                    text,
  created_at               timestamptz not null default now()
);

create index if not exists ingredients_name_idx on ingredients (name);
create index if not exists ingredients_product_id_idx on ingredients (product_id);

-- ---------------------------------------------------------------------
-- Trigger: mantener products.updated_at al actualizar precios
-- ---------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists products_set_updated_at on products;
create trigger products_set_updated_at
  before update on products
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- RLS: equipo chico y de confianza (2-4 usuarios).
-- Cualquier usuario autenticado tiene acceso total a los catálogos.
-- ---------------------------------------------------------------------
alter table providers   enable row level security;
alter table products    enable row level security;
alter table ingredients enable row level security;

do $$
declare t text;
begin
  foreach t in array array['providers', 'products', 'ingredients'] loop
    execute format('drop policy if exists "auth_all_%1$s" on %1$s;', t);
    execute format(
      'create policy "auth_all_%1$s" on %1$s
         for all to authenticated
         using (true) with check (true);', t);
  end loop;
end $$;
