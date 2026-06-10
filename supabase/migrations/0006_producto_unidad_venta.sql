-- =====================================================================
-- Oliva — Unidad de venta del producto (import de listas de precios)
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query > Run
-- (Requiere 0001_catalogos.sql)
--
-- Agrega 'sale_unit': el nombre de la unidad de compra tal como la vende
-- el proveedor (ej: "cabeza", "bolsa", "atado", "docena", "caja"). Es solo
-- una etiqueta para mostrar; el costeo sigue usando base_unit + pack_size.
-- =====================================================================

alter table products
  add column if not exists sale_unit text;
