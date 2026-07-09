-- Migration: stock_movements | Created: 2025-07-09 | Author: Kutloano Moshao
-- Append-only ledger of every change to ingredient stock. quantity_change is negative for consumption
-- (sales, waste) and positive for additions (deliveries, adjustments).
-- reference_id + reference_type form a polymorphic link to the source record.

CREATE TABLE stock_movements (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id   UUID          NOT NULL REFERENCES ingredients (id),
  movement_type   VARCHAR(20)   NOT NULL
                                CHECK (movement_type IN ('sale', 'delivery', 'adjustment', 'waste', 'void_reversal')),
  quantity_change DECIMAL(10,4) NOT NULL,  -- negative = consumed, positive = added
  reference_id    UUID,                    -- order_item_id for sales, delivery_item_id for deliveries
  reference_type  VARCHAR(30),             -- 'order_item', 'delivery_item', 'manual_adjustment'
  performed_by    UUID          NOT NULL REFERENCES staff (id),
  performed_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  notes           TEXT
);

CREATE INDEX idx_stock_movements_ingredient_id ON stock_movements (ingredient_id);
CREATE INDEX idx_stock_movements_performed_at  ON stock_movements (performed_at);
CREATE INDEX idx_stock_movements_movement_type ON stock_movements (movement_type);
-- Composite index for the variance report query (ingredient over a date range)
CREATE INDEX idx_stock_movements_ingredient_date ON stock_movements (ingredient_id, performed_at);
