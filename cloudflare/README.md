# Cloudflare D1 Integration

This folder contains everything needed to run the Cladhunter backend on Cloudflare Workers with a D1 database. The worker mirrors the Supabase edge function API, so the frontend can keep using the same endpoints (`/make-server-0f597298/...`).

## Files

| File | Description |
| --- | --- |
| `worker.ts` | Hono-based Cloudflare Worker that implements all REST endpoints backed by D1. |
| `schema.sql` | SQL schema you can apply to the D1 database (via `wrangler d1 execute`). |

## Prerequisites

1. Install the Wrangler CLI (`npm install -g wrangler` or use the local dev dependency via `npx wrangler`).
2. Create a Cloudflare D1 database and note its `database_id`.
3. (Optional) If you still use Supabase Auth, keep your Supabase project URL, anon key, and service role key handy so the worker can verify authenticated users.

## Configure `wrangler.toml`

The repository contains a `wrangler.toml` in the project root with sensible defaults. Update it with your database name/id and, if you maintain separate environments, add the corresponding `[[d1_databases]]` sections for them.

```toml
name = "cladhunter-api"
main = "cloudflare/worker.ts"
compatibility_date = "2024-10-01"
node_compat = true

[[d1_databases]]
binding = "DB"
database_name = "cladhunter"
database_id = "<replace-with-your-database-id>"
```

## Apply the schema

```bash
wrangler d1 execute <database-name> --local --file=cloudflare/schema.sql
# or against production
wrangler d1 execute <database-name> --file=cloudflare/schema.sql
```

## Required environment variables

Set these secrets using `wrangler secret put` (or in the dashboard):

- `SUPABASE_URL` – only needed if you want the worker to validate Supabase access tokens.
- `SUPABASE_SERVICE_ROLE_KEY` – required alongside the URL to verify non-anonymous users.
- `SUPABASE_ANON_KEY` – used to recognise anonymous requests (`Authorization: Bearer <anon>` + `X-User-ID`).
- `VITE_TON_MERCHANT_ADDRESS` – TON merchant wallet that receives boost payments.

Example commands:

```bash
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put SUPABASE_ANON_KEY
wrangler secret put VITE_TON_MERCHANT_ADDRESS
```

## Deploy

```bash
# Preview locally (requires a remote D1 database)
npx wrangler dev cloudflare/worker.ts --remote

# Deploy to production
npx wrangler deploy
```

After deploy, set `VITE_API_BASE_URL` on the frontend (Cloudflare Pages, Vercel, etc.) to the worker URL including the base path, e.g.:

```
VITE_API_BASE_URL=https://cladhunter-api.yourdomain.workers.dev/make-server-0f597298
```

The existing React hooks (`useApi`, `useUserData`, etc.) will automatically start using the worker once the environment variable is provided.

> Since the Supabase fallback has been removed, omitting `VITE_API_BASE_URL` in production will break the app intentionally. This guarantees that all reads and writes happen against the D1 database you control. For local development the frontend defaults to `http://127.0.0.1:8787/make-server-0f597298` so you can run `wrangler dev` without additional configuration.
