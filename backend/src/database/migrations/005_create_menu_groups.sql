-- Migration: menu_groups | Created: 2025-07-09 | Author: Kutloano Moshao
-- Top-level menu sections displayed on the POS terminal (Breakfast, Mains, Drinks, etc.)

CREATE TABLE menu_groups (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(100) NOT NULL,  -- e.g. 'Breakfast', 'Starters', 'Mains', 'Drinks'
  sort_order INTEGER      NOT NULL DEFAULT 0,
  is_active  BOOLEAN      NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_menu_groups_sort_order ON menu_groups (sort_order);
CREATE INDEX idx_menu_groups_is_active  ON menu_groups (is_active);
