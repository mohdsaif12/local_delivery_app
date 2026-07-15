-- ═══════════════════════════════════════════════════════════
-- 016  rider_locations: allow shared staff account to write
-- ═══════════════════════════════════════════════════════════
-- The delivery dashboard is run by a single shared operator/admin
-- account, not by each rider individually. The original policies
-- required auth.uid() = rider_id, which can never be true for a
-- shared account pushing GPS on behalf of many riders — every
-- upsert failed with 42501 (RLS violation).
--
-- Fix: any authenticated staff member (role 'restaurant' or 'rider')
-- may insert/update rider locations. The upsert (INSERT ... ON
-- CONFLICT DO UPDATE) exercises BOTH the INSERT WITH CHECK and the
-- UPDATE policy, so both are relaxed the same way.

DROP POLICY IF EXISTS "rider_locations_insert" ON public.rider_locations;
DROP POLICY IF EXISTS "rider_locations_update" ON public.rider_locations;

CREATE POLICY "rider_locations_insert"
  ON public.rider_locations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('restaurant', 'rider')
    )
  );

CREATE POLICY "rider_locations_update"
  ON public.rider_locations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('restaurant', 'rider')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('restaurant', 'rider')
    )
  );
