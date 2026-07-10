-- Seed: menu_items | Created: 2025-07-10 | Author: Kutloano Moshao
-- Die Blikkasteel real menu. Prices as of opening day — update via admin panel.
-- Uses CTEs to resolve group IDs by name so this seed is position-independent.

WITH groups AS (
  SELECT id, name FROM menu_groups
)
INSERT INTO menu_items (group_id, name, price) VALUES

  -- Breakfast
  ((SELECT id FROM groups WHERE name = 'Breakfast'), 'Omelette 2 Eggs',         25.00),
  ((SELECT id FROM groups WHERE name = 'Breakfast'), 'Omelette 3 Eggs',         35.00),
  ((SELECT id FROM groups WHERE name = 'Breakfast'), 'Fit for a King',          180.00),
  ((SELECT id FROM groups WHERE name = 'Breakfast'), 'Butlers Breakfast',        75.00),
  ((SELECT id FROM groups WHERE name = 'Breakfast'), 'Commoner''s Breakfast',    55.00),
  ((SELECT id FROM groups WHERE name = 'Breakfast'), 'Panini Breakfast Burger', 175.00),

  -- Starters
  ((SELECT id FROM groups WHERE name = 'Starters'), 'Asparagus Quiche',              45.00),
  ((SELECT id FROM groups WHERE name = 'Starters'), 'Spinach Quiche',               40.00),
  ((SELECT id FROM groups WHERE name = 'Starters'), 'Small Pancake Spinach+Feta',   42.00),
  ((SELECT id FROM groups WHERE name = 'Starters'), 'Small Pancake Smoked Trout',   65.00),
  ((SELECT id FROM groups WHERE name = 'Starters'), 'Creamy Garlic Snails + Toast', 70.00),
  ((SELECT id FROM groups WHERE name = 'Starters'), 'Garlic Roll Cheese',           25.00),

  -- Mains - Steaks
  ((SELECT id FROM groups WHERE name = 'Mains - Steaks'), 'Fillet 250g', 160.00),
  ((SELECT id FROM groups WHERE name = 'Mains - Steaks'), 'Fillet 300g', 190.00),
  ((SELECT id FROM groups WHERE name = 'Mains - Steaks'), 'Rump 250g',   160.00),
  ((SELECT id FROM groups WHERE name = 'Mains - Steaks'), 'Rump 300g',   190.00),

  -- Mains - Other
  ((SELECT id FROM groups WHERE name = 'Mains - Other'), 'Oxtail',               200.00),
  ((SELECT id FROM groups WHERE name = 'Mains - Other'), 'Lamb Curry',           170.00),
  ((SELECT id FROM groups WHERE name = 'Mains - Other'), 'Hake',                 105.00),
  ((SELECT id FROM groups WHERE name = 'Mains - Other'), 'Pork Chop x1',          80.00),
  ((SELECT id FROM groups WHERE name = 'Mains - Other'), 'Pork Chop x2',         120.00),
  ((SELECT id FROM groups WHERE name = 'Mains - Other'), 'Chicken Schnitzel x2', 112.00),
  ((SELECT id FROM groups WHERE name = 'Mains - Other'), 'Lasagna',              105.00),
  ((SELECT id FROM groups WHERE name = 'Mains - Other'), 'Lamb Chops x2',        160.00),
  ((SELECT id FROM groups WHERE name = 'Mains - Other'), 'Sparerib Fingers',     105.00),

  -- Platters
  ((SELECT id FROM groups WHERE name = 'Platters'), 'Commoner''s Platter', 250.00),
  ((SELECT id FROM groups WHERE name = 'Platters'), 'Butlers Platter',     320.00),
  ((SELECT id FROM groups WHERE name = 'Platters'), 'Queens Platter',      450.00),
  ((SELECT id FROM groups WHERE name = 'Platters'), 'Kings Platter',       700.00),

  -- Kiddies
  ((SELECT id FROM groups WHERE name = 'Kiddies'), 'Pork Fingers with Chips/Mash',  65.00),
  ((SELECT id FROM groups WHERE name = 'Kiddies'), 'Chicken Strips with Chips',     60.00),
  ((SELECT id FROM groups WHERE name = 'Kiddies'), 'Chicken Pops with Chips/Mash',  60.00),
  ((SELECT id FROM groups WHERE name = 'Kiddies'), 'Kiddies Hamburger with Chips',  65.00),

  -- Special Menu (mapped to Giant Panini Burgers group as closest match)
  ((SELECT id FROM groups WHERE name = 'Giant Panini Burgers'), 'Pap, Sous + Wors',              60.00),
  ((SELECT id FROM groups WHERE name = 'Giant Panini Burgers'), 'Chicken Wings 6pc + Chips/Pap', 80.00),
  ((SELECT id FROM groups WHERE name = 'Giant Panini Burgers'), 'Quarter Leg Chicken',           80.00),
  ((SELECT id FROM groups WHERE name = 'Giant Panini Burgers'), 'Stew & Pap',                    70.00),
  ((SELECT id FROM groups WHERE name = 'Giant Panini Burgers'), 'Fish & Chips',                  95.00),
  ((SELECT id FROM groups WHERE name = 'Giant Panini Burgers'), 'Russian & Chips',               50.00),
  ((SELECT id FROM groups WHERE name = 'Giant Panini Burgers'), 'Chuck & Chips',                 75.00)

ON CONFLICT DO NOTHING;
