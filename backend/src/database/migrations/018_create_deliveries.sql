-- Migration: deliveries | Created: 2025-07-09 | Author: Kutloano Moshao
-- Header record for a supplier delivery. Status moves from pending → verified once quantities
-- are confirmed, or → disputed if discrepancies are found and unresolved.

CREATE TABLE deliveries (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_name     VARCHAR(100) NOT NULL,
  delivery_date     DATE         NOT NULL,
  recorded_by       UUID         NOT NULL REFERENCES staff (id),
  recorded_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  invoice_reference VARCHAR(100),
  notes             TEXT,
  status            VARCHAR(20)  NOT NULL DEFAULT 'pending'
                                 CHECK (status IN ('pending', 'verified', 'disputed'))
);

CREATE INDEX idx_deliveries_delivery_date ON deliveries (delivery_date);
CREATE INDEX idx_deliveries_recorded_by   ON deliveries (recorded_by);
CREATE INDEX idx_deliveries_status        ON deliveries (status);
