# Phase 3: Files

Status: Not Started

## Goal
Store, organize and find household documents and photos.

## Dependencies
Phase 0 done; `CreatableSelect`/`ResponsiveSheet` from Phase 1 (or built here if Phase 1 skipped).

## Deliverables
`file_groups`, `files`, storage bucket + policies, `/files` UI.

## Implementation
- [ ] FILES-001: Migration — `file_groups` (seeded), `files`; backfill groups
- [ ] FILES-002: Private bucket `household-files` with size/MIME limits + storage policies
- [ ] FILES-003: RLS + storage policy tests (member, other household, anon)
- [ ] FILES-004: Upload flow (file picker + camera capture, description, creatable group, progress, orphan cleanup)
- [ ] FILES-005: List with search (description/filename) and group filter
- [ ] FILES-006: Preview via signed URL (image/PDF/download fallback)
- [ ] FILES-007: Edit description/group; group rename/delete
- [ ] FILES-008: Delete route (object then row) + failure handling
- [ ] FILES-009: Playwright e2e + manual phone camera test
- [ ] FILES-010: Deploy

## Acceptance Criteria
- [ ] Receipt uploadable from a phone
- [ ] Description search finds files
- [ ] Custom groups work
- [ ] Previews work
- [ ] Unauthorized users cannot access metadata or content
- [ ] Deletion removes object and metadata

## Verification
Storage/RLS tests, e2e, typecheck/lint/build, manual device test.

## Definition of Done
All verified/checked, docs updated, deployed.
