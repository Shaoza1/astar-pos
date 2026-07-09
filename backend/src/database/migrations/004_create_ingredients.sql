-- Migration: ingredients | Created: 2025-07-09 | Author: Kutloano Moshao
-- Core inventory items. Stock is always tracked in consumption_unit; purchase_unit is for ordering/receiving.
-- Unit conversion: current_stock (consumption units) = quantity_received × units_per_purchase

CREATE TABLE ingredients (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id              UUID          NOT NULL REFERENCES ingredient_groups (id),
  name                  VARCHAR(100)  NOT NULL,
  purchase_unit         VARCHAR(50)   NOT NULL,  -- e.g. 'loaf', 'bottle', 'kg', 'litre', 'pack'
  consumption_unit      VARCHAR(50)   NOT NULL,  -- e.g. 'slice', 'measure', 'g', 'ml', 'piece'
  units_per_purchase    DECIMAL(10,4) NOT NULL,  -- e.g. 20 (slices per loaf), 30 (measures per bottle)
  low_stock_threshold   DECIMAL(10,4) NOT NULL DEFAULT 0,  -- alert when stock falls below this (in consumption units)
  current_stock         DECIMAL(10,4) NOT NULL DEFAULT 0,  -- in consumption units
  cost_per_purchase_unit DECIMAL(10,2),                    -- what you pay per loaf/bottle/pack
  is_active             BOOLEAN       NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ingredients_group_id  ON ingredients (group_id);
CREATE INDEX idx_ingredients_is_active ON ingredients (is_active);
-- Partial index for low-stock alerts query
CREATE INDEX idx_ingredients_low_stock ON ingredients (current_stock) WHERE is_active = true;
