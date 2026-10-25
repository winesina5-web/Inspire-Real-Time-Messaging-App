-- Deliver scheduled direct messages without exposing them to the recipient early.
-- The sender can see their scheduled message immediately; the receiver can only
-- select it after its scheduled time. A minute-level pg_cron task clears due
-- timestamps, producing a normal row update for Realtime subscribers.
DROP POLICY IF EXISTS messages_select_participant ON public.messages;
CREATE POLICY messages_select_participant
ON public.messages
FOR SELECT
TO authenticated
USING (
  (SELECT auth.uid()) = sender_id
  OR (
    (SELECT auth.uid()) = receiver_id
    AND (scheduled_for IS NULL OR scheduled_for <= now())
  )
);

CREATE OR REPLACE FUNCTION public.release_due_scheduled_messages()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  released_count integer;
BEGIN
  UPDATE public.messages
     SET scheduled_for = NULL
   WHERE scheduled_for IS NOT NULL
     AND scheduled_for <= now()
     AND receiver_id IS NOT NULL;
  GET DIAGNOSTICS released_count = ROW_COUNT;
  RETURN released_count;
END
$function$;

REVOKE ALL ON FUNCTION public.release_due_scheduled_messages() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_due_scheduled_messages() TO postgres, service_role;

DO $block$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid)
      FROM cron.job
     WHERE jobname = 'release-due-scheduled-messages';
    PERFORM cron.schedule(
      'release-due-scheduled-messages',
      '* * * * *',
      'SELECT public.release_due_scheduled_messages();'
    );
  ELSE
    RAISE NOTICE 'pg_cron is not installed; scheduled messages will not auto-release until enabled';
  END IF;
END
$block$;
