# 01 — Product Requirements Document (PRD)
## Inspire — Real-Time Messaging App

---

## 1. Purpose & Vision

Inspire is a WhatsApp-style real-time messaging application. Any person can open the app, create an account with a unique `@username`, and immediately be reachable by anyone who knows that username — exactly as a phone number works in WhatsApp, or a handle works in Instagram/X.

The product must feel like a **real, production-grade messenger**: instant delivery, read receipts, presence (online/last seen), rich media (image/video/audio/voice notes), and a genuinely useful set of AI-assisted features — not a toy demo.

---

## 2. Target Users

- **General public** — anyone, any device, no invitation required.
- No age-gating or business-specific audience. Mobile-first, but usable on desktop browsers too.

---

## 3. User Roles

| Role | Description |
|---|---|
| **Guest (unauthenticated)** | Can view the landing/auth screens only. No access to the app. |
| **User** | A registered, authenticated person. Default role for everyone who signs up. Full access to messaging features. |
| **Admin** | Elevated role granted manually (via the `profiles.role` column — see `05_Backend_Schema.md`). Has access to the Admin Panel in addition to normal User capabilities. |

There is no self-service path to become an Admin. The first Admin is set directly in the database after deployment; Admins may promote other users to Admin from within the Admin Panel.

---

## 4. Core Features (User-Facing)

