export type UserRole = 'user' | 'admin' | 'moderator' | 'bot';
export type UserStatus = 'active' | 'suspended';
export type AvailabilityStatus = 'available' | 'busy' | 'away' | 'invisible';
export type AccentTheme = 'default' | 'ocean' | 'sunset' | 'forest' | 'rose';

export interface Profile {
  id: string;
  username: string | null;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  role: UserRole;
  status: UserStatus;
  is_online: boolean;
  last_seen: string;
  created_at: string;
  // Document 07 extensions
  theme_preference?: 'light' | 'dark' | 'system';
  bubble_color?: string | null;
  birthday?: string | null;
  two_factor_enabled?: boolean;
  app_lock_enabled?: boolean;
  status_emoji?: string | null;
  font_scale?: number;
  ui_language?: string;
  notification_preview_enabled?: boolean;
  // Document 09 Wave 2 extensions
  pronouns?: string | null;
  website_url?: string | null;
  verified?: boolean;
  follower_count?: number;
  following_count?: number;
  availability_status?: AvailabilityStatus;
  accent_theme?: AccentTheme;
  typing_coach_enabled?: boolean;
  messages_sent_count?: number;
  video_call_background?: string | null;
}

export interface Contact {
  id: string;
  user_id: string;
  contact_id: string;
  created_at: string;
  profile?: Profile;
}

export interface BlockedUser {
  id: string;
  blocker_id: string;
  blocked_id: string;
  created_at: string;
}

export type MessageType =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'voice_note'
  | 'file'
  | 'sticker'
  | 'gif'
  | 'location'
  | 'contact_card'
  | 'poll'
  | 'game'
  | 'split'
  | 'event'
  | 'music_card'
  | 'direct_transfer';

export interface Reaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export interface PollOption {
  id: string;
  poll_id?: string;
  option_text: string;
  votes: string[]; // user IDs who voted
}

export interface PollData {
  id: string;
  question: string;
  allow_multiple: boolean;
  options: PollOption[];
  closes_at?: string | null;
}

export interface LocationData {
  lat: number;
  lng: number;
  address?: string;
  is_live?: boolean;
  expires_at?: string;
}

export interface ContactCardData {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url?: string | null;
}

export interface Message {
  id: string;
  sender_id: string;
  receiver_id?: string | null;
  group_id?: string | null;
  content: string | null;
  message_type: MessageType;
  media_url: string | null;
  media_size: number | null;
  media_name: string | null;
  reply_to_id: string | null;
  is_deleted_sender: boolean;
  is_deleted_receiver: boolean;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  reply_to?: Message | null;
  reactions?: Reaction[];
  // Document 07 extensions
  edited_at?: string | null;
  forwarded_from_id?: string | null;
  forwarded_from_name?: string | null;
  is_view_once?: boolean;
  view_once_opened?: boolean;
  scheduled_for?: string | null;
  location_data?: LocationData | null;
  contact_card_data?: ContactCardData | null;
  poll_data?: PollData | null;
  is_starred?: boolean;
  is_pinned?: boolean;
  ai_alt_text?: string | null;
  ai_character_id?: string | null;
  ai_character_name?: string | null;
  ai_character_avatar_url?: string | null;
  delivery_status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  // Document 09 Wave 2 extensions
  thread_id?: string | null;
  thread_reply_count?: number;
  is_saved_for_later?: boolean;
  ai_sentiment?: 'positive' | 'neutral' | 'negative' | null;
  ai_voice_summary?: string | null;
  vtt_captions?: string | null;
  is_anonymous?: boolean;
  expires_at?: string | null;
  content_format?: 'plain' | 'markdown';
  game_data?: GameData | null;
  split_data?: PaymentSplit | null;
  event_data?: GroupEvent | null;
  music_data?: MusicCardData | null;
  transfer_data?: DirectTransferData | null;
}

export interface GameData {
  game: 'tictactoe' | 'wordguess';
  board: (string | null)[];
  currentPlayer: string;
  winner?: string | null;
  status: 'playing' | 'won' | 'draw';
  turnUserId: string;
  targetWord?: string;
  guesses?: string[];
}

export interface PaymentSplitItem {
  id: string;
  user_id: string;
  amount: number;
  status: 'pending' | 'paid';
  paid_at?: string | null;
  profile?: Profile;
}

