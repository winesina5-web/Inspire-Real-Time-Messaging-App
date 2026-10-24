-- ==============================================================================
-- Migration 00002: Wave 1 Advanced Features Schema (Document 07)
-- Inspire — Real-Time Messaging App
-- ==============================================================================

-- 1. Groups Tables
CREATE TABLE IF NOT EXISTS public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  avatar_url text,
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  invite_link_token text UNIQUE,
  max_members int NOT NULL DEFAULT 256,
  is_public boolean NOT NULL DEFAULT false,
  category text
);

-- Link messages.group_id to groups table
ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS fk_messages_group,
  ADD CONSTRAINT fk_messages_group FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS public.group_members (
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_group_members_user ON public.group_members(user_id);

CREATE TABLE IF NOT EXISTS public.group_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text,
  message_type text NOT NULL DEFAULT 'text' CHECK (message_type IN (
    'text', 'image', 'video', 'audio', 'voice_note', 'file',
    'sticker', 'gif', 'location', 'contact_card', 'poll', 'event', 'split', 'game'
  )),
  media_url text,
  media_size bigint,
  media_name text,
  reply_to_id uuid REFERENCES public.group_messages(id) ON DELETE SET NULL,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz,
  mentioned_user_ids uuid[],
  thread_reply_count int NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_group_messages_group ON public.group_messages(group_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.group_message_reads (
  group_message_id uuid NOT NULL REFERENCES public.group_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_message_id, user_id)
);

-- 2. Message Edits, Starred, and Pinned Messages
CREATE TABLE IF NOT EXISTS public.message_edits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  previous_content text NOT NULL,
  edited_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_message_edits_msg ON public.message_edits(message_id);

CREATE TABLE IF NOT EXISTS public.starred_messages (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, message_id)
);

CREATE TABLE IF NOT EXISTS public.pinned_messages (
  conversation_key text NOT NULL PRIMARY KEY,
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  pinned_by uuid NOT NULL REFERENCES public.profiles(id),
  pinned_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Calls Table
CREATE TABLE IF NOT EXISTS public.calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_id uuid NOT NULL REFERENCES public.profiles(id),
  callee_id uuid REFERENCES public.profiles(id),
  group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('voice', 'video')),
  status text NOT NULL CHECK (status IN ('missed', 'answered', 'declined')),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_seconds int DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_calls_caller ON public.calls(caller_id);
CREATE INDEX IF NOT EXISTS idx_calls_callee ON public.calls(callee_id);

-- 4. Statuses (Stories) Tables
CREATE TABLE IF NOT EXISTS public.statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  media_type text NOT NULL CHECK (media_type IN ('text', 'image', 'video')),
  content text,
  media_url text,
  privacy text NOT NULL DEFAULT 'contacts' CHECK (privacy IN ('contacts', 'except', 'only')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_statuses_user_expires ON public.statuses(user_id, expires_at);

CREATE TABLE IF NOT EXISTS public.status_views (
  status_id uuid NOT NULL REFERENCES public.statuses(id) ON DELETE CASCADE,
  viewer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (status_id, viewer_id)
);

CREATE TABLE IF NOT EXISTS public.status_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status_id uuid NOT NULL REFERENCES public.statuses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji text,
  reply_text text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Group Polls
CREATE TABLE IF NOT EXISTS public.polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_message_id uuid NOT NULL REFERENCES public.group_messages(id) ON DELETE CASCADE,
  question text NOT NULL,
  allow_multiple boolean NOT NULL DEFAULT false,
  closes_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.poll_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  option_text text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.poll_votes (
  poll_id uuid NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  option_id uuid NOT NULL REFERENCES public.poll_options(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  voted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (poll_id, option_id, user_id)
);

-- 6. Folders, Pinned, Muted, and Secret Chats
CREATE TABLE IF NOT EXISTS public.chat_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text DEFAULT '#0E2A6E',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chat_folder_members (
  folder_id uuid NOT NULL REFERENCES public.chat_folders(id) ON DELETE CASCADE,
  partner_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pinned_chats (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  conversation_key text NOT NULL,
  pinned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, conversation_key)
);

CREATE TABLE IF NOT EXISTS public.muted_chats (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  conversation_key text NOT NULL,
  muted_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, conversation_key)
);

CREATE TABLE IF NOT EXISTS public.secret_chats (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  conversation_key text NOT NULL,
  pin_hash text,
  decoy_pin_hash text,
  auto_delete_seconds int DEFAULT 60,
  enabled_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, conversation_key)
);

CREATE TABLE IF NOT EXISTS public.view_once_media (
  message_id uuid PRIMARY KEY REFERENCES public.messages(id) ON DELETE CASCADE,
  opened_by uuid REFERENCES public.profiles(id),
  opened_at timestamptz
);

-- 7. User Sessions and Privacy Settings
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  device_label text NOT NULL,
  last_active timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON public.user_sessions(user_id);

CREATE TABLE IF NOT EXISTS public.privacy_settings (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_seen_visibility text NOT NULL DEFAULT 'everyone' CHECK (last_seen_visibility IN ('everyone', 'contacts', 'nobody')),
  profile_photo_visibility text NOT NULL DEFAULT 'everyone' CHECK (profile_photo_visibility IN ('everyone', 'contacts', 'nobody')),
  status_visibility text NOT NULL DEFAULT 'everyone' CHECK (status_visibility IN ('everyone', 'contacts', 'nobody')),
  read_receipts_enabled boolean NOT NULL DEFAULT true,
  auto_translate_enabled boolean NOT NULL DEFAULT false,
  preferred_translation_language text NOT NULL DEFAULT 'en'
);

-- 8. Support Tickets and Admin Moderation Rules
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id),
  is_admin boolean NOT NULL DEFAULT false,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.moderation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword_pattern text NOT NULL,
  action text NOT NULL CHECK (action IN ('flag', 'auto_hide')),
  rule_type text NOT NULL DEFAULT 'keyword' CHECK (rule_type IN ('keyword', 'regex', 'proximity', 'ai_verdict')),
  severity int NOT NULL DEFAULT 1 CHECK (severity BETWEEN 1 AND 5),
  pattern2 text,
  proximity_words int,
  ai_verdict_category text,
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_roles (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  scope text[] NOT NULL DEFAULT '{all}',
  granted_by uuid REFERENCES public.profiles(id),
  granted_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.feature_flags (
  key text PRIMARY KEY,
  rollout_percent int NOT NULL DEFAULT 100 CHECK (rollout_percent BETWEEN 0 AND 100),
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.scheduled_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  audience text NOT NULL CHECK (audience IN ('all', 'active_7d')),
  scheduled_for timestamptz NOT NULL,
  sent boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.link_preview_cache (
  url text PRIMARY KEY,
  title text,
  description text,
  image_url text,
  is_music_card boolean NOT NULL DEFAULT false,
  track_name text,
  artist text,
  preview_audio_url text,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.app_lock_pins (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  pin_hash text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint text NOT NULL PRIMARY KEY,
  keys_p256dh text,
  keys_auth text,
  created_at timestamptz NOT NULL DEFAULT now()
);
