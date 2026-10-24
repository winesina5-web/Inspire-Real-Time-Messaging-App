-- Harden SECURITY DEFINER helpers against search_path attacks and privilege abuse.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid()) AND role = 'admin'
  );
$$;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_contact_suggestions(me uuid)
RETURNS TABLE (contact_id uuid, mutual_count bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF me IS NULL OR me <> (SELECT auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized to request suggestions for another user'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT c2.contact_id, COUNT(*) AS mutual_count
  FROM public.contacts c1
  JOIN public.contacts c2 ON c1.contact_id = c2.user_id
  WHERE c1.user_id = me
    AND c2.contact_id <> me
    AND NOT EXISTS (
      SELECT 1 FROM public.contacts c3
      WHERE c3.user_id = me AND c3.contact_id = c2.contact_id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.dismissed_suggestions d
      WHERE d.user_id = me AND d.suggested_id = c2.contact_id
    )
  GROUP BY c2.contact_id
  ORDER BY mutual_count DESC
  LIMIT 10;
END;
$$;
REVOKE ALL ON FUNCTION public.get_contact_suggestions(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_contact_suggestions(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.refresh_message_heatmap()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Administrator access required' USING ERRCODE = '42501';
  END IF;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.message_heatmap;
END;
$$;
REVOKE ALL ON FUNCTION public.refresh_message_heatmap() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refresh_message_heatmap() TO authenticated, service_role;

-- Trigger helpers use a fixed search_path; they are not RPC entry points.
ALTER FUNCTION public.handle_new_user() SET search_path = public, pg_temp;
ALTER FUNCTION public.prevent_role_status_self_update() SET search_path = public, pg_temp;
ALTER FUNCTION public.check_not_blocked_before_message() SET search_path = public, pg_temp;
ALTER FUNCTION public.increment_user_message_count() SET search_path = public, pg_temp;
