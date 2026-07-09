-- Migration: tables | Created: 2025-07-09 | Author: Kutloano Moshao
-- Physical restaurant tables and bar positions. table_number is the human-readable label shown on the POS.

CREATE TABLE tables (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  table_number VARCHAR(10) NOT NULL UNIQUE,  -- e.g. 'T1', 'T2', 'BAR1'
  capacity     INTEGER     NOT NULL DEFAULT 2,
  location     VARCHAR(50),                  -- e.g. 'indoor', 'outdoor', 'bar'
  is_active    BOOLEAN     NOT NULL DEFAULT true
);

CREATE INDEX idx_tables_is_active ON tables (is_active);
