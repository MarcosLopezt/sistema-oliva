-- =====================================================================
-- Oliva — Precio de mercado automático (Mejora 3)
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query > Run
-- (Requiere 0001_catalogos.sql)
--
-- Para ingredientes "sin proveedor fijo" (product_id null) que deben
-- actualizar su precio automáticamente desde una fuente de mercado.
--   market_auto:          flag "buscar precio de mercado automáticamente".
--   market_price_source:  'auto'   = lo trajo la búsqueda automática.
--                         'manual' = lo editó el usuario a mano.
-- (market_price y market_price_updated_at ya existen desde 0001.)
-- =====================================================================

alter table ingredients
  add column if not exists market_auto boolean not null default false;

alter table ingredients
  add column if not exists market_price_source text;

-- Datos de prueba: "Café expreso" (del tiramisú) queda como sin proveedor
-- fijo con búsqueda automática activada, para testear la Mejora 3.
update ingredients
  set market_auto = true,
      product_id = null
  where (name ilike '%café%' or name ilike '%cafe%')
    and market_auto = false;
