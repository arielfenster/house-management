# Feature: Shopping Lists (`/shopping`)

## 1. Purpose
A notes-like shared checklist optimized for use on a phone in a supermarket.

## 2. Scope
One shared list per household (schema allows more); sections (visual headings); items; add, tick off (removes the item, D22), edit, delete, create/rename/delete/reorder sections, reorder items, move items between sections; multi-line paste; near-real-time sync.

## 3. Out of scope
Prices, quantities, inventory, product DB, barcodes, store integrations, analytics, images.

## 4. User stories
- I type "milk", Enter, "cheese", Enter — the input stays focused.
- I paste 10 lines and get 10 items.
- Another household member adds eggs at home and I see it while shopping.
- I tick items as I walk through Produce.

## 5. Main interactions
Persistent add input at top (or bottom on mobile) targeting the *current section* (selectable chip, defaults to the last used). Enter adds + keeps focus. Pasted multi-line text → one item per non-empty line. "New section" inline input. Long-press/handle drag to reorder; item menu → move to section. Ticking an item removes it (D22).

Implemented (SHOP-005): the add bar is sticky at the top on all sizes (a bottom bar fights the phone keyboard). The section chip is a native select, remembered per device (localStorage; a deleted section falls back to "No section"). Items are appended to the end of the chosen section. Pasting several lines adds them at once; list markers (`- `, `• `, `1. `, `[ ]`) are stripped. A failed single add puts the text back in the input; a failed paste shows a toast with Retry.
Sections (SHOP-006): "New section" below the list opens an inline input; the new section is added at the end and becomes the add target. The pencil on a heading turns it into an inline editor (Enter saves, Esc cancels) with a delete button. Names are 1–50 characters and unique per list ignoring case (UI check, `shared/validation/shopping.ts`). Delete hides the section and its items at once and shows an Undo toast; the delete runs when the toast ends (or when the app is backgrounded / the page is left), as for tasks.

Ticking (D22): the check shows for ~300 ms, then the row collapses out and the item is deleted at once (so the other member sees it gone). One toast, "✓ Milk · Undo", is reused by every tick (5 s); Undo re-inserts the latest ticked item with its id, section and position (top area if its section is gone). A failed delete brings the row back with an error toast. There is no checked state and no "Clear completed"; the `checked` column is unused.

## 6. UI behavior
Section = small bold/uppercase heading with subtle separator; items = plain rows with checkbox; ticking shows check + strikethrough briefly, then the row leaves; no cards. Tap target ≥ 44px. Inline edit by tapping text.

## 7. Data requirements
`shopping_lists`, `shopping_sections`, `shopping_items` (fractional `position`) (03).

## 8. Authorization
Household members only (04).

## 9. Concurrency & ordering
Optimistic local update, then write. Realtime events update local state; refetch on focus. Last-write-wins per row. Reordering writes only the moved row's `position` (midpoint of neighbours); positions are renormalized when gap < 1e-6. Two members ticking the same item both delete it (the second delete matches nothing). Realtime echo of own writes is ignored by id/version.

## 10. Edge cases
Deleting a section deletes its items (undo toast) [Q8]. Items without a section go to an implicit top area. Empty/whitespace lines ignored on paste. Offline: show error toast and keep the text in the input (no queueing in v1). Very long lists render without pagination (small scale).

## 11. Acceptance criteria
Rapid consecutive entry works; custom sections; ticking removes instantly (with Undo); persists after refresh; both members see the same list; concurrent edits converge predictably.

## 12. Verification
Vitest: position/rebalance logic, paste parsing, RLS. Playwright: add multiple items, tick off + undo, reorder; two-context test for sync.
