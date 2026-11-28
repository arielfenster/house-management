# 03 — Database Schema

Status: **Approved**; implemented phase by phase (Phase 0: profiles, households, members, notes; Phase 1: task tables). Implementation notes below record where the migrations refine this design.
All tables live in `public`, have RLS enabled, and use `uuid` PKs (`gen_random_uuid()`) and `timestamptz` timestamps.

## Diagram

```text
auth.users ─1:1─ profiles
    │
    └─< household_members >─ households ─┬─< task_categories
          (user_id unique*)              ├─< rooms
                                         ├─< file_groups ─< files
                                         ├─< notes
                                         ├─< tasks ─< task_completions
                                         ├─< shopping_lists ─< shopping_sections ─< shopping_items
auth.users ─< push_subscriptions         └─ (timezone lives on households)
tasks + users ─< reminder_log
```
\* `unique(user_id)` enforces one household per user for now; dropping it later is a cheap migration.

## Tables

### profiles
Purpose: display name + per-user notification defaults. Needed because `auth.users` is not readable from the client and members must see each other's names (task assignment).
| Column | Notes |
|---|---|
| id uuid PK → auth.users(id) on delete cascade | |
| display_name text not null | |
| reminder_days_before int not null default 1 | default reminder timing (check 0..60) |
| reminder_hour int not null default 9 | local hour (household timezone) to deliver, check 0..23 |
| notifications_enabled bool not null default true | master switch |
Created by a trigger on `auth.users` insert (name from metadata or email prefix). No email copy (avoid duplicating auth data).

### households
`id`, `name` not null, `timezone` text not null default `'UTC'` (IANA name, set at creation from browser), `invite_code` text unique not null (random, rotatable), `created_at`.

### household_members
`household_id` → households (cascade), `user_id` → auth.users (cascade), `joined_at`. PK `(household_id, user_id)`; **unique `(user_id)`** (one household per user, see decisions). No roles column: all members equal.

