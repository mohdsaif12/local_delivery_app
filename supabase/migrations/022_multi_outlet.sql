-- Multiple outlets
--
-- The restaurants table already held everything an outlet needs (address,
-- lat/lng, hours, delivery fee, open flag) but the app only ever read one row.
-- This adds the columns needed to list several of them to customers.
--
-- The menu is shared across outlets: products carry no restaurant_id, so
-- nothing here touches them. Only delivery distance, fee and hours differ.

ALTER TABLE public.restaurants
  -- Short label for the picker, e.g. 'Swaroop Nagar'. Falls back to name.
  ADD COLUMN IF NOT EXISTS area_name TEXT,
  -- Lets an outlet be hidden from customers without deleting its order history.
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  -- Display order in the picker; ties break on name.
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0,
  -- How far this outlet delivers. 25km matches the previous global limit, so
  -- existing behaviour is unchanged until someone narrows it per outlet.
  ADD COLUMN IF NOT EXISTS delivery_radius_km NUMERIC(5,2) NOT NULL DEFAULT 25;

-- Give the existing outlet a label so the picker never shows a blank row.
UPDATE public.restaurants
   SET area_name = COALESCE(NULLIF(area_name, ''), name)
 WHERE area_name IS NULL OR area_name = '';

-- Customers list active outlets on every menu and checkout load.
CREATE INDEX IF NOT EXISTS restaurants_active_idx
  ON public.restaurants (is_active, sort_order);

-- Orders must name the outlet they belong to. Historic rows predate multi
-- outlet and already point at the only restaurant that existed.
CREATE INDEX IF NOT EXISTS orders_restaurant_idx
  ON public.orders (restaurant_id, created_at DESC);
