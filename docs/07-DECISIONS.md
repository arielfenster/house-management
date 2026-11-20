# 07 — Decisions

Format: Decision · Context · Alternatives · Rationale · Consequences · Date. Only meaningful decisions.

## Accepted defaults (proposed by planning; overridable at review)

### D1 — `profiles` table exists, minimal
Context: need member display names and per-user notification defaults; `auth.users` is not client-readable. Alternatives: store names in `household_members`; read via admin API. Rationale: one tiny table, no duplicated auth data (no email). Consequences: trigger on signup. 2026-11-20.

### D2 — One household per user via `unique(user_id)`
Context: spec allows it initially. Alternative: allow many now. Rationale: avoids "active household" UX. Consequences: dropping constraint later is easy because all policies/rows carry `household_id`. 2026-11-20.

### D3 — Household-scoped, seeded (not system-wide) categories/rooms/groups, separate tables
Alternatives: system rows + custom rows (nullable household_id); one generic `labels` table. Rationale: uniform RLS, renaming/deleting defaults trivially allowed, no special cases. Consequences: defaults copied per household at creation. 2026-11-20.

### D4 — Recurrence stored as columns; `due_date` stored; no `last_completed_at`
Alternatives: JSON/RRULE, separate schedule table, computing due date on read. Rationale: constrained simple columns; stored due date is the hot query/notification key; last completion derived from history. 2026-11-20.

### D5 — Direct supabase-js CRUD under RLS; server routes only for logic/secrets
Rationale: least code, single authorization boundary (RLS). Consequences: any new privileged route needs a decision entry. 2026-11-20.

### D6 — Reminders computed, not scheduled; dedup via `reminder_log` PK
Alternative: scheduled-notifications table populated on every task change. Rationale: fewer states to keep in sync; edits are automatically correct. 2026-11-20.

### D7 — Scheduler: Supabase pg_cron + pg_net → secured Nuxt route
Alternatives: Vercel cron (Hobby = daily only), Supabase Edge Function, external cron. Rationale: hourly precision on free/cheap tiers, same DB. Consequences: secret in Vault; log cleanup job. 2026-11-20.

### D8 — Private tasks cannot be assigned to someone else
Rationale: enforces "assignment does not grant access" at the DB level. 2026-11-20.

### D9 — Files and shopping are shared-only; `visibility` only on tasks and notes
Rationale: matches spec; YAGNI. 2026-11-20.

## Decided by you (2026-11-20 review)

### D10 — Recurring due date = completion date + interval (Q1)
Applies to early and late completion alike; no catch-up of missed occurrences. A per-task "keep original schedule" option may come later. Reflected in `features/TASKS.md`.

### D11 — Auth: email + password only, no emails sent (Q2, revised)
Supabase Auth email/password; **"Confirm email" is disabled** so signup works immediately and the app sends no email. Consequences: (a) no email-based password reset — a forgotten password is reset manually in the Supabase dashboard (acceptable for two users; a reset-by-email flow can be added later with an SMTP provider); (b) email addresses are not verified, so signup should be limited to avoid strangers creating accounts — see below; (c) no SMTP setup needed. Magic link and OAuth can be added later without schema changes.
**Signup restriction:** since anyone with the URL could otherwise create an account (though they could not access any household without an invite code), disable public signups after the two accounts exist (Supabase "Allow new users to sign up" off) or keep signups open but rely on RLS isolation; decide at FOUNDATION-015. Invite codes/links remain the only way into a household.

### D12 — Supabase free tier only (Q3)
Consequences/risks: (a) free projects are paused after a period of inactivity — the hourly reminder job and normal use should keep the project active, but this is **unverified**; FOUNDATION-014/NOTIF-008 must check actual behaviour and the pause policy, and we should know how to resume a paused project; (b) free-tier storage/database/egress quotas apply — keep the 15 MB file limit and monitor usage; (c) no automatic backups on free — schedule a periodic `pg_dump` (manual or CI) as a safety net; (d) re-check that `pg_cron`/`pg_net` and Realtime are available on the free plan at Phase 0 time.

### D13 — Vercel hosting (Q4)
Confirmed. See 08-DEPLOYMENT.md.

### D14 — Join by invite code (Q5)
After signing up, the new member enters the household's invite code (or opens a shareable link `/join/<code>` that pre-fills it; if logged out, they sign in/up first and then return to the join step). The creator simply sends the code or link by any messenger. Codes are long and random, rotatable, and the join RPC rejects users already in a household.

### D15 — Private-task UI deferred (Q6)
The database/RLS foundation (visibility, creator ownership, private-assignment rule) is still built and tested in Phase 1, but **no "Private" toggle or private-task UI ships in v1**; all tasks created from the UI are `shared`. To add later (see `features/TASKS.md` "Deferred"). Notes keep their private/shared columns with no UI.

### D16 — Shopping section deletion removes its items, with undo toast (Q8)
Confirmed.

### D17 — English UI; Hebrew only as user-entered content (Q9, clarified)
The interface is English/LTR only: no translations, no i18n library, no RTL layout. Users will type Hebrew into task titles/descriptions, notes, shopping items and file descriptions, so free-text content must render and edit correctly: `dir="auto"` on text inputs/textareas and on elements displaying user content (so Hebrew lines are right-aligned and punctuation/mixed text behaves), a Hebrew-capable font fallback, and Hebrew test data. Search (`ILIKE`) works on Hebrew as-is. Consequences: no `@nuxtjs/i18n`; UI strings may be written inline.

## Still open
- **Q7 `@vite-pwa/nuxt` + Nuxt 4** is not explicitly confirmed; verified by the Phase 0 spike (FOUNDATION-011). Fallback: hand-written service worker + manifest.
