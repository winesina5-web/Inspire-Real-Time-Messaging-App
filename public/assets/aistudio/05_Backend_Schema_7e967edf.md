# 05 — Backend Schema (Supabase / PostgreSQL)
## Inspire — Real-Time Messaging App

> **This is a planning document only.** It does not create the database. Google AI Studio writes frontend code that assumes this exact schema exists. The actual Supabase project and these tables are created later by ChatGPT (via the Supabase plugin), using this document as the exact specification. Table/column names here are final and must be used verbatim by both AI Studio's frontend code and ChatGPT's database creation.

---

## 1. Tables

### 1.1 `profiles`
One row per authenticated user, 1:1 with `auth.users`.

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK, references `auth.users(id)` on delete cascade |
| `username` | `text` | UNIQUE, nullable (null until onboarding step completes), lowercase, 3–20 chars, `^[a-z0-9_]+$` (enforce via CHECK constraint) |
| `display_name` | `text` | NOT NULL, default `''` |
| `bio` | `text` | nullable, max 100 chars (enforce via CHECK or frontend + trigger) |
| `avatar_url` | `text` | nullable — stores the **R2 object key**, not a full URL |
| `role` | `text` | NOT NULL, default `'user'`, CHECK IN (`'user'`, `'admin'`) |
| `status` | `text` | NOT NULL, default `'active'`, CHECK IN (`'active'`, `'suspended'`) |
| `is_online` | `boolean` | NOT NULL, default `false` |
| `last_seen` | `timestamptz` | NOT NULL, default `now()` |
| `created_at` | `timestamptz` | NOT NULL, default `now()` |

**Trigger:** `on_auth_user_created` — `AFTER INSERT ON auth.users` → inserts a matching `profiles` row (`id = new.id`, `username = NULL`, `display_name = ''`).

### 1.2 `contacts`
Mutual contact relationship (created once, visible to both sides).

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `user_id` | `uuid` | NOT NULL, references `profiles(id)` on delete cascade |
| `contact_id` | `uuid` | NOT NULL, references `profiles(id)` on delete cascade |
| `created_at` | `timestamptz` | NOT NULL, default `now()` |

UNIQUE (`user_id`, `contact_id`). Application logic inserts **two rows** when a contact is added (A→B and B→A) so each side has their own row — simpler RLS than a single bidirectional row.

### 1.3 `blocked_users`

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `blocker_id` | `uuid` | NOT NULL, references `profiles(id)` on delete cascade |
| `blocked_id` | `uuid` | NOT NULL, references `profiles(id)` on delete cascade |
| `created_at` | `timestamptz` | NOT NULL, default `now()` |

UNIQUE (`blocker_id`, `blocked_id`).

### 1.4 `messages`

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `sender_id` | `uuid` | NOT NULL, references `profiles(id)` on delete cascade |
| `receiver_id` | `uuid` | NOT NULL, references `profiles(id)` on delete cascade |
| `content` | `text` | nullable (null for pure media messages, or after "delete for everyone") |
| `message_type` | `text` | NOT NULL, default `'text'`, CHECK IN (`'text'`, `'image'`, `'video'`, `'audio'`, `'voice_note'`) |
| `media_url` | `text` | nullable — R2 object key |
| `media_size` | `bigint` | nullable |
| `media_name` | `text` | nullable |
| `reply_to_id` | `uuid` | nullable, references `messages(id)` on delete set null |
| `is_deleted_sender` | `boolean` | NOT NULL, default `false` |
| `is_deleted_receiver` | `boolean` | NOT NULL, default `false` |
| `is_read` | `boolean` | NOT NULL, default `false` |
| `read_at` | `timestamptz` | nullable |
| `created_at` | `timestamptz` | NOT NULL, default `now()` |

Indexes: `(sender_id)`, `(receiver_id)`, `(created_at)`, and a composite `(least(sender_id,receiver_id), greatest(sender_id,receiver_id), created_at)` to speed up conversation lookups.