export interface PaymentSplit {
  id: string;
  created_by: string;
  conversation_key: string;
  title: string;
  total_amount: number;
  currency: string;
  items: PaymentSplitItem[];
  created_at: string;
}

export interface EventRsvp {
  user_id: string;
  response: 'going' | 'maybe' | 'not_going';
  updated_at: string;
  profile?: Profile;
}

export interface GroupEvent {
  id: string;
  group_id: string;
  title: string;
  description: string;
  starts_at: string;
  ends_at?: string | null;
  location?: string | null;
  created_by: string;
  created_at: string;
  rsvps: EventRsvp[];
}

export interface MusicCardData {
  track_name: string;
  artist: string;
  album_art_url: string;
  preview_url: string;
  platform: 'spotify' | 'soundcloud' | 'youtube' | 'generic';
}

export interface DirectTransferData {
  filename: string;
  size: number;
  status: 'transferring' | 'completed' | 'cancelled';
  progress?: number;
}

export interface Group {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  created_by: string;
  created_at: string;
  members_count?: number;
  role?: 'member' | 'admin';
  invite_link_token?: string | null;
  max_members?: number;
  is_public?: boolean;
  category?: string | null;
  slow_mode_interval?: number; // 0, 5, 30, 60, 300, 3600 seconds
}

export interface GroupMember {
  group_id: string;
  user_id: string;
  role: 'member' | 'admin';
  joined_at: string;
  profile?: Profile;
}

export interface CallRecord {
  id: string;
  caller_id: string;
  callee_id?: string | null;
  group_id?: string | null;
  type: 'voice' | 'video';
  status: 'missed' | 'answered' | 'declined';
  started_at: string;
  ended_at?: string | null;
  duration_seconds: number;
  partner?: Profile;
  group?: Group;
}

export interface StatusPost {
  id: string;
  user_id: string;
  media_type: 'text' | 'image' | 'video';
  content: string | null;
  media_url: string | null;
  privacy: 'contacts' | 'except' | 'only';
  created_at: string;
  expires_at: string;
  user?: Profile;
  views_count?: number;
  has_viewed?: boolean;
}

export interface ChatFolder {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
  conversation_ids: string[];
}

export interface SupportTicket {
  id: string;
  user_id: string;
  subject: string;
  status: 'open' | 'in_progress' | 'resolved';
  created_at: string;
  user?: Profile;
  messages_count?: number;
}

export interface SupportMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  is_admin: boolean;
  content: string;
  created_at: string;
  sender?: Profile;
}

export interface ModerationRule {
  id: string;
  keyword_pattern: string;
  action: 'flag' | 'auto_hide';
  created_by: string;
  created_at: string;
}

export interface FeatureFlag {
  key: string;
  rollout_percent: number;
  enabled: boolean;
  updated_at: string;
}

export interface UserSession {
  id: string;
  user_id: string;
  device_label: string;
  ip_address?: string;
  last_active: string;
  created_at: string;
  is_current?: boolean;
  revoked: boolean;
}

export type ReportStatus = 'open' | 'resolved' | 'dismissed';

export interface Report {
  id: string;
  reporter_id: string;
  reported_user_id: string;
  reported_message_id: string | null;
  reported_group_id?: string | null;
  reason: string;
  note: string | null;
  status: ReportStatus;
  moderation_verdict: string | null;
  moderation_confidence: number | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  reporter?: Profile;
  reported_user?: Profile;
  reported_message?: Message;
}

export interface AdminAuditLog {
  id: string;
  admin_id: string;
  viewed_user_id: string;
  conversation_partner_id: string | null;
  action: string;
  created_at: string;
  admin?: Profile;
  viewed_user?: Profile;
  partner?: Profile;
}

export type AiFeatureKey =
  | 'smart_reply'
  | 'translate'
  | 'summarize'
  | 'smart_search'
  | 'moderate'
  | 'transcribe'
  | 'emoji_suggest'
  | 'chat_assistant'
  | 'tone_check'
  | 'voice_translate'
  | 'auto_categorize'
  | 'notification_summary'
  | 'alt_text'
  | 'link_safety'
  | 'event_extraction';

export interface AiUsageLog {
  id: string;
  user_id: string | null;
  feature: AiFeatureKey;
  model_id: string | null;
  estimated_neurons: number;
  created_at: string;
}

export interface AppSetting {
  key: string;
  value: boolean;
  updated_by: string | null;
  updated_at: string;
}

