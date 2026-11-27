# Feature: Tasks and Routines (`/tasks`)

## 1. Purpose
Lightweight shared household tasks and recurring routines.

## 2. Scope
One-time and recurring tasks (daily/weekly/monthly/yearly/custom "every N units"); title, description, category, room, due date, assignee, per-task reminder override (setting stored here, delivery in Notifications); complete, edit, delete, search, filter, last completion, completion history; custom categories/rooms created inline.

## 3. Out of scope
Private-task UI (deferred, see below) — Subtasks, dependencies, kanban, priorities, estimates, calendar view, advanced recurrence (weekdays, nth-weekday), complex delegation.

## 4. User stories
- As a household member I tick a task with one tap.
- I create "Clean AC filters" every 3 months, and see when it's due next and when it was last done.
- I assign "Fix faucet" to another member while we both still see it.
- I create a new category from the task form without leaving it.

## 5. Main interactions
Quick add (title field + Enter creates a one-time shared task; "More" opens full sheet). Row tap → detail/edit sheet.
Implemented (TASKS-007, `TaskFormSheet`): title; One-time / Repeats toggle; "Repeat every [N] [days|weeks|months|years]"; due date (required when repeating — defaults to today; labelled "First due" when setting up a repetition and "Next due" when editing one, with a live summary such as "Due tomorrow, then every week after each completion." from `describeSchedule`) with one-tap Today / Tomorrow / In a week and "No date"; assignee ("Anyone" or a member); notes. Validation in `shared/validation/task.ts` (`taskFormSchema`). The "More options" button next to quick add opens the sheet with the typed title. Edit has Delete: the row disappears with an 8-second Undo toast and the actual delete (which removes history) runs when the window ends, or at once if the app goes to the background. The assignee's name shows in the row's meta line. Category and room (TASKS-008) use `CreatableSelect`: an inline panel under the field (no nested popup inside the sheet) with a search box, "None", the household's values and "Add “…”" for new text; Enter picks an exact (case-insensitive) match or creates the value, which is selected automatically. Each value has a pencil button to rename it or delete it (two-step inline confirmation; deleting clears it from tasks, which keep everything else). Names: 1–50 characters, unique per household ignoring case ("That name already exists."). Checkbox → complete. Filters: All / Upcoming / Overdue / Completed + category, room, type chips. Search box over title/description.

## 6. UI behavior
Compact row: checkbox, title, category/room as muted text, due label ("Today", "in 3 d", "3 d overdue" in warning colour).
Implemented (TASKS-006, `shared/task-list.ts`): labels are "N d overdue" (amber), "Today", "Tomorrow", "in N d" up to 13 days, then the date ("Dec 18", with the year when it differs); screen readers get the long form ("Due in 3 days, Tuesday, December 1"). The meta line shows the recurrence ("Every 3 months") then category · room. Ticking shows the check for 250 ms, then the row leaves (one-time) or moves to its next due date (recurring, computed optimistically with the same function as the server); an 8-second toast offers Undo. Quick-added tasks are undated, so they sort to the end. The list refreshes when the app returns to the foreground. Recurring rows show next due and a repeat icon. Detail sheet shows last completed + expandable history (date, who, late/early). Default sort: overdue → due soonest → undated; completed hidden from All (shown in Completed).

## 7. Data requirements
`tasks`, `task_completions`, `task_categories`, `rooms` (see 03-DATABASE-SCHEMA.md).

## 8. Authorization
Per 04: private visible only to creator; shared to household; assignment independent of visibility; private tasks self/unassigned only; visibility changeable only by creator.

## 9. Recurrence semantics (policy — decided, D10)
All dates are **local calendar dates in the household timezone** (`date`, no time-of-day). "Today" = today in that timezone.
- **Completing a recurring task** inserts a `task_completions` row (completed_at = now, `due_date_at_completion`), sets `tasks.last_completed_at = now`, and sets `due_date = addInterval(localCompletionDate, interval)`. (Anchor = completion date (decided).)
- **Early completion:** same rule; the next occurrence counts from the actual completion day.
- **Late completion:** same rule; no back-filling.
- **Missed occurrences:** never generate catch-up instances; a task simply stays overdue until completed once.
- **Month math:** add N months, clamping the day to the target month's last day (Jan 31 + 1 month = Feb 28/29). No drift memory (documented limitation).
- **Yearly:** +12 months; Feb 29 + 1 year = Feb 28 in non-leap years.
- **Weeks/days:** +7N / +N days. DST irrelevant because dates, not instants.
- **Editing recurrence/due date:** takes effect immediately; history untouched.
- **One-time completion:** `completed_at` set; "uncomplete" clears it. Undo of a recurring completion deletes the completion row, restores the previous `due_date` (from `due_date_at_completion`) and resets `last_completed_at` to the previous completion's `completed_at` (or null).
Implemented as pure functions in `shared/recurrence.ts`, exhaustively unit-tested.

## Deferred (not in v1 UI)
- **Private tasks:** a "Private" toggle in the task form so a task is visible only to its creator. The schema, RLS and tests already support it (`visibility`, private-assignment rule); only the UI is deferred. UI-created tasks are always `shared` in v1.
- Option to keep the original schedule instead of completion-based due dates.

## 10. Edge cases
Deleting a category/room clears references. Deleting a task deletes its history (confirm via undo toast). Assignee leaves household → assignment cleared. Task with no due date never appears Overdue. Concurrent completion by both members: second completion within a short window is rejected/merged (RPC checks that task's `due_date` equals the one the client saw).

## 11. Acceptance criteria
- One-time & recurring tasks can be created, edited, deleted, completed.
- Recurring completion advances due date per policy and preserves history; last completion visible.
- Custom category/room creatable inline and auto-selected.
- Shared vs private visibility and assignment rules enforced by DB.
- Filters and search work; mobile flow efficient.

## 12. Verification
Vitest: recurrence table tests (month-end, leap year, early/late, timezone "today"), RLS tests (04 matrix), RPC tests. Playwright: create → complete → verify next due; custom category flow.
