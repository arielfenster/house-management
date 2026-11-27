# 08 — Deployment

## Recommendation
- **App:** Vercel (Nuxt/Nitro zero-config SSR, env var management, preview deploys, git-push deploys). Cloudflare/Netlify are viable alternatives; Vercel chosen for minimal ops.
- **Backend:** Supabase hosted project (prod) + local Supabase stack (dev). Migrations applied with `supabase db push` from CI or manually after review.
- **Scheduler:** Supabase **pg_cron + pg_net** → `POST https://<app>/api/cron/reminders` hourly with header `x-cron-secret`. Reason: Vercel Hobby cron is limited to once per day (±1 hour precision), which can't deliver reminders at each user's chosen hour; Vercel Pro cron or an external scheduler also work. Notes from docs: pg_net requests are fire-and-forget without retry (hourly cadence + idempotent log makes this fine); `cron.job_run_details` needs periodic cleanup (add a small cleanup job).

## Free-tier notes (D12)
Supabase free projects are paused after about a week without activity (unverified; no API/database requests). To resume, open the project in the Supabase dashboard and click "Restore"; the reminder cron job acts as keep-alive. They also have no managed backups: document how to resume, and run a periodic `pg_dump` backup. Verify `pg_cron`/`pg_net`/Realtime availability and quotas at setup. No emails are sent (email confirmation disabled), so no SMTP provider is needed; password resets are done manually in the Supabase dashboard.

## Environment variables
| Var | Scope |
|---|---|
| `SUPABASE_URL`, `SUPABASE_KEY` (publishable/anon) | public/runtime |
| `SUPABASE_SECRET_KEY` (service role; `@nuxtjs/supabase` v2 name, replaces deprecated `SUPABASE_SERVICE_KEY`) | server only |
| `VAPID_PUBLIC_KEY` (public), `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | private except public key |
| `CRON_SECRET` | server only; also stored in Supabase Vault for the pg_net job |

## Pipeline
PR → CI (typecheck, lint, DB types check, vitest incl. RLS tests on local Supabase, build, Playwright smoke) → merge to `main` → Vercel production deploy. Migrations: reviewed in PR, applied to prod before/with deploy (backward-compatible changes preferred).

## Checklist (Phase 0)
Create Supabase prod project; configure Auth redirect URLs; create Vercel project; set env vars; first deploy of the hello-world authenticated app; confirm HTTPS (required for PWA/push).