> **Deletion semantics (must match exactly — the prior build had a bug here):** "Delete for me" sets `is_deleted_sender = true` if the actor is the sender, or `is_deleted_receiver = true` if the actor is the receiver — only the actor's own flag. "Delete for everyone" (sender only) sets **both** flags `true` and clears `content` to `NULL`. A message is "deleted" *from a given viewer's perspective* precisely when: `(viewer = sender AND is_deleted_sender) OR (viewer = receiver AND is_deleted_receiver)`. Frontend code must check this per-viewer condition, never `is_deleted_sender OR is_deleted_receiver` unconditionally (that would incorrectly show "deleted" to the wrong side for a "delete for me" action).

### 1.5 `reactions`

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `message_id` | `uuid` | NOT NULL, references `messages(id)` on delete cascade |
| `user_id` | `uuid` | NOT NULL, references `profiles(id)` on delete cascade |
| `emoji` | `text` | NOT NULL |
| `created_at` | `timestamptz` | NOT NULL, default `now()` |

UNIQUE (`message_id`, `user_id`) — one active reaction per user per message (re-reacting replaces it, via upsert).

### 1.6 `reports`

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `reporter_id` | `uuid` | NOT NULL, references `profiles(id)` on delete cascade |
| `reported_user_id` | `uuid` | NOT NULL, references `profiles(id)` on delete cascade |
| `reported_message_id` | `uuid` | nullable, references `messages(id)` on delete set null |
| `reason` | `text` | NOT NULL |
| `note` | `text` | nullable |
| `status` | `text` | NOT NULL, default `'open'`, CHECK IN (`'open'`, `'resolved'`, `'dismissed'`) |
| `moderation_verdict` | `text` | nullable — AI moderation result label |
| `moderation_confidence` | `numeric` | nullable |
| `resolved_by` | `uuid` | nullable, references `profiles(id)` |
| `resolved_at` | `timestamptz` | nullable |
| `created_at` | `timestamptz` | NOT NULL, default `now()` |

### 1.7 `admin_audit_log`
Append-only. Logs every time an Admin views a user's chat history.

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `admin_id` | `uuid` | NOT NULL, references `profiles(id)` |
| `viewed_user_id` | `uuid` | NOT NULL, references `profiles(id)` |
| `conversation_partner_id` | `uuid` | nullable, references `profiles(id)` (the other party in the viewed conversation, if a specific conversation was opened) |
| `action` | `text` | NOT NULL, default `'view_chat_history'` |
| `created_at` | `timestamptz` | NOT NULL, default `now()` |

### 1.8 `ai_usage_log`
Tracks Workers AI calls against the daily 10,000-neuron free-tier budget (budget resets 00:00 UTC, shared across the whole Cloudflare account).

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `user_id` | `uuid` | nullable, references `profiles(id)` on delete set null |
| `feature` | `text` | NOT NULL, CHECK IN (`'smart_reply'`, `'translate'`, `'summarize'`, `'smart_search'`, `'moderate'`, `'transcribe'`, `'emoji_suggest'`) |
| `model_id` | `text` | nullable — the exact Workers AI model string used (e.g. `'@cf/meta/llama-3.1-8b-instruct-fast'`), kept for audit/debugging since model choice may change per feature over time |
| `estimated_neurons` | `numeric` | NOT NULL — may be fractional (most calls in this app cost well under 1 whole neuron) |
| `created_at` | `timestamptz` | NOT NULL, default `now()` |

Index: `(created_at)` — used for the daily-sum budget check and the analytics trend.

### 1.9 `app_settings`
Single-row (or small keyed) table for Admin-controlled global toggles.

