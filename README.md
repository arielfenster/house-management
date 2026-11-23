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
