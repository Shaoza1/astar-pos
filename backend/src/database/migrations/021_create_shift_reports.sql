-- Migration: shift_reports | Created: 2025-07-09 | Author: Kutloano Moshao
-- Summary record created when a shift is opened and finalised when closed. Totals are computed
-- and written at close time — they are not live-calculated to keep reporting fast.

CREATE TABLE shift_reports (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_date  DATE          NOT NULL,
  shift       VARCHAR(10)   NOT NULL CHECK (shift IN ('morning', 'evening')),
  opened_by   UUID          NOT NULL REFERENCES staff (id),
  closed_by   UUID          REFERENCES staff (id),
  opened_at   TIMESTAMPTZ   NOT NULL,
  closed_at   TIMESTAMPTZ,
  total_sales DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_cash  DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_card  DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_voids DECIMAL(10,2) NOT NULL DEFAULT 0,
  notes       TEXT,
  CONSTRAINT one_shift_per_day UNIQUE (shift_date, shift)
);

CREATE INDEX idx_shift_reports_shift_date ON shift_reports (shift_date);
