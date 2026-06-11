-- =====================================================================
-- Oliva — Precio de mercado automático para bebidas de la barra
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query > Run
-- (Requiere 0004_barra.sql)
--
-- Misma idea que en ingredientes (Mejora 3): una bebida puede tener su
-- precio actualizado automáticamente desde la fuente de mercado.
--   market_auto:             buscar el precio automáticamente.
--   market_price_source:     'auto' (búsqueda) | 'manual' (editado a mano).
--   market_price_updated_at: cuándo se actualizó por última vez.
-- El precio vive en la columna 'price' que ya existe; estos campos solo
-- controlan/registran la actualización automática.
-- =====================================================================

alter table bar_beverages
  add column if not exists market_auto boolean not null default false;

alter table bar_beverages
  add column if not exists market_price_source text;

alter table bar_beverages
  add column if not exists market_price_updated_at timestamptz;
