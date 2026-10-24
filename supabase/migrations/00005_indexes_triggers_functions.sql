-- ==============================================================================
-- Migration 00005: Indexes, Triggers, and Database Functions
-- Inspire — Real-Time Messaging App
-- ==============================================================================

-- 1. Full-Text Search tsvector columns and GIN Indexes (Document 09 Feature 129)
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS content_tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(content, ''))) STORED;

CREATE INDEX IF NOT EXISTS idx_messages_content_tsv ON public.messages USING GIN(content_tsv);

ALTER TABLE public.group_messages ADD COLUMN IF NOT EXISTS content_tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(content, ''))) STORED;

CREATE INDEX IF NOT EXISTS idx_group_messages_content_tsv ON public.group_messages USING GIN(content_tsv);

-- 2. User Creation Trigger (Document 05 Section 5)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, created_at, last_seen)
  VALUES (new.id, null, split_part(new.email, '@', 1), now(), now())
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 3. Prevent Self Role/Status Escalation (Document 05 Section 5)
CREATE OR REPLACE FUNCTION public.prevent_role_status_self_update()
RETURNS trigger AS $$
BEGIN
  -- If updater is not an admin, disallow changes to role or status
  IF (new.role != old.role OR new.status != old.status) AND (auth.uid() IS NOT NULL) THEN
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
      RAISE EXCEPTION 'Unauthorized: only platform administrators can alter role or status.';
    END IF;
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_prevent_role_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_role_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.prevent_role_status_self_update();

-- 4. Check Block Status Before Message Send (Document 05 Section 5)
CREATE OR REPLACE FUNCTION public.check_not_blocked_before_message()
RETURNS trigger AS $$
BEGIN
  IF new.receiver_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.blocked_users
      WHERE (blocker_id = new.receiver_id AND blocked_id = new.sender_id)
         OR (blocker_id = new.sender_id AND blocked_id = new.receiver_id)
    ) THEN
      RAISE EXCEPTION 'Messaging blocked between participants.';
    END IF;
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_check_not_blocked ON public.messages;
CREATE TRIGGER trg_check_not_blocked
  BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE PROCEDURE public.check_not_blocked_before_message();

-- 5. Track Messages Sent Count for Badges / Gamification (Document 09 Feature 119)
CREATE OR REPLACE FUNCTION public.increment_user_message_count()
RETURNS trigger AS $$
BEGIN
  UPDATE public.profiles
  SET messages_sent_count = messages_sent_count + 1
  WHERE id = new.sender_id;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_increment_message_count ON public.messages;
CREATE TRIGGER trg_increment_message_count
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE PROCEDURE public.increment_user_message_count();

-- 6. Smart Contact Suggestions Function (Document 09 Feature 147)
CREATE OR REPLACE FUNCTION public.get_contact_suggestions(me uuid)
RETURNS TABLE (
  contact_id uuid,
  mutual_count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT c2.contact_id, COUNT(*) AS mutual_count
  FROM public.contacts c1
  JOIN public.contacts c2 ON c1.contact_id = c2.user_id
  WHERE c1.user_id = me
    AND c2.contact_id != me
    AND c2.contact_id NOT IN (SELECT c3.contact_id FROM public.contacts c3 WHERE c3.user_id = me)
    AND c2.contact_id NOT IN (SELECT d.suggested_id FROM public.dismissed_suggestions d WHERE d.user_id = me)
  GROUP BY c2.contact_id
  ORDER BY mutual_count DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Revoke default public execution
REVOKE EXECUTE ON FUNCTION public.get_contact_suggestions(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_contact_suggestions(uuid) TO authenticated;

-- 7. Materialized View for Message Heatmap (Document 09 Feature 131)
CREATE MATERIALIZED VIEW IF NOT EXISTS public.message_heatmap AS
  SELECT
    EXTRACT(dow FROM created_at)::int AS day_of_week,
    EXTRACT(hour FROM created_at)::int AS hour_of_day,
    COUNT(*) AS message_count
  FROM public.messages
  WHERE created_at > now() - interval '90 days'
  GROUP BY 1, 2;

CREATE UNIQUE INDEX IF NOT EXISTS idx_message_heatmap_dow_hour
  ON public.message_heatmap (day_of_week, hour_of_day);

CREATE OR REPLACE FUNCTION public.refresh_message_heatmap()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.message_heatmap;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
