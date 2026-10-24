# Supabase Database Migrations & Security Specification
## Inspire — Real-Time Messaging App

> **CRITICAL DIRECTIVE:** As mandated in `10_GitHub_Audit_Fix_Instructions.md`, the migration files in this directory are **for review and future deployment only**. They must **NOT** be executed against the live production Supabase instance during code review passes.

---

## 1. Migration Execution Order

When preparing to apply migrations to a new or existing Supabase project, execute the SQL files in strict ascending numerical order:

1. `00001_initial_schema.sql`
   - Installs `uuid-ossp` and `pgcrypto` extensions.
   - Creates foundational Document 05 tables: `profiles`, `contacts`, `blocked_users`, `messages`, `reactions`, `reports`, `admin_audit_log`, `ai_usage_log`, `app_settings` (with seed keys), `broadcasts`, and `broadcast_dismissals`.
   - Creates foreign keys, constraints, and initial performance indexes.

2. `00002_wave1_advanced_features.sql`
   - Creates Document 07 expansion tables: `groups`, `group_members`, `group_messages`, `group_message_reads`, `message_edits`, `starred_messages`, `pinned_messages`, `calls`, `statuses`, `status_views`, `status_reactions`, `polls`, `poll_options`, `poll_votes`, `chat_folders`, `chat_folder_members`, `pinned_chats`, `muted_chats`, `secret_chats`, `view_once_media`, `user_sessions`, `privacy_settings`, `support_tickets`, `support_messages`, `moderation_rules`, `admin_roles`, `feature_flags`, `scheduled_broadcasts`, `link_preview_cache`, `app_lock_pins`, and `push_subscriptions`.

3. `00003_wave2_ultra_features.sql`
   - Creates Document 09 expansion tables: `message_threads`, `thread_messages`, `ai_personas`, `message_translations_cache`, `user_notes`, `reminders`, `slow_mode_settings`, `user_availability`, `chat_bots`, `bot_subscriptions`, `message_templates`, `channel_subscriptions`, `channel_posts`, `channel_post_reactions`, `channel_members`, `read_later`, `user_connections`, `ai_summaries_cache`, `message_analytics`, `payment_splits`, `payment_split_items`, `custom_emoji`, `group_events`, `event_rsvps`, `stories_highlights`, `highlight_items`, `message_reactions_log`, `broadcast_templates`, `moderation_appeals`, `user_badges`, `leaderboards`, `network_quality_log`, `incognito_mode`, `trusted_contacts`, `account_recovery_requests`, `shared_notes`, `time_capsules`, `chat_previews`, `translation_settings`, `dismissed_suggestions`, `notification_queue`, `archived_chats`, `deletion_requests`, `clipboard_items`, and `user_conversation_analytics_cache`.

4. `00004_rls_and_policies.sql`
   - Enforces `ENABLE ROW LEVEL SECURITY` on **100% of all public schema tables**.
   - Applies strict, least-privilege policies with dual `USING` and `WITH CHECK` clauses for data modification.
   - Enforces append-only policies for `admin_audit_log`.

5. `00005_indexes_triggers_functions.sql`
   - Generates Full-Text Search `content_tsv` columns and GIN indexes on `messages` and `group_messages`.
   - Implements triggers: `handle_new_user`, `prevent_role_status_self_update`, `check_not_blocked_before_message`, and `increment_user_message_count`.
   - Defines database functions: `get_contact_suggestions` and `message_heatmap` materialized view with refresh helper.

6. `00006_realtime_publication.sql`
   - Adds real-time tables (`messages`, `reactions`, `group_messages`, `thread_messages`, `poll_votes`, `channel_posts`, `shared_notes`, `event_rsvps`) to the `supabase_realtime` publication.

---

## 2. Table-by-Table Access & RLS Matrix

