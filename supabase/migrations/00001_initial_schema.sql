-- ==============================================================================
-- Migration 00001: Initial Core Schema (Document 05)
-- Inspire — Real-Time Messaging App
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE CHECK (username IS NULL OR (char_length(username) >= 3 AND char_length(username) <= 20 AND username ~ '^[a-z0-9_]+$')),
  display_name text NOT NULL DEFAULT '',
  bio text CHECK (bio IS NULL OR char_length(bio) <= 100),
  avatar_url text,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin', 'moderator', 'bot')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deactivated')),
  is_online boolean NOT NULL DEFAULT false,
  last_seen timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  theme_preference text NOT NULL DEFAULT 'system' CHECK (theme_preference IN ('light', 'dark', 'system')),
  bubble_color text,
  birthday date,
  two_factor_enabled boolean NOT NULL DEFAULT false,
  app_lock_enabled boolean NOT NULL DEFAULT false,
  status_emoji text,
  font_scale numeric NOT NULL DEFAULT 1.0,
  ui_language text NOT NULL DEFAULT 'en',
  notification_preview_enabled boolean NOT NULL DEFAULT true,
  pronouns text,
  website_url text,
  verified boolean NOT NULL DEFAULT false,
  follower_count int NOT NULL DEFAULT 0,
  following_count int NOT NULL DEFAULT 0,
  availability_status text NOT NULL DEFAULT 'available' CHECK (availability_status IN ('available', 'busy', 'away', 'invisible')),
  accent_theme text NOT NULL DEFAULT 'default' CHECK (accent_theme IN ('default', 'ocean', 'sunset', 'forest', 'rose')),
  typing_coach_enabled boolean NOT NULL DEFAULT true,
  messages_sent_count int NOT NULL DEFAULT 0,
  terms_accepted_at timestamptz,
  terms_version_accepted text
);

CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- 2. Contacts Table
CREATE TABLE IF NOT EXISTS public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_contacts_user ON public.contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_contact ON public.contacts(contact_id);

-- 3. Blocked Users Table
CREATE TABLE IF NOT EXISTS public.blocked_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (blocker_id, blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_blocked_blocker ON public.blocked_users(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocked_blocked ON public.blocked_users(blocked_id);

-- 4. Messages Table
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  group_id uuid, -- Will reference groups(id) in migration 00002
  content text,
  message_type text NOT NULL DEFAULT 'text' CHECK (message_type IN (
    'text', 'image', 'video', 'audio', 'voice_note', 'file',
    'sticker', 'gif', 'location', 'contact_card', 'poll', 'event', 'split', 'game', 'direct_transfer'
  )),
  media_url text,
  media_size bigint,
  media_name text,
  media_group_id uuid,
  media_thumbnail_key text,
  reply_to_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  is_deleted_sender boolean NOT NULL DEFAULT false,
  is_deleted_receiver boolean NOT NULL DEFAULT false,
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz,
  forwarded_from_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  is_view_once boolean NOT NULL DEFAULT false,
  scheduled_for timestamptz,
  location_lat numeric,
  location_lng numeric,
  location_expires_at timestamptz,
  ai_alt_text text,
  thread_id uuid,
  is_saved_for_later boolean NOT NULL DEFAULT false,
  ai_sentiment text,
  ai_voice_summary text,
  vtt_captions text,
  expires_at timestamptz,
  is_anonymous boolean NOT NULL DEFAULT false,
  content_format text NOT NULL DEFAULT 'plain' CHECK (content_format IN ('plain', 'markdown'))
);

CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON public.messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_conv_pair ON public.messages(LEAST(sender_id, receiver_id), GREATEST(sender_id, receiver_id), created_at DESC);

-- 5. Reactions Table
CREATE TABLE IF NOT EXISTS public.reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_reactions_message ON public.reactions(message_id);

-- 6. Reports Table
CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reported_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reported_message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  reported_group_id uuid,
  reason text NOT NULL,
  note text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
  moderation_verdict text,
  moderation_confidence numeric,
  resolved_by uuid REFERENCES public.profiles(id),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);

-- 7. Admin Audit Log Table (Append-Only)
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES public.profiles(id),
  viewed_user_id uuid NOT NULL REFERENCES public.profiles(id),
  conversation_partner_id uuid REFERENCES public.profiles(id),
  impersonated_user_id uuid REFERENCES public.profiles(id),
  action text NOT NULL DEFAULT 'view_chat_history',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON public.admin_audit_log(created_at DESC);

-- 8. AI Usage Log Table
CREATE TABLE IF NOT EXISTS public.ai_usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  feature text NOT NULL,
  model_id text,
  estimated_neurons numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_created ON public.ai_usage_log(created_at);

-- 9. App Settings Table
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value boolean NOT NULL DEFAULT true,
  updated_by uuid REFERENCES public.profiles(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Seed Initial App Settings
INSERT INTO public.app_settings (key, value) VALUES
  ('maintenance_mode', false),
  ('ai_smart_reply_enabled', true),
  ('ai_translate_enabled', true),
  ('ai_summarize_enabled', true),
  ('ai_smart_search_enabled', true),
  ('ai_moderate_enabled', true),
  ('ai_transcribe_enabled', true),
  ('ai_emoji_suggest_enabled', true),
  ('ai_chat_assistant_enabled', true),
  ('ai_tone_checker_enabled', true),
  ('ai_voice_translation_enabled', true),
  ('ai_auto_categorize_enabled', true),
  ('ai_notification_summary_enabled', true),
  ('ai_alt_text_enabled', true),
  ('ai_link_safety_enabled', true),
  ('ai_event_extraction_enabled', true),
  ('calls_enabled', true),
  ('status_enabled', true),
  ('groups_enabled', true),
  ('channels_enabled', true),
  ('bots_enabled', true),
  ('payment_splits_enabled', true),
  ('custom_emoji_enabled', true),
  ('group_events_enabled', true),
  ('gamification_enabled', true),
  ('ai_sentiment_enabled', true),
  ('ai_smart_compose_enabled', true),
  ('ai_image_enhance_enabled', true),
  ('ai_background_blur_enabled', true)
ON CONFLICT (key) DO NOTHING;

-- 10. Broadcasts Table
CREATE TABLE IF NOT EXISTS public.broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  audience text NOT NULL CHECK (audience IN ('all', 'active_7d')),
  dismissible boolean NOT NULL DEFAULT true,
  sent_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 11. Broadcast Dismissals Table
CREATE TABLE IF NOT EXISTS public.broadcast_dismissals (
  broadcast_id uuid NOT NULL REFERENCES public.broadcasts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  dismissed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (broadcast_id, user_id)
);
