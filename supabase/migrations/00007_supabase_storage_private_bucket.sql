-- Private media storage on Supabase Storage (Cloudflare R2 is not used).
-- Idempotent because the live project may already have this bucket/policy set.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('inspire-media', 'inspire-media', false, 52428800)
ON CONFLICT (id) DO UPDATE
SET public = false, file_size_limit = EXCLUDED.file_size_limit;

DROP POLICY IF EXISTS inspire_media_insert_own ON storage.objects;
CREATE POLICY inspire_media_insert_own
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'inspire-media'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);

DROP POLICY IF EXISTS inspire_media_select_authorized ON storage.objects;
CREATE POLICY inspire_media_select_authorized
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'inspire-media'
  AND (
    (storage.foldername(name))[1] = (SELECT auth.uid())::text
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.avatar_url = storage.objects.name
        AND (SELECT auth.uid()) IS NOT NULL
    )
    OR EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.media_url = storage.objects.name
        AND (m.sender_id = (SELECT auth.uid()) OR m.receiver_id = (SELECT auth.uid()))
    )
    OR EXISTS (
      SELECT 1
      FROM public.group_messages gm
      JOIN public.group_members gmem ON gmem.group_id = gm.group_id
      WHERE gm.media_url = storage.objects.name
        AND gmem.user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1
      FROM public.channel_posts cp
      JOIN public.channel_members cm ON cm.channel_id = cp.channel_id
      WHERE cp.media_url = storage.objects.name
        AND cm.user_id = (SELECT auth.uid())
    )
  )
);

DROP POLICY IF EXISTS inspire_media_update_own ON storage.objects;
CREATE POLICY inspire_media_update_own
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'inspire-media'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
)
WITH CHECK (
  bucket_id = 'inspire-media'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);

DROP POLICY IF EXISTS inspire_media_delete_own ON storage.objects;
CREATE POLICY inspire_media_delete_own
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'inspire-media'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);
