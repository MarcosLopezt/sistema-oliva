-- =====================================================================
-- Oliva — Bebida disponible en ambos servicios de barra
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query > Run
-- (Requiere 0004_barra.sql)
--
-- Agrega el valor 'ambos' al enum barra_service para que una bebida pueda
-- figurar tanto en barra con alcohol como sin alcohol (ej: la Coca-Cola es
-- el mismo producto en los dos servicios). Solo se usa en bar_beverages.service;
-- los eventos siguen eligiendo ninguna/sin_alcohol/con_alcohol.
-- =====================================================================

alter type barra_service add value if not exists 'ambos';
