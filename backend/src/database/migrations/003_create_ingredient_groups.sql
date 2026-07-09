-- Migration: ingredient_groups | Created: 2025-07-09 | Author: Kutloano Moshao
-- Logical grouping for ingredients (Proteins, Dairy, Alcohol - Spirits, etc.) used in stock reports

CREATE TABLE ingredient_groups (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(100) NOT NULL UNIQUE,  -- e.g. 'Proteins', 'Carbs', 'Dairy', 'Alcohol - Spirits'
  sort_order INTEGER      NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ingredient_groups_sort_order ON ingredient_groups (sort_order);
