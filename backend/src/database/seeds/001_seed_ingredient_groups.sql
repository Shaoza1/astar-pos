-- Seed: ingredient_groups | Created: 2025-07-09 | Author: Kutloano Moshao
-- Die Blikkasteel ingredient categories. sort_order controls display sequence in stock reports.

INSERT INTO ingredient_groups (name, sort_order) VALUES
  ('Proteins',          10),
  ('Carbs',             20),
  ('Dairy',             30),
  ('Vegetables',        40),
  ('Condiments',        50),
  ('Alcohol - Spirits', 60),
  ('Alcohol - Beer',    70),
  ('Soft Drinks',       80);
