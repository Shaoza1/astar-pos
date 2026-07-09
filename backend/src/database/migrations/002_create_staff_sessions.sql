-- Migration: staff_sessions | Created: 2025-07-09 | Author: Kutloano Moshao
-- Tracks clock-in/clock-out per staff member per device; flagged if terminal mismatch detected

CREATE TABLE staff_sessions (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id         UUID         NOT NULL REFERENCES staff (id),
  clocked_in_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  clocked_out_at   TIMESTAMPTZ,                      -- nullable until clocked out
  device_identifier VARCHAR(255),                    -- which terminal/device
  clock_in_method  VARCHAR(20)  CHECK (clock_in_method IN ('pin', 'biometric')),
  flagged          BOOLEAN      NOT NULL DEFAULT false, -- true if clock-out device differs from clock-in device
  flag_reason      TEXT                               -- populated if flagged = true
);

CREATE INDEX idx_staff_sessions_staff_id      ON staff_sessions (staff_id);
CREATE INDEX idx_staff_sessions_clocked_in_at ON staff_sessions (clocked_in_at);
-- Partial index to quickly find all currently open sessions
CREATE INDEX idx_staff_sessions_open          ON staff_sessions (staff_id) WHERE clocked_out_at IS NULL;