export interface Broadcast {
  id: string;
  title: string;
  body: string;
  audience: 'all' | 'active_7d';
  dismissible: boolean;
  sent_by: string;
  created_at: string;
}

export interface ScheduledBroadcast extends Broadcast {
  scheduled_for: string;
  sent: boolean;
}

export interface ConversationItem {
  id: string;
  isGroup?: boolean;
  partner?: Profile;
  group?: Group;
  lastMessage: Message | null;
  unreadCount: number;
  isPinned?: boolean;
  isMuted?: boolean;
  isSecret?: boolean;
  isChannel?: boolean;
  folderId?: string;
  draftText?: string;
  isIncognito?: boolean;
}

// Wave 2 Entities (Document 09)
export interface MessageThread {
  id: string;
  root_message_id: string;
  group_id: string;
  created_at: string;
  reply_count: number;
  root_message?: Message;
}

export interface ThreadMessage extends Message {
  thread_id: string;
}

export interface ChannelSubscription {
  id: string;
  owner_id: string;
  name: string;
  description: string;
  avatar_url?: string | null;
  subscriber_count: number;
  is_public: boolean;
  is_subscribed?: boolean;
  created_at: string;
}

export interface ChannelPost {
  id: string;
  channel_id: string;
  content: string | null;
  media_url?: string | null;
  message_type: MessageType;
  created_at: string;
  view_count: number;
  reaction_count: number;
  reactions?: Record<string, number>;
  my_reaction?: string | null;
}

export interface StoryHighlight {
  id: string;
  user_id: string;
  title: string;
  cover_url?: string | null;
  status_ids: string[];
  created_at: string;
}

export interface UserAvailability {
  user_id: string;
  dnd_enabled: boolean;
  dnd_start?: string | null;
  dnd_end?: string | null;
  timezone?: string | null;
  auto_reply_text?: string | null;
}

export interface UserBadge {
  id: string;
  badge_type: 'first_message' | 'hundred_messages' | 'streak_7d' | 'voice_master' | 'media_pro' | 'group_creator' | 'verified_star';
  title: string;
  icon: string;
  description: string;
  earned_at: string;
  progress?: number;
  max_progress?: number;
}

export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  score: number;
  profile: Profile;
}

export interface UserConnection {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  profile?: Profile;
  mutual_count?: number;
}

export interface ChatBot {
  id: string;
  name: string;
  avatar_url?: string | null;
  webhook_url: string;
  keyword_pattern: string;
  is_active: boolean;
  created_by: string;
  created_at: string;
}

export interface ReadLaterItem {
  id: string;
  user_id: string;
  message_id: string;
  note?: string | null;
  is_done: boolean;
  saved_at: string;
  message?: Message;
  partner?: Profile;
}

export interface Reminder {
  id: string;
  user_id: string;
  message_id: string;
  remind_at: string;
  note?: string | null;
  sent: boolean;
  created_at: string;
  message_preview?: string;
  partner?: Profile;
}

export interface ModerationAppeal {
  id: string;
  user_id: string;
  action_type: string;
  reason: string;
  status: 'open' | 'reviewed' | 'overturned' | 'upheld';
  reviewed_by?: string | null;
  admin_response?: string | null;
  created_at: string;
  user?: Profile;
}

export interface SharedNote {
  conversation_key: string;
  content: string;
  last_edited_by: string;
  updated_at: string;
  collaborators?: string[];
}

export interface ChatPreview {
  id: string;
  created_by: string;
  conversation_key: string;
  messages: Message[];
  expires_at: string;
  view_count: number;
}

export interface TimeCapsule {
  id: string;
  created_by: string;
  conversation_key: string;
  title: string;
  unlock_at?: string | null;
  is_public: boolean;
  message_snapshot: Message[];
  created_at: string;
  view_count: number;
}

export interface CustomEmoji {
  id: string;
  shortcode: string;
  image_url: string;
  created_by: string;
}

export interface MoodData {
  mood_label: string;
  mood_emoji: string;
  breakdown: {
    positive: number;
    neutral: number;
    negative: number;
  };
  gradient_start: string;
  gradient_end: string;
}

export interface SentimentTimelinePoint {
  day: string;
  dateStr: string;
  positive: number;
  neutral: number;
  negative: number;
  score: number; // -1 to 1
  firstMessageId?: string;
}

