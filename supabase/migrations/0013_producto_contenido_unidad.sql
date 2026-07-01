-- =====================================================================
-- Oliva — Contenido por unidad del producto
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query > Run
-- (Requiere 0001_catalogos.sql)
--
-- Agrega 'unit_content_value' y 'unit_content_unit': el volumen o peso
-- que contiene cada unidad individual del producto (ej: 700 ml por botella).
-- Solo aplica cuando base_unit='un'. Permite calcular costos proporcionales
-- en recetas y cantidades exactas (unidades + cajas) en eventos.
-- =====================================================================

alter table products
  add column if not exists unit_content_value numeric
    check (unit_content_value > 0),
  add column if not exists unit_content_unit text
    check (unit_content_unit in ('g', 'kg', 'ml', 'l', 'un'));
