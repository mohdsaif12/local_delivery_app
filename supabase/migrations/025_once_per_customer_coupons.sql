-- ============================================================
-- Restaurant Direct — One-time-use coupons + admin management
-- Run AFTER 024_percent_coupons.sql. Safe to re-run.
-- ============================================================

-- once_per_customer: usable at any point in a customer's life, but only once.
-- (first_order_only is stricter — it must be their very first order.)
ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS once_per_customer BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS description       TEXT;

-- ------------------------------------------------------------
-- The two welcome offers. A new customer can use BOTH — one per
-- order — and each one only once, ever.
-- ------------------------------------------------------------

-- 10% off, never more than ₹100, minimum order ₹100.
INSERT INTO public.coupons
  (code, discount_amount, discount_percent, max_discount, min_order_value,
   first_order_only, once_per_customer, is_active, description)
VALUES
  ('WELCOME10', 0, 10, 100, 100, false, true, true, '10% off up to ₹100')
ON CONFLICT (code) DO UPDATE SET
  discount_amount   = 0,
  discount_percent  = 10,
  max_discount      = 100,
  min_order_value   = 100,
  first_order_only  = false,
  once_per_customer = true,
  is_active         = true;

-- Flat ₹50 off on orders of ₹299 or more.
INSERT INTO public.coupons
  (code, discount_amount, discount_percent, max_discount, min_order_value,
   first_order_only, once_per_customer, is_active, description)
VALUES
  ('SAVE50', 50, NULL, NULL, 299, false, true, true, 'Flat ₹50 off above ₹299')
ON CONFLICT (code) DO UPDATE SET
  discount_amount   = 50,
  discount_percent  = NULL,
  max_discount      = NULL,
  min_order_value   = 299,
  first_order_only  = false,
  once_per_customer = true,
  is_active         = true;

-- Redemptions are read from orders.coupon_code, so that lookup needs an index.
CREATE INDEX IF NOT EXISTS orders_customer_coupon_idx
  ON public.orders (customer_id, coupon_code)
  WHERE coupon_code IS NOT NULL;

-- ------------------------------------------------------------
-- Admin management: the restaurant role owns this table, so offers
-- can be created and switched on/off from the dashboard with no
-- code change. Customers keep read-only access to active coupons.
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "coupons_admin_all" ON public.coupons;
CREATE POLICY "coupons_admin_all"
  ON public.coupons FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'restaurant')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'restaurant')
  );

-- Verify
SELECT code, discount_amount, discount_percent, max_discount, min_order_value,
       first_order_only, once_per_customer, is_active
FROM public.coupons ORDER BY code;
