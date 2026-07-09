-- Migration: audit_log | Created: 2025-07-09 | Author: Kutloano Moshao
-- Immutable append-only log of every INSERT, UPDATE, and DELETE on audited tables.
-- Populated by database triggers (added in Phase 1), not by application code, so it cannot
-- be bypassed by a bug or a direct DB connection.
-- old_data and new_data store the full row as JSONB for forensic reconstruction.

CREATE TABLE audit_log (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name   VARCHAR(50) NOT NULL,
  record_id    UUID        NOT NULL,
  action       VARCHAR(10) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data     JSONB,
  new_data     JSONB,
  performed_by UUID        REFERENCES staff (id),  -- nullable: system/trigger actions may have no staff context
  performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address   VARCHAR(45)
);

CREATE INDEX idx_audit_log_table_record  ON audit_log (table_name, record_id);
CREATE INDEX idx_audit_log_performed_by  ON audit_log (performed_by);
CREATE INDEX idx_audit_log_performed_at  ON audit_log (performed_at);
-- GIN index on JSONB columns for forensic searches (e.g. "find all records where price was 150")
CREATE INDEX idx_audit_log_old_data      ON audit_log USING GIN (old_data);
CREATE INDEX idx_audit_log_new_data      ON audit_log USING GIN (new_data);
