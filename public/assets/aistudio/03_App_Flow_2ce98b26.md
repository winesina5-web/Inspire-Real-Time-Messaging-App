# 03 — App Flow Document
## Inspire — Real-Time Messaging App

---

## 1. Route Map

| Route | Access | Page Component |
|---|---|---|
| `/login` | Guest only | `LoginPage` |
| `/signup` | Guest only | `SignupPage` |
| `/forgot-password` | Guest only | `ForgotPasswordPage` |
| `/choose-username` | Authenticated, `profiles.username IS NULL` | (part of signup flow, see 2.1) |
| `/chats` | Authenticated, username set | `ChatListPage` |
| `/chat/:userId` | Authenticated, username set | `ChatPage` |
| `/profile` | Authenticated, username set | `ProfilePage` |
| `/admin` | Authenticated + `role = 'admin'` | `AdminDashboardPage` |
| `/admin/users` | Admin | `AdminUsersPage` |
| `/admin/reports` | Admin | `AdminReportsPage` |
| `/admin/chats/:userId` | Admin | `AdminChatViewerPage` |
| `/admin/analytics` | Admin | `AdminAnalyticsPage` |
| `/admin/broadcast` | Admin | `AdminBroadcastPage` |
| `/admin/settings` | Admin | `AdminSettingsPage` |
| `*` (unknown) | Any | Redirect to `/chats` if authenticated, else `/login` |

Bottom navigation (visible on `/chats` and `/profile` only): **Chats** | **Profile**.
Admin users additionally see an **Admin** entry point (e.g. a small link/icon in `/profile`) leading to `/admin`.

---

## 2. Authentication Flow

