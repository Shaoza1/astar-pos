-- Migration: recipe_items | Created: 2025-07-09 | Author: Kutloano Moshao
-- Line items of a recipe. quantity is always in consumption_unit (slices, ml, g, pieces).
-- option_group allows modelling "choice of chips OR mash OR salad" — only one item per group is deducted.

CREATE TABLE recipe_items (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id     UUID          NOT NULL REFERENCES recipes (id),
  ingredient_id UUID          NOT NULL REFERENCES ingredients (id),
  quantity      DECIMAL(10,4) NOT NULL,       -- in consumption units (e.g. 2 slices, 25ml, 0.25kg)
  is_optional   BOOLEAN       NOT NULL DEFAULT false,  -- for items like 'choice of chips OR mash OR salad'
  option_group  VARCHAR(50)   -- if is_optional=true, groups options together (e.g. 'side_choice', 'protein_choice')
);

CREATE INDEX idx_recipe_items_recipe_id     ON recipe_items (recipe_id);
CREATE INDEX idx_recipe_items_ingredient_id ON recipe_items (ingredient_id);
