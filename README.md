# House Management

Mobile-first app for managing a household: tasks & routines, files, shared shopping list, and push reminders.

**Status:** planning complete, awaiting review — no application code yet.

- Start with `docs/00-PROJECT-OVERVIEW.md`
- Rules for AI agents: `AGENTS.md`
- Progress and tasks: `docs/plans/PHASE-*.md`
- Open decisions: `docs/07-DECISIONS.md`

## Local development
Needs Node 22 (`nvm use`) and Docker running.
```bash
npm install
npm run db:start          # local Supabase (Postgres, Auth, Storage)
npx supabase status -o env   # copy URL / publishable / secret keys into .env (see .env.example)
npm run db:types          # regenerate types/database.types.ts after every migration
npm run dev
```

### Tests
```bash
npm test             # Vitest; RLS tests run against the local stack (npm run db:start first)
npm run typecheck    # Nuxt app + tests/scripts (tsconfig.tests.json)
npm run test:e2e     # Playwright smoke (e2e/): builds + previews the app on :3100, phone and desktop projects
```
RLS tests (`supabase/tests/rls/`) sign in real users and query through the API, so they exercise the same policies as the browser. They create uniquely named users/households and clean up after themselves; keys come from `.env` or `supabase status`.
E2E tests need the local stack too and a one-time `npx playwright install chromium`; set `E2E_BASE_URL=http://localhost:3000` to run them against `npm run dev` instead of a fresh build. Each test signs up its own user and deletes it afterwards.

CI (`.github/workflows/ci.yml`) runs all of the above on every push to `main` and every PR, plus `npm run build` and a check that the secret key is not in the client bundle.
