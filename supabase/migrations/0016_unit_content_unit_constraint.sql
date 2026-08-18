-- =====================================================================
-- Oliva — Acotar unit_content_unit a unidades de peso/volumen
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query > Run
-- (Requiere 0013_producto_contenido_unidad.sql)
--
-- La constraint original aceptaba los 5 valores de unit_kind, incluido 'un'.
-- 'un' no tiene sentido como contenido por unidad: "cuántas unidades trae la
-- compra" ya es pack_size, así que un producto con unit_content_unit='un'
-- queda medio configurado — parece tener contenido pero no se puede costear
-- contra un ingrediente en ml o g.
--
-- Las unidades de peso y volumen (g/kg/ml/l) SÍ son todas válidas: el costeo
-- las convierte bien, aunque el importador normalice a la unidad chica.
--
-- Este script primero limpia los datos que violarían las constraints nuevas
-- (si no, el ALTER falla) y después las aplica.
-- =====================================================================

-- 1) 'un' como contenido: se descarta el dato, no aporta nada.
update products
   set unit_content_value = null,
       unit_content_unit  = null
 where unit_content_unit = 'un';

-- 2) Contenido a medio cargar (valor sin unidad o unidad sin valor): el código
--    ya lo ignora (exige los dos campos), así que se normaliza a null.
update products
   set unit_content_value = null,
       unit_content_unit  = null
 where (unit_content_value is null) <> (unit_content_unit is null);

-- 3) Constraint de valores admitidos, ahora sin 'un'.
alter table products
  drop constraint if exists products_unit_content_unit_check;

alter table products
  add constraint products_unit_content_unit_check
  check (
    unit_content_unit is null
    or unit_content_unit in ('g', 'kg', 'ml', 'l')
  );

-- 4) Coherencia del par: o están los dos campos, o ninguno.
alter table products
  drop constraint if exists products_unit_content_pair_check;

alter table products
  add constraint products_unit_content_pair_check
  check ((unit_content_value is null) = (unit_content_unit is null));
