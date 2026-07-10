-- Seed: recipes | Created: 2025-07-10 | Author: Kutloano Moshao
-- Seeds placeholder ingredients and two complete working recipes.
-- All other recipes are entered via the admin panel before go-live.
--
-- Placeholder ingredient — update cost_per_purchase_unit and units_per_purchase
-- via admin panel before going live.

WITH protein_group AS (
  SELECT id FROM ingredient_groups WHERE name = 'Proteins'
),
carb_group AS (
  SELECT id FROM ingredient_groups WHERE name = 'Carbs'
),
veg_group AS (
  SELECT id FROM ingredient_groups WHERE name = 'Vegetables'
)

INSERT INTO ingredients (group_id, name, purchase_unit, consumption_unit, units_per_purchase, low_stock_threshold)
VALUES
  -- Placeholder ingredient — update cost_per_purchase_unit and units_per_purchase via admin panel before going live
  ((SELECT id FROM protein_group), 'bacon_rasher',    'pack',  'rasher', 10, 5),
  -- Placeholder ingredient — update cost_per_purchase_unit and units_per_purchase via admin panel before going live
  ((SELECT id FROM protein_group), 'egg',             'tray',  'egg',    30, 10),
  -- Placeholder ingredient — update cost_per_purchase_unit and units_per_purchase via admin panel before going live
  ((SELECT id FROM carb_group),    'bread_slice',     'loaf',  'slice',  20, 10),
  -- Placeholder ingredient — update cost_per_purchase_unit and units_per_purchase via admin panel before going live
  ((SELECT id FROM veg_group),     'fried_tomato',    'kg',    'piece',   8, 4),
  -- Placeholder ingredient — update cost_per_purchase_unit and units_per_purchase via admin panel before going live
  ((SELECT id FROM protein_group), 'cheese_griller',  'pack',  'piece',  10, 5)
ON CONFLICT DO NOTHING;

-- ── Butlers Breakfast recipe ──────────────────────────────────────────────────

WITH butlers AS (
  SELECT id FROM menu_items WHERE name = 'Butlers Breakfast' LIMIT 1
),
new_recipe AS (
  INSERT INTO recipes (menu_item_id, serves, notes)
  SELECT id, 1, 'Classic full breakfast'
  FROM butlers
  ON CONFLICT (menu_item_id) DO NOTHING
  RETURNING id, menu_item_id
),
recipe_ref AS (
  SELECT id FROM new_recipe
  UNION ALL
  SELECT r.id FROM recipes r JOIN butlers b ON r.menu_item_id = b.id
  LIMIT 1
)
INSERT INTO recipe_items (recipe_id, ingredient_id, quantity)
SELECT r.id, i.id, v.qty
FROM recipe_ref r
CROSS JOIN (VALUES
  ('bacon_rasher',   2),
  ('egg',            2),
  ('bread_slice',    2),
  ('fried_tomato',   1),
  ('cheese_griller', 2)
) AS v(iname, qty)
JOIN ingredients i ON i.name = v.iname
ON CONFLICT DO NOTHING;

-- ── Commoner's Breakfast recipe ───────────────────────────────────────────────

WITH commoners AS (
  SELECT id FROM menu_items WHERE name = 'Commoner''s Breakfast' LIMIT 1
),
new_recipe AS (
  INSERT INTO recipes (menu_item_id, serves, notes)
  SELECT id, 1, 'Lighter breakfast option'
  FROM commoners
  ON CONFLICT (menu_item_id) DO NOTHING
  RETURNING id, menu_item_id
),
recipe_ref AS (
  SELECT id FROM new_recipe
  UNION ALL
  SELECT r.id FROM recipes r JOIN commoners c ON r.menu_item_id = c.id
  LIMIT 1
)
INSERT INTO recipe_items (recipe_id, ingredient_id, quantity)
SELECT r.id, i.id, v.qty
FROM recipe_ref r
CROSS JOIN (VALUES
  ('bacon_rasher',   2),
  ('cheese_griller', 1),
  ('egg',            1),
  ('bread_slice',    1),
  ('fried_tomato',   1)
) AS v(iname, qty)
JOIN ingredients i ON i.name = v.iname
ON CONFLICT DO NOTHING;