### 2.1 Sign Up
1. Guest lands on `/signup`. Fields: email, password, confirm password.
2. Submit → `supabase.auth.signUp()`.
3. **Success:** Supabase sends a verification email. Show a clear "Check your email to verify your account" state (not a silent redirect). User cannot proceed to the app until verified.
4. **Error states:** email already registered → inline error ("An account with this email already exists — Log in instead?" linking to `/login`); weak password → inline validation per Supabase's password rules; network error → toast + retry.
5. After the user clicks the verification link (handled by Supabase's redirect) and returns to the app authenticated, a Postgres trigger has already created a `profiles` row with `username = NULL`.
6. App detects `username IS NULL` → routes to `/choose-username` (not a separate URL necessarily, but a required gate — can be implemented as a step within the same screen flow).
7. `/choose-username`: display name + `@username` fields, same live-availability-check UX as described in `04_UI_UX_Design_Brief.md` (debounced check against `profiles.username`).
8. Submit → `UPDATE profiles SET username = ..., display_name = ...` → redirect to `/chats`.

### 2.2 Log In
1. Guest lands on `/login`. Fields: email, password.
2. Submit → `supabase.auth.signInWithPassword()`.
3. **Success + username already set:** → `/chats`.
4. **Success + username NOT set (edge case: verified but never finished step 2.1.7):** → `/choose-username`.
5. **Error states:** wrong credentials → generic inline error ("Invalid email or password") — never reveal whether the email exists; unverified email → specific message with a "Resend verification email" action; network error → toast + retry.

### 2.3 Forgot Password
1. `/forgot-password`: email field → `supabase.auth.resetPasswordForEmail()`.
2. Always show the same success message regardless of whether the email exists (do not leak account existence).
3. Email contains Supabase's reset link → user sets a new password on Supabase's hosted flow (or a custom reset-confirmation screen if time allows; Supabase's default redirect is acceptable for v1).

### 2.4 Logout
- Available from `/profile`. Calls `supabase.auth.signOut()`. Clears local session. Redirects to `/login`.
- Logging out on one device does not affect sessions on other devices (Supabase default behavior).

---

## 3. Main App Flow (User)

### 3.1 Chat List (`/chats`) — Landing Screen After Login
- **Loading state:** skeleton rows while the initial conversation list query runs.
- **Empty state:** "No chats yet" illustration + "Add someone by their @username to start chatting" + prominent add-contact action.
- **Populated state:** list of conversations sorted by most recent message, each row showing avatar (with online dot), display name, last message preview (text snippet, or "📷 Photo" / "🎬 Video" / "🎵 Audio" / "🎤 Voice note" / "Message deleted" as appropriate — mirroring the exact per-type preview logic used in the prior build), timestamp, and an unread badge.
- Tapping a row → `/chat/:userId`.
- A floating "+" action (Dark Royal Blue circle with a Yellow plus glyph, per `04_UI_UX_Design_Brief.md`) opens an **Add Contact** flow: search by `@username` (debounced), results list, "Add" button per result.
- A **Contacts** tab (sub-view within `/chats`, alongside a "Chats" tab) lists already-added contacts for quick access even before a conversation exists.

### 3.2 Chat Page (`/chat/:userId`)
- **Loading state:** spinner while the initial message page loads.
- **Header:** back button → `/chats`; other user's avatar + name + live presence ("Online" / "Last seen …" / "typing…" — typing takes priority over presence text when active).
- **Message list:** reverse-chronological render (newest at bottom), auto-scrolls to bottom on new message/on open; "Load earlier messages" on scroll-to-top (cursor pagination).
- **Sending a text message:** type → send button enabled only when non-empty → optimistic UI append → Realtime confirms/syncs.
- **Attaching media:** attachment button opens a small menu (Image / Video / Audio File) → native file picker → client-side size validation → file is sent to the Worker's `/api/media/upload` route, which writes it to R2 → upload progress shown inline → on success, message appears immediately (not waiting for the next Realtime tick — this exact bug existed in the prior build and must not recur).
- **Voice note:** mic button (shown only when the text input is empty) → press to start recording → live duration counter + waveform/pulse animation → Stop & Send or Cancel → same immediate-append behavior as other media.
- **Reactions:** long-press or tap-and-hold a bubble → emoji picker popover → tap an emoji → reaction appears under the bubble for both users via Realtime.
- **Reply:** swipe or a "Reply" action on a bubble → composer shows a quoted preview of the original message → send → new message visually references the quoted one.
- **Delete:** "Delete for me" (bubble becomes "Message deleted" only for the actor) vs "Delete for everyone" (sender only; bubble becomes "Message deleted" for both — this must correctly distinguish sender-side vs receiver-side deletion flags; the prior build had a bug conflating these and must not repeat it).
- **AI — Translate:** small action on a received message → inline translated text toggle below the original, marked with the small Yellow AI sparkle per the design brief.
- **AI — Smart Reply:** 2–3 suggestion chips appear above the composer after receiving a message; tapping one sends it (editable before sending, not forced).
- **AI — Emoji Suggest:** while typing, small suggested-emoji row appears above the keyboard.
- **AI — Transcribe:** "View transcript" toggle under a voice note bubble.
- **AI — Summarize / Smart Search:** accessed from a chat-header overflow menu ("Summarize this chat", "Search in chat" with a toggle for AI-powered natural-language search vs plain keyword).
- **Block/Report:** accessed from the chat-header overflow menu — "Block @username" (confirmation dialog) and "Report" (reason selector + optional note → submits to `reports` table).
- **Blocked-state UX:** if either party has blocked the other, the composer is disabled with a clear inline message ("You can't message this contact") instead of a silent failure.

### 3.3 Profile (`/profile`)
- View/edit display name, bio, avatar (upload → Worker writes to R2 via the native binding → `UPDATE profiles.avatar_url`).
- View own `@username` with Copy action.
- Dark/Light mode toggle.
- Logout action.
- (Admins only) a visible "Admin Panel" link.

---

## 4. Admin Flow

### 4.1 Entry & Gating
- Any navigation to `/admin/*` by a non-admin redirects to `/chats` immediately (checked both client-side via the `AuthProvider`'s `role` and enforced server-side by RLS on every admin query — a non-admin must get empty/denied results even if they somehow reach the route).

### 4.2 Dashboard (`/admin`)
- At-a-glance summary cards: total users, messages today, active users today, open reports count, today's AI neuron usage vs the 10,000 cap (resets 00:00 UTC), with a visual warning state if usage is approaching the cap.

### 4.3 User Management (`/admin/users`)
- Searchable/sortable table of all users (username, display name, email, joined date, status, role).
- Row actions: View profile, Suspend/Unsuspend, Promote/Demote Admin, Force-block.
- Suspend/promote/demote actions require a confirmation dialog (destructive-action pattern).

### 4.4 Reports (`/admin/reports`)
- Queue of open reports, each card showing: reporter, reported user, reported message (if applicable, with content preview), reason, AI moderation verdict + confidence (if the content was auto-moderated), and timestamp.
- Actions per report: Dismiss, Warn user (logs a note, no further action), Suspend user, Delete the reported message.
- Status filter: Open / Resolved / Dismissed.

### 4.5 Chat History Viewer (`/admin/chats/:userId`)
- Entry point: from a user's profile in `/admin/users`, "View all conversations."
- Shows the list of that user's conversations; selecting one opens a read-only transcript view (`/admin/chats/:userId` with a conversation selector, or a nested route — AI Studio's implementation discretion as long as both the conversation list and the transcript view exist).
- **Every open of a specific conversation's transcript writes an `admin_audit_log` row** (admin id, viewed user id, conversation partner id, timestamp) — this must happen on the read action itself, not be skippable.
- The admin view is explicitly read-only — no send/reply/react capability from this screen.

### 4.6 Analytics (`/admin/analytics`)
- Charts/stat tiles: user growth over time, messages sent over time (by type breakdown), daily/weekly active users, AI feature usage by feature, daily Workers AI neuron usage trend.

### 4.7 Broadcast (`/admin/broadcast`)
- Compose an announcement (title + body), choose audience (All users / Active in last 7 days), choose dismissible vs persistent, Send.
- History of past broadcasts with send date and audience size.

### 4.8 Settings (`/admin/settings`)
- Maintenance Mode toggle (with a confirmation dialog — this is a destructive, app-wide action).
- Per-AI-feature on/off toggles (Smart Reply, Translation, Summarizer, Smart Search, Moderation, Transcription, Emoji Suggest) — each independently switchable.

---

## 5. Cross-Cutting States (Apply Throughout the App)

- **Loading:** skeletons for lists, spinners for single actions — never a blank white screen.
- **Empty:** every list view (chats, contacts, reports, users, broadcasts) has a designed empty state with a clear next action, not just blank space.
- **Error:** network/API failures surface as a toast (non-blocking) for transient actions, or an inline message for form validation; the app must never silently fail a user action without feedback.
- **Success:** confirmations via toast for background actions (profile saved, contact added, broadcast sent) — never a full-page interruption for a successful minor action.
- **Maintenance Mode (global):** when Admin enables it, all non-admin users attempting to send a message (or load `/chats` fresh) see a dedicated maintenance screen; already-open read views may remain visible but composing is disabled.

---

## 6. Permissions Summary

| Action | Guest | User | Admin |
|---|---|---|---|
| View landing/auth screens | ✅ | — | — |
| Use messaging features | ❌ | ✅ (own conversations only) | ✅ (own conversations only) |
| View own chat history | ❌ | ✅ | ✅ |
| View *any* user's chat history | ❌ | ❌ | ✅ (audit-logged) |
| Block/report users | ❌ | ✅ | ✅ |
| Suspend/promote users | ❌ | ❌ | ✅ |
| Resolve reports | ❌ | ❌ | ✅ |
| Toggle AI features / maintenance mode | ❌ | ❌ | ✅ |
| Send broadcast | ❌ | ❌ | ✅ |
