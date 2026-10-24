# 08 — Fix & Complete Build Instructions
## Inspire — Real-Time Messaging App

> **How to use this document:** This is the single file to hand to Google AI Studio next. **Part A is mandatory and blocking** — the current repo build deviates from the architecture in a way that must be corrected before anything else is added. **Part B is the complete, consolidated feature checklist** — every feature from `01_PRD.md` plus all 73 features from `07_Advanced_Features.md`, merged into one ordered list covering the app end-to-end (opening screen to admin settings), so nothing from either document is missed. **Part C** adds newly identified features that were not in either prior document. **Part D** is the exact instruction block to paste into AI Studio to kick off the fix + full build in one pass.
>
> This document does not replace `01_PRD.md` through `07_Advanced_Features.md` — it is the execution checklist that sits on top of all of them.

---

## PART A — Critical Architecture Fixes (Mandatory, Blocking)

The current repository (`bossdomain406-dev/Inspire-Real-Time-Messaging-App`) was found to be built on Google AI Studio's **default scaffold**, not the architecture specified in `02_TRD.md`. These are not style preferences — they are hard contradictions of the approved spec and must be corrected **before** any feature work continues, because features built on the wrong foundation (e.g., AI features wired to Gemini instead of the Worker) would all need to be rewired later anyway.

### A1. Remove the Gemini API dependency; rewire every AI feature through the Cloudflare Worker

- **Found:** `metadata.json` declares `"majorCapabilities": ["MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API"]`; `.env.example` contains `GEMINI_API_KEY`; `package.json` depends on `@google/genai`.
- **Required:** Delete the Gemini dependency, the `GEMINI_API_KEY` env var, and the `MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API` capability declaration entirely. Every AI feature (Smart Reply, Translate, Summarize, Smart Search, Moderate, Transcribe, Emoji Suggest, and every AI feature added in `07_Advanced_Features.md` Section E) must call the Cloudflare Worker's `/api/ai/*` routes, which in turn call `env.AI.run(...)` with the exact model IDs listed in `02_TRD.md` Section 5. No frontend or server code anywhere in this project may call `generativelanguage.googleapis.com` or any Gemini SDK.
- **Verify:** `grep -ri "gemini\|genai\|GoogleGenerativeAI" -r src/ worker/` must return zero results when done.

### A2. Remove Express; the backend is a Cloudflare Worker, not a Node server

- **Found:** `package.json` depends on `express`, `dotenv`, `@types/express`, and has a `"clean": "rm -rf dist server.js"` script implying a generated `server.js`.
- **Required:** Delete `express`, `@types/express`, and any `server.js`/custom Node server file from the project. The only backend is the Cloudflare Worker under `worker/`, deployed via `wrangler deploy`, exactly as specified in `02_TRD.md` Sections 1–2 and 9–10. `dotenv` may be removed too — the Worker uses `wrangler secret put` (Cloudflare secrets), not a `.env` file, for anything server-side.

### A3. Fix dependency versions to match the approved stack

| Found | Required (per `02_TRD.md` Section 1) |
|---|---|
| `react@19.0.1` | `react@^18.x` |
| `react-dom@19.0.1` | `react-dom@^18.x` |
| `react-router-dom@7.18.4` | `react-router-dom@^6.x` |

React 19/Router 7 may introduce breaking API changes (e.g. React 19's different `ref`-as-prop handling, Router 7's data APIs) that the rest of this build's component patterns (`AuthProvider` Context, route guards) were specified against React 18/Router 6 semantics. Downgrade before writing further component code, not after.

### A4. Remove `bun.lock`; use npm exclusively

- **Found:** `bun.lock` present at repo root; no `package-lock.json` visible.
- **Required:** Delete `bun.lock`. Run `npm install` to generate `package-lock.json` and commit it. Cloudflare Pages' build step must run `npm install`/`npm run build`, not `bun install`. This matches `02_TRD.md` Section 10's explicit requirement.

### A5. Restore the correct `.env.example`

