-- Margen global de vajilla por evento (unidades extra de reserva)
ALTER TABLE events ADD COLUMN vajilla_margin NUMERIC(10,2) NOT NULL DEFAULT 5;

-- Parámetros de autocálculo por ítem de vajilla en el evento
-- multiplier: cuántas unidades de este ítem usa cada persona (default 1)
-- margin_override: margen propio del ítem (null = usar vajilla_margin del evento)
-- quantity_manual: true = el usuario editó la cantidad a mano, no recalcular automáticamente
ALTER TABLE event_tableware ADD COLUMN multiplier      NUMERIC(10,4) NOT NULL DEFAULT 1;
ALTER TABLE event_tableware ADD COLUMN margin_override NUMERIC(10,2);
ALTER TABLE event_tableware ADD COLUMN quantity_manual BOOLEAN       NOT NULL DEFAULT FALSE;
