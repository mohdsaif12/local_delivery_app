-- ============================================================
-- Restaurant Direct — Percentage coupons + first-order-only offers
-- Run AFTER 023_restaurants_insert.sql. Safe to re-run.
-- ============================================================

-- A coupon is now either a flat amount (discount_amount) or a percentage
-- (discount_percent) capped at max_discount. first_order_only limits it to a
-- customer who has never ordered before — every later order only sees the
-- coupons the admin has switched on in this table.
ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS discount_percent  INTEGER,
  ADD COLUMN IF NOT EXISTS max_discount      INTEGER,
  ADD COLUMN IF NOT EXISTS first_order_only  BOOLEAN NOT NULL DEFAULT FALSE;

-- discount_amount was NOT NULL CHECK (> 0); percentage coupons carry 0 there.
ALTER TABLE public.coupons ALTER COLUMN discount_amount SET DEFAULT 0;

DO $$
BEGIN
  ALTER TABLE public.coupons DROP CONSTRAINT IF EXISTS coupons_discount_amount_check;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE public.coupons DROP CONSTRAINT IF EXISTS coupons_shape_check;
ALTER TABLE public.coupons ADD CONSTRAINT coupons_shape_check CHECK (
  (discount_percent IS NULL AND discount_amount > 0)
  OR (discount_percent BETWEEN 1 AND 100 AND max_discount > 0)
);

-- The welcome offer: 10% off, never more than ₹100, first order only.
INSERT INTO public.coupons
  (code, discount_amount, discount_percent, max_discount, min_order_value, first_order_only, is_active)
VALUES
  ('WELCOME10', 0, 10, 100, 100, true, true)
ON CONFLICT (code) DO UPDATE SET
  discount_amount  = 0,
  discount_percent = 10,
  max_discount     = 100,
  min_order_value  = 100,
  first_order_only = true,
  is_active        = true;

-- Retire the old flat ₹50 offer.
UPDATE public.coupons SET is_active = false WHERE code = 'FLAT50';

-- Verify
SELECT code, discount_amount, discount_percent, max_discount, min_order_value,
       first_order_only, is_active
FROM public.coupons ORDER BY code;
