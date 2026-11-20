# Feature: Files and Photos (`/files`)

## 1. Purpose
A searchable household library of documents and images (manuals, receipts, misc).

## 2. Scope
Upload images/PDFs/common docs (Office, txt); mobile camera capture; description; group (Manuals, Receipts, General files + custom); search by description + filename; filter by group; browse; preview; edit description/group; delete.

## 3. Out of scope
OCR, AI processing, receipt extraction, workflows, financial tracking, private files, folders/nesting, versioning, sharing outside the household.

## 4. User stories
- I snap a receipt on my phone, type "Dishwasher receipt", save.
- I search "boiler" and find the manual.
- I create a "Warranties" group while uploading.

## 5. Main interactions
"+" → sheet: choose file / take photo → description → group (default General files, creatable) → Save. List: search input + group chips. Row tap → preview. Row menu: edit, delete.

## 6. UI behavior
Compact list rows (thumbnail for images, icon otherwise, description primary, filename + date + group secondary). Preview: image viewer / PDF in-page viewer (or open signed URL); other types: download. Upload shows progress; failure keeps the form so the user can retry.

## 7. Data requirements
`files`, `file_groups`, Storage bucket `household-files` (03).

## 8. Authorization
Household members only, for metadata and content (04). Private bucket, signed URLs (short expiry), path prefixed by household id with storage policies.

## 9. Validation
Max size 15 MB (bucket-enforced + client pre-check); MIME allow-list (jpeg, png, webp, heic/heif, gif, pdf, txt, doc/docx, xls/xlsx); filename sanitized; client-side image downscale is deferred unless uploads prove too slow.

## 10. Edge cases
Deleting a group sets files to "General files" (null group). Metadata insert fails after upload → remove orphan object. Storage delete fails → keep metadata, show error. Duplicate filenames fine (id in path). Camera capture on iOS (HEIC) accepted.

## 11. Acceptance criteria
Receipt uploadable from a phone; description searchable; custom groups work; preview works for images/PDF; non-members cannot read metadata or content; deletion removes object and row.

## 12. Verification
Vitest: storage policy tests (member/non-member/anon), validation. Playwright: upload → search → preview → delete (desktop); manual phone camera check.
