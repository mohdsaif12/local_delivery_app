-- Let staff create outlets from the dashboard.
--
-- 001_init gave restaurants SELECT (public) and UPDATE (restaurant role) only.
-- With one hardcoded outlet that was enough — nobody ever created a row from
-- the app. An admin "Add outlet" screen needs INSERT, or RLS rejects the write
-- with no obvious error.
--
-- Scope note: any account with role = 'restaurant' can add an outlet. That
-- matches how UPDATE already works. When per-outlet staff accounts land, both
-- policies should be narrowed to an owner/admin role together.

DROP POLICY IF EXISTS "restaurants_insert_restaurant" ON public.restaurants;

CREATE POLICY "restaurants_insert_restaurant"
  ON public.restaurants FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'restaurant'
    )
  );

-- Deliberately no DELETE policy: outlets carry order history, so retiring one
-- means setting is_active = false, not deleting the row.
