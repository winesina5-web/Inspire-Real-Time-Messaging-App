-- ==============================================================================
-- Migration 00003: Wave 2 Ultra Advanced Features Schema (Document 09)
-- Inspire — Real-Time Messaging App
-- ==============================================================================

-- 1. Threaded Replies in Groups
CREATE TABLE IF NOT EXISTS public.message_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  root_message_id uuid NOT NULL REFERENCES public.group_messages(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.thread_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.message_threads(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  message_type text NOT NULL DEFAULT 'text',
  media_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. AI Personas and Translation Cache
CREATE TABLE IF NOT EXISTS public.ai_personas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  system_prompt text NOT NULL,
  avatar_emoji text DEFAULT '🤖',
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.message_translations_cache (
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  target_lang text NOT NULL,
  translated_text text NOT NULL,
  model_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, target_lang)
);

-- 3. Private Contact Notes, In-App Reminders, and Availability
CREATE TABLE IF NOT EXISTS public.user_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, contact_id)
);

CREATE TABLE IF NOT EXISTS public.reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message_id uuid REFERENCES public.messages(id) ON DELETE CASCADE,
  remind_at timestamptz NOT NULL,
  note text,
  sent boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reminders_due ON public.reminders(remind_at, sent);

CREATE TABLE IF NOT EXISTS public.slow_mode_settings (
  group_id uuid PRIMARY KEY REFERENCES public.groups(id) ON DELETE CASCADE,
  interval_seconds int NOT NULL DEFAULT 0,
  updated_by uuid REFERENCES public.profiles(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_availability (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  dnd_enabled boolean NOT NULL DEFAULT false,
  dnd_start time,
  dnd_end time,
  timezone text DEFAULT 'UTC',
  auto_reply_text text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Chat Automation Bots & Templates
CREATE TABLE IF NOT EXISTS public.chat_bots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  avatar_url text,
  webhook_url text NOT NULL,
  token_hash text NOT NULL,
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bot_subscriptions (
  bot_id uuid NOT NULL REFERENCES public.chat_bots(id) ON DELETE CASCADE,
  context_type text NOT NULL CHECK (context_type IN ('dm', 'group')),
  context_id uuid NOT NULL,
  added_by uuid NOT NULL REFERENCES public.profiles(id),
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bot_id, context_id)
);

CREATE TABLE IF NOT EXISTS public.message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  label text NOT NULL,
  content text NOT NULL,
  shortcut text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, shortcut)
);

-- 5. Channels and Analytics
CREATE TABLE IF NOT EXISTS public.channel_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  avatar_url text,
  is_public boolean NOT NULL DEFAULT true,
  subscriber_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.channel_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.channel_subscriptions(id) ON DELETE CASCADE,
  content text NOT NULL,
  media_url text,
  message_type text NOT NULL DEFAULT 'text',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.channel_post_reactions (
  channel_post_id uuid NOT NULL REFERENCES public.channel_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (channel_post_id, user_id, emoji)
);

