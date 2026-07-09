-- Migration: transaction_splits | Created: 2025-07-09 | Author: Kutloano Moshao
-- Child rows of a 'split' transaction. Each row represents one payment leg of a split bill
-- (e.g. guest A pays R150 cash, guest B pays R200 card).

CREATE TABLE transaction_splits (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id    UUID          NOT NULL REFERENCES transactions (id),
  split_amount      DECIMAL(10,2) NOT NULL,
  payment_method    VARCHAR(20)   NOT NULL
                                  CHECK (payment_method IN ('cash', 'card', 'staff_account')),
  payment_reference VARCHAR(255)
);

CREATE INDEX idx_transaction_splits_transaction_id ON transaction_splits (transaction_id);
