-- Migration: staff_accounts | Created: 2025-07-09 | Author: Kutloano Moshao
-- Running tab for each staff member. balance can go negative (staff owes the restaurant).
-- credit_limit enforces the maximum debt before further charges are blocked.

CREATE TABLE staff_accounts (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id     UUID          NOT NULL REFERENCES staff (id) UNIQUE,
  balance      DECIMAL(10,2) NOT NULL DEFAULT 0,    -- can go negative (owes the restaurant)
  credit_limit DECIMAL(10,2) NOT NULL DEFAULT 200,  -- max debt allowed
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- No additional index needed — staff_id is already unique-indexed by the constraint
