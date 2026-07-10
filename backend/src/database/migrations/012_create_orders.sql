-- Migration: orders | Created: 2025-07-09 | Author: Kutloano Moshao
-- A table session can have multiple orders (e.g. starter round, main round, drinks round).
-- Status transitions: pending → sent_to_kitchen → ready → served (or cancelled at any point).

CREATE TABLE orders (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  table_session_id UUID        NOT NULL REFERENCES table_sessions (id),
  taken_by         UUID        NOT NULL REFERENCES staff (id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status           VARCHAR(20) NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending', 'sent_to_kitchen', 'ready', 'served', 'cancelled')),
  notes            TEXT
);

CREATE INDEX idx_orders_table_session_id ON orders (table_session_id);
CREATE INDEX idx_orders_taken_by         ON orders (taken_by);
CREATE INDEX idx_orders_status           ON orders (status);
