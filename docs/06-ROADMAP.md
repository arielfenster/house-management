# 06 — Roadmap

Small vertical slices, each deployed when usable. Checkbox progress lives **only** in `docs/plans/PHASE-*.md`.

| Phase | Goal | Plan | Usable output |
|---|---|---|---|
| 0 Foundation | Secure deployed skeleton: auth, household create/join, notes table + RLS proof, nav, 4 placeholder routes, CI, deploy | PHASE-00 | Login + household on production |
| 1 Tasks | Create/complete one-time & recurring tasks, categories/rooms, history, search; shared tasks (private-task DB support, no UI) | PHASE-01 | Daily-use task list |
| 2 Shopping | Fast shared list with sections, reorder, realtime | PHASE-02 | Use in the supermarket |
| 3 Files | Upload/camera, groups, search, preview, delete | PHASE-03 | Receipts & manuals stored |
| 4 Notifications | Push subscriptions, preferences, hourly reminder job, dedup | PHASE-04 | Reminders before due dates |
| 5 PWA & Polish | Install polish, empty/loading/error states, a11y, e2e, optional offline | PHASE-05 | Installable app |

## Changes from the original roadmap
- Tasks tables are created in Phase 1 (not 0); Phase 0 proves RLS on `notes` and the household model.
- Order kept (Tasks → Shopping → Files → Notifications → PWA). Shopping before Files because it has the highest everyday value and no storage complexity.
- A manifest + basic installable PWA is done in Phase 0 (cheap), full polish in Phase 5.

## Recommended removals / deferrals for v1
- Offline shopping/task sync (stay optional in Phase 5).
- "Completed" filter paging and any history analytics — plain list per task is enough.
- Multi-household switching UI (schema-ready only).
- Private-task **UI** (the "Private" toggle) — deferred by decision D15; DB/RLS support still built and tested.
- Original-schedule recurrence option (completion-based only for now).
- Realtime for anything but shopping.
