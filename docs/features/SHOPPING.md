# Feature: Shopping Lists (`/shopping`)

## 1. Purpose
A notes-like shared checklist optimized for use on a phone in a supermarket.

## 2. Scope
One shared list per household (schema allows more); sections (visual headings); items; add, check/uncheck, edit, delete, create/rename/delete/reorder sections, reorder items, move items between sections, clear completed; multi-line paste; near-real-time sync.

## 3. Out of scope
Prices, quantities, inventory, product DB, barcodes, store integrations, analytics, images.

## 4. User stories
- I type "milk", Enter, "cheese", Enter — the input stays focused.
- I paste 10 lines and get 10 items.
- Another household member adds eggs at home and I see it while shopping.
- I tick items as I walk through Produce.

## 5. Main interactions
Persistent add input at top (or bottom on mobile) targeting the *current section* (selectable chip, defaults to the last used). Enter adds + keeps focus. Pasted multi-line text → one item per non-empty line.
Implemented (SHOP-005): the add bar is sticky at the top on all sizes (a bottom bar fights the phone keyboard). The section chip is a native select, remembered per device (localStorage; a deleted section falls back to "No section"). Items are appended to the end of the chosen section. Pasting several lines adds them at once; list markers (`- `, `• `, `1. `, `[ ]`) are stripped. A failed single add puts the text back in the input; a failed paste shows a toast with Retry. "New section" inline input. Long-press/handle drag to reorder; item menu → move to section. "Clear completed" button.

## 6. UI behavior
Section = small bold/uppercase heading with subtle separator; items = plain rows with checkbox; checked = muted + strikethrough and remain in place; no cards. Tap target ≥ 44px. Inline edit by tapping text.

## 7. Data requirements
`shopping_lists`, `shopping_sections`, `shopping_items` (fractional `position`) (03).

## 8. Authorization
Household members only (04).

## 9. Concurrency & ordering
Optimistic local update, then write. Realtime events update local state; refetch on focus. Last-write-wins per row. Reordering writes only the moved row's `position` (midpoint of neighbours); positions are renormalized when gap < 1e-6. Two members checking the same item converge to the last write. Realtime echo of own writes is ignored by id/version.

## 10. Edge cases
Deleting a section deletes its items (undo toast) [Q8]. Items without a section go to an implicit top area. Empty/whitespace lines ignored on paste. Offline: show error toast and keep the text in the input (no queueing in v1). Very long lists render without pagination (small scale).

## 11. Acceptance criteria
Rapid consecutive entry works; custom sections; instant check; persists after refresh; both members see the same list; concurrent edits converge predictably.

## 12. Verification
Vitest: position/rebalance logic, paste parsing, RLS. Playwright: add multiple items, check, clear completed, reorder; two-context test for sync.
