-- ============================================================
-- Restaurant Direct — MVP Database Migration
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- ── Tables ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.profiles (
  id        UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role      TEXT NOT NULL CHECK (role IN ('customer', 'restaurant')),
  full_name TEXT NOT NULL DEFAULT '',
  email     TEXT NOT NULL DEFAULT '',
  phone     TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.products (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT    NOT NULL,
  description  TEXT    NOT NULL DEFAULT '',
  price        INTEGER NOT NULL CHECK (price > 0),  -- stored in ₹ (whole rupees)
  photo_url    TEXT,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.orders (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','accepted','preparing','ready')),
  delivery_address JSONB NOT NULL DEFAULT '{}',
  total            INTEGER NOT NULL CHECK (total >= 0),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.order_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id       UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id     UUID REFERENCES public.products(id) ON DELETE SET NULL,
  quantity       INTEGER NOT NULL CHECK (quantity > 0),
  price_at_order INTEGER NOT NULL CHECK (price_at_order >= 0),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── Auto-create profile on sign-up ────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, role, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'customer'),
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.email, '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ── Row Level Security ─────────────────────────────────────

ALTER TABLE public.profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY "profiles_select_own"  ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update_own"  ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own"  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- products: everyone can read
CREATE POLICY "products_select_all"  ON public.products FOR SELECT USING (true);

-- orders: customers insert own; customers OR restaurant can read; restaurant updates status
CREATE POLICY "orders_insert_own"    ON public.orders FOR INSERT
  WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "orders_select"        ON public.orders FOR SELECT
  USING (
    auth.uid() = customer_id
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'restaurant'
    )
  );

CREATE POLICY "orders_update_restaurant" ON public.orders FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'restaurant'
    )
  );

-- order_items: customers insert for own orders; customers/restaurant can read
CREATE POLICY "order_items_insert"   ON public.order_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE id = order_id AND customer_id = auth.uid()
    )
  );

CREATE POLICY "order_items_select"   ON public.order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE id = order_id AND (
        customer_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid() AND role = 'restaurant'
        )
      )
    )
  );

-- ── Enable Realtime ────────────────────────────────────────

-- Run these AFTER tables are created:
ALTER TABLE public.orders REPLICA IDENTITY FULL;

-- Add orders to the Realtime publication
-- (supabase_realtime already exists on Supabase projects)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;
END $$;

-- ── Seed Data ─────────────────────────────────────────────

INSERT INTO public.products (name, description, price, is_available)
VALUES
  ('Chicken Biryani',
   'Aromatic basmati rice with tender chicken, whole spices, caramelised onions, and saffron. Served with raita.',
   180, TRUE),
  ('Veg Biryani',
   'Fragrant basmati rice layered with seasonal vegetables, fried onions, mint, and green chutney.',
   140, TRUE),
  ('Paneer Roll',
   'Soft whole-wheat paratha stuffed with spiced cottage cheese, crunchy onions, and house green chutney.',
   120, TRUE),
  ('Cold Coffee',
   'Rich blended coffee with chilled milk and a hint of vanilla. Smooth and refreshing.',
   90, TRUE),
  ('Brownie',
   'Dense, fudgy dark-chocolate brownie with a crinkle top. Served warm.',
   80, TRUE)
ON CONFLICT DO NOTHING;

-- ============================================================
-- AFTER running this migration, create test accounts:
--
-- In Supabase Dashboard → Authentication → Users → Add user
--
-- 1. Customer account
--    Email:    customer@demo.com
--    Password: demo1234
--    Metadata: {"role":"customer","full_name":"Demo Customer"}
--
-- 2. Restaurant account
--    Email:    restaurant@demo.com
--    Password: demo1234
--    Metadata: {"role":"restaurant","full_name":"Demo Restaurant"}
--
-- The trigger above will auto-create the profiles row.
-- ============================================================