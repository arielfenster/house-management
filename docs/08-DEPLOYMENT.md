# 08 — Deployment

## Recommendation
- **App:** Vercel (Nuxt/Nitro zero-config SSR, env var management, preview deploys, git-push deploys). Cloudflare/Netlify are viable alternatives; Vercel chosen for minimal ops.
- **Backend:** Supabase hosted project (prod) + local Supabase stack (dev). Migrations applied with `supabase db push` from CI or manually after review.
- **Scheduler:** Supabase **pg_cron + pg_net** → `POST https://<app>/api/cron/reminders` hourly with header `x-cron-secret`. Reason: Vercel Hobby cron is limited to once per day (±1 hour precision), which can't deliver reminders at each user's chosen hour; Vercel Pro cron or an external scheduler also work. Notes from docs: pg_net requests are fire-and-forget without retry (hourly cadence + idempotent log makes this fine); `cron.job_run_details` needs periodic cleanup (add a small cleanup job).

## Production (FOUNDATION-014, 2026-11-28)
| | |
|---|---|
| App | https://house-management-puce.vercel.app (Vercel Hobby, Git integration: every push to `main` deploys; PRs get preview deploys) |
| Functions region | `fra1`, set in `nuxt.config.ts` (`nitro.vercel.functions.regions`) to sit next to the database |
| Supabase | project `house-management`, ref `tblaawpxvpttnwhskmbm`, region `eu-central-1` (Frankfurt), Free plan, Postgres 17 |
| Vercel env vars | `SUPABASE_URL`, `SUPABASE_KEY` (publishable) only. `SUPABASE_SECRET_KEY` is **not** set: no server code uses it yet; add it when the first server route needs it (Phase 4 cron) |

Project creation choices: Data API on, "Grant API access to new tables automatically" on (same as local/CI; every migration revokes and grants explicitly), "Enable RLS on new tables automatically" on (safety net; migrations enable RLS explicitly).

**Applying migrations (manual, not in CI).** CI only applies migrations to a throwaway local stack. Production is migrated by hand, before merging/deploying code that needs the change (keep migrations backward-compatible). Once per machine: `npx supabase login` and `npx supabase link --project-ref tblaawpxvpttnwhskmbm`. Then:
```bash
npx supabase db push --remote --dry-run   # lists the migrations that would be applied
npx supabase db push --remote
npx supabase migration list --remote      # local and remote columns match
```
Note: CLI v3 targets the **local** stack unless `--remote` is passed. Read-only checks: `npx supabase db query --remote --read-only "<sql>"`.

## Free-tier notes (D12)
Checked against Supabase docs on 2026-11-28:
- **Pausing:** Free projects with low activity over a 7-day period are paused (paid plans never are). Normal use and, from Phase 4, the hourly reminder job keep it active. **To resume:** dashboard → the project → "Resume"/"Restore"; data and config come back as they were. Current docs allow restoring a paused project for up to a year (an older 2024 changelog said 90 days); after that only the backup file can be downloaded and restored into a new project.
- **Backups:** the Free plan has **no automatic backups** (daily backups start at Pro). Make an off-site dump regularly (e.g. monthly and before risky migrations), and keep it out of the repo:
  ```bash
  npx supabase db dump --remote -f prod-schema.sql
  npx supabase db dump --remote --data-only -f prod-data.sql
  ```
  Storage files (Phase 3) are not included in database dumps; back them up separately.
- **Extensions:** `pg_cron` and `pg_net` are available on the project (verified with a read-only query; enabled in Phase 4). Realtime is included on the Free plan (quotas apply); used by the shopping list since Phase 2 (`shopping_items`, `shopping_sections` in the `supabase_realtime` publication).
- No emails are sent (email confirmation disabled), so no SMTP provider is needed; password resets are done manually (see "Auth settings").

## Auth settings (D11, FOUNDATION-015)
Local values live in `supabase/config.toml` `[auth]`. Production is set by hand in the dashboard (Authentication), not with `supabase config push`, because the URLs differ:
- **Sign In / Providers:** Email enabled; **"Confirm email" off** (no emails are sent, signup returns a session immediately). All other providers, phone, anonymous sign-ins and MFA off.
- **Minimum password length:** 6, matching `PASSWORD_MIN_LENGTH` in `shared/validation/auth.ts`.
- **URL Configuration:** Site URL = `https://house-management-puce.vercel.app`; redirect URLs = `https://house-management-puce.vercel.app/**`. No auth flow redirects today (no email links, no OAuth); these matter once magic links/OAuth are added.
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

## Checklist (Phase 0) — done 2026-11-28
Create Supabase prod project; push migrations; apply the Auth settings above; create Vercel project; set env vars; deploy; confirm HTTPS (required for PWA/push). Verified: HTTPS with HSTS, `/` → `/login`, manifest and service worker served, functions run in `fra1`, live client bundle contains only the publishable key and project URL (no secret key), real signup auto-confirmed and household created, RLS enabled on every `public` table, production schema matches `types/database.types.ts`.
