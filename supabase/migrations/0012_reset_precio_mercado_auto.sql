-- =====================================================================
-- Oliva — Reset de precios de mercado automáticos mal calculados
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query > Run
-- (Requiere 0009_ingrediente_precio_mercado.sql)
--
-- La primera versión de la búsqueda guardaba el precio del PAQUETE como si
-- fuera precio por unidad base, inflando muchísimo el costo (ej: café a
-- $8.645/ml). Ya se corrigió (ahora el precio se normaliza por unidad base).
-- Acá limpiamos los valores viejos auto para que se vuelvan a buscar bien al
-- abrir el próximo evento. Respeta los precios cargados a mano ('manual').
-- =====================================================================

update ingredients
   set market_price = null,
       market_price_updated_at = null,
       market_price_source = null
 where market_auto = true
   and market_price_source is distinct from 'manual';
