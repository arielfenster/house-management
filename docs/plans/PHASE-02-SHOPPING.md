# Phase 2: Shopping

Status: Implemented and deployed (2026-11-28); real-phone store test pending

## Goal
A fast shared shopping list useful in the supermarket.

## Dependencies
Phase 0 done (Phase 1 not required). Q8 decided.

## Deliverables
Shopping tables + RLS, realtime sync, `/shopping` UI.
	
## Implementation
- [x] SHOP-001: Migration — `shopping_lists`, `shopping_sections`, `shopping_items`, indexes; list created in `create_household` (+ backfill)
- [x] SHOP-002: RLS + tests (member vs non-member)
- [x] SHOP-003: Position utilities (midpoint, rebalance) + unit tests; paste-parsing util + tests
- [x] SHOP-004: Page with sections/items rendering, check/uncheck (optimistic)
- [x] SHOP-005: Fast-entry input (Enter adds, stays focused, target section, multi-line paste)
- [x] SHOP-006: Section create/rename/delete (undo)
- [x] SHOP-007: Inline edit/delete items ("clear completed" dropped: ticking deletes, D22)
- [x] SHOP-008: Reorder items/sections and move between sections
- [ ] SHOP-008a: Inline "+ Add an item" row at the end of each section (and the top area): tap → input in place; Enter adds to the end of that section and keeps focus; multi-line paste adds all lines there; Esc / empty blur closes. Functionality only — keep current styling; hidden in reorder mode
- [x] SHOP-009: Realtime subscription + refetch-on-focus; reconcile own echoes
- [x] SHOP-010: Playwright (rapid entry, two-context sync) + mobile check
- [x] SHOP-011: Deploy — both migrations applied to prod (SHOP-001, SHOP-009); `main` auto-deploys on Vercel; live build verified

## Acceptance Criteria
- [x] Adding many items is fast with input staying focused
- [x] Custom sections work; ticked items leave instantly (with undo)
- [x] Changes persist after refresh
- [x] Both members see the same list; concurrent changes converge predictably

## Verification
Unit/RLS/e2e; typecheck/lint/build; real-phone test in a store-like scenario.

Status: unit, RLS and e2e (phone + desktop projects, incl. two-member realtime) pass; typecheck/lint/build pass. Remaining: the real-phone test in a store-like scenario (touch drag in Arrange mode, keyboard behaviour of the add bar).

## Definition of Done
Tasks verified and checked; docs updated; deployed.
