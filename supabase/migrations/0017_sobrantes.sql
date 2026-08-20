-- =====================================================================
-- Oliva — Sobrantes (Etapa 1: registro informativo)
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query > Run
-- (Requiere 0001_catalogos.sql y 0003_eventos.sql)
--
-- El sistema compra packs completos por diseño, así que genera sobrante
-- sistemático (para 6.900 ml de aceite compra 2 bidones de 5 L y quedan
-- 3,1 L pagados sin usar). Esta migración permite REGISTRAR ese sobrante.
--
-- ETAPA 1 ES SOLO REGISTRO. Nada de lo que hay acá entra en el motor de
-- costeo: no descuenta stock, no altera costos de eventos ni el precio
-- sugerido por persona.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Vida útil del sobrante, por producto
--    Días que dura el sobrante una vez abierto/fraccionado.
--    Ej: aceite 180 · crema 5 · verduras 3.
--    NULL = sin definir → el sobrante queda sin fecha de vencimiento y la
--    UI lo marca como "sin vida útil definida" (falta configurarlo).
-- ---------------------------------------------------------------------
alter table products
  add column if not exists leftover_shelf_life_days integer
    check (leftover_shelf_life_days > 0);

-- ---------------------------------------------------------------------
-- 2) Estado del sobrante
--    NOTA: 'vencido' NO se persiste en la Etapa 1. La fuente de verdad del
--    vencimiento es `expires_at`, y la app deriva el estado al leer
--    (expires_at < hoy && status = 'disponible' → se muestra vencido). Así
--    no hace falta cron y no hay drift si después se edita la fecha.
--    El valor queda en el enum porque la Etapa 2 va a necesitar congelarlo.
-- ---------------------------------------------------------------------
do $$ begin
  create type leftover_status as enum
    ('disponible', 'vencido', 'consumido', 'descartado');
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------
-- 3) Sobrantes
-- ---------------------------------------------------------------------
create table if not exists leftovers (
  id                 uuid primary key default gen_random_uuid(),

  product_id         uuid not null references products(id) on delete cascade,
  -- NULL = carga manual (no vino del cierre de un evento).
  -- on delete set null: el sobrante físico sigue existiendo en la heladera
  -- aunque se borre el evento del que salió.
  origin_event_id    uuid references events(id) on delete set null,

  -- ---------- CANTIDADES ----------
  -- SIEMPRE en `base_unit` (la unidad base del producto), nunca en porcentaje.
  -- El porcentaje del pack es solo una forma de mostrarlo/ingresarlo.
  --
  -- Son TRES columnas a propósito:
  --   qty_calculated → lo que calculó el sistema al cerrar el evento
  --                    (NULL si el sobrante se cargó a mano)
  --   qty_confirmed  → lo que confirmó el usuario AL REGISTRAR. Queda
  --                    CONGELADA: es el par de qty_calculated para calibrar
  --                    la merma. Si se pisara al editar stock, se perdería.
  --   qty_remaining  → stock actual. Es la que se edita y se consume.
  qty_calculated     numeric check (qty_calculated >= 0),
  qty_confirmed      numeric not null check (qty_confirmed >= 0),
  qty_remaining      numeric not null check (qty_remaining >= 0),

  -- ---------- SNAPSHOTS AL REGISTRAR ----------
  -- Información del momento que NO se puede reconstruir después. Si mañana
  -- alguien reconfigura el producto (de "botella de 5 L" a "bidón de 20 L")
  -- o el proveedor actualiza su lista de precios, los sobrantes viejos no
  -- se reinterpretan mal ni pierden su valor histórico.
  base_unit          unit_kind not null,
  unit_content_value numeric check (unit_content_value > 0),
  unit_content_unit  text
    check (unit_content_unit is null or unit_content_unit in ('g','kg','ml','l')),
  -- Total comprado en el evento origen, en base_unit. Habilita mostrar el
  -- sobrante como % del pack.
  purchased_qty      numeric check (purchased_qty >= 0),
  -- $ por base_unit al momento de registrar (products.price / pack_size).
  -- IRRECUPERABLE: si el proveedor actualiza precios, este número se pierde
  -- para siempre. Se captura desde ahora aunque la Etapa 1 no lo use: la
  -- Etapa 2 lo necesita para el "costo de referencia" del evento.
  unit_cost          numeric check (unit_cost >= 0),
  -- Merma del evento con la que se calculó qty_calculated. También
  -- irrecuperable: si después se edita merma_pct del evento, la comparación
  -- calculado-vs-confirmado quedaría midiendo contra otra base.
  merma_pct          numeric check (merma_pct >= 0),
  -- Nombre del evento origen al registrar. Si el evento se borra,
  -- origin_event_id queda NULL y este es el único rastro de dónde vino.
  origin_event_name  text,

  -- ---------- ESTADO Y VENCIMIENTO ----------
  status             leftover_status not null default 'disponible',
  registered_at      date not null default current_date,
  -- Calculada: fecha del evento + leftover_shelf_life_days del producto.
  -- NULL = el producto no tiene vida útil cargada.
  expires_at         date,
  -- true = el usuario sobrescribió la fecha a mano en este sobrante puntual;
  -- no se debe recalcular automáticamente.
  expiry_manual      boolean not null default false,

  note               text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  -- El contenido por unidad va completo o no va (mismo criterio que products).
  constraint leftovers_unit_content_pair_check
    check ((unit_content_value is null) = (unit_content_unit is null))
);

-- Aviso informativo al planificar (Tarea 6): "¿hay sobrante de este producto?"
create index if not exists leftovers_product_status_idx
  on leftovers (product_id, status);
-- Trazabilidad desde el evento origen.
create index if not exists leftovers_origin_event_idx
  on leftovers (origin_event_id);
-- Listado de la sección, ordenado por vencimiento.
create index if not exists leftovers_status_expires_idx
  on leftovers (status, expires_at);

-- updated_at automático (reusa la función de 0001_catalogos.sql).
drop trigger if exists leftovers_set_updated_at on leftovers;
create trigger leftovers_set_updated_at
  before update on leftovers
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- 4) RLS — mismo criterio que el resto de la app (equipo chico de confianza)
-- ---------------------------------------------------------------------
alter table leftovers enable row level security;

drop policy if exists "auth_all_leftovers" on leftovers;
create policy "auth_all_leftovers" on leftovers
  for all to authenticated
  using (true) with check (true);
