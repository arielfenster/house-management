# 05 — UI/UX Guidelines

**Speed is the top requirement**: common actions in ≤ 2 taps, no navigation thinking, optimistic updates.

## Hebrew content (D17)
The UI is English/LTR only. User-entered text may be Hebrew: use `dir="auto"` on inputs, textareas and elements rendering user content; use a font stack with Hebrew glyphs; keep list rows tolerant of mixed-direction text (truncate with `text-start`, avoid fixed-direction icon placement inside text).
Implementation (FOUNDATION-016): `FormField` defaults to `dir="auto"` (pass `dir="ltr"` for always-Latin values such as invite codes/links); new shared text components (textarea, list rows) must do the same. Font: system UI stack in `app/assets/css/tailwind.css` (`--font-sans`, no web font) with Hebrew fallbacks. Hebrew/mixed coverage: `e2e/hebrew.spec.ts`.

## Layout & navigation
- Mobile: fixed bottom bar, 4 items (Tasks, Files, Shopping, Notifications), icon + label, clear active state, `padding-bottom: env(safe-area-inset-bottom)`.
- Desktop (≥ md): compact left sidebar, same 4 items; content max-width ~ 720px for lists (not stretched).
- `/` redirects to `/tasks`. No dashboard, no sub-navigation.
- Household & account (name, invite link/code, log out) live in one **account sheet** (`AccountSheet`, a `ResponsiveSheet`), opened from the page header icon on mobile and the sidebar footer on desktop — not a fifth nav item.
- Page header is small (title + 1–2 actions). No oversized headings.

## Visual style
Compact list rows (min 44px touch target) inside one rounded, bordered list box (`border-foreground/20`, `shadow-xs`) with 1px dividers between rows (`border-foreground/10`) — not a card per row; rows get a muted background on hover (hover-capable devices only); form labels are block-level with 8px (`space-y-2`) above their field; one neutral palette + one accent, system UI font (Hebrew-capable, no web font), consistent type scale (sm body, xs meta). Light + dark via Tailwind tokens (shadcn theme variables). Muted style for completed items.

## Interaction patterns
- **Forms:** Drawer (bottom sheet) on mobile, Dialog on desktop — one shared `ResponsiveSheet` component. Autofocus first field; Enter submits.
- **Creatable select** (`CreatableSelect` component): searchable list + "Add new…" row; creating shows a tiny inline input/dialog without leaving the form and **auto-selects the new value**. Used for category, room, file group. Optional fields allow "None". Implemented in TASKS-008 as an inline panel below the field (works inside bottom sheets); values are renamed/deleted from a pencil button per row; Esc closes only the panel.
- **Inline editing:** shopping items, task title where practical.
- **Feedback:** toast for success/error with undo for destructive actions (prefer undo over confirmation dialogs). Skeletons for loading, short helpful empty states.
- **Optimistic UI** for check/uncheck, add, reorder; roll back + toast on failure.
- **Keyboard:** all controls reachable; `Esc` closes sheets; `/` or `Ctrl+K` focuses search on desktop.
- **Accessibility:** semantic elements, visible focus, labels on icon buttons, contrast ≥ WCAG AA, respects reduced motion.

## Shared components (built in Phase 0/1 as needed, not all up front)
`AppShell` (nav), `ResponsiveSheet`, `CreatableSelect`, `ListRow`, `EmptyState`, `ConfirmUndoToast`, `SearchInput`.

## Test data
Use realistic household examples in fixtures/mockups: "Clean AC filters" (every 3 months), "Water plants" (weekly), "Prepare balcony for winter" (yearly), "Fix bathroom faucet" (one-time), shopping sections Produce/Dairy/Household, files "Dishwasher manual", "Boiler warranty receipt".
