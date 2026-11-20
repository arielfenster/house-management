# AGENTS.md — Permanent Project Instructions

Household management app. Read this first, then the relevant `plans/PHASE-*.md` and `docs/features/*.md`.

## Stack
Nuxt 4, Vue 3, TypeScript, Tailwind v4, shadcn-vue, Supabase (Postgres, Auth, Storage, RLS, Realtime), @vite-pwa/nuxt (injectManifest), web-push, Vitest, Playwright. Details: `docs/01-TECH-STACK.md`. Do not add dependencies without need; log significant ones in `docs/07-DECISIONS.md`.

## Architecture
Direct supabase-js CRUD under RLS; Nuxt server routes only for logic/secrets (`docs/02-ARCHITECTURE.md`). Pure logic in `shared/`. Migrations only in `supabase/migrations`, committed. Always use the typed supabase-js SDK (`SupabaseClient<Database>` from generated `types/database.types.ts`); regenerate types after every migration; no `any`/untyped queries.

## Security (non-negotiable)
- RLS is the authorization boundary; never rely on frontend filtering.
- Service role key is server-only and used only where `docs/04-AUTHORIZATION.md` allows.
- Every new table: RLS enabled + tests. Private files bucket + signed URLs.
- Validate server input and forms with valibot (schemas in `shared/`). No secrets in the repo or client bundle.

## Conventions
TypeScript strict; files `kebab-case`, components `PascalCase`, composables `useX`; DB tables/columns `snake_case`; dates are `date` (local calendar) unless an instant is needed; categories/groups are never DB enums.

## UI/UX
UI is English/LTR. User content may be Hebrew: put `dir="auto"` on inputs and user-content text.
Mobile-first, speed first, compact lists, bottom sheets, creatable selects, optimistic updates, undo over confirm. See `docs/05-UI-UX-GUIDELINES.md`.

## Workflow (one task at a time)
1. Read this file, the phase plan and feature spec; inspect existing code.
2. Implement only the selected task; no unrelated refactors; no scope expansion without approval.
3. Verify: relevant tests, typecheck, lint, build (when appropriate), authorization review. Never claim checks passed without running them.
4. Tick the checkbox in the phase plan only after verification; record significant decisions in `docs/07-DECISIONS.md`.
5. Summarize and stop before the next task. Commit with the task ID (e.g. `TASKS-004: recurrence logic`).

## Definition of done
Acceptance criteria met, tests/typecheck/lint pass, authorization considered, docs match the implementation, phase checklist updated.

## Documentation rules
Phase plans are the only progress tracker — no extra backlog/status files. Update docs when implementation diverges from them.
