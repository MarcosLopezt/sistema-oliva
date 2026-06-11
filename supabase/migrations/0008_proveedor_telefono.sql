-- =====================================================================
-- Oliva — Teléfono / WhatsApp del proveedor (Mejora 2)
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query > Run
-- (Requiere 0001_catalogos.sql)
--
-- Se usa para habilitar "Compartir por WhatsApp" al exportar el pedido.
-- Formato libre; el front lo normaliza a dígitos para armar el link wa.me.
-- =====================================================================

alter table providers
  add column if not exists phone text;
