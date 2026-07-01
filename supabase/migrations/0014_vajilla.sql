-- Proveedores de vajilla (independientes de los proveedores de MP)
CREATE TABLE tableware_providers (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  notes      TEXT,
  phone      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE tableware_providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_only" ON tableware_providers FOR ALL USING (auth.role() = 'authenticated');

-- Catálogo de ítems de vajilla
-- cost_type: 'alquiler' = se alquila por evento | 'compra' = se compra una vez y reutiliza
-- category: platos | cubiertos | cristaleria | bandejas | utensilios | otros
CREATE TABLE tableware_items (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID         NOT NULL REFERENCES tableware_providers(id) ON DELETE CASCADE,
  name        TEXT         NOT NULL,
  category    TEXT         NOT NULL DEFAULT 'otros',
  cost_type   TEXT         NOT NULL DEFAULT 'alquiler' CHECK (cost_type IN ('alquiler', 'compra')),
  unit_price  NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes       TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

ALTER TABLE tableware_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_only" ON tableware_items FOR ALL USING (auth.role() = 'authenticated');

CREATE INDEX ON tableware_items(provider_id);

-- Vajilla asignada a un evento
-- breakage_qty: roturas estimadas (solo aplica para alquiler, se suman al costo)
-- charge_purchase: para ítems de compra, si es true se carga el costo a este evento
CREATE TABLE event_tableware (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         UUID         NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  item_id          UUID         NOT NULL REFERENCES tableware_items(id) ON DELETE RESTRICT,
  quantity         NUMERIC(10,2) NOT NULL DEFAULT 0,
  breakage_qty     NUMERIC(10,2) NOT NULL DEFAULT 0,
  charge_purchase  BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

ALTER TABLE event_tableware ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_only" ON event_tableware FOR ALL USING (auth.role() = 'authenticated');

CREATE INDEX ON event_tableware(event_id);
CREATE INDEX ON event_tableware(item_id);
