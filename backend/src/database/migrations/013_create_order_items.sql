-- Migration: order_items | Created: 2025-07-09 | Author: Kutloano Moshao
-- Individual line items within an order. unit_price is snapshotted at order time — price changes
-- after the order is placed must never alter the billed amount.
-- modifiers stores the guest's chosen options as JSON (e.g. sauce, side, doneness).

CREATE TABLE order_items (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID          NOT NULL REFERENCES orders (id),
  menu_item_id UUID          NOT NULL REFERENCES menu_items (id),
  quantity     INTEGER       NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price   DECIMAL(10,2) NOT NULL,  -- snapshot of price at time of order, not a live reference
  modifiers    TEXT,                    -- JSON string of chosen options e.g. '{"side":"chips","sauce":"mushroom"}'
  is_voided    BOOLEAN       NOT NULL DEFAULT false,
  void_reason  TEXT,                    -- mandatory if is_voided = true
  voided_by    UUID          REFERENCES staff (id),
  voided_at    TIMESTAMPTZ
);

CREATE INDEX idx_order_items_order_id     ON order_items (order_id);
CREATE INDEX idx_order_items_menu_item_id ON order_items (menu_item_id);
-- Partial index for void audit queries
CREATE INDEX idx_order_items_voided       ON order_items (voided_at) WHERE is_voided = true;
