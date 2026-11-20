# Feature: Notifications (`/notifications`)

## 1. Purpose
Push reminders before recurring tasks become due, even when the app is closed.

## 2. Scope
Enable/disable push; register current device; subscription status; default reminder timing (days before + hour); per-task override; list of upcoming reminders; push delivery with click-through to the task. One type: `RECURRING_TASK_UPCOMING`.

## 3. Out of scope
Inbox/history UI, analytics, email/SMS, rules engine, other notification types, one-time-task reminders.

## 4. User stories
- I enable notifications on my phone and get "Clean AC filters — due in 7 days".
- I set my default to 3 days before at 9:00 and override one task to 14 days.
- Tapping the notification opens that task.

## 5. Main interactions
Toggle "Notifications on this device" (permission prompt → subscribe → store). Status line: Enabled / Blocked in browser / Not supported / (iOS: install to home screen first). Defaults form (days before, hour). "Send test". Upcoming list: next reminders computed from tasks.

## 6. UI behavior
Single compact page, plain controls, explanatory text for blocked/unsupported states. Per-task override lives in the task form (field "Remind me" with Default / N days before).

## 7. Data requirements
`push_subscriptions`, `profiles` (defaults), `tasks.remind_days_before`, `reminder_log` (03). No scheduled-notification table.

## 8. Authorization
Users manage only their own subscriptions/preferences. `reminder_log` is service-role only. Recipients: assignee, else all members (shared); creator only (private).

## 9. Scheduling & dedup
Hourly job `POST /api/cron/reminders` (secret header). Per recipient/task: remind when `now ≥ (due_date − days) at reminder_hour in household tz`; skip if a log row `(task,user,due_date)` exists; insert claim row first, then send. Overdue tasks past the reminder window are not repeatedly reminded (v1: one reminder per occurrence). 404/410 → delete subscription; other errors → status `failed`, not retried within the same occurrence unless the claim is released (v1: no retry).

## 10. Edge cases
Permission denied/unsupported browser handled gracefully; multiple devices each receive the push; due date edited after reminder sent → new occurrence key allows a new reminder; task completed before reminder time → not eligible; timezone from household; user disables master switch → skipped.

## 11. Acceptance criteria
Enable on device; reminders arrive for upcoming recurring tasks with the app closed; per-task timing respected; no duplicates; dead subscriptions cleaned; click opens task.

## 12. Verification
Vitest: eligibility function (timezone/hour/offset cases), dedup (concurrent claims), subscription cleanup with mocked `web-push`. Manual: real-device push (Android Chrome; iOS installed PWA). Playwright: settings UI states.
