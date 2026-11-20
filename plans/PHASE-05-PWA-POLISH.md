# Phase 5: PWA and Polish

Status: Not Started

## Goal
Smooth, installable everyday mobile experience.

## Dependencies
Phases 0–4.

## Deliverables
Polished PWA, consistent states, accessibility pass, e2e coverage, optional offline.

## Implementation
- [ ] PWA-001: Finalize manifest, icons (maskable), install prompt guidance, theme colours
- [ ] PWA-002: Safe SW caching (app shell only; never API/Supabase responses); update flow
- [ ] PWA-003: Loading skeletons, empty states, error states across the four pages
- [ ] PWA-004: Accessibility review (keyboard, focus, labels, contrast) and fixes
- [ ] PWA-005: Mobile performance review (bundle size, LCP, list rendering)
- [ ] PWA-006: Critical-path Playwright suite (auth, task complete, shopping add, file upload)
- [ ] PWA-007 (optional): Offline shopping reads/writes with queue + conflict policy — only if justified
- [ ] PWA-008 (optional): Offline task completion — only if justified

## Acceptance Criteria
- [ ] App installable on Android and iOS
- [ ] Core mobile workflows smooth
- [ ] No major accessibility problems
- [ ] Any offline feature shipped works reliably
- [ ] Critical e2e workflows pass

## Verification
Lighthouse PWA/a11y/perf runs, e2e suite, manual device checks.

## Definition of Done
Verified, checked, docs updated; optional items explicitly marked skipped (with reason) if not done.
