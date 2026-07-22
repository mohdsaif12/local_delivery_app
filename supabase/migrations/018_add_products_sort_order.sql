-- 018_add_products_sort_order.sql
-- Ensure products table has sorting/positioning columns for admin dashboard ordering

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS display_order INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS position INT DEFAULT 0;
