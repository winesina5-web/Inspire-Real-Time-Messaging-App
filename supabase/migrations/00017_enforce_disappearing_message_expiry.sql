-- Enforce expiry at the database read boundary for disappearing messages.
-- Keep the existing scheduled-message release gate and sender visibility before expiry.
DROP POLICY IF EXISTS messages_select_participant ON public.messages;
CREATE POLICY messages_select_participant
ON public.messages
FOR SELECT
TO authenticated
USING (
  (
    (SELECT auth.uid()) = sender_id
    OR (
      (SELECT auth.uid()) = receiver_id
      AND (scheduled_for IS NULL OR scheduled_for <= now())
    )
  )
  AND (expires_at IS NULL OR expires_at > now())
);
