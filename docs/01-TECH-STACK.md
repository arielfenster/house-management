# 01 — Tech Stack Assessment

Verified by web search on 2026-11-20 against official docs/community sources; **re-verify versions at install time** (Phase 0) and pin them.

| Area | Choice | Assessment |
|---|---|---|
| Framework | Nuxt 4 + Vue 3 + TS | Keep. SSR + client nav. |
| Styling | Tailwind CSS v4 via `@tailwindcss/vite` | Keep. v4 uses the Vite plugin, not the old module. |
| Components | shadcn-vue via `shadcn-nuxt` (Reka UI) | Keep. Follow the *current* shadcn-vue Nuxt + Tailwind v4 install page; needs `tw-animate-css`. Gives Drawer (bottom sheet) / Dialog / Select / Command. |
| Supabase integration | `@nuxtjs/supabase` v2.x | Keep. v2 line supports Nuxt 4. Open issue reports around `serverSupabaseServiceRole` on some Node/OS combos — check when pinning Node (use current LTS). |
| DB/Auth/Storage/RLS/migrations | Supabase | Keep. Use Supabase CLI + local stack for migrations and RLS tests. |
| PWA | `@vite-pwa/nuxt` (v2) | Keep. Uses the **`buildSW`** strategy with our own `service-worker/sw.ts` for push handling (generateSW would overwrite push code; v2 rejects `injectManifest` with a TypeScript SW). Confirmed on Nuxt 4 by the FOUNDATION-011 spike (D20). |
| Push | `web-push` npm lib + VAPID keys, in a Nuxt server route | Keep. iOS requires the PWA to be installed to home screen (iOS 16.4+). |
| Validation | `valibot` | Add (small, tree-shakeable) for server-route input and forms; schemas live in `shared/` and types are inferred with `v.InferOutput`. |
| Typed data access | `supabase-js` + generated `Database` types | Always use the SDK (no raw `fetch`/hand-written SQL strings from the app). Generate `types/database.types.ts` with `supabase gen types typescript --local`, and type every client as `SupabaseClient<Database>` (`@nuxtjs/supabase` accepts the `Database` generic via `useSupabaseClient<Database>()` / `serverSupabaseClient<Database>(event)`). RPCs (`create_household`, `complete_task`, …) are called with `supabase.rpc()` and are typed from the same generated file. |
| Recurrence date math | Hand-written pure TS (date-only, ~40 lines) with tests; no library | Avoids Luxon/dayjs dependency; household timezone needed only to compute "today". Revisit if it grows. |
| Tests | Vitest (unit + DB integration), Playwright (e2e) | Keep. |
| Lint/format | ESLint (`@nuxt/eslint`) + Prettier-compatible stylistic rules | Add; part of "checks". |
| CI | GitHub Actions: typecheck, lint, vitest, build; (RLS tests with `supabase start`) | Add in Phase 0. |

## Not adding
Prisma/Drizzle, Redis, separate backend, Pinia (use Nuxt `useState`/composables + `useAsyncData`), search engine, offline sync framework. Generated DB types come from `supabase gen types` and are regenerated after every migration; CI fails if `types/database.types.ts` is out of date.

## Proposed changes vs. the spec
1. **Tasks schema moves from Phase 0 to Phase 1.** Phase 0 builds households/profiles/membership + the `notes` table (already mandated) and proves the private/shared RLS pattern on notes. Avoids schema churn ("finalize task schema" is already a Phase 1 item).
2. **Scheduler = Supabase `pg_cron` + `pg_net` hitting a secured Nuxt route**, not host-native cron (see 08-DEPLOYMENT.md).
3. **No scheduled-reminders table** (computed instead; see schema).
4. **Realtime**: use Supabase Realtime only for `shopping_items`/`sections`; everything else refetches on focus/mutation.
5. **Supabase free tier only (D12)**: projects can be paused after inactivity, no automatic backups, quota limits; mitigations in 07-DECISIONS.md and 08-DEPLOYMENT.md.
