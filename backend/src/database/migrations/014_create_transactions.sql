-- Migration: transactions | Created: 2025-07-09 | Author: Kutloano Moshao
-- Records the payment event that closes a table session. A session may have one transaction
-- (full payment) or one transaction with multiple transaction_splits (split bill).

CREATE TABLE transactions (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  table_session_id UUID          NOT NULL REFERENCES table_sessions (id),
  processed_by     UUID          NOT NULL REFERENCES staff (id),
  total_amount     DECIMAL(10,2) NOT NULL,
  payment_method   VARCHAR(20)   NOT NULL
                                 CHECK (payment_method IN ('cash', 'card', 'staff_account', 'split')),
  payment_reference VARCHAR(255),  -- Yoco/Peach reference if card
  paid_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  notes            TEXT
);

CREATE INDEX idx_transactions_table_session_id ON transactions (table_session_id);
CREATE INDEX idx_transactions_processed_by     ON transactions (processed_by);
CREATE INDEX idx_transactions_paid_at          ON transactions (paid_at);
