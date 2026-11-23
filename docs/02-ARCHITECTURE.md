# 02 — Architecture

## Overview
```text
Phone/Desktop PWA (Nuxt/Vue, SSR first paint)
   │  supabase-js (user JWT)  ──────────────►  Supabase: Postgres + RLS, Auth, Storage, Realtime
   │  fetch /api/*  ─► Nuxt server routes (Vercel) ─ user-context client ─►  Supabase
Supabase pg_cron ─ pg_net HTTP POST (secret) ─► /api/cron/reminders ─ service role + web-push ─► push services ─► Service worker
```

## Frontend vs server responsibilities
**Direct supabase-js from the browser (RLS-protected):** simple CRUD — tasks, categories/rooms, files metadata, shopping items/sections, subscriptions, profile prefs, signed URLs. Fast and no boilerplate routes.
**Nuxt server routes (`server/api/`)**, only where logic or secrets are needed:
- `POST /api/tasks/[id]/complete` — computes next due date (shared pure TS function), calls the `complete_task` RPC (atomic: insert completion + advance/close task).
- `DELETE /api/files/[id]` — remove storage object then row.
- `POST /api/push/test` — send a test notification to caller's devices.
- `POST /api/cron/reminders` — scheduler target (service role, secret-protected).
Rule: a route never bypasses RLS except the cron route.

## Code layout (to be created in Phase 0)
`app/` pages (`tasks.vue`, `files.vue`, `shopping.vue`, `notifications.vue`, `login.vue`, `onboarding.vue`), `app/components/ui/` (shadcn), `app/components/<feature>/`, `app/composables/` (`useTasks`, `useShopping`…), `shared/` (pure logic: recurrence, validation — used by server and client), `server/api/`, `server/utils/`, `supabase/migrations/`, `supabase/tests/`, `tests/`.

## Auth & authorization
See 04-AUTHORIZATION.md. SSR session via cookies; global middleware gates routes (login → onboarding → app).

## Database
Plain SQL migrations in `supabase/migrations` (committed). Types generated with `supabase gen types` into `types/database.types.ts`; all Supabase access goes through the typed supabase-js SDK (`SupabaseClient<Database>`), including RPCs, storage and realtime. See 03.

## Storage
Files are stored in *Supabase Storage* (no separate file service). One *private* bucket (objects are not reachable by a public URL); the app displays/downloads files through short-lived *signed URLs*, requested via supabase-js under the user's JWT. Storage RLS policies allow access only when the object path starts with ⁠ <household_id>/ ⁠ of a household the user belongs to. The bucket enforces size and MIME-type limits. Metadata lives in the ⁠ files ⁠ table; see ⁠ features/FILES.md ⁠

## Notification processing
Hourly pg_cron job → `/api/cron/reminders`. For each active recurring task with a due date, per candidate recipient: compute `remind_at = due_date − (task.remind_days_before ?? profile.reminder_days_before)` at `profile.reminder_hour` in household timezone; if now ≥ remind_at and not overdue-by-more-than-grace, and no `reminder_log` row for `(task, user, due_date)` → insert log row (claim, `on conflict do nothing`) then send to all of the user's subscriptions; update status; delete subscriptions on 404/410. Claiming first guarantees no duplicates even with overlapping runs (a crash after claim loses one reminder rather than duplicating — acceptable). Recipients: assignee if set; else all members; private tasks: creator only. Editing a task/recurrence simply changes `due_date`/override, so the next run does the right thing.

## PWA strategy
Phase 0: manifest + icons, our own SW (`service-worker/sw.ts`, `buildSW` strategy, D20) with precache of app shell only. Never cache `/api/*` or Supabase responses in v1. Push + notification click (opens `/tasks?task=<id>`) added in Phase 4. Offline data features are Phase 5, optional.

## Realtime (shopping only)
Subscribe to postgres_changes on `shopping_items`/`shopping_sections` filtered by `list_id`; apply events to local state; also refetch on tab focus as a safety net. Local mutations are optimistic.

## Environments
`dev` (local Supabase stack via CLI + `nuxt dev`), `prod` (hosted Supabase project + Vercel production). Optionally a preview Supabase project later. Secrets in host env vars; `.env.example` committed, `.env` ignored.
