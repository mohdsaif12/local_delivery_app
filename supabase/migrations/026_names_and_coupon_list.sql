-- ============================================================
-- Restaurant Direct — First/last name on profiles, coupon line-up
-- Run AFTER 025_once_per_customer_coupons.sql. Safe to re-run.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Names. Signup now asks for first and last name separately;
--    full_name stays the display name so nothing else has to change.
-- ------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name  TEXT;

-- Backfill from full_name for everyone who signed up before this.
UPDATE public.profiles
SET first_name = NULLIF(split_part(full_name, ' ', 1), ''),
    last_name  = NULLIF(trim(substr(full_name, length(split_part(full_name, ' ', 1)) + 2)), '')
WHERE first_name IS NULL
  AND full_name IS NOT NULL
  AND full_name <> 'Foodie';

-- ------------------------------------------------------------
-- 2. Coupon ordering. sort_order drives the list the customer sees;
--    the lowest one that fits their cart is applied by default.
-- ------------------------------------------------------------
ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 100;

-- ------------------------------------------------------------
-- 3. The live line-up. Every threshold below is the FOOD SUBTOTAL —
--    the delivery fee is never discounted.
-- ------------------------------------------------------------

-- Shown first, applied by default.
INSERT INTO public.coupons
  (code, discount_amount, discount_percent, max_discount, min_order_value,
   first_order_only, once_per_customer, is_active, sort_order, description)
VALUES
  ('WELCOME10', 0, 10, 100, 100, false, true, true, 10, '10% off up to ₹100')
ON CONFLICT (code) DO UPDATE SET
  discount_amount = 0, discount_percent = 10, max_discount = 100,
  min_order_value = 100, first_order_only = false, once_per_customer = true,
  is_active = true, sort_order = 10, description = '10% off up to ₹100';

INSERT INTO public.coupons
  (code, discount_amount, discount_percent, max_discount, min_order_value,
   first_order_only, once_per_customer, is_active, sort_order, description)
VALUES
  ('SAVE50', 50, NULL, NULL, 349, false, true, true, 20, 'Flat ₹50 off above ₹349')
ON CONFLICT (code) DO UPDATE SET
  discount_amount = 50, discount_percent = NULL, max_discount = NULL,
  min_order_value = 349, first_order_only = false, once_per_customer = true,
  is_active = true, sort_order = 20, description = 'Flat ₹50 off above ₹349';

INSERT INTO public.coupons
  (code, discount_amount, discount_percent, max_discount, min_order_value,
   first_order_only, once_per_customer, is_active, sort_order, description)
VALUES
  ('SAVE100', 100, NULL, NULL, 699, false, true, true, 30, 'Flat ₹100 off above ₹699')
ON CONFLICT (code) DO UPDATE SET
  discount_amount = 100, discount_percent = NULL, max_discount = NULL,
  min_order_value = 699, first_order_only = false, once_per_customer = true,
  is_active = true, sort_order = 30, description = 'Flat ₹100 off above ₹699';

-- Verify
SELECT code, discount_amount, discount_percent, max_discount, min_order_value,
       once_per_customer, sort_order, is_active
FROM public.coupons WHERE is_active ORDER BY sort_order;
