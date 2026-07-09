-- Migration: staff | Created: 2025-07-09 | Author: Kutloano Moshao
-- Root identity table — every other table that tracks "who did this" references staff.id

CREATE TABLE staff (
  id                     UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name              VARCHAR(100)  NOT NULL,
  role                   VARCHAR(20)   NOT NULL CHECK (role IN ('owner', 'manager', 'waiter', 'barman', 'kitchen')),
  pin_hash               VARCHAR(255)  NOT NULL,  -- bcrypt hash of 6-digit PIN, never store plain PIN
  webauthn_credential_id VARCHAR(255),             -- nullable, for biometric auth
  webauthn_public_key    TEXT,                     -- nullable
  is_active              BOOLEAN       NOT NULL DEFAULT true,
  created_at             TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_staff_role     ON staff (role);
CREATE INDEX idx_staff_is_active ON staff (is_active);
