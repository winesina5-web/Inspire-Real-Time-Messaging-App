CREATE TABLE IF NOT EXISTS public.group_ai_reply_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES public.group_messages(id) ON DELETE CASCADE,
  group_ai_character_id uuid NOT NULL REFERENCES public.group_ai_characters(id) ON DELETE CASCADE,
  claimed_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, message_id, group_ai_character_id)
);

CREATE INDEX IF NOT EXISTS group_ai_reply_claims_created_idx
  ON public.group_ai_reply_claims (created_at);

ALTER TABLE public.group_ai_reply_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Group members can see AI reply claims" ON public.group_ai_reply_claims;
CREATE POLICY "Group members can see AI reply claims"
  ON public.group_ai_reply_claims FOR SELECT TO authenticated
  USING (
    public.is_group_member(group_id)
    AND EXISTS (
      SELECT 1 FROM public.group_ai_characters c
      WHERE c.id = group_ai_character_id AND c.group_id = group_ai_reply_claims.group_id
    )
  );

DROP POLICY IF EXISTS "Group members can claim AI replies" ON public.group_ai_reply_claims;
CREATE POLICY "Group members can claim AI replies"
  ON public.group_ai_reply_claims FOR INSERT TO authenticated
  WITH CHECK (
    claimed_by = (SELECT auth.uid())
    AND public.is_group_member(group_id)
    AND EXISTS (
      SELECT 1 FROM public.group_ai_characters c
      WHERE c.id = group_ai_character_id
        AND c.group_id = group_ai_reply_claims.group_id
        AND c.is_active = true
    )
    AND EXISTS (
      SELECT 1 FROM public.group_messages m
      WHERE m.id = message_id AND m.group_id = group_ai_reply_claims.group_id
        AND m.ai_character_id IS NULL
    )
  );

DROP POLICY IF EXISTS "Claim owner can release failed AI replies" ON public.group_ai_reply_claims;
CREATE POLICY "Claim owner can release failed AI replies"
  ON public.group_ai_reply_claims FOR DELETE TO authenticated
  USING (claimed_by = (SELECT auth.uid()));

GRANT SELECT, INSERT, DELETE ON public.group_ai_reply_claims TO authenticated;
