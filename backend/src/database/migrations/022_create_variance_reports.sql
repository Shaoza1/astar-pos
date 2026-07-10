-- Migration: variance_reports | Created: 2025-07-09 | Author: Kutloano Moshao
-- Per-ingredient stock variance for a shift. variance and variance_type are generated columns
-- so they are always mathematically consistent with the entered counts.
--
-- Formula: variance = opening_stock + stock_received - expected_consumption - actual_count
--   Negative variance = shortage (more was consumed than expected — possible theft or waste)
--   Positive variance = over (less was consumed than expected — possible counting error)

CREATE TABLE variance_reports (
  id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_report_id      UUID          NOT NULL REFERENCES shift_reports (id),
  ingredient_id        UUID          NOT NULL REFERENCES ingredients (id),
  opening_stock        DECIMAL(10,4) NOT NULL,
  stock_received       DECIMAL(10,4) NOT NULL DEFAULT 0,
  expected_consumption DECIMAL(10,4) NOT NULL,  -- calculated from sales × recipes
  actual_count         DECIMAL(10,4) NOT NULL,  -- physical count entered by admin
  variance             DECIMAL(10,4) GENERATED ALWAYS AS
                         (opening_stock + stock_received - expected_consumption - actual_count) STORED,
  variance_type        VARCHAR(10)   GENERATED ALWAYS AS (
                         CASE
                           WHEN (opening_stock + stock_received - expected_consumption - actual_count) < 0 THEN 'shortage'
                           WHEN (opening_stock + stock_received - expected_consumption - actual_count) > 0 THEN 'over'
                           ELSE 'exact'
                         END
                       ) STORED,
  counted_by           UUID          NOT NULL REFERENCES staff (id),
  counted_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_variance_reports_shift_report_id ON variance_reports (shift_report_id);
CREATE INDEX idx_variance_reports_ingredient_id   ON variance_reports (ingredient_id);
-- Partial indexes to support "show shortages only" and "show overs only" filter views
CREATE INDEX idx_variance_reports_shortages        ON variance_reports (shift_report_id) WHERE variance < 0;
CREATE INDEX idx_variance_reports_overs            ON variance_reports (shift_report_id) WHERE variance > 0;