| Column | Type | Constraints |
|---|---|---|
| `key` | `text` | PK — e.g. `'maintenance_mode'`, `'ai_smart_reply_enabled'`, `'ai_translate_enabled'`, `'ai_summarize_enabled'`, `'ai_smart_search_enabled'`, `'ai_moderate_enabled'`, `'ai_transcribe_enabled'`, `'ai_emoji_suggest_enabled'` |
| `value` | `boolean` | NOT NULL, default `true` (all AI features default on, `maintenance_mode` defaults `false`) |
| `updated_by` | `uuid` | nullable, references `profiles(id)` |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` |

Seed rows for all 8 keys above must be inserted when the table is created.

### 1.10 `broadcasts`

| Column | Type | Constraints |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `title` | `text` | NOT NULL |
| `body` | `text` | NOT NULL |
| `audience` | `text` | NOT NULL, CHECK IN (`'all'`, `'active_7d'`) |
| `dismissible` | `boolean` | NOT NULL, default `true` |
| `sent_by` | `uuid` | NOT NULL, references `profiles(id)` |
| `created_at` | `timestamptz` | NOT NULL, default `now()` |

### 1.11 `broadcast_dismissals`
Tracks which users have dismissed which broadcast (so a dismissible banner doesn't reappear).

| Column | Type | Constraints |
|---|---|---|
| `broadcast_id` | `uuid` | NOT NULL, references `broadcasts(id)` on delete cascade |
| `user_id` | `uuid` | NOT NULL, references `profiles(id)` on delete cascade |
| `dismissed_at` | `timestamptz` | NOT NULL, default `now()` |

PK (`broadcast_id`, `user_id`).

---

## 2. Storage Buckets

No Supabase Storage buckets are used — **all media lives in Cloudflare R2**, not Supabase Storage (per `02_TRD.md`). This is a deliberate deviation from the default Supabase pattern; ChatGPT should **not** create a Supabase Storage bucket for this project.

---

## 3. Row Level Security (RLS) — Required Policies

RLS must be **enabled on every table listed above**, with no exceptions and no "disabled during development" shortcuts.

### `profiles`
- SELECT: any authenticated user can read any profile's public fields (`id`, `username`, `display_name`, `avatar_url`, `is_online`, `last_seen`, `role`) — needed for search/contacts/chat headers. (If column-level restriction isn't practical, allow full-row SELECT; there is no private data in `profiles` beyond what's already needed for the app to function, except `status`, which is acceptable to expose since it only matters to the user themself/Admins.)
- UPDATE: a user may only update their **own** row (`auth.uid() = id`), and must not be able to set `role` or `status` themselves (these two columns' updates must be restricted to Admins — implement via a separate policy/trigger that rejects a non-admin's attempt to change `role`/`status`).
- Admins may UPDATE any row's `role`/`status` (policy: `auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin')`).

### `contacts`
- SELECT/INSERT/DELETE: only rows where `auth.uid() = user_id`.

