# Phase 4: Notifications

Status: Not Started

## Goal
Push reminders before recurring tasks are due, working with the app closed.

## Dependencies
Phase 1 done; PWA/SW foundation from FOUNDATION-011; Q1 settled; Supabase plan supports pg_cron/pg_net.

## Deliverables
Subscription + preference storage, reminder job, push delivery, `/notifications` UI.

## Implementation
- [ ] NOTIF-001: Migration — `push_subscriptions`, `reminder_log`, profile prefs columns usage, RLS
- [ ] NOTIF-002: Generate VAPID keys; env config; service worker push + notificationclick (opens `/tasks?task=<id>`) in `service-worker/sw.ts` (D20)
- [ ] NOTIF-003: Subscribe/unsubscribe composable + status detection (denied/unsupported/iOS-not-installed)
- [ ] NOTIF-004: `/notifications` page: toggle, status, defaults, test push
- [ ] NOTIF-005: Per-task reminder override field in task form
- [ ] NOTIF-006: Pure eligibility function (tz/hour/offset/recipients) + unit tests
- [ ] NOTIF-007: `/api/cron/reminders` (secret auth, claim-then-send, cleanup of 404/410) + tests with mocked web-push
- [ ] NOTIF-008: pg_cron + pg_net hourly job with Vault-stored secret; log-table cleanup job
- [ ] NOTIF-009: Upcoming-reminders list (computed)
- [ ] NOTIF-010: Real-device verification (Android + installed iOS PWA) with app closed
- [ ] NOTIF-011: Deploy

## Acceptance Criteria
- [ ] Users can enable notifications and register devices
- [ ] Upcoming recurring tasks trigger reminders; per-task timing works
- [ ] No duplicate reminders (concurrent runs tested)
- [ ] Works with no open tab
- [ ] Failed/unsupported subscriptions handled

## Verification
Unit/integration tests, manual device checks, typecheck/lint/build, review that the cron route is the only service-role path.

## Definition of Done
Verified, checked, docs updated, deployed.
