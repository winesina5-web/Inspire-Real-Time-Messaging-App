# Cloudflare Worker setup

This Worker provides Cloudflare Workers AI and authenticated server-side utility routes. Media files are stored in the private Supabase Storage bucket `inspire-media`; this Worker does not use Cloudflare R2.

## Configure secrets

From the `worker/` directory, configure secrets required by existing server-side utility routes:

```sh
npx wrangler secret put SUPABASE_JWT_SECRET
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

Use the JWT verification secret supported by the Supabase project's token-signing configuration. If the project uses asymmetric signing keys, update the verifier to use the project's JWKS before deploying; do not paste signing keys into source control.

Set `SUPABASE_URL` as a Worker variable for the project and set `ALLOWED_ORIGINS` to a comma-separated list of exact production origins. Do not use wildcard domains. The checked-in list includes local development origins and `https://inspire.pages.dev`; add the actual Pages/custom domain explicitly if it differs.

## Frontend variables

Configure `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_WORKER_API_URL` in Cloudflare Pages. The anon key is intended for browser use and must be constrained by Supabase RLS. Never put the service-role key or JWT signing secret in a `VITE_*` variable.

## Database migration

Review migrations `00007` through `00009` against the current production schema and reconcile existing migration history before applying them. Do not reset the database or delete migration-history entries.