### `blocked_users`
- SELECT/INSERT/DELETE: only rows where `auth.uid() = blocker_id`. (A user should not be able to see who has blocked *them* in detail beyond what's needed to disable messaging — the app enforces the messaging restriction by checking both directions server-side/RLS on `messages`, not by exposing the full block list.)

### `messages`
- SELECT: `auth.uid() = sender_id OR auth.uid() = receiver_id`, **OR** the requester is an Admin (`auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin')`) — this is what powers the Admin Chat Viewer. Note: the Admin SELECT path should be used by the Admin Chat Viewer UI only, which is responsible for writing the corresponding `admin_audit_log` row at the application layer when it fetches messages for a conversation it doesn't own.
- INSERT: `auth.uid() = sender_id`, AND the sender must not be blocked by the receiver (enforce via a trigger or a policy subquery against `blocked_users`).
- UPDATE: only the sender may update `is_deleted_sender`/`is_deleted_receiver`/`content` fields tied to their own role in the message (sender can set their own `is_deleted_sender` and, for "delete for everyone," both flags + null content; receiver can set only `is_deleted_receiver` and `is_read`/`read_at`). This is most safely implemented as **two narrow UPDATE policies** (one for sender-initiated updates, one for receiver-initiated updates) rather than one broad policy.

### `reactions`
- SELECT: any authenticated user who can SELECT the parent message (i.e., a participant in that conversation, or Admin).
- INSERT/UPDATE/DELETE: `auth.uid() = user_id`.

### `reports`
- INSERT: `auth.uid() = reporter_id`.
- SELECT: `auth.uid() = reporter_id` (a user can see their own submitted reports) **OR** Admin.
- UPDATE (status, resolved_by, resolved_at, moderation fields): Admin only.

### `admin_audit_log`
- INSERT: Admin only (`auth.uid() IN (SELECT id FROM profiles WHERE role='admin')`), and `admin_id` must equal `auth.uid()`.
- SELECT: Admin only.
- No UPDATE or DELETE policy for any role (append-only, enforced by omission — no policy means no access).

### `ai_usage_log`
- INSERT: performed by the Worker using the service-role key (bypasses RLS by design — this is the one legitimate server-side use of the service-role key per `02_TRD.md`), so no INSERT policy is needed for the `authenticated` role.
- SELECT: Admin only (for the analytics dashboard and budget check — the budget check itself runs server-side in the Worker with the service-role key, but the Admin UI's analytics view queries this table as the logged-in Admin user, hence the SELECT policy).

### `app_settings`
- SELECT: any authenticated user (the frontend needs to know which AI features/maintenance mode are active to conditionally render UI).
- UPDATE: Admin only.
- No INSERT/DELETE policy needed for any role beyond initial seeding (done once via migration/ChatGPT setup, not through the app).

### `broadcasts`
- SELECT: any authenticated user (to display active broadcasts matching their audience segment — the audience filter is applied in the query, e.g. `active_7d` computed against `profiles.last_seen`).
- INSERT: Admin only.

### `broadcast_dismissals`
- SELECT/INSERT: `auth.uid() = user_id`.

---

## 4. Realtime Configuration

- Enable Supabase Realtime (Postgres Changes) on the `messages` table, filtered client-side to the open conversation (`sender_id=eq.X,receiver_id=eq.Y` OR the reverse, via two subscriptions or an OR filter as Supabase's client supports).
- Enable Realtime on `reactions` (so reaction updates appear live without a full message re-fetch).
- Use Supabase **Presence** (not a table) for online/offline status — a lightweight per-user presence channel, not `profiles.is_online` polling. `profiles.is_online`/`last_seen` columns still exist as a fallback/persisted snapshot (e.g. for showing "last seen" to a user who isn't currently subscribed), updated via presence join/leave events.
- Use Supabase **Broadcast** (not a table, ephemeral) for the typing indicator — never persisted to the database.

---

## 5. Functions / Triggers Summary

1. `handle_new_user()` — trigger function, `AFTER INSERT ON auth.users`, creates the matching `profiles` row (Section 1.1).
2. `prevent_role_status_self_update()` — trigger function on `profiles`, `BEFORE UPDATE`, raises an exception if a non-admin attempts to change `role` or `status` on any row (defense-in-depth alongside the RLS policy).
3. `check_not_blocked_before_message()` — trigger function on `messages`, `BEFORE INSERT`, raises an exception if `receiver_id` has blocked `sender_id` (or vice versa) in `blocked_users`.
4. (Optional, recommended) `touch_last_seen()` — not DB-triggered; handled by the frontend's presence-leave event updating `profiles.last_seen`/`is_online` directly (simpler than a DB trigger for this particular field).

---

## 6. Required Backend Operations Summary (for AI Studio's frontend to implement against)

- Auth: signup, login, logout, password reset (all via `supabase.auth.*`, no custom backend needed).
- Profile: get own/other profile, update own profile, username availability check (`SELECT 1 FROM profiles WHERE username = ? LIMIT 1`).
- Contacts: search by username, add contact (two-row insert), list contacts.
- Messaging: send message, fetch conversation (paginated), mark as read, delete (for me / for everyone), react, reply.
- Inbox: list conversations with last message + unread count per conversation (a single efficient query grouping by conversation partner — see the "known pitfall" note below).
- Block/Report: block user, unblock user, submit report.
- Admin: all of the above plus user management queries, report resolution, audit-logged chat history reads, analytics aggregation queries, broadcast CRUD, app_settings reads/writes.

> **Known pitfall from the prior build (must be avoided):** the "list conversations with last message per partner" query was originally implemented with a buggy `DISTINCT ON (LEAST(sender_id,receiver_id), GREATEST(...))` approach that could mismatch conversation partners. The correct approach: compute `CASE WHEN sender_id = me THEN receiver_id ELSE sender_id END AS partner_id` in a CTE, filter to messages visible to `me` (not deleted on my side), then `DISTINCT ON (partner_id) ... ORDER BY partner_id, created_at DESC` to get exactly one latest message per partner, unambiguously.
