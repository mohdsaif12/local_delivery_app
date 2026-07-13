-- Allow authenticated users to read rider profiles
-- Needed so customers can see their assigned rider's name on the order tracking page
DROP POLICY IF EXISTS "profiles_select_rider" ON public.profiles;

CREATE POLICY "profiles_select_rider"
  ON public.profiles FOR SELECT
  USING (
    role = 'rider'
    AND auth.uid() IS NOT NULL
  );
