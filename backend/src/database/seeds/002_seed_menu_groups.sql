-- Seed: menu_groups | Created: 2025-07-09 | Author: Kutloano Moshao
-- Die Blikkasteel menu sections. sort_order controls tab sequence on the POS terminal.

INSERT INTO menu_groups (name, sort_order) VALUES
  ('Breakfast',            10),
  ('Starters',             20),
  ('Mains - Steaks',       30),
  ('Mains - Other',        40),
  ('Giant Panini Burgers', 50),
  ('Platters',             60),
  ('Kiddies',              70),
  ('Desserts',             80),
  ('Drinks - Hot',         90),
  ('Drinks - Cold',       100),
  ('Milkshakes',          110);
