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

### Demo data
`npm run db:seed-demo` fills the **local** stack (it refuses any other database) with a demo household, "Our home", for looking at the UI. Re-running resets it.
- Two members who can both log in: Ariel `ariel@gmail.com` and Noa `demo2@house.test`, password `demo-password-local`. **Both accounts are deleted and recreated on every run**, with everything in their household.
- About 40 open tasks: overdue, today, this week, months ahead and undated; one-time and repeating (daily to yearly); assigned to Ariel, Noa or nobody; some with notes, long titles or Hebrew titles.
- Extra categories (Garden, Pets, Shopping) and rooms (Laundry, Garage, Kids' room) next to the defaults.
- Completed one-time tasks for the Done tab, and completion history (on time, late, early, by both members) on several repeating tasks.

Edit the `TASKS` list in `scripts/seed-demo.ts` to change what it creates.

### Tests
```bash
npm test             # Vitest; RLS tests run against the local stack (npm run db:start first)
npm run typecheck    # Nuxt app + tests/scripts (tsconfig.tests.json)
npm run test:e2e     # Playwright smoke (e2e/): builds + previews the app on :3100, phone and desktop projects
```
RLS tests (`supabase/tests/rls/`) sign in real users and query through the API, so they exercise the same policies as the browser. They create uniquely named users/households and clean up after themselves; keys come from `.env` or `supabase status`.
E2E tests need the local stack too and a one-time `npx playwright install chromium`; set `E2E_BASE_URL=http://localhost:3000` to run them against `npm run dev` instead of a fresh build. Each test signs up its own user and deletes it afterwards.

CI (`.github/workflows/ci.yml`) runs all of the above on every push to `main` and every PR, plus `npm run build` and a check that the secret key is not in the client bundle.
