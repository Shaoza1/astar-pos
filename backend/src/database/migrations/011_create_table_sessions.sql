-- Migration: table_sessions | Created: 2025-07-09 | Author: Kutloano Moshao
-- A session represents guests being seated at a table from open to bill payment.
-- The UNIQUE constraint on (table_id, closed_at) prevents two concurrent open sessions on the same table
-- because NULL is distinct in PostgreSQL's unique index — only one NULL per table_id is allowed.

CREATE TABLE table_sessions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id    UUID        NOT NULL REFERENCES tables (id),
  opened_by   UUID        NOT NULL REFERENCES staff (id),
  opened_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at   TIMESTAMPTZ,           -- nullable until session closed
  guest_count INTEGER,
  is_flagged  BOOLEAN     NOT NULL DEFAULT false,  -- flagged if open longer than 4 hours with no activity
  flag_reason TEXT,
  CONSTRAINT no_overlapping_sessions UNIQUE (table_id, closed_at)
);

CREATE INDEX idx_table_sessions_table_id  ON table_sessions (table_id);
CREATE INDEX idx_table_sessions_opened_by ON table_sessions (opened_by);
-- Partial index for the "show all open tables" query on the POS floor view
CREATE INDEX idx_table_sessions_open      ON table_sessions (table_id) WHERE closed_at IS NULL;