### task_categories / rooms / file_groups
Same shape, separate tables (different future behavior; trivial cost): `id`, `household_id` (cascade), `name` not null (1–50 chars), `created_at`, **unique `(household_id, lower(name))`**, plus `unique (id, household_id)` as the target of composite foreign keys (a task can only reference its own household's values).
Implemented for task_categories/rooms in TASKS-001: defaults are Cleaning/Maintenance/General and Kitchen/Bathroom/Living room/Bedroom/Balcony, inserted by `private.seed_task_lists` from `create_household`; households created earlier were backfilled by the migration.
Household-scoped, **no system rows**: defaults (Cleaning/Maintenance/General; Kitchen/Bathroom/…; Manuals/Receipts/General files) are copied in by the `create_household` function. "Built-in" protection is a UI nicety only (optional `is_default` bool is NOT included; add later if needed). Deleting a value: `on delete set null` on referencing columns — except `files.group_id`, see below.

### notes (foundation only, no UI)
`id`, `household_id`, `created_by` → auth.users, `visibility` text not null default `'private'` check in (`'private'`,`'shared'`), `title` not null default `''`, `content` not null default `''`, `created_at`, `updated_at`.

### tasks
| Column | Notes |
|---|---|
| id, household_id, created_by | created_by → auth.users |
| visibility | `'private'`/`'shared'`, default `'shared'` |
| assigned_to uuid null → auth.users | nullable = unassigned. Must be a household member (trigger). Private tasks: null or creator only |
| title text not null, description text null | |
| kind text not null | check in (`'one_time'`,`'recurring'`) |
| category_id, room_id null | → set null on delete |
| due_date date null | **local calendar date**. One-time: optional. Recurring: *next due date*, required |
| recurrence_unit text null, recurrence_interval int null | check (`day`,`week`,`month`,`year`), interval ≥ 1; both required iff recurring. "Every 3 months" = (month,3). Columns, not JSON/table: simple, constrained, queryable |
| remind_days_before int null | per-task override of profile default; null = use default |
| completed_at timestamptz null | one-time only; null for recurring |
| last_completed_at timestamptz null | recurring: most recent completion (single value, set by `complete_task`; full history is in `task_completions`) |
| created_at, updated_at | |
Constraints: kind/recurrence consistency check; private ⇒ (assigned_to is null or assigned_to = created_by).
Redundant/derivable: `last_completed_at` is stored (D4) for cheap display without a join; it is maintained by `complete_task` and by undo (reset to the previous completion). `due_date` for recurring is technically derivable but is stored: it is the hot filter/sort/notification column and its computation policy (see TASKS.md) must not be re-run on every read.
Indexes: `(household_id, due_date)` where `completed_at is null`; `(assigned_to)`; trigram/ILIKE on title is unnecessary at this scale (seq scan).
Implemented in TASKS-002 with: `created_by` default `auth.uid()`, **on delete set null** (shared tasks survive a deleted account); `category_id`/`room_id` as composite FKs `(x, household_id)` → `(id, household_id)` with `on delete set null (x)`; title 1–200 chars, description ≤ 2000, interval 1–999; assignee-is-member trigger (`assignee_not_member`); members who leave are unassigned by trigger; making a completed one-time task recurring clears `completed_at`; only the creator changes `visibility` (`only_creator_can_change_visibility`); `completed_at`/`last_completed_at` are written only by the RPCs.

### task_completions
`id`, `task_id` → tasks (cascade), `household_id` (denormalized for RLS speed), `completed_by` → auth.users (set null), `completed_at` timestamptz not null default now(), `due_date_at_completion` date null (what it was due; enables history display "done 3 days late"). Index `(task_id, completed_at desc)`. Insert only via `complete_task` RPC; no update; delete only via `uncomplete_task` (undo of the latest completion). Both one-time and recurring completions are recorded (D21).

Implemented in TASKS-002 (`supabase/migrations/*_tasks.sql`): `(task_id, household_id)` → `tasks (id, household_id)` composite FK keeps `household_id` consistent. RPCs: `complete_task(p_task_id, p_expected_due_date, p_next_due_date)` (recurring: expected due date must match — concurrent completion guard — and the next date must be after today in the household timezone) and `uncomplete_task(p_task_id, p_completion_id)`.

### files
`id`, `household_id`, `uploaded_by`, `group_id` null → file_groups **on delete set null** (null displays as "General files"; so deleting a group never loses files), `storage_path` text unique not null (`{household_id}/{id}/{sanitized_name}`), `original_name` not null, `description` text not null default `''`, `mime_type` not null, `size_bytes` bigint not null, `created_at`. Files are household-shared only (no private files; YAGNI). Search: `ILIKE` over `description || original_name`; add `pg_trgm` GIN index only if it gets slow.

### shopping_lists / shopping_sections / shopping_items
- `shopping_lists`: `id`, `household_id`, `name` default `'Shopping'`. One per household created with the household; unique(household_id) *not* enforced so multiple lists remain possible.
- `shopping_sections`: `id`, `list_id` (cascade), `household_id` (denorm for RLS), `name` not null, `position` double precision not null.
- `shopping_items`: `id`, `list_id`, `section_id` null → sections (**set null** — deleting a section moves its items to the end of the top area via a before-delete trigger, D24; originally cascade, D16), `household_id`, `name` not null, `checked` bool default false (unused since D22: ticking deletes the row), `position` double precision, `created_at`.
Ordering: fractional `position` (midpoint between neighbours); renormalize a section when gaps get tiny. Concurrent edits: last-write-wins per row; reorder only writes the moved row.
Index: `(list_id, section_id, position)`.
Implemented in SHOP-001: names are 1–50 chars (lists, sections) / 1–200 (items); items also have `updated_at`. Consistency of the denormalized columns is enforced by composite foreign keys: sections and items reference `shopping_lists (id, household_id)`, and items reference `shopping_sections (id, list_id)` (so an item's section is always in its own list). `household_id`/`list_id` are immutable (column privileges). Clients may supply `id` on insert (optimistic rows keep their id; realtime echoes match by id). The list is inserted by `private.seed_shopping_list` from `create_household`, existing households were backfilled. Clients cannot insert or delete lists in v1 (only rename).

### push_subscriptions
`id`, `user_id` → auth.users (cascade), `endpoint` text unique not null, `p256dh` not null, `auth` not null, `user_agent` null, `created_at`, `last_error_at` null. One row per device. 404/410 from the push service ⇒ row deleted.

### reminder_log
`task_id` (cascade), `user_id` (cascade), `due_date` date, `sent_at`, `status` text (`sent`/`failed`/`expired`), `error` null. **PK `(task_id, user_id, due_date)`** — this *is* duplicate prevention: one reminder per user per task occurrence. If a task's due date changes, a new occurrence key naturally permits a new reminder. Written only by the service role.
There is **no scheduled-notification table**: upcoming reminders (shown on `/notifications`) are computed from tasks + preferences; the cron job recomputes eligibility each run. Fewer moving parts, edits/recurrence changes handled for free.

## RLS summary (details in 04-AUTHORIZATION.md)
Helper `private.is_member(hid uuid)` (security definer, stable, `search_path=''`) checks `household_members`. Tasks/notes: select if `(visibility='private' and created_by=auth.uid()) or (visibility='shared' and is_member(household_id))`. Other household tables: `is_member(household_id)`. `profiles`: self, or co-members. `push_subscriptions`: own rows. `reminder_log`: no client access.

## Migration risks
- Dropping `unique(user_id)` for multi-household needs "active household" selection in UI and in RLS helpers (policies already take household_id explicitly, so low risk).
- Splitting `due_date` semantics if time-of-day tasks are ever added (date → timestamptz).
- Denormalized `household_id` columns must be kept consistent (composite FK or trigger — decide in FOUND schema task).
- Fractional positions need an occasional rebalance routine.
