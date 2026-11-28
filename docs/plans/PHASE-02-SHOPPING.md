# Phase 2: Shopping

Status: In Progress

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
- [ ] SHOP-007: Inline edit/delete items ("clear completed" dropped: ticking deletes, D22)
- [ ] SHOP-008: Reorder items/sections and move between sections
- [ ] SHOP-009: Realtime subscription + refetch-on-focus; reconcile own echoes
- [ ] SHOP-010: Playwright (rapid entry, two-context sync) + mobile check
- [ ] SHOP-011: Deploy

## Acceptance Criteria
- [ ] Adding many items is fast with input staying focused
- [ ] Custom sections work; ticked items leave instantly (with undo)
- [ ] Changes persist after refresh
- [ ] Both members see the same list; concurrent changes converge predictably

## Verification
Unit/RLS/e2e; typecheck/lint/build; real-phone test in a store-like scenario.

## Definition of Done
Tasks verified and checked; docs updated; deployed.
