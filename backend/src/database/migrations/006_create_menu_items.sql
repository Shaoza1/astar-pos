-- Migration: menu_items | Created: 2025-07-09 | Author: Kutloano Moshao
-- Individual sellable items. unit_price is snapshotted onto order_items at sale time so price changes
-- never retroactively alter historical orders.

CREATE TABLE menu_items (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    UUID          NOT NULL REFERENCES menu_groups (id),
  name        VARCHAR(150)  NOT NULL,
  description TEXT,
  price       DECIMAL(10,2) NOT NULL CHECK (price >= 0),
  is_active   BOOLEAN       NOT NULL DEFAULT true,
  is_comp     BOOLEAN       NOT NULL DEFAULT false,  -- if true, can be added at R0 with logged reason
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_menu_items_group_id  ON menu_items (group_id);
CREATE INDEX idx_menu_items_is_active ON menu_items (is_active);