CREATE TABLE IF NOT EXISTS public.channel_members (
  channel_id uuid NOT NULL REFERENCES public.channel_subscriptions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (channel_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.read_later (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  note text,
  is_done boolean NOT NULL DEFAULT false,
  saved_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (requester_id, addressee_id)
);

CREATE TABLE IF NOT EXISTS public.ai_summaries_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_key text NOT NULL,
  last_message_id uuid REFERENCES public.messages(id) ON DELETE CASCADE,
  summary_text text NOT NULL,
  type text NOT NULL DEFAULT 'summary',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.message_analytics (
  post_id uuid PRIMARY KEY REFERENCES public.channel_posts(id) ON DELETE CASCADE,
  view_count int NOT NULL DEFAULT 0,
  reaction_count int NOT NULL DEFAULT 0,
  share_count int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 6. Payment Splits and Custom Emoji
CREATE TABLE IF NOT EXISTS public.payment_splits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  conversation_key text NOT NULL,
  title text NOT NULL,
  total_amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payment_split_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  split_id uuid NOT NULL REFERENCES public.payment_splits(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'paid')) DEFAULT 'pending',
  paid_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.custom_emoji (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shortcode text UNIQUE NOT NULL,
  image_url text NOT NULL,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 7. Group Events and RSVPs
CREATE TABLE IF NOT EXISTS public.group_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  location text,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.event_rsvps (
  event_id uuid NOT NULL REFERENCES public.group_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  response text NOT NULL CHECK (response IN ('going', 'maybe', 'not_going')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);

-- 8. Stories Highlights
CREATE TABLE IF NOT EXISTS public.stories_highlights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  cover_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.highlight_items (
  highlight_id uuid NOT NULL REFERENCES public.stories_highlights(id) ON DELETE CASCADE,
  status_id uuid NOT NULL REFERENCES public.statuses(id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (highlight_id, status_id)
);

CREATE TABLE IF NOT EXISTS public.message_reactions_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.channel_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.broadcast_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.moderation_appeals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  reason text NOT NULL,
  status text NOT NULL CHECK (status IN ('open', 'reviewed', 'overturned', 'upheld')) DEFAULT 'open',
  reviewed_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  badge_type text NOT NULL,
  earned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, badge_type)
);

CREATE TABLE IF NOT EXISTS public.leaderboards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period text NOT NULL CHECK (period IN ('daily', 'weekly', 'monthly')),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  score int NOT NULL,
  rank int NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.network_quality_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rtt_ms int,
  packet_loss_pct numeric,
  client_ts timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.incognito_mode (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  conversation_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  enabled_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, conversation_key)
);

CREATE TABLE IF NOT EXISTS public.trusted_contacts (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  trusted_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, trusted_id)
);

CREATE TABLE IF NOT EXISTS public.account_recovery_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('pending', 'confirmed', 'denied', 'expired')) DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);

CREATE TABLE IF NOT EXISTS public.shared_notes (
  conversation_key text PRIMARY KEY,
  content text NOT NULL DEFAULT '',
  last_edited_by uuid REFERENCES public.profiles(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.time_capsules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  conversation_key text NOT NULL,
  sealed_at timestamptz NOT NULL DEFAULT now(),
  unlock_at timestamptz,
  title text NOT NULL,
  is_public boolean NOT NULL DEFAULT false,
  message_snapshot jsonb NOT NULL,
  view_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chat_previews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  conversation_key text NOT NULL,
  message_ids uuid[] NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '48 hours'),
  view_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.translation_settings (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  conversation_key text NOT NULL,
  auto_translate boolean NOT NULL DEFAULT false,
  target_language text NOT NULL DEFAULT 'en',
  PRIMARY KEY (user_id, conversation_key)
);

CREATE TABLE IF NOT EXISTS public.dismissed_suggestions (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  suggested_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  dismissed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, suggested_id)
);

CREATE TABLE IF NOT EXISTS public.notification_queue (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  conversation_key text NOT NULL,
  pending_count int NOT NULL DEFAULT 1,
  first_queued_at timestamptz NOT NULL DEFAULT now(),
  last_queued_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, conversation_key)
);

CREATE TABLE IF NOT EXISTS public.archived_chats (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  conversation_key text NOT NULL,
  archived_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, conversation_key)
);

CREATE TABLE IF NOT EXISTS public.deletion_requests (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  requested_at timestamptz NOT NULL DEFAULT now(),
  scheduled_purge_at timestamptz NOT NULL DEFAULT (now() + interval '30 days')
);

CREATE TABLE IF NOT EXISTS public.clipboard_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('message', 'manual')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_conversation_analytics_cache (
  conversation_key text NOT NULL,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  computed_at timestamptz NOT NULL DEFAULT now(),
  stats_json jsonb NOT NULL,
  PRIMARY KEY (conversation_key, user_id)
);
