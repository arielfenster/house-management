# 08 — Deployment

## Recommendation
- **App:** Vercel (Nuxt/Nitro zero-config SSR, env var management, preview deploys, git-push deploys). Cloudflare/Netlify are viable alternatives; Vercel chosen for minimal ops.
- **Backend:** Supabase hosted project (prod) + local Supabase stack (dev). Migrations applied with `supabase db push` from CI or manually after review.
- **Scheduler:** Supabase **pg_cron + pg_net** → `POST https://<app>/api/cron/reminders` hourly with header `x-cron-secret`. Reason: Vercel Hobby cron is limited to once per day (±1 hour precision), which can't deliver reminders at each user's chosen hour; Vercel Pro cron or an external scheduler also work. Notes from docs: pg_net requests are fire-and-forget without retry (hourly cadence + idempotent log makes this fine); `cron.job_run_details` needs periodic cleanup (add a small cleanup job).

## Free-tier notes (D12)
Supabase free projects are paused after about a week without activity (unverified; no API/database requests). To resume, open the project in the Supabase dashboard and click "Restore"; the reminder cron job acts as keep-alive. They also have no managed backups: document how to resume, and run a periodic `pg_dump` backup. Verify `pg_cron`/`pg_net`/Realtime availability and quotas at setup. No emails are sent (email confirmation disabled), so no SMTP provider is needed; password resets are done manually (see "Auth settings").

## Auth settings (D11, FOUNDATION-015)
Local values live in `supabase/config.toml` `[auth]`. Production is set by hand in the dashboard (Authentication), not with `supabase config push`, because the URLs differ:
- **Sign In / Providers:** Email enabled; **"Confirm email" off** (no emails are sent, signup returns a session immediately). All other providers, phone, anonymous sign-ins and MFA off.
- **Minimum password length:** 6, matching `PASSWORD_MIN_LENGTH` in `shared/validation/auth.ts`.
- **URL Configuration:** Site URL = the production app URL (`https://<app>`); redirect URLs = the same origin (`https://<app>/**`). No auth flow redirects today (no email links, no OAuth); these matter once magic links/OAuth are added.
- **"Allow new users to sign up": on, and stays on** (D11). Email addresses are unverified, so anyone with the URL can create an account, but without an invite code it has no household and RLS gives it no data. Accepted trade-off: strangers could create empty accounts that count toward free-tier quotas; if that happens, delete them under Authentication → Users and, if needed, turn this setting off (the signup page then shows "Sign-up is closed").

**Manual password reset** (no reset emails): in the dashboard SQL Editor, run
```sql
update auth.users
set encrypted_password = extensions.crypt('<new password>', extensions.gen_salt('bf')), updated_at = now()
where email = '<user email>';
```
then share the new password privately; the user can sign in with it immediately. The update does not revoke refresh tokens, so other devices may stay signed in. Verified against the local stack: the old password is rejected and the new one works. Don't paste the password into anything that is saved (tickets, chat history); use a temporary one if unsure.

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
Create Supabase prod project; apply the Auth settings above; create Vercel project; set env vars; first deploy of the hello-world authenticated app; confirm HTTPS (required for PWA/push).
