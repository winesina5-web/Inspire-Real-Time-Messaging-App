-- ==============================================================================
-- Inspire — Real-Time Messaging App
-- Supabase PostgreSQL Canonical Schema Reference (Documents 05, 07, 09)
-- 100% RLS Coverage & Security Specification
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. PROFILES TABLE
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

-- 2. CONTACTS TABLE
CREATE TABLE IF NOT EXISTS public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, contact_id)
);

-- 3. BLOCKED USERS TABLE
CREATE TABLE IF NOT EXISTS public.blocked_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (blocker_id, blocked_id)
);

-- 4. GROUPS TABLE
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

CREATE TABLE IF NOT EXISTS public.group_members (
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

-- 5. MESSAGES TABLE
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE,
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

-- 6. GROUP MESSAGES TABLE
CREATE TABLE IF NOT EXISTS public.group_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text,
  message_type text NOT NULL DEFAULT 'text',
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

-- 7. REACTIONS TABLE
CREATE TABLE IF NOT EXISTS public.reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id)
);

-- 8. REPORTS TABLE
CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reported_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reported_message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  reported_group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL,
  reason text NOT NULL,
  note text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
  moderation_verdict text,
  moderation_confidence numeric,
  resolved_by uuid REFERENCES public.profiles(id),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 9. ADMIN AUDIT LOG TABLE
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES public.profiles(id),
  viewed_user_id uuid NOT NULL REFERENCES public.profiles(id),
  conversation_partner_id uuid REFERENCES public.profiles(id),
  impersonated_user_id uuid REFERENCES public.profiles(id),
  action text NOT NULL DEFAULT 'view_chat_history',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 10. AI USAGE LOG TABLE
CREATE TABLE IF NOT EXISTS public.ai_usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  feature text NOT NULL,
  model_id text,
  estimated_neurons numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 11. APP SETTINGS TABLE
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value boolean NOT NULL DEFAULT true,
  updated_by uuid REFERENCES public.profiles(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 12. BROADCASTS & DISMISSALS
CREATE TABLE IF NOT EXISTS public.broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  audience text NOT NULL CHECK (audience IN ('all', 'active_7d')),
  dismissible boolean NOT NULL DEFAULT true,
  sent_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.broadcast_dismissals (
  broadcast_id uuid NOT NULL REFERENCES public.broadcasts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  dismissed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (broadcast_id, user_id)
);

-- 13. ADDITIONAL ADVANCED & WAVE 2 TABLES
CREATE TABLE IF NOT EXISTS public.group_message_reads (
  group_message_id uuid NOT NULL REFERENCES public.group_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_message_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.message_edits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  previous_content text NOT NULL,
  edited_at timestamptz NOT NULL DEFAULT now()
);

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

CREATE TABLE IF NOT EXISTS public.user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  device_label text NOT NULL,
  last_active timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.privacy_settings (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_seen_visibility text NOT NULL DEFAULT 'everyone' CHECK (last_seen_visibility IN ('everyone', 'contacts', 'nobody')),
  profile_photo_visibility text NOT NULL DEFAULT 'everyone' CHECK (profile_photo_visibility IN ('everyone', 'contacts', 'nobody')),
  status_visibility text NOT NULL DEFAULT 'everyone' CHECK (status_visibility IN ('everyone', 'contacts', 'nobody')),
  read_receipts_enabled boolean NOT NULL DEFAULT true,
  auto_translate_enabled boolean NOT NULL DEFAULT false,
  preferred_translation_language text NOT NULL DEFAULT 'en'
);

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

-- ==============================================================================
-- 100% RLS ENABLING ON ALL PUBLIC TABLES
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcast_dismissals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_message_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_edits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.starred_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pinned_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_folder_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pinned_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.muted_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.secret_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.view_once_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.privacy_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.link_preview_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_lock_pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.thread_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_translations_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slow_mode_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_bots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_post_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.read_later ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_summaries_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_split_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_emoji ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stories_highlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.highlight_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reactions_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcast_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_appeals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.network_quality_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incognito_mode ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trusted_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_recovery_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_capsules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_previews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.translation_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dismissed_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.archived_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deletion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clipboard_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_conversation_analytics_cache ENABLE ROW LEVEL SECURITY;
