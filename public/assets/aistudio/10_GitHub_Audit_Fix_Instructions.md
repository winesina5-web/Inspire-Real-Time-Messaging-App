# 10 — GitHub Audit & Fix Instructions
## Inspire — Real-Time Messaging App

> **Overview:** Comprehensive audit and repair mandate for the repository `winesina5-web/Inspire-Real-Time-Messaging-App`. This document governs the verification criteria, architectural boundaries, database security, and workflow requirements.

---

### 1. Mandatory Technical Stack
- **Frontend:** React 18 (`^18.x`), React Router DOM 6 (`^6.x`), Vite (`^6.x` / `^8.x`), Tailwind CSS (`@tailwindcss/vite`), TypeScript (`^5.x` / `^7.x`).
- **Database & Realtime:** Supabase (Auth, Postgres, Realtime, Storage/Presigned).
- **Edge Backend:** Cloudflare Pages (Frontend Hosting), Cloudflare Workers (API Layer), Cloudflare R2 (Object Storage), Cloudflare Workers AI (`env.AI.run`).
- **Strict Exclusions:** NO Express server, NO Node.js runtime servers, NO Google Generative AI (Gemini) SDKs, NO external third-party AI keys.

---

### 2. Core Security & Architecture Requirements

#### 2.1 Worker JWT Verification Fail-Closed
- The Worker must verify the Supabase JWT on every incoming request to protected routes (`/api/*`, excluding `/api/health`).
- If `SUPABASE_JWT_SECRET` is unset or blank, or if the token signature fails, or if the token is expired or algorithm is not `HS256`, the Worker MUST immediately respond with `401 Unauthorized`. It must NEVER fail open or decode unverified tokens.

#### 2.2 CORS & SSRF Hardening
- Replaces open wildcard CORS (`*`) with an origin allowlist (e.g. `localhost:3000`, `*.pages.dev`, `*.run.app`, or user configured domain).
- Restricts link preview crawler from fetching private/internal IP addresses, metadata endpoints (e.g. `169.254.169.254`), or loopback interfaces.

#### 2.3 Media Authorization & Streaming
- Download requests (`/api/media/download` or `/api/media/stream`) must enforce caller authorization:
  - Caller must be the sender, receiver, group member, or channel subscriber.
  - Avatar images are publicly readable by authenticated users.
  - Unauthenticated or unauthorized callers must receive `403 Forbidden`.

#### 2.4 Cloudflare Workers AI Budgeting
- All AI features call `env.AI.run(...)` using the exact approved models:
  - Smart Reply & Summarizer: `@cf/meta/llama-3.1-8b-instruct-fast`
  - Translation: `@cf/meta/m2m100-1.2b`
  - Embeddings: `@cf/baai/bge-m3`
  - Moderation: `@cf/meta/llama-guard-3-8b`
  - Voice Transcription: `@cf/openai/whisper-large-v3-turbo`
- Daily budget cap (10,000 neurons) enforced with tracking in `ai_usage_log`.
- Admin per-feature kill switches checked via `app_settings`.

#### 2.5 Admin Inspection & Audit Logging
- Platform owner inspection requirement: Admins must be able to inspect any user's conversation history for safety and compliance.
- Every chat inspection action MUST create an append-only audit record in `admin_audit_log` capturing the admin ID, target conversation key, IP address, and timestamp.

#### 2.6 Database Persistence & Row-Level Security
- All 49+ tables must have `ENABLE ROW LEVEL SECURITY` explicitly enabled.
- Ordered migration scripts in `supabase/migrations/` (`00001_initial_schema.sql` through `00006_realtime_publication.sql`).
- Complete canonical schema maintained in `supabase/schema-reference.sql`.
- **CRITICAL CONSTRAINT:** Do not execute database migrations against the live Supabase instance during the audit fix. Commit clean, valid SQL files for user deployment.

---

### 3. Deliverables
1. Clean, production-ready codebase on branch `fix/audit-completion`.
2. `AUDIT_FEATURE_MATRIX.md` detailing all 151+ features, implementation status, files, database tables, and verification methods.
3. Full test coverage in `src/utils/helpers.test.ts` and `worker/src/auth.test.ts`.
4. Successful `compile_applet`, `npm run lint`, and unit test run reports.
