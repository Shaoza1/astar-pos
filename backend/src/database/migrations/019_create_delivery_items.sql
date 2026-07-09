-- Migration: delivery_items | Created: 2025-07-09 | Author: Kutloano Moshao
-- Line items for a delivery. All quantities are in purchase_unit (loaves, bottles, kg).
-- discrepancy is a generated column: positive = received more than ordered, negative = short delivery.
-- quantity_ordered is nullable to support unplanned deliveries (no prior order placed).

CREATE TABLE delivery_items (
  id                 UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id        UUID          NOT NULL REFERENCES deliveries (id),
  ingredient_id      UUID          NOT NULL REFERENCES ingredients (id),
  quantity_ordered   DECIMAL(10,4),           -- in purchase units — nullable if not pre-ordered
  quantity_received  DECIMAL(10,4) NOT NULL,  -- in purchase units
  cost_per_unit      DECIMAL(10,2),
  discrepancy        DECIMAL(10,4) GENERATED ALWAYS AS
                       (quantity_received - COALESCE(quantity_ordered, quantity_received)) STORED
);

CREATE INDEX idx_delivery_items_delivery_id   ON delivery_items (delivery_id);
CREATE INDEX idx_delivery_items_ingredient_id ON delivery_items (ingredient_id);
