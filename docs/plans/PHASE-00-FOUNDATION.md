# Phase 0: Foundation

Status: Not Started

## Goal
A secure, deployed skeleton: authentication, household create/join, private/shared RLS proven on `notes`, responsive navigation with four placeholder routes, tests and CI.

## Dependencies
Approval of docs 01–04 and decisions D11–D17 in 07-DECISIONS.md (only Q7 remains open, resolved by FOUNDATION-011).

## Deliverables
Deployed Nuxt 4 app; Supabase prod + local; migrations for `profiles`, `households`, `household_members`, `notes`, helper functions; RLS test harness; CI.

## Implementation
- [x] FOUNDATION-001: Initialize Nuxt 4 + TypeScript, pin Node version (npm, see D18), ESLint, `.env.example`, `.gitignore`, git repo
- [x] FOUNDATION-002: Tailwind v4 (`@tailwindcss/vite`) + shadcn-nuxt; add base components (Button, Input, Drawer, Dialog, Select, Sonner)
- [x] FOUNDATION-003: Supabase CLI init, local stack, `@nuxtjs/supabase` config, `npm run db:types` script generating `types/database.types.ts`, typed `Database` client wiring (browser + server), CI check that types are up to date
- [x] FOUNDATION-004: Migration — `profiles` (+ signup trigger), `households`, `household_members` (unique user_id), `private.is_member()`
- [ ] FOUNDATION-005: Migration — RPCs `create_household` (seeds nothing task/file-specific yet except household row, membership; seed hooks added in later phases) and `join_household`
- [ ] FOUNDATION-006: Migration — `notes` table + RLS (private/shared)
- [ ] FOUNDATION-007: RLS test harness (Vitest, JWT-scoped clients for users A1/A2/B1) + tests for household isolation, notes private/shared, join rules
- [ ] FOUNDATION-008: Auth pages (`/login`, signup) + route middleware (login → onboarding → app)
- [ ] FOUNDATION-009: Onboarding: create household (name, timezone) / join by invite code or `/join/<code>` link; show/copy/share invite code and link
- [ ] FOUNDATION-010: AppShell: mobile bottom bar (safe-area) + desktop sidebar; `/` → `/tasks`; four placeholder pages
- [ ] FOUNDATION-011: PWA spike: `@vite-pwa/nuxt` with `injectManifest` on Nuxt 4 (manifest, icons, minimal SW); record outcome in 07-DECISIONS.md
- [ ] FOUNDATION-012: Playwright smoke test (signup → create household → navigate four routes)
- [ ] FOUNDATION-013: GitHub Actions CI (typecheck, lint, vitest with local Supabase, build)
- [ ] FOUNDATION-015: Auth config: email+password only, **disable "Confirm email"** (no emails sent), set site URL/redirects; decide on disabling public signups after both accounts exist; document manual password reset via dashboard
- [ ] FOUNDATION-016: Hebrew content support: `dir="auto"` on shared input/text components, Hebrew-capable font fallback, verify Hebrew text entry/display and mixed Hebrew/English in a basic test
- [ ] FOUNDATION-014: Production: Supabase prod project, Vercel project, env vars, apply migrations, first deploy

## Acceptance Criteria
- [ ] User can sign up, log in with email and password (no emails sent), log out
- [ ] Hebrew text can be entered and displays correctly in user-content fields
- [ ] Household can be created; another user can join with invite code
- [ ] Cross-household isolation and private/shared notes rules verified by automated tests
- [ ] Four routes render; responsive navigation works on phone and desktop widths
- [ ] Production deployment reachable over HTTPS (free-tier pause/backup behaviour documented, D12)
- [ ] CI green

## Verification
Run `npm run typecheck && npm run lint && npm test && npm run build`; run Playwright smoke; manual check on a real phone; confirm service role key absent from client bundle (grep build output).

## Definition of Done
All tasks checked after verification, acceptance criteria met, docs updated to match reality, deployed.
