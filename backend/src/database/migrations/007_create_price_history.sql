-- Migration: price_history | Created: 2025-07-09 | Author: Kutloano Moshao
-- Immutable audit trail of every price change. reason is mandatory when change exceeds 20%.

CREATE TABLE price_history (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id UUID          NOT NULL REFERENCES menu_items (id),
  old_price    DECIMAL(10,2) NOT NULL,
  new_price    DECIMAL(10,2) NOT NULL,
  changed_by   UUID          NOT NULL REFERENCES staff (id),
  changed_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  reason       TEXT          -- mandatory if price changes by more than 20%
);

CREATE INDEX idx_price_history_menu_item_id ON price_history (menu_item_id);
CREATE INDEX idx_price_history_changed_at   ON price_history (changed_at);
