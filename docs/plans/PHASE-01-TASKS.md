# Phase 1: Tasks

Status: In Progress

## Goal
Make household task management usable daily.

## Dependencies
Phase 0 done; schema in 03 approved; Decisions D10 (completion-date anchor) and D15 (no private-task UI) apply.

## Deliverables
Tasks tables + RLS, categories/rooms, recurrence module, completion RPC, `/tasks` UI.

## Implementation
- [x] TASKS-001: Migration — `task_categories`, `rooms` (+ seeding in `create_household`, backfill existing households)
- [ ] TASKS-002: Migration — `tasks` (incl. `last_completed_at`), `task_completions`, constraints, indexes, `complete_task` RPC (sets `last_completed_at`)
- [ ] TASKS-003: RLS for tasks/completions/categories/rooms + tests (04 matrix items 1–6, 10)
- [ ] TASKS-004: `shared/recurrence.ts` pure functions + exhaustive unit tests (month-end, leap, early/late, tz "today")
- [ ] TASKS-005: `POST /api/tasks/[id]/complete` route (+ concurrent-completion guard) and undo (restores `due_date` and `last_completed_at`)
- [ ] TASKS-006: Task list UI: rows, due labels, sort, quick add
- [ ] TASKS-007: `ResponsiveSheet` + task create/edit form (type, recurrence, assignee; no private toggle in v1 — D15)
- [ ] TASKS-008: `CreatableSelect` for category and room (create inline, auto-select, rename/delete)
- [ ] TASKS-009: Filters (All/Upcoming/Overdue/Completed + category/room/type) and search
- [ ] TASKS-010: Detail view: last completion (`last_completed_at`) + completion history
- [ ] TASKS-011: Playwright e2e (create, complete recurring, custom category) + mobile viewport check
- [ ] TASKS-012: Deploy

## Acceptance Criteria
- [ ] One-time tasks work
- [ ] Recurring tasks advance correctly per policy
- [ ] Last completion and history viewable
- [ ] Custom categories and rooms work inline
- [ ] Shared tasks work for both users; private-task authorization verified at DB level (no UI)
- [ ] Mobile experience efficient
- [ ] Automated checks pass; production build succeeds

## Verification
Unit + RLS + e2e suites; typecheck/lint/build; manual phone test; review for authorization implications.

## Definition of Done
Tasks checked after verification; 03/TASKS docs updated to the implemented schema; deployed.
