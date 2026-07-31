-- ════════════════════════════════════════════════════════════════════════
-- Avatars bucket — customer profile photos
--
-- Creates a public 'avatars' bucket and Storage policies so each signed-in
-- customer can upload/replace/delete ONLY their own avatar (files must live
-- under a folder named their user id: avatars/<uid>/...). Anyone can read
-- (the bucket is public), so photos display without signed URLs.
--
-- Run once in Supabase → SQL Editor.
-- ════════════════════════════════════════════════════════════════════════

-- 1. Bucket (idempotent)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Public read
DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
CREATE POLICY "avatars_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- 3. A user may upload only into their own folder (avatars/<uid>/...)
DROP POLICY IF EXISTS "avatars_own_insert" ON storage.objects;
CREATE POLICY "avatars_own_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 4. A user may replace their own avatar
DROP POLICY IF EXISTS "avatars_own_update" ON storage.objects;
CREATE POLICY "avatars_own_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 5. A user may delete their own avatar
DROP POLICY IF EXISTS "avatars_own_delete" ON storage.objects;
CREATE POLICY "avatars_own_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