| Table Name | SELECT Access | INSERT Access | UPDATE Access | DELETE Access | Notes |
|---|---|---|---|---|---|
| `profiles` | Authenticated users | System Trigger only | Self (non-role) / Admin (all) | Admin only | Username unique 3-20 chars |
| `contacts` | Owner (`user_id = auth.uid()`) | Owner | None | Owner | Bidirectional 2-row model |
| `blocked_users` | Blocker (`blocker_id = auth.uid()`) | Blocker | None | Blocker | Prevents message send |
| `messages` | Sender, Receiver, or Admin | Sender (if not blocked) | Sender (own flags) / Receiver (read status) | Soft delete flags | Audit logged when Admin reads |
| `reactions` | Message participants / Admin | Owner | Owner | Owner | Upsert single reaction per user |
| `reports` | Reporter or Admin | Reporter | Admin only | Admin only | Queued for moderation |
| `admin_audit_log` | Admin only | Admin only | **None (Forbidden)** | **None (Forbidden)** | Append-only security audit |
| `ai_usage_log` | Admin only | Service Role (Worker) | None | None | Tracks 10,000 neuron daily cap |
| `app_settings` | Authenticated users | System setup | Admin only | None | Global feature toggles |
| `broadcasts` | Authenticated users | Admin only | Admin only | Admin only | System announcements |
| `broadcast_dismissals` | Dismissing user | Dismissing user | None | None | Per-user dismissal record |
| `groups` | Members or Public or Admin | Creator | Group Admin or Platform Admin | Platform Admin | Group chat metadata |
| `group_members` | Group members or Admin | Group Admin or Self-join | Group Admin | Member (leave) or Group Admin | Role: member/admin |
| `group_messages` | Group members or Admin | Member | Sender | Sender | Mirrors 1:1 message features |
| `group_message_reads` | Group members | Reader | None | None | Group read receipts |
| `message_edits` | Message participants | Sender | None | None | Historical edit audit |
| `starred_messages` | Owner | Owner | None | Owner | Per-user saved bookmarks |
| `pinned_messages` | Conversation participants | Pinner | None | Pinner or Admin | Pinned message banner |
| `calls` | Caller, Callee, or Admin | Caller | Participants | None | WebRTC call metadata |
| `statuses` | Contacts / Audience | Creator | Creator | Creator | 24-hour expiration |
| `status_views` | Status owner or Viewer | Viewer | None | None | Story view receipts |
| `status_reactions` | Status owner or Reactor | Reactor | None | Reactor | Story emojis and replies |
| `polls` | Group members | Group members | None | Poll Creator | Group polls |
| `poll_options` | Group members | Poll Creator | None | None | Poll choice items |
| `poll_votes` | Group members | Voter | Voter | Voter | One vote per option/poll |
| `chat_folders` | Owner | Owner | Owner | Owner | Custom folder tabs |
| `chat_folder_members` | Folder owner | Folder owner | None | Folder owner | Mapping chats to folders |
| `pinned_chats` | Owner | Owner | None | Owner | Pin conversations at top |
| `muted_chats` | Owner | Owner | Owner | Owner | Mute notifications |
| `secret_chats` | Owner | Owner | Owner | Owner | UI privacy mode (Admin visible) |
| `view_once_media` | Message participants | Uploader | Opener (one-time) | None | Self-destructing media marker |
| `user_sessions` | Owner | Owner | Owner (revoke) | Owner | Active device sessions |
| `privacy_settings` | Authenticated | Owner | Owner | None | Granular visibility controls |
| `support_tickets` | Creator or Admin | Creator | Creator or Admin | Admin | In-app support system |
| `support_messages` | Ticket owner or Admin | Ticket owner or Admin | None | None | Messages within ticket |
| `moderation_rules` | Admin only | Admin only | Admin only | Admin only | Auto-flagging patterns |
| `admin_roles` | Target user or Admin | Admin only | Admin only | Admin only | Granular admin scopes |
| `feature_flags` | Authenticated | Admin only | Admin only | Admin only | A/B testing rollouts |
| `scheduled_broadcasts`| Admin only | Admin only | Admin only | Admin only | Cron-triggered broadcasts |
| `link_preview_cache` | Authenticated | Worker / System | None | None | OpenGraph metadata cache |
| `app_lock_pins` | Owner | Owner | Owner | Owner | Salted hash PIN storage |
| `push_subscriptions` | Owner | Owner | Owner | Owner | Web Push endpoints |
| `message_threads` | Group members | Group members | None | None | Sub-threads in groups |
| `thread_messages` | Group members | Member | Sender | Sender | Messages in sub-thread |
| `ai_personas` | Owner | Owner | Owner | Owner | Custom AI persona prompts |
| `message_translations_cache` | Participants | System | None | None | Cached translations |
| `user_notes` | Contact note owner | Owner | Owner | Owner | Private invisible contact notes |
| `reminders` | Owner | Owner | Owner | Owner | In-app message reminders |
| `slow_mode_settings` | Group members | Group Admin | Group Admin | Group Admin | Per-group cooldowns |
| `user_availability` | Authenticated | Owner | Owner | Owner | DND and auto-reply schedule |
| `chat_bots` | Authenticated | Admin only | Admin only | Admin only | Registered webhook bots |
| `bot_subscriptions` | Group members | Group Admin | None | Group Admin | Bots added to contexts |
| `message_templates` | Owner | Owner | Owner | Owner | Quick canned replies |
| `channel_subscriptions` | Subscribers / Public | Creator | Channel Owner | Channel Owner | Broadcast channels |
| `channel_posts` | Subscribers / Public | Channel Owner | Channel Owner | Channel Owner | Channel publications |
| `channel_post_reactions`| Subscribers | Reactor | None | Reactor | Reactions on posts |
| `channel_members` | Channel subscribers | Self-subscribe | None | Self-unsubscribe | Member list |
| `read_later` | Owner | Owner | Owner | Owner | Deferred reading inbox |
| `user_connections` | Parties | Requester | Addressee | Either party | Professional network |
| `ai_summaries_cache` | Participants | System | None | None | Cached summary results |
| `message_analytics` | Channel owner / Admin | System | System | None | Views and engagement stats |
| `payment_splits` | Participants | Participant | Split Creator | Split Creator | In-chat expense splits |
| `payment_split_items` | Participants | Creator | Item debtor / Creator | Creator | Settle split portions |
| `custom_emoji` | Authenticated | Admin only | Admin only | Admin only | Custom emoji shortcodes |
| `group_events` | Group members | Member | Event Creator | Event Creator | Calendar event in group |
| `event_rsvps` | Group members | Attendee | Attendee | Attendee | Going / Maybe / Not Going |
| `stories_highlights` | Authenticated | Owner | Owner | Owner | Permanent pinned stories |
| `highlight_items` | Authenticated | Highlight owner | None | Highlight owner | Stories within highlight |
| `message_reactions_log` | Channel owner / Admin| Reactor | None | None | Reaction analytics log |
| `broadcast_templates` | Admin only | Admin only | Admin only | Admin only | Saved broadcast templates |
| `moderation_appeals` | Submitting user / Admin | Submitting user | Admin only | None | User suspension appeals |
| `user_badges` | Authenticated | System Trigger | None | None | Gamification badges |
| `leaderboards` | Authenticated | System | None | None | Weekly engagement ranks |
| `network_quality_log` | Owner | Owner | None | None | Client telemetry |
| `incognito_mode` | Owner | Owner | Owner | Owner | Suppress read receipts |
| `trusted_contacts` | Owner | Owner | None | Owner | Social recovery contacts |
| `account_recovery_requests`| User / Trusted contacts| User | Trusted contacts | User | Emergency session revoke |
| `shared_notes` | Participants | Participants | Participants | None | Collaborative 1:1 document |
| `time_capsules` | Owner / Public when unlocked | Creator | None (Immutable) | None (Immutable) | Sealed message memories |
| `chat_previews` | Public (non-expired) | Authenticated | None | Creator | 48h guest chat links |
| `translation_settings` | Owner | Owner | Owner | Owner | Per-chat auto-translation |
| `dismissed_suggestions`| Owner | Owner | None | Owner | Dismissed contact matches |
| `notification_queue` | Owner | System | System | System | 15s push notification batch |
| `archived_chats` | Owner | Owner | None | Owner | Archived conversations |
| `deletion_requests` | Owner | Owner | None | Owner | 30-day account deletion grace |
| `clipboard_items` | Owner | Owner | None | Owner | Cross-device clipboard sync |
| `user_conversation_analytics_cache` | Owner | System | None | None | 24h conversation analytics |

---

## 3. Required Supabase Project Configuration

In the Supabase Project Dashboard:
1. **Authentication > Settings**:
   - Enable "Confirm email" for user signup.
   - Set Site URL and Redirect URLs to the deployed frontend domain (e.g., `https://inspire.pages.dev`).
   - JWT Expiration: default 3600 seconds (1 hour).
2. **Database > Replication**:
   - Verify that tables in migration `00006_realtime_publication.sql` are active under the `supabase_realtime` publication.
3. **Database > Webhooks** (Optional / Future Automation):
   - For automatic DND auto-replies or bot triggers, configure database webhooks targeting the deployed Cloudflare Worker endpoint with `BOT_RELAY_INTERNAL_SECRET`.
