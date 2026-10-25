-- AI character membership is shared only when a character is explicitly added to a group.
-- Private one-to-one character conversations remain browser-local and are never stored here.
ALTER TABLE public.group_messages
  ADD COLUMN IF NOT EXISTS ai_character_id uuid,
  ADD COLUMN IF NOT EXISTS ai_character_name text,
  ADD COLUMN IF NOT EXISTS ai_character_avatar_url text;

CREATE TABLE IF NOT EXISTS public.group_ai_characters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  character_id uuid NOT NULL,
  added_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  role text NOT NULL CHECK (char_length(role) BETWEEN 1 AND 240),
  behavior text NOT NULL DEFAULT '' CHECK (char_length(behavior) <= 2000),
  scenario text NOT NULL DEFAULT '' CHECK (char_length(scenario) <= 2000),
  speaking_style text NOT NULL DEFAULT 'Natural, expressive, concise' CHECK (char_length(speaking_style) <= 500),
  avatar_url text,
  trigger_mode text NOT NULL DEFAULT 'mentioned_or_relevant'
    CHECK (trigger_mode IN ('mentioned_or_relevant', 'mentioned_only', 'every_message')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_spoke_at timestamptz,
  UNIQUE (group_id, character_id)
);

CREATE INDEX IF NOT EXISTS group_ai_characters_group_active_idx
  ON public.group_ai_characters (group_id, is_active, created_at);

ALTER TABLE public.group_ai_characters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Group members can view group AI characters" ON public.group_ai_characters;
CREATE POLICY "Group members can view group AI characters"
  ON public.group_ai_characters FOR SELECT TO authenticated
  USING (public.is_group_member(group_id));

DROP POLICY IF EXISTS "Group members can add group AI characters" ON public.group_ai_characters;
CREATE POLICY "Group members can add group AI characters"
  ON public.group_ai_characters FOR INSERT TO authenticated
  WITH CHECK (
    added_by = (SELECT auth.uid())
    AND public.is_group_member(group_id)
  );

DROP POLICY IF EXISTS "Character owner or group admins can update group AI characters" ON public.group_ai_characters;
CREATE POLICY "Character owner or group admins can update group AI characters"
  ON public.group_ai_characters FOR UPDATE TO authenticated
  USING (added_by = (SELECT auth.uid()) OR public.is_group_admin(group_id))
  WITH CHECK (added_by = (SELECT auth.uid()) OR public.is_group_admin(group_id));

DROP POLICY IF EXISTS "Character owner or group admins can remove group AI characters" ON public.group_ai_characters;
CREATE POLICY "Character owner or group admins can remove group AI characters"
  ON public.group_ai_characters FOR DELETE TO authenticated
  USING (added_by = (SELECT auth.uid()) OR public.is_group_admin(group_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_ai_characters TO authenticated;
