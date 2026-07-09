-- Migration: recipes | Created: 2025-07-09 | Author: Kutloano Moshao
-- One recipe per menu item (enforced by UNIQUE). The recipe defines which ingredients are deducted
-- from stock when this item is sold.

CREATE TABLE recipes (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id UUID        NOT NULL REFERENCES menu_items (id) UNIQUE,  -- one recipe per menu item
  serves       INTEGER     NOT NULL DEFAULT 1,
  notes        TEXT,       -- e.g. 'choose one of: boerewors OR beef patty OR cheese grillers'
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- No additional index needed — menu_item_id is already unique-indexed by the constraint
