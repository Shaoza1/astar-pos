-- Migration: tables seed | Created: 2026-07-10 | Author: Kutloano Moshao
-- Die Blikkasteel restaurant floor layout

INSERT INTO tables (id, table_number, capacity, location) VALUES
  (gen_random_uuid(), 'T1',   4, 'indoor'),
  (gen_random_uuid(), 'T2',   4, 'indoor'),
  (gen_random_uuid(), 'T3',   6, 'indoor'),
  (gen_random_uuid(), 'T4',   2, 'indoor'),
  (gen_random_uuid(), 'T5',   4, 'indoor'),
  (gen_random_uuid(), 'T6',   8, 'indoor'),
  (gen_random_uuid(), 'BAR1', 2, 'bar'),
  (gen_random_uuid(), 'BAR2', 2, 'bar'),
  (gen_random_uuid(), 'OUT1', 4, 'outdoor'),
  (gen_random_uuid(), 'OUT2', 4, 'outdoor')
ON CONFLICT (table_number) DO NOTHING;