### 4.1 Authentication & Identity
- Sign up with **email + password** (Supabase Auth).
- Email verification required before full access (configurable, but required by default).
- On successful signup, the user chooses a unique `@username` (3–20 chars, lowercase letters/numbers/underscore) and a display name — this is their permanent, shareable "contact ID," exactly like a WhatsApp number.
- Login with email + password. "Forgot password" flow (Supabase Auth's built-in reset-by-email).
- Logged-in session persists across visits (Supabase session, refresh token).
- Users can log out from any device independently (does not need to invalidate other sessions).

### 4.2 Contacts
- A user finds another user by searching their exact or partial `@username`.
- Adding a contact is **one-directional discovery, mutual once added**: once User A adds User B, both can message each other and both see each other in their respective contact lists (mirroring the "you can message anyone who has your number" reality of WhatsApp, but gated by deliberate username lookup rather than a shared phone contact book).
- A user cannot message someone who has blocked them.
- Removing a contact does not delete message history; it only removes the entry from the contact list.

### 4.3 Messaging
- 1-on-1 (direct) conversations only in this version. (Group chat is explicitly out of scope — see Section 7.)
- Message types: **text, image, video, audio file, voice note**.
- Messages delivered in real time (Supabase Realtime) — no polling, no manual refresh.
- **Typing indicator**: "X is typing…" shown live while the other person is composing.
- **Read receipts**: single check (sent), double check (delivered — implicit via Realtime), double check turned accent-colored (read).
- **Reactions**: emoji reactions on any message (👍 ❤️ 😂 😮 😢 🔥).
- **Delete message**: "Delete for me" (hides only on my side) and "Delete for everyone" (sender only, within the UI; no artificial time limit required for v1).
- **Message replies**: reply-to / quote a specific earlier message (shown as a quoted preview above the new message).
- Unread message counters per conversation and a total unread badge on the app's bottom navigation.

### 4.4 Media Sharing
- Image sharing (max 10MB).
- Video sharing (max 50MB — generous because Cloudflare R2's free tier charges **zero egress**, confirmed; see `02_TRD.md` for exact limits).
- Audio file sharing (max 20MB).
- **Voice notes**: record directly in-app (press-and-hold or tap-to-record mic button), upload, and play back with a custom player (play/pause, duration, waveform-style progress bar).
- All media delivered via secure, time-limited signed URLs (Cloudflare R2) — never a public bucket.

### 4.5 Presence
- Online / offline status, updated via a lightweight heartbeat and Supabase Realtime presence channels.
- "Last seen at [time]" when offline, formatted as: Just now / X minutes ago / Today at HH:MM / Yesterday at HH:MM / DD Mon at HH:MM.

### 4.6 Profile
- Edit display name, bio (max 100 chars), and profile photo (stored in Cloudflare R2).
- View own `@username` with a "Copy ID" button to share with others.
- Dark / Light mode toggle (persisted per device) — see `04_UI_UX_Design_Brief.md` for the finalized palette (white chat surfaces, dark royal blue + yellow elements, bold black text, full dark-mode parity).

### 4.7 Safety — Block & Report
- **Block a user**: blocked user cannot send messages, cannot see the blocker's online/last-seen status, and disappears from search results for the blocker (and vice versa for new messaging attempts).
- **Report a user or a specific message**: a user can submit a report (reason + optional note) against another user or a specific message. Reports are queued for Admin review (see `05_Backend_Schema.md` → `reports` table).
- Reporting does **not** automatically block; blocking is a separate, explicit action.

### 4.8 Progressive Web App (PWA)
- Installable on mobile home screens (manifest + service worker).
- Offline shell caching for the app chrome; live data (messages, media) always requires network — no offline message queue in v1.

---

## 5. AI Features (Cloudflare Workers AI — Free Tier, 10,000 Neurons/day)

All AI features are **optional, user-triggered** (never silently run on every message) to respect the daily neuron budget, with the exception of Content Moderation which runs automatically but only on reported content (not on every message — see `02_TRD.md` for the exact trigger design and budget reasoning).

Model selection and per-call neuron costs below are confirmed against current Cloudflare documentation (Oct 2026) and are deliberately the cheapest model that satisfies each feature, since the whole app shares one 10,000-neuron/day pool across every user.

| Feature | Description | Trigger | Model | Approx. cost/call |
|---|---|---|---|---|
| **Smart Reply Suggestions** | 2–3 short suggested replies shown above the keyboard based on the last received message. | On receiving a new message (debounced; only while that chat is open). | `@cf/meta/llama-3.1-8b-instruct-fast` | Well under 1 neuron per call (~100–150 tokens in/out) |
| **Auto Translation** | A "Translate" button on any message; translates it into the viewer's preferred language inline. | User taps "Translate" on a specific message. | `@cf/meta/m2m100-1.2b` | A fraction of a neuron per sentence |
| **Chat Summarizer** | Summarizes a long conversation (or a selected date range) into a few bullet points. | User explicitly taps "Summarize this chat" from the chat menu. | `@cf/meta/llama-3.1-8b-instruct-fast` | Well under 1 neuron per call |
| **Smart Search** | Natural-language search across a conversation's history (e.g. "when did we talk about the trip?") in addition to plain keyword search. | User types a query into chat search. | `@cf/baai/bge-m3` (embeddings, cosine-compared in the Worker) | A few neurons per 1M tokens embedded |
| **Content Moderation** | Automatically scans **reported** messages/images for abusive/harmful content and attaches a moderation verdict + confidence score to the report for the Admin. | Automatically, only when a report is filed (not on every message — budget-conscious). | Text: `@cf/meta/llama-guard-3-8b` · Image: `@cf/meta/llama-3.2-11b-vision-instruct` | ~0.2 neurons per short text report; a few neurons per image |
| **Voice Note Transcription** | Converts a voice note to text, shown as a "View transcript" toggle under the voice note player. | User taps "View transcript" on a specific voice note (generated on first tap, cached after). | `@cf/openai/whisper-large-v3-turbo` | ~46.6 neurons per audio minute (~23 neurons for a 30-second note) |
| **AI Emoji/Sticker Suggestion** | While typing, suggests 3–4 relevant emoji based on the message content. | Debounced, while composing (only while that chat is open — not on every keystroke). | `@cf/meta/llama-3.1-8b-instruct-fast` | Well under 1 neuron per call |

**Budget rule (documented for AI Studio and the Admin Panel):** every AI call must be deliberately triggered or scoped (not run per-message automatically) because the free Workers AI tier is capped at **10,000 Neurons/day, reset at 00:00 UTC, shared across the whole Cloudflare account** (not per-Worker). At typical per-call costs above, the daily budget comfortably supports normal usage across many simultaneous users, but the Admin Panel must still show daily AI usage so the limit can be monitored (see Section 6) and must expose a kill switch per feature in case usage spikes.

---

## 6. Admin Panel (Advanced)

Accessible only to users with `profiles.role = 'admin'`, at a separate route (`/admin`), fully gated by Supabase RLS + a server-side role check (never a frontend-only gate).

### 6.1 User Management
- List/search all users, view their profile, suspend or unsuspend an account, promote/demote Admin role, force-block a user app-wide.

### 6.2 Reports Review
- Queue of all user-submitted reports (user reports + message reports), each showing the reporter, the reported user/message, the reason, the AI moderation verdict (if available), and an action panel (dismiss / warn user / suspend user / delete message).

### 6.3 Chat History Access (Sensitive — Audit-Logged)
- Admins can open and view the full message history between any two users, for moderation/investigation purposes.
- **Every time an Admin opens a user's chat history, it is logged** (`admin_audit_log` table: which admin, whose chat, when) — this is a hard requirement, not optional, to protect user trust and give accountability for this sensitive capability.
- This capability — and the fact that it exists — must be disclosed to end users in the app's Privacy Policy / Terms screen (a static in-app page is sufficient for v1; this PRD flags the requirement, the actual legal text is outside Claude's/AI Studio's scope to draft).

### 6.4 Analytics Dashboard
- Total users, new signups (daily/weekly), total messages sent (daily/weekly), active users (daily/weekly), messages by type (text/image/video/audio/voice), AI feature usage counts, and **daily Workers AI neuron usage** (to self-monitor the free-tier budget, reset daily at 00:00 UTC).

### 6.5 Broadcast Announcements
- Admin can send a system-wide announcement (shown as a non-dismissible or dismissible banner/notice, Admin's choice per broadcast) to all users, or to a filtered subset (e.g. active in last 7 days).

### 6.6 App Settings
- Toggle **Maintenance Mode** (shows a maintenance screen to all non-admin users, blocks messaging while on).
- Toggle individual AI features on/off app-wide (kill switch if the neuron budget is at risk of being exhausted).

---

## 7. Explicitly Out of Scope (v1)

- Group chats / channels / broadcast lists (user-to-user; Admin broadcast in Section 6.5 is separate and one-way).
- Voice/video calling.
- End-to-end encryption (messages are encrypted in transit via TLS and at rest via Supabase's standard database encryption, but not E2EE at the application layer — this is explicitly acceptable given the Admin chat-history-access requirement in Section 6.3, which would be incompatible with true E2EE anyway).
- Multi-device simultaneous sessions with message sync nuances beyond what Supabase Realtime naturally provides.
- Payments / business accounts / verified badges.
- Offline message composing/queueing.

---

## 8. Functional Requirements Summary

1. Users can sign up, verify email, log in, and log out (Supabase Auth).
2. Users can search for and add contacts by `@username`.
3. Users can send/receive text, image, video, audio, and voice-note messages in real time.
4. Users see typing indicators, read receipts, and online/last-seen presence.
5. Users can react to, reply to, and delete messages.
6. Users can block and report other users/messages.
7. Users can access AI-assisted features (smart reply, translation, summarization, smart search, transcription, emoji suggestion) on demand.
8. Users can install the app as a PWA and switch between dark/light mode.
9. Admins can manage users, review reports, view chat history (audit-logged), view analytics, broadcast announcements, and control app-wide settings including AI kill switches.

## 9. Non-Functional Requirements

- **Performance:** Message send-to-display latency should feel instant (sub-second) via Supabase Realtime. AI calls should resolve quickly enough to feel optional, not blocking — confirmed typical latencies: short text generation ~200–500ms, speech-to-text (30s clip) ~1–3s, image moderation ~1–5s.
- **Security:** All data access governed by Supabase Row Level Security (RLS); no secrets in frontend code or GitHub repo; all media access via short-lived signed URLs, never public buckets; Workers AI itself needs no API key (it's a native, credential-free Worker binding), so the only secrets to protect are the Supabase service-role key and the R2 S3-compatible credentials.
- **Reliability:** AI feature failures must never block core messaging (graceful degradation — if an AI call fails, hits the daily neuron cap (HTTP 429), or the model is temporarily out of capacity (HTTP 429), the feature silently hides/disables itself).
- **Scalability (cost-conscious):** Every AI feature is designed to stay within Cloudflare Workers AI's free 10,000 neurons/day tier; every storage decision stays within Cloudflare R2's free tier, confirmed as **10GB-month storage, 1 million Class A (write) operations/month, 10 million Class B (read) operations/month, and zero-cost egress**; and within Supabase's free database tier.
- **Accessibility:** Sufficient color contrast in both light and dark themes, tappable targets ≥44px on mobile, alt text on images.
