# 04 — Authorization

## Principles
1. Postgres RLS is the security boundary. Frontend filtering and Nuxt route checks are convenience only.
2. Every access path (browser Supabase client, Nuxt server routes) runs **as the user** (their JWT) so the same RLS applies. The service role is used only in the cron/reminder route and household bootstrap where RLS cannot express the operation; each such use is listed here.
3. The service role key is server-only (`runtimeConfig`, never `public`).
4. No roles/permission hierarchy: a household has equal members.

## Authentication
Supabase Auth (email + password only, email confirmation disabled, no emails sent; magic link/OAuth optional later), cookie-based SSR sessions via `@nuxtjs/supabase`. Route middleware redirects unauthenticated users to `/login`; authenticated users without a household go to `/onboarding` (create household → get invite code; or join with code).

## Household lifecycle (needs privileged functions)
- `create_household(name, timezone)` — `security definer` RPC: inserts household, membership, default categories/rooms/groups, shopping list. Callable by any authenticated user without a household.
- `join_household(invite_code)` — `security definer` RPC: validates code, inserts membership (fails if user already in one). Rate-limit via Supabase Auth limits / simple attempt guard; codes are long random strings (≥ 12 chars).
- Clients cannot insert into `households`/`household_members` directly (no insert policies).

Private-task **UI** is deferred (D15), but the policies below are implemented and tested from Phase 1.

## Policy rules
| Resource | Select | Insert | Update | Delete |
|---|---|---|---|---|
| households | member | RPC only | member (name/timezone) | none (v1) |
| household_members | member of same household | RPC only | none | self (leave) |
| profiles | self or co-member | trigger | self | cascade |
| tasks, notes | creator if private; member if shared | `created_by=auth.uid()` and member; assignee must be member | private: creator; shared: any member; `visibility` change: creator only | same as update |
| task_completions | can see parent task | via `complete_task` RPC (invoker; checks task visibility) | none | can see parent task |
| categories/rooms/file_groups | member | member | member | member |
| files (+storage) | member | member, `uploaded_by=auth.uid()` | member (description/group) | member |
| shopping_* | member | member | member | member |
| push_subscriptions | own | own | own | own |
| reminder_log | none | service role | service role | service role |

**Assignment ≠ access.** `assigned_to` is not consulted by any select policy. Private tasks may only be unassigned or self-assigned (DB check), so an assignee can never be granted access by accident. Shared tasks visible to both members regardless of assignee.

## Storage
Private bucket `household-files`; object path `{household_id}/{file_id}/{name}`. `storage.objects` policies mirror table rules using `(storage.foldername(name))[1]::uuid` and `is_member`. Bucket enforces `file_size_limit` and `allowed_mime_types`. Access to content only through short-lived signed URLs (created as the user, so policies apply). Upload: client uploads directly to storage (policy-checked), then inserts metadata; a failed metadata insert triggers best-effort object removal. Delete: server route removes the object then the row.

## Server-route guidelines
- Use `serverSupabaseClient(event)` (user context) by default. `serverSupabaseServiceRole` only in: `/api/cron/reminders` (authenticated by shared secret header compared in constant time) and nowhere else without an entry in 07-DECISIONS.md.
- Validate all input with valibot; never trust `household_id` from the client for authorization — RLS decides.

## Required automated tests (Vitest against a local Supabase, using real JWT-scoped clients)
Users A1, A2 (household A) and B1 (household B):
1. B1 cannot read/write any A resource (tasks, notes, files metadata, storage objects, shopping, categories, memberships).
2. A1 private task/note invisible to A2; A1 shared task visible/editable by A2.
3. A2 cannot update `visibility` of A1's shared task.
4. Assigning a shared task to A2 keeps it visible to A1; assigning a private task to A2 is rejected.
5. Assigning a task to B1 (non-member) is rejected.
6. A user cannot insert a row with another user's `created_by` or another household's `household_id`.
7. `join_household` with bad code fails; user already in a household cannot join another.
8. Storage: A2 can sign a URL for A1's file; B1 cannot; unauthenticated cannot.
9. `reminder_log` and other users' `push_subscriptions` unreadable by clients.
10. Completion RPC refuses tasks the caller cannot see.