Replace the current `.env.example` content with exactly:
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_WORKER_API_URL=
```
No `GEMINI_API_KEY`, no `APP_URL` — per `02_TRD.md` Section 9.

### A6. Confirm/rebuild the Worker (`worker/`) from scratch against the real spec

Since the AI layer was wired to Gemini instead of the Worker, the `worker/` directory likely does not yet implement the routes in `02_TRD.md` Section 5 at all. Rebuild it to include:
- `worker/wrangler.jsonc` with the `ai` binding and `r2_buckets` binding exactly as shown in `02_TRD.md` Section 5.
- `worker/src/auth.ts`, `worker/src/media.ts`, `worker/src/ai.ts` implementing every route in `02_TRD.md` Section 5's table, including the budget-check/usage-logging/graceful-degradation behavior.
- No Worker route may require a `GEMINI_API_KEY` or any credential for `env.AI` — confirmed in prior research that Workers AI needs none.

### A7. Confirm `public/_redirects` and build script are correct

- `public/_redirects` must contain `/*    /index.html   200`.
- `package.json`'s `build` script must be `"build": "vite build"` only (already correct in the current repo — keep as is).

### A8. Re-verify every item in `06_Implementation_Plan.md` Section 12 (QA Checklist)

Once A1–A7 are done, re-run that entire checklist — it was written assuming the correct architecture, and most of it could not have passed against the current Gemini/Express-based build.

---

## PART B — Complete Feature Checklist (Opening Screen → Admin Settings)

This is every feature from `01_PRD.md` and every feature from `07_Advanced_Features.md`, merged into one ordered, end-to-end checklist so AI Studio can build the whole app in natural user-journey order without cross-referencing two documents. Each item references where its full spec lives. Nothing is dropped from either source document.

### B1. Landing & Authentication
- [ ] Sign up (email + password), email verification required
- [ ] Choose `@username` + display name (live availability check)
- [ ] Log in, generic invalid-credentials error (no account-existence leakage)
- [ ] Forgot password (Supabase reset-by-email)
- [ ] Two-Factor Authentication (2FA/TOTP) *(Feature 40)*
- [ ] CAPTCHA/bot protection on signup *(new — see Part C, Feature 89)*
- [ ] Rate limiting on auth endpoints *(new — Part C, Feature 90)*
- [ ] Terms of Service / Privacy Policy acceptance tracking *(new — Part C, Feature 93)*
- [ ] Logout (per-device, does not affect other sessions)
- [ ] Session persistence across visits

### B2. Onboarding / Profile Setup
- [ ] Username + display name selection gate (`/choose-username`)
- [ ] Profile: display name, bio, avatar upload
- [ ] Dark/Light/System theme (three-way, not binary) *(Feature 71)*
- [ ] Font-size scaling / accessibility mode *(Feature 72)*
- [ ] Multi-language UI (i18n) *(Feature 73)*
- [ ] QR code for sharing your own `@username`; QR scanner to add others *(Feature 69)*

### B3. Contacts
- [ ] Search by `@username` (exact/partial)
- [ ] Add contact (mutual once added)
- [ ] Contacts tab/list
- [ ] Block a user; blocked user restrictions (can't message, can't see presence, hidden from search)
- [ ] Report a user or message (reason + note → `reports` table)

### B4. Chat List
- [ ] Loading/empty/populated states
- [ ] Conversation list sorted by recency, with avatar/online-dot/last-message-preview/unread badge
- [ ] Add Contact floating action
- [ ] Pinned/favorite chats (top of list) *(Feature 54)*
- [ ] Chat folders/labels *(Feature 55)*
- [ ] Mute conversation (1h/8h/always) *(Feature 50)*
- [ ] Archive chat *(new — Part C, Feature 75)*
- [ ] Mark chat as unread *(new — Part C, Feature 77)*
- [ ] Global search across all chats, not just one conversation *(new — Part C, Feature 74)*
- [ ] Pull-to-refresh *(new — Part C, Feature 83)*
- [ ] Swipe gestures on list rows (archive/mute/delete) *(new — Part C, Feature 82)*

### B5. 1:1 Messaging — Core
- [ ] Real-time text messaging (Supabase Realtime, sub-second)
- [ ] Typing indicator
- [ ] Read receipts (sent/delivered/read, accent-colored when read)
- [ ] Reactions (👍 ❤️ 😂 😮 😢 🔥)
- [ ] Reply/quote a message
- [ ] Delete for me / delete for everyone (correct per-viewer semantics — see `05_Backend_Schema.md` 1.4)
- [ ] Unread counters (per-conversation + total badge)
- [ ] Message editing (sender, text only) *(Feature 2)*
- [ ] Message forwarding *(Feature 3)*
- [ ] Message pinning (per conversation) *(Feature 4)*
- [ ] Message starring/bookmarking *(Feature 5)*
- [ ] Disappearing messages (timer-based) *(Feature 6)*
- [ ] Multi-select & bulk actions (delete/forward) *(Feature 7)*
- [ ] Rich link previews *(Feature 8)*
- [ ] Message search highlighting + jump-to-message *(Feature 11)*
- [ ] Draft auto-save per conversation *(Feature 12)*
- [ ] Date separators ("Today"/"Yesterday"/date) *(new — Part C, Feature 78)*
- [ ] New-message divider + "jump to latest" button *(new — Part C, Feature 79)*
- [ ] Copy/select message text *(new — Part C, Feature 80)*
- [ ] Forward with an added caption *(new — Part C, Feature 95, folded into Feature 3)*
- [ ] Swipe-to-reply gesture on a bubble *(new — Part C, Feature 82)*
- [ ] Clear chat history (for me) *(new — Part C, Feature 76)*
- [ ] Per-conversation chat wallpaper *(new — Part C, Feature 81)*

### B6. Group Chats
- [ ] Create group, add/remove members, member/admin roles *(Feature 1)*
- [ ] Group messaging (mirrors 1:1 messaging features above)
- [ ] @mentions with notification priority *(Feature 9)*
- [ ] Group read receipts ("Seen by" list) *(Feature 10)*
- [ ] Group polls *(Feature 29)*
- [ ] Group info page (members, description, avatar)

### B7. Media & Files
- [ ] Image sharing (max 10MB)
- [ ] Video sharing (max 50MB)
- [ ] Audio file sharing (max 20MB)
- [ ] Voice notes (record, upload, custom player with waveform)
- [ ] Signed URL access (upload via native R2 binding, download via presigned GET — `02_TRD.md` Section 6)
- [ ] Document/generic file sharing *(Feature 22)*
- [ ] Multi-image/album send *(Feature 23)*
- [ ] In-app camera capture *(Feature 24)*
- [ ] Media gallery per chat *(Feature 25)*
- [ ] GIF & sticker support *(Feature 26)*
- [ ] Location sharing (static + live) *(Feature 27)*
- [ ] Contact card sharing *(Feature 28)*
- [ ] Playback speed control (voice notes/video) *(Feature 30)*
- [ ] View-once (self-destructing) media *(Feature 45)*

### B8. Calls & Presence
- [ ] Online/offline presence, "last seen" formatting
- [ ] "Online now" ring animation *(Feature 18)*
- [ ] Voice calling (1:1) *(Feature 13)*
- [ ] Video calling (1:1) *(Feature 14)*
- [ ] Group voice/video calls *(Feature 15)*
- [ ] Call history log *(Feature 16)*
- [ ] Screen sharing *(Feature 17)*

### B9. Status / Stories
- [ ] Post a status (text/photo/video, 24h expiry) *(Feature 19)*
- [ ] Status reactions & replies *(Feature 20)*
- [ ] Status privacy controls (My Contacts / Except / Only Share With) *(Feature 21)*

### B10. AI Features
- [ ] Smart Reply suggestions (`@cf/meta/llama-3.1-8b-instruct-fast`)
- [ ] Auto Translation (`@cf/meta/m2m100-1.2b`)
- [ ] Chat Summarizer (`@cf/meta/llama-3.1-8b-instruct-fast`)
- [ ] Smart Search (`@cf/baai/bge-m3` embeddings)
- [ ] Content Moderation, auto on reports (`@cf/meta/llama-guard-3-8b` text / `@cf/meta/llama-3.2-11b-vision-instruct` image)
- [ ] Voice Note Transcription (`@cf/openai/whisper-large-v3-turbo`)
- [ ] AI Emoji/Sticker Suggestion
- [ ] AI Chat Assistant ("Ask AI") *(Feature 31)*
- [ ] Smart Reply personalization (tone-matching) *(Feature 32)*
- [ ] AI tone checker before sending *(Feature 33)*
- [ ] Voice-to-voice translation (transcribe→translate→Web Speech API playback) *(Feature 34)*
- [ ] AI auto-categorization of chats into folders *(Feature 35)*
- [ ] Smart notification summarization *(Feature 36)*
- [ ] Image captioning/alt-text (automatic, accessibility) *(Feature 37)*
- [ ] AI link-safety check (automatic on URLs) *(Feature 38)*
- [ ] Meeting/plan extraction + .ics export *(Feature 39)*
- [ ] All AI features: budget check, `ai_usage_log` logging, graceful degradation, per-feature Admin kill switch

### B11. Security & Privacy
- [ ] RLS on every table, no exceptions
- [ ] Media only via signed URLs, never public
- [ ] Secret Chat — app-level privacy mode, NOT true E2EE, admin-visible (see `07_Advanced_Features.md` Section 0) *(Feature 41)*
- [ ] App lock (PIN/biometric) *(Feature 42)*
- [ ] Chat-level lock *(Feature 43)*
- [ ] Screenshot detection (best-effort, documented as non-guaranteed) *(Feature 44)*
- [ ] Active sessions manager (view + remote logout) *(Feature 46)*
- [ ] Granular privacy settings (last seen / profile photo / status visibility) *(Feature 47)*
- [ ] Account deactivation & deletion *(new — Part C, Feature 86)*
- [ ] GDPR-style full data export *(new — Part C, Feature 87)*
- [ ] Email change flow (with re-verification) *(new — Part C, Feature 91)*
- [ ] Password change flow (from Profile) *(new — Part C, Feature 92)*
- [ ] Cookie/privacy consent banner *(new — Part C, Feature 88)*

### B12. Notifications
- [ ] Push notifications (Web Push API) *(Feature 48)*
- [ ] Custom notification sounds per contact/group *(Feature 49)*
- [ ] Mute (already in B4) *(Feature 50)*
- [ ] Notification preview control (show/hide content) *(Feature 51)*
- [ ] Haptic feedback on key actions *(new — Part C, Feature 84)*

### B13. Social / Engagement
- [ ] User profile bubble color themes *(Feature 52)*
- [ ] Custom status/bio emoji *(Feature 53)*
- [ ] Pinned chats (already in B4) *(Feature 54)*
- [ ] Chat folders (already in B4) *(Feature 55)*
- [ ] Birthday reminders *(Feature 56)*

### B14. PWA & Infrastructure
- [ ] Installable PWA (manifest + service worker)
- [ ] Offline shell caching (app chrome only)
- [ ] Message pagination/virtualization *(Feature 64)*
- [ ] Offline message queue *(Feature 65 — requires explicit PRD scope-reversal sign-off first)*
- [ ] Delivery retries / manual resend *(Feature 66)*
- [ ] CDN-level image optimization *(Feature 67 — confirm free-tier budget first)*
- [ ] Multi-device sync improvements *(Feature 68)*
- [ ] Desktop keyboard shortcuts *(new — Part C, Feature 85)*

### B15. Admin Panel
- [ ] Dashboard (totals, AI neuron usage vs. cap)
- [ ] User management (search/sort, suspend, promote/demote, force-block)
- [ ] Reports queue (dismiss/warn/suspend/delete-message)
- [ ] **Full chat history viewer for any user, audit-logged on every open** (hard requirement, confirmed by owner)
- [ ] Analytics dashboard (growth, messages by type, DAU/WAU, AI usage, neuron trend)
- [ ] Broadcast announcements (audience targeting, dismissible/persistent)
- [ ] App settings (maintenance mode, per-AI-feature kill switches)
- [ ] Advanced analytics (retention, cohorts, heatmaps) *(Feature 57)*
- [ ] Automated moderation rules engine (keyword auto-flag) *(Feature 58)*
- [ ] Bulk user actions (CSV export, bulk suspend) *(Feature 59)*
- [ ] Admin roles/permission tiers (Admin vs. Moderator) *(Feature 60)*
- [ ] In-app support/ticket system *(Feature 61)*
- [ ] A/B feature flag system *(Feature 62)*
- [ ] Scheduled broadcasts *(Feature 63)*

### B16. Export / Data Portability
- [ ] Export a single chat (PDF/txt) *(Feature 70)*
- [ ] GDPR full-account export (already listed in B11) *(new — Part C, Feature 87)*

---

## PART C — Newly Identified Features (Not in `01_PRD.md` or `07_Advanced_Features.md`)

These close remaining gaps — mostly everyday messenger polish and account-lifecycle/compliance items a "fully featured" app needs that weren't explicitly called out before. Numbering continues from the 73 features in `07_Advanced_Features.md`.

| # | Feature | Notes / schema impact |
|---|---|---|
| 74 | **Global search across all chats** (not just within one open conversation) | New Worker-free, pure Supabase full-text query across `messages`/`group_messages` scoped to the caller's own conversations; frontend-only page `/search` |
| 75 | **Archive chat** | `archived_chats` table (`user_id`, `conversation_key`, `archived_at`) — mirrors the `muted_chats`/`pinned_chats` pattern already defined in `07_Advanced_Features.md` Section 1.1 |
| 76 | **Clear chat history** (delete all messages in a conversation, for me only) | Bulk-applies the existing per-viewer `is_deleted_sender`/`is_deleted_receiver` flags (`05_Backend_Schema.md` 1.4) to every message in the conversation — no new column needed |
| 77 | **Mark chat as unread** (manual) | `profiles`-scoped per-conversation override: a small `manual_unread` table (`user_id`, `conversation_key`) checked alongside the real unread count |
| 78 | **Date separators** in the message list ("Today" / "Yesterday" / "12 Oct") | Pure frontend, computed from `created_at` — no schema change |
| 79 | **New-message divider + "jump to latest" floating button** | Pure frontend state in `ChatPage.tsx` — no schema change |
| 80 | **Copy / select message text** | Pure frontend (`navigator.clipboard`) — no schema change |
| 81 | **Per-conversation chat wallpaper** | `chat_wallpapers` table (`user_id`, `conversation_key`, `wallpaper_id` or `color`) — constrained to a curated set, same contrast-safety reasoning as Feature 52's bubble colors |
| 82 | **Swipe gestures** (swipe-to-reply on a bubble, swipe-to-archive/mute/delete on a list row) | Pure frontend (touch gesture library or custom handlers) — no schema change |
| 83 | **Pull-to-refresh** on the chat list | Pure frontend — no schema change |
| 84 | **Haptic feedback** on key actions (send, delete confirm, reaction) | Pure frontend, `navigator.vibrate()` where supported — no schema change |
| 85 | **Desktop keyboard shortcuts** (`Ctrl/Cmd+K` global search, `Esc` close modal, `Enter` send, `↑` edit last message) | Pure frontend — no schema change |
| 86 | **Account deactivation & deletion** (self-service) | `profiles.status` CHECK extended to include `'deactivated'`; a `deletion_requests` table (`user_id`, `requested_at`, `scheduled_purge_at` — e.g. a 30-day grace period) so the request is reversible before permanent purge; a scheduled job performs the actual purge after the grace period |
| 87 | **GDPR-style "Export my data"** (full account data dump — separate from the single-chat export in Feature 70) | New Worker route `/api/export/account` that compiles the caller's own `profiles`, `messages`, `contacts`, `reports` (filed by them), and `ai_usage_log` rows into a downloadable JSON/ZIP via R2, same signed-URL pattern as other exports |
| 88 | **Cookie/privacy consent banner** (first visit) | Pure frontend, `localStorage`-persisted acknowledgment — no schema change, though the Terms acceptance in Feature 93 below is the account-linked counterpart |
| 89 | **CAPTCHA / bot protection on signup** | Cloudflare Turnstile (fits the existing Cloudflare-centric stack, free tier) embedded in `SignupPage.tsx`, verified server-side in a new Worker route `/api/auth/verify-turnstile` before the Supabase `signUp()` call proceeds |
| 90 | **Rate limiting on auth endpoints** (brute-force protection) | Cloudflare's built-in rate limiting rules on the Worker routes (`/api/auth/*`) — a dashboard/`wrangler.jsonc` configuration concern, not a new table |
| 91 | **Email change flow** (update email, re-verification required) | Supabase Auth's built-in `updateUser({ email })` already supports this with its own re-verification email — mainly a `ProfilePage.tsx` UI addition, no schema change |
| 92 | **Password change flow** (from within Profile, not only via "Forgot Password") | Supabase Auth's `updateUser({ password })`, requires the current session (already authenticated) — UI addition only |
| 93 | **Terms of Service / Privacy Policy acceptance tracking** | `profiles.terms_accepted_at timestamptz` nullable — set once at signup completion, re-prompted if the Terms version changes (`app_settings` key `'terms_version'` compared against a new `profiles.terms_version_accepted text`) |
| 94 | **New-account spam restrictions** (rate-limit messages from very new accounts to reduce spam/abuse) | A check in the `messages` INSERT trigger/RLS path: accounts younger than e.g. 1 hour are capped at N messages to unique recipients — ties into the existing `check_not_blocked_before_message()` trigger pattern from `05_Backend_Schema.md` Section 5 |
| 95 | **Forward with an added caption** | Folds into Feature 3 (Message Forwarding) — the forwarded message's `content` field is editable before sending, not purely a copy; no separate schema beyond `forwarded_from_id` already specified |
| 96 | **Chat backup reminder / export scheduling** (optional periodic reminder to export/back up a conversation) | Pure frontend notification/reminder logic built on top of Feature 70's export route — no new schema beyond a `profiles.last_export_reminder_at` nullable timestamp if a reminder cadence is wanted |

**Total feature count after this document: 96 individually specified features**, plus every cross-cutting state (loading/empty/error/success) and every security/RLS requirement from the original 6 documents.

---

## PART D — Instruction Block to Paste Into AI Studio

Copy the block below as the next message to AI Studio. It sequences Part A before Part B/C so the foundation is corrected first.

```
Read 01_PRD.md, 02_TRD.md, 03_App_Flow.md, 04_UI_UX_Design_Brief.md,
05_Backend_Schema.md, 06_Implementation_Plan.md, 07_Advanced_Features.md,
and 08_Fix_And_Complete_Build.md in full before writing any code.

STEP 1 — Apply every fix in 08_Fix_And_Complete_Build.md Part A (A1–A8)
to the existing repository first. Do not add any new feature until Part A
is fully done and verified:
- Remove @google/genai, GEMINI_API_KEY, and the
  MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API capability entirely.
- Remove express, @types/express, dotenv, and any server.js.
- Downgrade react/react-dom to ^18.x and react-router-dom to ^6.x.
- Delete bun.lock, run npm install, commit package-lock.json.
- Replace .env.example with exactly the three VITE_ variables specified.
- Build out worker/ to implement every route in 02_TRD.md Section 5
  using the native env.AI and env.MY_BUCKET bindings — no API key for AI.
- Confirm public/_redirects and the vite build script are correct.

STEP 2 — Once Part A is verified, build the complete application following
the order in 06_Implementation_Plan.md, implementing every item in
08_Fix_And_Complete_Build.md Part B (organized opening-screen to
admin-settings) and Part C (the 23 newly added features, numbered 74–96).

Do not invent table, column, or route names that differ from
05_Backend_Schema.md or 02_TRD.md — extend them using the exact names
given in 07_Advanced_Features.md Section 1 and 08_Fix_And_Complete_Build.md
Part C's notes column for anything not already in 05_Backend_Schema.md.

Follow 04_UI_UX_Design_Brief.md's palette exactly: white chat/app
background, Dark Royal Blue (#0E2A6E light / #3D6FE0 dark) and Yellow
(#FFD700) for buttons/interactive elements, bold black text in light mode,
full dark-mode parity throughout.

Admin must retain full, audit-logged access to every user's chat history,
including Secret Chats (07_Advanced_Features.md Section 0) — this is
non-negotiable and must not be weakened by any privacy feature added.

When finished, re-run the QA checklist in 06_Implementation_Plan.md
Section 1 Step 12 in full.
```
