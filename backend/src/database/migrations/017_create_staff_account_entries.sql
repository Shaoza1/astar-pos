-- Migration: staff_account_entries | Created: 2025-07-09 | Author: Kutloano Moshao
-- Double-entry ledger for staff accounts. Negative amount = charge (meal/drink taken).
-- Positive amount = payment (staff pays off their tab). Never update; only insert.

CREATE TABLE staff_account_entries (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  UUID          NOT NULL REFERENCES staff_accounts (id),
  amount      DECIMAL(10,2) NOT NULL,  -- negative = charge, positive = payment
  description TEXT          NOT NULL,
  created_by  UUID          NOT NULL REFERENCES staff (id),
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_staff_account_entries_account_id ON staff_account_entries (account_id);
CREATE INDEX idx_staff_account_entries_created_at ON staff_account_entries (created_at);
