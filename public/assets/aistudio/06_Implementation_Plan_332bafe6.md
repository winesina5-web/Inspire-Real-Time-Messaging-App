# 06 — Implementation Plan
## Inspire — Real-Time Messaging App

> This document is the **internal execution plan for Google AI Studio**. It is triggered by the single message `Follow the plan` (Pass 1) and `In files ko dobara se analyze kr k dekho or compare kro...` (Pass 2). It is not a set of phase-by-phase prompts for the user — AI Studio must read all 6 documents and build the entire application in one pass, then finalize it in a second pass, following the build order below.
>
> **Revision note:** this pass folds in two confirmed corrections from live Cloudflare documentation research (see `02_TRD.md`'s revision note): (1) the native R2 binding cannot generate presigned URLs — uploads go through the Worker via the native binding, downloads use a presigned GET URL via the S3-compatible API; (2) the design system now uses white chat surfaces, Dark Royal Blue + Yellow interactive elements, and bold black text (see `04_UI_UX_Design_Brief.md`).

---

## 0. Before Writing Any Code

Read all 6 documents fully and cross-reference them:
- `01_PRD.md` — what to build and why
- `02_TRD.md` — exact stack, folder structure, env vars, Worker API surface, confirmed Workers AI model IDs and R2 architecture
- `03_App_Flow.md` — every route, every state (loading/empty/error/success)
- `04_UI_UX_Design_Brief.md` — exact colors (white/Dark Royal Blue/Yellow/black), typography, component patterns
- `05_Backend_Schema.md` — exact table/column names the frontend code must query against (the database itself is NOT created by you — only write code that assumes this schema exists)

**Do not invent table/column names that differ from `05_Backend_Schema.md`.** Do not invent routes that differ from `03_App_Flow.md`. Do not invent colors that differ from `04_UI_UX_Design_Brief.md`. Do not invent a Workers AI/R2 architecture that differs from `02_TRD.md` — in particular, never design an upload flow around a "presigned PUT URL from the native R2 binding," since that capability does not exist.

---

## 1. Build Order (Single Pass)

### Step 1 — Project Setup
- Vite + React + TypeScript scaffold.
- Install: `@supabase/supabase-js`, `react-router-dom`, `tailwindcss` + `@tailwindcss/vite`.
- Create `.env.example`, `.npmrc` (`legacy-peer-deps=true`), `public/_redirects` (`/*    /index.html   200`).
- `vite.config.ts`: React + Tailwind plugins, no `process.env` usage that would require Node types (keep the frontend `tsconfig.json` scoped to `src` only, excluding `worker/`).
- `tsconfig.json`: `strict: true`, `skipLibCheck: true`, `include: ["src"]`.
- `package.json` build script: `"build": "vite build"` — **do not** chain a separate `tsc &&` step that can fail the build on type-check edge cases; let Vite's own esbuild-based type stripping handle the build, and rely on the editor/CI for type checking separately.
- Create `src/lib/supabaseClient.ts` (single shared client, reading `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`).
- Create `src/lib/workerApi.ts` (typed fetch wrapper that attaches the current Supabase session's access token as `Authorization: Bearer <token>` to every call, base URL from `VITE_WORKER_API_URL`). `uploadMedia()` sends `multipart/form-data` to `/api/media/upload`; `getDownloadUrl()` posts `{ object_key }` to `/api/media/download-url`.

### Step 2 — Design System Foundation
- `src/index.css`: CSS variables for the full light/dark palette from `04_UI_UX_Design_Brief.md` — white (`#FFFFFF`) app/chat background and surfaces in light mode separated by a `--color-border` hairline + soft shadow (not a background-color shift), Dark Royal Blue (`#0E2A6E`) primary, Yellow (`#FFD700`) accent, black (`#000000`) primary text at bold weight for names/headers/buttons, a distinct dark-mode set (`#0B0F1A`/`#161B2B` surfaces, `#F5F7FA` text), Inter font import, base body styles, the `animate-fade-in` keyframe utility (used throughout for modals/menus), `prefers-reduced-motion` consideration.
- Shared components first, since pages depend on them: `Avatar.tsx`, `Toast.tsx` (a `useToast` hook + `ToastContainer`, `.tsx` extension since it renders JSX), `BottomNav.tsx`, `TypingIndicator.tsx`, `VoiceNotePlayer.tsx`, `ReactionPicker.tsx`, `InstallPrompt.tsx` — every one of these built and visually checked against both the light and dark token sets before moving on, not just the light palette.

### Step 3 — Auth Foundation (Build This Correctly From the Start)
- `src/hooks/useAuth.tsx` (**`.tsx` extension — it contains JSX for the Provider**): implement as `AuthProvider` (React Context) + `useAuth()` (`useContext` consumer that throws if used outside the provider). Internally: `supabase.auth.getSession()` on mount, `onAuthStateChange` listener, exposes `{ session, user: profile, isLoading, isAuthenticated, signUp, signIn, signOut, refreshProfile }`. `user` here means the joined `profiles` row (not just the raw Supabase Auth user), fetched once a session exists.
- **This must be a single Provider instance wrapping the whole app in `App.tsx` — never a bare hook called independently in multiple components.** This exact mistake broke a prior version of this app (disconnected auth state per component, login/redirect loops) and must not be repeated.
- `App.tsx`: `<BrowserRouter><AuthProvider><AppRoutes /></AuthProvider></BrowserRouter>`, where `AppRoutes` reads `useAuth()` once and defines all routes from `03_App_Flow.md`'s route map, including the `/choose-username` gate (redirect there if authenticated but `profile.username` is null) and the `/admin/*` role gate (redirect to `/chats` if not `role === 'admin'`).

### Step 4 — Auth Pages
- `LoginPage.tsx`, `SignupPage.tsx`, `ForgotPasswordPage.tsx`, and the username-selection step — implement exactly the states described in `03_App_Flow.md` Section 2 (verification-pending state, inline errors, resend verification, generic invalid-credentials message, no account-existence leakage on password reset). Primary CTA buttons use the Dark Royal Blue fill + bold white label from the design brief; live-availability indicator uses success/danger tokens.

### Step 5 — Core Messaging Hooks
- `src/hooks/useMessages.ts`: fetch conversation (paginated), send message (optimistic append with the full message shape including `reactions: []` so nothing downstream crashes on an undefined field), delete message (update the correct per-viewer deletion flag per `05_Backend_Schema.md` Section 1.4 — do not conflate sender/receiver deletion), add/remove reaction, subscribe to Supabase Realtime Postgres Changes for the open conversation, expose an `addLocalMessage` function so media/voice-note uploads (which complete via the Worker, not this hook) can append their result immediately rather than waiting for the next Realtime event.
- `src/hooks/usePresence.ts`: join a Supabase Presence channel per user on mount, expose `{ onlineUserIds, isOnline(id) }`; update `profiles.is_online`/`last_seen` on join/leave.
- `src/hooks/useTyping.ts`: Supabase Broadcast channel per open conversation, debounced "typing" events, auto-clears after a few seconds of inactivity.
- `src/hooks/useMediaUpload.ts`: posts the file as `multipart/form-data` to `/api/media/upload` (the Worker validates size/type and writes it to R2 via the native binding, returning the object key), then inserts the `messages` row (or updates `profiles.avatar_url`) with that key. For displaying existing media, calls `/api/media/download-url` to get a short-lived presigned GET URL and renders directly from it.
- `src/hooks/useVoiceRecorder.ts`: `MediaRecorder` wrapper — start/stop/cancel, duration tracking, returns a `Blob`.
- `src/hooks/useAI.ts`: thin wrapper around each `/api/ai/*` Worker route; every call wrapped so a failure/429/403 degrades silently (returns `null`/`disabled`, never throws uncaught).

### Step 6 — Chat Pages
- `ChatListPage.tsx`: inbox query (per the corrected single-partner-per-row approach in `05_Backend_Schema.md` Section 6's pitfall note), Chats/Contacts tabs, Add Contact modal, all empty/loading states from `03_App_Flow.md`. White chat-list background per the design brief, with each row separated by a `--color-border` hairline rather than a background shift; unread badges in Yellow.
- `ChatPage.tsx`: message list + composer + attachment menu + voice recording UI + reactions + reply + delete + AI feature entry points (Smart Reply chips, Translate action, Emoji Suggest row, Transcript toggle, Summarize/Smart Search in header menu) + Block/Report actions + the blocked-state disabled composer. Sent bubbles Dark Royal Blue/white text; received bubbles white with a hairline border/black text, per the design brief. Build order within this page: text messaging and Realtime first (core functionality), then media/voice (depends on Step 5's upload hook), then reactions/replies, then AI features last (each independently optional and must not block the rest if it fails).

### Step 7 — Profile Page
- `ProfilePage.tsx`: display name/bio edit, avatar upload (via `useMediaUpload`), username display + copy, dark/light toggle, logout, Admin Panel link (conditional on `role === 'admin'`). **After a successful profile/avatar update, update the shared `AuthProvider` state** (expose a `refreshProfile`/`updateProfile` method from `useAuth` and call it) so the change reflects immediately across the app without a reload — this exact gap (profile saved to DB but not reflected in shared state) caused a visible bug in a prior build.

### Step 8 — Admin Panel
- Build after the user-facing app is functional, since admin screens read the same tables.
- `AdminSidebar.tsx` / responsive drawer, then each admin page per `03_App_Flow.md` Section 4: Dashboard, Users, Reports, Chat Viewer (remember: write an `admin_audit_log` row every time a specific conversation transcript is opened — this is a hard requirement, not optional), Analytics, Broadcast, Settings (AI feature toggles + maintenance mode, both read/write against `app_settings`). Tables use the sticky Dark Royal Blue header / white body pattern from `04_UI_UX_Design_Brief.md` Section 5.6.
- Maintenance Mode: when `app_settings.maintenance_mode = true`, non-admin users seeing `/chats` or attempting to send a message see a maintenance screen instead; implement this check once, centrally (e.g. in `AppRoutes` or a shared gate), not duplicated per page.

### Step 9 — Cloudflare Worker (`worker/`)
- `worker/src/auth.ts`: verifies the incoming Supabase JWT against `SUPABASE_JWT_SECRET`, extracts `user_id`; every route handler calls this first and rejects with `401` on failure.
- `worker/src/media.ts`: implements `/api/media/upload` (reads the `multipart/form-data` body, validates size/type against `02_TRD.md` Section 6's limits, writes via `env.MY_BUCKET.put()` — the native binding, no credentials involved) and `/api/media/download-url` (checks conversation/ownership membership, then signs a GET URL via `aws4fetch` using the `R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY` secrets — this is the only place those secrets are used).
- `worker/src/ai.ts`: implements all `/api/ai/*` routes from `02_TRD.md` Section 5 using the `env.AI` Workers AI binding (no credential needed) with the exact model IDs specified there, including the pre-call budget check, the post-call `ai_usage_log` insert (via the service-role key, recording `estimated_neurons` and `model_id`), the `app_settings`-driven per-feature enable check, and explicit handling of error codes 3036 (budget exhausted), 3040 (temporarily out of capacity), and 5035 (requires paid plan).
- `worker/wrangler.jsonc`: Worker config, including `"ai": { "binding": "AI" }` and `"r2_buckets": [{ "binding": "MY_BUCKET", "bucket_name": "inspire-media" }]` — self-contained so it can be deployed independently of the Pages frontend.

### Step 10 — PWA
- `public/manifest.json`, `public/sw.js` (shell caching only — `/api/*` and any Worker/Supabase calls must always be network-only, never cached), `InstallPrompt.tsx` wired into `App.tsx`, real (non-placeholder) `icon-192.png`/`icon-512.png` matching the Design Brief's Dark Royal Blue + Yellow speech-bubble mark, manifest/meta tags in `index.html`.

### Step 11 — Polish Pass
- Verify every list/empty/loading/error state from `03_App_Flow.md` Section 5 is actually implemented, not just the happy path.
- Verify dark mode is implemented on every screen built, not only the auth/chat screens — and that light mode genuinely renders a white chat canvas with Dark Royal Blue/Yellow elements and bold black text, not a leftover gray-on-gray look from an earlier palette.
- Verify every destructive action (suspend user, delete-for-everyone, maintenance mode toggle, force-block) has a confirmation step.
- Verify no AI feature call can throw an unhandled error that breaks the surrounding page.
- Verify no code path assumes the native R2 binding can produce a presigned URL — uploads must go through `/api/media/upload`, downloads through `/api/media/download-url`.

### Step 12 — QA Checklist (Self-Verify Before Finishing)
- [ ] No file contains JSX with a `.ts` extension (must be `.tsx`) — this exact mistake (a Context provider file saved as `.ts` instead of `.tsx`) broke a prior build's production bundle.
- [ ] No component references the `React` namespace (`React.ReactNode`, etc.) without importing `React` or the specific named type (`ReactNode`) from `'react'`.
- [ ] `useAuth` is a Context (`AuthProvider` + `useContext`), confirmed used identically in every page that needs it — no page defines or calls a separate/parallel auth hook.
- [ ] Message deletion correctly distinguishes sender-side vs receiver-side per `05_Backend_Schema.md` Section 1.4 — test both "delete for me" and "delete for everyone" from both the sender's and receiver's point of view.
- [ ] Media/voice-note messages appear immediately in the sender's own chat view upon successful upload, not only after the next Realtime event.
- [ ] The inbox query returns exactly one row per conversation partner (no duplicates, no mismatched partners) per the corrected approach in `05_Backend_Schema.md`.
- [ ] Every `/api/ai/*` call path has a visible fallback/hidden state if the Worker call fails — core messaging is never blocked by an AI feature.
- [ ] No Supabase service-role key, Cloudflare R2 API token, or any secret from `02_TRD.md` Section 9 appears anywhere in `src/` or any committed frontend file — only in `worker/` as references to `env.<SECRET_NAME>` (the actual values are Cloudflare secrets, never hardcoded even in `worker/` source). Confirm `env.AI` is called with no credential of any kind, since none exists for Workers AI.
- [ ] `package-lock.json` exists; no `bun.lock`/`bun.lockb` exists; root `.npmrc` contains `legacy-peer-deps=true`; `public/_redirects` exists with the SPA fallback rule.
- [ ] `npm run build` succeeds using only `vite build` (no separate blocking `tsc` step in the build script).
- [ ] Every screen uses the confirmed palette: white chat/app background, Dark Royal Blue + Yellow for buttons/interactive elements, bold black primary text — no leftover light-gray-on-light-gray styling from an earlier design pass.

---

## 2. Dependencies Between Steps

```
Step 1 (setup) → Step 2 (design system) → Step 3 (auth foundation)
                                              │
                      ┌───────────────────────┼───────────────────────┐
                      ▼                       ▼                       ▼
               Step 4 (auth pages)    Step 5 (messaging hooks)   Step 7 (profile)
                                              │
                                              ▼
                                       Step 6 (chat pages)
                                              │
                                              ▼
                                       Step 8 (admin panel)
                                              │
                      ┌───────────────────────┼───────────────────────┐
                      ▼                       ▼                       ▼
              Step 9 (Worker)         Step 10 (PWA)           Step 11 (polish)
                                                                       │
                                                                       ▼
                                                              Step 12 (QA checklist)
```

Step 9 (the Worker) can technically be built in parallel with Steps 4–8 since it's a separate deployable, but its contract (`02_TRD.md` Section 5's exact routes/payloads — `/api/media/upload`, `/api/media/download-url`, and the `/api/ai/*` routes with their confirmed model IDs) must be respected by `useMediaUpload`/`useAI` from the moment those hooks are written in Step 5, so write the Worker's route *shapes* early even if the full implementation is finished later in the same pass.

---

## 3. Testing Checkpoints (Self-Verify During the Single Pass, Not Deferred)

1. After Step 3: can a user sign up, verify (simulated/assumed), choose a username, and land on `/chats`? Does refreshing the page keep them logged in?
2. After Step 6: can two different user accounts exchange a text message and see it appear on both sides without a manual refresh (Realtime working)?
3. After Step 6 (media): does an uploaded image appear immediately in the uploader's own chat view?
4. After Step 8: does a non-admin attempting to visit `/admin` get redirected? Does opening a chat transcript in the Admin Chat Viewer actually produce a new `admin_audit_log` row?
5. After Step 9: does a Worker call without a valid `Authorization` header correctly return `401` rather than proceeding? Does `/api/media/upload` succeed with the native binding and no R2 credentials present in the request path? Does `/api/media/download-url` correctly fail for a non-participant?

---

## 4. Final Checklist (Mirrors the Master Workflow's Step 3 Delivery Checklist)

```
✅ Folder structure matches 02_TRD.md exactly
✅ All 6 documents' table/column/route names used consistently, no invented names
✅ AuthProvider Context pattern used (not a bare hook) — Step 3/Step 12 verified
✅ RLS assumed/coded against for every Supabase query (no query assumes open access
   beyond what 05_Backend_Schema.md's policies allow)
✅ Cloudflare Worker (worker/) is self-contained with its own wrangler.jsonc
✅ Media upload goes through the native R2 binding (via the Worker); media download
   goes through a presigned GET URL (via the S3-compatible API) — never a public
   bucket URL, and never an assumed "presigned PUT from the native binding"
✅ Every Workers AI call uses the confirmed model ID from 02_TRD.md, with no API key
   (Workers AI requires none) and explicit handling of error codes 3036/3040/5035
✅ Every AI feature degrades gracefully on failure/disabled state
✅ .env.example, .npmrc, public/_redirects, package-lock.json present and correct
✅ npm run build succeeds with just "vite build"
✅ Dark mode implemented across every screen, not only auth/chat
✅ Light mode renders the confirmed white/Dark-Royal-Blue/Yellow/bold-black palette
   from 04_UI_UX_Design_Brief.md, not a leftover earlier palette
✅ PWA manifest + service worker + real icons in place
✅ QA checklist (Section 1, Step 12) fully checked off
```
