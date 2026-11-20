# Household Management Application — Project Bootstrap & Planning

You are the lead software architect and engineer for a new household management application.

This project will be developed almost entirely using AI coding agents, primarily Claude Code.

Your responsibility is to help plan, architect, implement, test, and maintain the application incrementally.

**Your first assignment is planning and documentation only. Do not begin implementing the application yet.**

## 1. Project Goals

Build a mobile-first household management application for everyday use by two partners sharing a household.

The initial application will provide four core features:

1. Tasks and recurring household routines.
2. Photo and document storage.
3. Shared shopping lists.
4. Push notifications for upcoming recurring tasks.

Each feature must have its own page and URL.

The application must be extremely fast and easy to use, particularly on mobile.

### Primary objectives

- Get a useful application into production as soon as possible.
- Optimize for everyday usability rather than feature quantity.
- Keep the interface compact, clean, and intuitive.
- Support multiple users and household membership from the beginning.
- Architect for both private and shared information.
- Use established technologies that AI coding agents can work with reliably.
- Build incrementally, with deployable milestones.
- Avoid unnecessary complexity and speculative features.

### Non-goals

We are not building:

- A generic project management system.
- A sophisticated habit tracker.
- A financial management application.
- A credit card transaction manager.
- A large household administration platform.
- A complex offline-first system in the first release.

We already have a separate application for managing credit card transactions.

### Guiding principle

**Design the foundation properly, but implement only what is needed to start using the application.**

---

# 2. Planning and Architectural Review

Before implementing anything, critically review this entire specification.

Treat explicit product requirements and constraints as mandatory.

Treat suggested database structures, infrastructure choices, and implementation patterns as proposals that may be challenged when a better alternative exists.

### Your responsibilities

1. Identify unnecessary complexity.
2. Suggest opportunities to simplify.
3. Evaluate the proposed technology stack.
4. Verify current compatibility of major dependencies.
5. Identify missing architectural requirements.
6. Propose the simplest database schema supporting the required functionality.
7. Identify decisions that would be expensive to change later.
8. Recommend practical defaults for minor decisions.
9. Identify potential security risks.
10. Propose incremental development phases that deliver usable functionality early.

Do not introduce complexity merely to support hypothetical future features.

Do not ask me to decide every minor implementation detail.

Use sensible defaults and document them.

Ask for approval only when a decision significantly affects architecture, security, product behavior, or long-term maintainability.

### Initial planning deliverables

Produce:

- Product overview.
- Technology stack assessment.
- Proposed application architecture.
- Proposed database schema.
- Authentication and authorization design.
- UI/UX guidelines.
- Detailed feature specifications.
- Development roadmap.
- Phase-by-phase implementation plans.
- Important architectural decisions and tradeoffs.
- Risks and unresolved questions.

Create the Markdown documentation described later in this prompt.

**Do not write application code, initialize the Nuxt project, or create database migrations during this initial planning stage.**

Once the documentation is ready, summarize the major decisions and stop for my review.

---

# 3. Proposed Technology Stack

The following is our preferred stack.

Use it unless you identify a significant reason to recommend an alternative.

| Area | Technology |
|---|---|
| Application framework | Nuxt 4 |
| Frontend | Vue 3 |
| Language | TypeScript |
| Rendering | SSR + client-side navigation |
| Styling | Tailwind CSS |
| UI components | shadcn-vue / compatible Nuxt ecosystem |
| Database | Supabase PostgreSQL |
| Authentication | Supabase Auth |
| File storage | Supabase Storage |
| Authorization | PostgreSQL Row Level Security |
| PWA | @vite-pwa/nuxt |
| Service workers | Workbox |
| Push notifications | Web Push |
| Unit/integration tests | Vitest |
| End-to-end tests | Playwright |
| Database migrations | Supabase SQL migrations |
| Version control | Git |

### Stack principles

Prefer:

- Established libraries.
- Officially supported integrations.
- Managed services.
- Simple deployment.
- Minimal infrastructure.
- Clear framework conventions.
- Strong TypeScript support.

Avoid adding technologies without a demonstrated need.

Specifically, do not introduce these by default:

- Drizzle or Prisma.
- Redis.
- Microservices.
- A separate backend application.
- Complex state management.
- Dedicated search engines.
- Custom authentication.
- Elaborate offline synchronization frameworks.

### Backend approach

Use Nuxt server routes when server-side processing is necessary.

Use Supabase for:

- PostgreSQL.
- Authentication.
- File storage.
- Row Level Security.
- Database migrations.

Evaluate the appropriate separation between direct Supabase client operations and Nuxt server routes.

Make authorization consistent regardless of the access path.

Never expose privileged credentials to the browser.

### Deployment

Recommend a straightforward Nuxt-compatible hosting solution.

Prioritize:

- Minimal operational overhead.
- Reliable SSR.
- Environment variable management.
- Simple deployments.
- Support for scheduled server-side work or integration with an external scheduler.

Separate development and production environments.

Document the deployment approach.

---

# 4. Users, Households, and Personal/Shared Data

This is a foundational architectural requirement.

The application must support multiple users, household membership, and private/shared resources from the beginning.

However, the initial UI should focus primarily on shared household functionality.

## 4.1 Conceptual layers

There are three conceptual layers.

### Personal

Information accessible only to an individual user.

Examples:

- Private tasks.
- Private notes.
- Personal reminders.

### Family

Information shared among household members.

Examples:

- Shared tasks.
- Shared shopping lists.
- Family information.

### Home

Information associated with maintaining and managing a property.

Examples:

- Maintenance tasks.
- Documents.
- Appliances.
- Household projects.

These are conceptual distinctions.

They do not require separate navigation sections or separate application modules.

Do not create additional navigation solely to represent these layers.

## 4.2 Users and households

The database must support:

- Individual user accounts.
- Households.
- Household membership.
- Multiple members belonging to the same household.
- Shared resources belonging to a household.

An explicit `households` table is required.

A household membership relationship is also required.

Evaluate whether a dedicated application-level `users` or `profiles` table is necessary, or whether Supabase Auth and household memberships are sufficient initially.

Avoid unnecessary duplication of authentication information.

Initially, supporting one active household per user is acceptable, but consider the implications for future expansion.

Do not implement complicated household roles or permission hierarchies.

## 4.3 Unified resources

Use unified tables for resources supporting personal/shared visibility.

### Tasks

Use one tasks table.

Do not create separate personal and household task tables.

Tasks must support:

- Creator ownership.
- Household association.
- Private/shared visibility.
- Optional assignment to a household member.

Task assignment and visibility are independent.

For example:

A task assigned to one partner can remain visible to both household members.

### Notes

Use one notes table.

Notes must support:

- Creator ownership.
- Household association.
- Private/shared visibility.
- Title and content.

Create the necessary database foundation for notes.

**Do not build a notes page, note editor, or notes management features in the initial application.**

## 4.4 Authorization

Mandatory rules:

1. Private resources are accessible only to their creator.
2. Shared resources are accessible only to members of the relevant household.
3. A user cannot access resources belonging to another household without membership.
4. Assignment does not grant access to otherwise private resources.
5. Authorization must be enforced in the backend/database.
6. Frontend filtering must never be the security boundary.
7. File storage access must be authorization-aware.

Use PostgreSQL RLS where appropriate.

Provide explicit tests for:

- Users from different households.
- Two users belonging to the same household.
- Private resources.
- Shared resources.
- Unauthorized resource access.
- Task assignment and visibility.

Where the initial implementation only exposes shared functionality, still implement the foundational private/shared authorization correctly.

---

# 5. Database Architecture

**Do not assume any proposed database schema is finalized.**

You are responsible for designing and proposing the database structure.

Do not simply translate product requirements into tables with every conceivable field.

Prefer the smallest relational schema that correctly supports the required functionality.

## 5.1 Required concepts

The application needs to represent:

- Households.
- Household memberships.
- Users/authentication.
- Tasks.
- Task completion history.
- Notes.
- Task categories.
- Rooms.
- Uploaded files.
- File groups.
- Shopping lists.
- Shopping sections.
- Shopping items.
- Push notification subscriptions.
- Notification preferences.
- Scheduled notification delivery where necessary.

These are conceptual requirements, not an instruction to create exactly one table for each item.

You may combine or separate structures when justified.

## 5.2 Schema design principles

- Minimize unnecessary columns.
- Avoid storing redundant or easily derivable data without justification.
- Use foreign keys and constraints.
- Prefer simple relationships.
- Avoid premature normalization or abstraction.
- Avoid generic polymorphic resource systems unless clearly needed.
- Use indexes when justified by actual query patterns.
- Avoid database enums for categories/groups that users can extend.
- Prefer database migrations committed to Git.
- Keep data ownership and authorization explicit.

Examples of decisions to evaluate:

- Is `lastCompletedAt` necessary if completion history already exists?
- Should recurrence settings be columns, JSON, or a separate table?
- How should next due dates be calculated and stored?
- Does the application need its own users table?
- Should categories and rooms have separate tables?
- How should reusable groups be scoped?
- Which resources need private/shared visibility immediately?
- Which notification data needs persistence?

Explain tradeoffs rather than introducing unnecessary fields.

## 5.3 Required schema planning output

Before implementing the database:

1. List the proposed tables.
2. Explain the purpose of each table.
3. Define the important columns.
4. Show relationships and foreign keys.
5. Identify nullable fields and why they are nullable.
6. Explain important constraints.
7. Identify redundant or derivable data.
8. Explain indexes where relevant.
9. Describe RLS authorization policies.
10. Identify future migration risks.

Provide a simple relationship diagram if useful.

**Do not create database migrations until the schema has been reviewed and approved.**

---

# 6. Global Grouping and Categorization Rules

Whenever users can select a group, category, room, or other organizational value, they must be able to create a new value.

Do not force users to select an unrelated built-in option.

This is a global product requirement.

## Examples

### Files

Initial suggested groups:

- Manuals.
- Receipts.
- General files.

Users must be able to create additional groups.

### Tasks

Suggested categories:

- Cleaning.
- Maintenance.
- General.

Users must be able to create custom categories.

### Rooms

Suggested rooms:

- Kitchen.
- Bathroom.
- Bedroom.
- Living room.
- Balcony.
- Storage.

Users must be able to create custom rooms.

### Shopping

Users can create custom visual sections.

Unlike file groups and task categories, shopping sections are primarily ordered visual separators.

Do not force these different concepts into one generic database table unless doing so clearly improves the design.

## UX requirements

When selecting a category or group:

- Include an "Add new..." option.
- Allow creating the new value inline or in a small dialog.
- Do not navigate away from the current form.
- Automatically select the newly created value.
- Make existing values easy to reuse.
- Keep the interaction fast.

Where grouping is optional, allow users to leave it unset.

## Management

Support appropriate operations such as:

- Creating custom values.
- Renaming custom values.
- Deleting custom values.
- Reassigning or clearing references when a value is deleted.

Built-in values may be protected from deletion where appropriate.

Avoid creating a complex category management module.

### Architecture

Evaluate whether organizational values should be:

- Household-scoped.
- User-scoped.
- System-provided defaults.

Recommend the simplest design consistent with household sharing and future personal resources.

---

# 7. UI/UX Requirements

The application must be mobile-first.

It should feel like a lightweight, polished productivity application, not an enterprise dashboard.

**The most important UX requirement is speed.**

Users should be able to perform common actions with minimal taps and without thinking about navigation.

## 7.1 Design principles

- Compact but readable.
- Clean and minimal.
- Consistent typography.
- Clear visual hierarchy.
- Minimal visual noise.
- Subtle borders and separators.
- Avoid excessive cards.
- Avoid oversized headings and unnecessary whitespace.
- Large enough touch targets.
- Sensible defaults.
- Inline editing where practical.
- Bottom sheets for lightweight mobile forms.
- Responsive desktop layouts.
- Good keyboard support.
- Accessible controls.

Prefer practical usability over decorative design.

## 7.2 Navigation

Four primary pages:

| Route | Page |
|---|---|
| `/tasks` | Tasks |
| `/files` | Files |
| `/shopping` | Shopping |
| `/notifications` | Notifications |

Mobile navigation:

- Fixed bottom bar.
- Icons and labels.
- Clear active state.
- Respect device safe areas.

Desktop navigation:

- Compact sidebar or top navigation.

Avoid creating a complex dashboard or additional navigation hierarchy.

A `/` route may redirect to `/tasks` initially.

## 7.3 Common interaction expectations

- Mark a task complete with one tap.
- Add multiple shopping items without repeatedly refocusing an input.
- Upload a file with a short description.
- Search documents quickly.
- Create a new category directly from a selector.
- Avoid unnecessary confirmation dialogs.
- Provide clear feedback for successful actions and errors.

Use realistic household examples in mockups and tests.

---

# 8. Feature A — Tasks and Routines

Route: `/tasks`

Build a lightweight task management feature.

Do not build a generic project management platform.

## 8.1 Task types

Support two types:

### One-time

A task completed once.

Examples:

- Fix bathroom faucet.
- Hang a shelf.
- Repair kitchen cabinet.

A due date is optional.

### Recurring

A task that repeats according to a schedule.

Examples:

- Water plants.
- Clean washing machine filter.
- Clean AC filters.
- Prepare balcony for winter.

Support:

- Daily.
- Weekly.
- Monthly.
- Yearly.
- Custom intervals, such as every 3 months.

Seasonal tasks should be representable using yearly recurrence or suitable custom schedules.

Avoid an advanced recurrence rules engine.

## 8.2 Task properties

Keep tasks lean.

Required:
- Title.
- Type.

Optional or conditional:
- Description/notes.
- Category.
- Room.
- Due date.
- Recurrence schedule.
- Assigned household member.
- Notification settings.

Track task completion and completion history.

Do not store redundant fields without justification.

## 8.3 Core functionality

- Create task.
- Edit task.
- Delete task.
- Complete task.
- Search tasks.
- Filter tasks.
- View last completion.
- View completion history.

Suggested filters:

- All.
- Upcoming.
- Overdue.
- Completed.

Additional filters can include category, room, and task type if useful.

## 8.4 Task UI

Use a compact list.

Each task row should primarily show:

- Checkbox.
- Title.
- Relevant category/room.
- Due date or overdue status.

Recurring tasks should make their next due date clear.

Last completion should be accessible without cluttering the main list.

Clicking a task opens a lightweight detail or edit view.

Use bottom sheets on mobile and dialogs or drawers on desktop where appropriate.

## 8.5 Task completion

Completing a one-time task marks it completed.

Completing a recurring task should:

1. Record a completion event.
2. Preserve completion history.
3. Calculate the next occurrence.
4. Keep the recurring task active.

Do not create a new task entity for every recurrence.

Explicitly define recurrence semantics, including:

- Early completion.
- Late completion.
- Missed occurrences.
- Monthly recurrence near month-end.
- Yearly recurrence and leap years.
- Local timezone behavior.

Propose a simple, predictable policy and document it.

## 8.6 Out of scope

- Subtasks.
- Task dependencies.
- Kanban boards.
- Complex priorities.
- Time estimates.
- Advanced delegation.
- Full calendar interface.
- Complex recurrence editors.

---

# 9. Feature B — Files and Photos

Route: `/files`

Provide a simple searchable library of household documents and images.

## 9.1 Supported uploads

- Photos/images.
- PDFs.
- Common document files where practical.

## 9.2 Organization

Initial groups:

- Manuals.
- Receipts.
- General files.

Users must be able to create new groups.

Avoid using a fixed database enum for these groups.

## 9.3 Metadata

Each uploaded file should have enough metadata to support:

- Storage and retrieval.
- Original filename.
- Description.
- Group.
- Upload date.
- Household association.
- Uploader/ownership.
- Secure access.

Determine the minimal schema.

## 9.4 Core functionality

- Upload files.
- Take photos on mobile.
- Add description.
- Select or create group.
- Search by description and filename.
- Filter by group.
- Browse files.
- Preview files.
- Edit description.
- Change group.
- Delete file.

## 9.5 Upload UX

Keep the upload process extremely simple:

1. Select a file or take a photo.
2. Enter a description.
3. Select a group or create one.
4. Save.

Default to General files unless the user chooses otherwise.

The description should be the primary searchable metadata.

Support editing it later.

## 9.6 Security

- Use private Supabase Storage buckets.
- Validate file size and type.
- Enforce household authorization.
- Protect file metadata and binary content.
- Use secure access mechanisms.
- Handle deletion of metadata and storage objects safely.

## 9.7 Out of scope

- OCR.
- AI document processing.
- Automatic receipt extraction.
- Automatic product identification.
- Complex document workflows.
- Financial transaction tracking.

---

# 10. Feature C — Shopping Lists

Route: `/shopping`

This should feel like a simple notes application with checkboxes.

The primary use case is shopping from a phone.

Do not design a traditional inventory management system.

## 10.1 Structure

Initially support one shared shopping list per household.

Design the schema so multiple lists could be supported later if necessary.

A shopping list contains sections.

Sections contain items.

Example:

### Produce

- Tomatoes
- Cucumbers
- Bananas

### Dairy

- Milk
- Cheese
- Butter

### Household

- Laundry detergent
- Dishwasher tablets

Sections are custom visual groupings.

They should resemble headings or whitespace separators in a notes application.

They are not predefined product categories.

## 10.2 Core functionality

- Add item.
- Check/uncheck item.
- Edit item.
- Delete item.
- Create section.
- Rename section.
- Delete section.
- Reorder sections.
- Reorder items.
- Move items between sections.
- Clear completed items.

## 10.3 Fast entry

This is the most important aspect of the feature.

- Provide a convenient input for adding items.
- Enter immediately adds the item.
- Keep the input focused after adding.
- Allow consecutive item entry.
- Support pasting multiple lines, creating one item per line.
- Make adding a new section simple.
- Allow choosing which section receives new items.

Completed items should remain visible with a muted style and strikethrough.

Provide a "Clear completed" action.

## 10.4 Visual design

- Simple rows.
- Checkboxes.
- Section headings.
- Subtle separators.
- Compact spacing.
- No individual product cards.
- No product images.

Prioritize the number of visible items and ease of checking them while shopping.

## 10.5 Shared behavior

The list is shared between household members.

Changes should be reflected reliably for both users.

Evaluate Supabase Realtime if appropriate, but do not introduce unnecessary synchronization complexity.

Define predictable handling for concurrent updates and item ordering.

## 10.6 Out of scope

- Prices.
- Quantities.
- Inventory tracking.
- Product databases.
- Barcode scanning.
- Supermarket integrations.
- Shopping analytics.

---

# 11. Feature D — Notifications

Route: `/notifications`

Initially support only push notifications for upcoming recurring tasks.

Do not build a general-purpose notification management product.

## 11.1 Functionality

- Enable/disable push notifications.
- Register the current device.
- Show subscription status.
- Configure default reminder timing.
- Override reminder timing per recurring task.
- Display upcoming scheduled reminders.

Examples:

- Clean AC filters in 7 days.
- Replace water filter tomorrow.
- Prepare balcony for winter in 14 days.

Only recurring tasks require notifications in the initial release.

## 11.2 Architecture

Build a generic enough notification foundation to support additional notification types later.

Initially, only one notification type is needed:

`RECURRING_TASK_UPCOMING`

Evaluate the minimum necessary persistence for:

- Device subscriptions.
- User preferences.
- Scheduled reminders.
- Delivery attempts/status.
- Duplicate prevention.

Avoid creating unnecessary tables or building a complex notification rules engine.

## 11.3 Scheduling

Notifications must work when the application is closed.

Use a reliable server-side scheduling mechanism.

Potential flow:

1. Periodic scheduled job checks upcoming recurring tasks.
2. Eligible reminders are identified.
3. Notifications are scheduled or dispatched.
4. Push delivery occurs.
5. Delivery status is recorded where appropriate.

Ensure notifications are not sent repeatedly for the same task occurrence and reminder.

Handle task edits and recurrence changes correctly.

Account for timezone behavior.

## 11.4 Service worker

The service worker should:

- Receive push notifications.
- Display notifications.
- Open the relevant task when clicked.

Handle denied permissions and unsupported browsers gracefully.

## 11.5 Out of scope

- Notification inbox.
- Notification analytics.
- Email notifications.
- SMS notifications.
- Complex notification rules.
- Other notification types.

---

# 12. PWA and Offline Strategy

The application should eventually behave like an installable mobile application.

However, offline synchronization must not delay the first usable release.

## Initial goals

- Installable PWA.
- Web app manifest.
- Application icons.
- Basic service worker.
- Safe application-shell caching.

## Later improvements

- Offline shopping list access.
- Offline shopping item changes.
- Offline task completion.
- Synchronization when connectivity returns.
- Conflict handling for shared data.
- Queued file uploads.

Implement offline features incrementally.

Do not build a complicated offline-first framework at the beginning.

Prioritize correctness and a working online application.

---

# 13. AI-First Development Workflow

This project will be implemented primarily by Claude Code.

We need enough documentation and structure to keep development consistent across many AI sessions.

However, avoid excessive process overhead.

Use Markdown files as the source of truth.

## 13.1 Required directory structure

Create:

```text
/
├── AGENTS.md
├── CLAUDE.md
├── README.md
│
├── docs/
│   ├── 00-PROJECT-OVERVIEW.md
│   ├── 01-TECH-STACK.md
│   ├── 02-ARCHITECTURE.md
│   ├── 03-DATABASE-SCHEMA.md
│   ├── 04-AUTHORIZATION.md
│   ├── 05-UI-UX-GUIDELINES.md
│   ├── 06-ROADMAP.md
│   ├── 07-DECISIONS.md
│   ├── 08-DEPLOYMENT.md
│   │
│   └── features/
│       ├── TASKS.md
│       ├── FILES.md
│       ├── SHOPPING.md
│       └── NOTIFICATIONS.md
│
└── plans/
    ├── PHASE-00-FOUNDATION.md
    ├── PHASE-01-TASKS.md
    ├── PHASE-02-SHOPPING.md
    ├── PHASE-03-FILES.md
    ├── PHASE-04-NOTIFICATIONS.md
    └── PHASE-05-PWA-POLISH.md
```

Do not create separate backlog, current, or completed tracking files.

The phase plans are the sole source of truth for implementation progress.

## 13.2 AGENTS.md

This should contain permanent project instructions:

- Technology stack.
- Architecture conventions.
- Naming conventions.
- Security requirements.
- UI/UX principles.
- Testing expectations.
- Development workflow.
- Definition of done.
- Documentation update rules.

Keep it concise enough that coding agents can read it frequently.

## 13.3 CLAUDE.md

Create a minimal Claude Code entry point referencing AGENTS.md and relevant documentation.

Do not duplicate the entire instruction set.

## 13.4 Feature specifications

Each feature document should contain:

1. Purpose.
2. Scope.
3. Out-of-scope functionality.
4. User stories.
5. Main interactions.
6. UI behavior.
7. Data requirements.
8. Authorization requirements.
9. Edge cases.
10. Acceptance criteria.
11. Verification/testing requirements.

Keep feature specifications independent of implementation details unless implementation constraints are important.

## 13.5 Architecture documentation

Document:

- High-level architecture.
- Nuxt frontend/server responsibilities.
- Supabase integration.
- Authentication.
- Authorization.
- Database approach.
- Storage.
- Notification processing.
- PWA strategy.
- Deployment.

Focus on practical decisions rather than lengthy theoretical explanations.

## 13.6 Architecture decisions

Maintain `docs/07-DECISIONS.md`.

For each significant decision record:

- Decision.
- Context.
- Alternatives considered.
- Rationale.
- Consequences.
- Date.

Only record meaningful decisions.

Avoid documenting trivial implementation choices.

---

# 14. Phase-Based Implementation Tracking

Each phase must have one Markdown plan containing:

- Goal.
- Dependencies.
- Deliverables.
- Numbered implementation tasks.
- Acceptance criteria.
- Verification steps.
- Definition of done.

Use checkboxes directly inside the phase plan.

Example:

```markdown
# Phase 1: Tasks

Status: Not Started

## Implementation

- [ ] TASKS-001: Implement task schema
- [ ] TASKS-002: Implement task authorization
- [ ] TASKS-003: Implement task creation
- [ ] TASKS-004: Implement task list
- [ ] TASKS-005: Implement recurrence logic
- [ ] TASKS-006: Implement completion history
- [ ] TASKS-007: Implement categories and rooms
- [ ] TASKS-008: Implement task search
- [ ] TASKS-009: Add tests

## Acceptance Criteria

- [ ] One-time tasks work
- [ ] Recurring tasks work
- [ ] Private/shared authorization works
- [ ] Mobile experience is verified
- [ ] Relevant tests pass
- [ ] Production build succeeds
```

Assign stable task identifiers.

Keep individual tasks focused and independently verifiable where practical.

A task is only complete once its acceptance criteria are satisfied.

Do not mark tasks complete just because code was generated.

When implementation begins, update the relevant phase file after each verified task.

Do not create parallel progress tracking documents.

---

# 15. Development Roadmap

Implement the application in small vertical slices.

Deploy early.

Each phase should result in something testable and ideally usable.

## Phase 0 — Foundation

Goal: Establish a secure, deployable application.

Planned work:

- Initialize Nuxt 4.
- Configure TypeScript.
- Configure Tailwind CSS.
- Install component library.
- Configure Supabase.
- Implement authentication.
- Create households and membership models.
- Create foundational tasks and notes schemas.
- Implement private/shared authorization foundations.
- Configure RLS.
- Implement mobile/desktop navigation.
- Create four primary routes.
- Establish shared UI components.
- Set up testing.
- Configure CI checks.
- Deploy the application.

### Acceptance criteria

- User can authenticate.
- Household membership works.
- Basic household creation/joining flow exists.
- Private/shared authorization is verified.
- Four primary routes render correctly.
- Responsive navigation works.
- Production deployment is accessible.

Avoid building unnecessary feature functionality in Phase 0.

## Phase 1 — Tasks and Routines

Goal: Make household task management usable.

Planned work:

- Finalize task schema.
- Implement tasks authorization.
- Implement categories and rooms.
- Support custom values.
- Create/edit/delete tasks.
- One-time tasks.
- Recurring tasks.
- Recurrence calculations.
- Task completion.
- Completion history.
- List and filtering.
- Search.
- Mobile UX.
- Tests.

### Acceptance criteria

- Users can create and complete tasks.
- Recurring tasks correctly advance.
- Last completion can be viewed.
- Custom categories and rooms work.
- Shared household tasks work.
- Private task authorization works.
- Mobile experience is efficient.
- Automated checks pass.

Deploy when usable.

## Phase 2 — Shopping Lists

Goal: Make the shared shopping list useful in everyday life.

Planned work:

- Shopping schema.
- Household authorization.
- Sections.
- Items.
- Fast consecutive item entry.
- Check/uncheck.
- Inline editing.
- Reordering.
- Clear completed.
- Shared access.
- Concurrency behavior.
- Mobile UX.
- Tests.

### Acceptance criteria

- Adding multiple items is fast.
- Custom sections work.
- Items can be checked instantly.
- Changes persist after refresh.
- Both household members can access the same list.
- Concurrent changes behave predictably.

Deploy when usable.

## Phase 3 — Files and Photos

Goal: Store, organize, and find documents.

Planned work:

- Private storage configuration.
- File metadata schema.
- Custom file groups.
- Upload interface.
- Mobile camera upload.
- Descriptions.
- Search.
- Filtering.
- Preview.
- Metadata editing.
- Deletion.
- Storage authorization.
- Tests.

### Acceptance criteria

- Receipts can be uploaded from a phone.
- Files can be described.
- Custom groups work.
- Files can be found through description search.
- File previews work.
- Unauthorized users cannot access files.
- Deletion behaves correctly.

Deploy when usable.

## Phase 4 — Notifications

Goal: Notify users before recurring tasks become due.

Planned work:

- Push notification architecture.
- Device subscriptions.
- Preferences.
- Per-task reminder settings.
- Notification settings page.
- Scheduled reminder processing.
- Web Push delivery.
- Duplicate prevention.
- Notification click navigation.
- Error handling.
- Tests.

### Acceptance criteria

- Users can enable notifications.
- Device subscriptions work.
- Upcoming recurring tasks trigger reminders.
- Per-task timing works.
- Duplicate reminders are prevented.
- Push works without an open application tab.
- Failed/unsupported subscriptions are handled.

Deploy when usable.

## Phase 5 — PWA and Polish

Goal: Improve the experience for regular mobile use.

Planned work:

- Complete PWA installation support.
- App icons and manifest.
- Safe service worker caching.
- Loading states.
- Empty states.
- Error handling.
- Accessibility review.
- Mobile performance improvements.
- Offline shopping support if justified.
- Offline task completion if justified.
- Synchronization safety.
- End-to-end tests.

### Acceptance criteria

- Application can be installed.
- Core mobile workflows are smooth.
- No major accessibility problems.
- Relevant offline functionality works reliably if implemented.
- Critical end-to-end workflows pass.

Offline synchronization is optional in this phase if it would introduce disproportionate complexity.

---

# 16. Testing and Verification

Since much of the application will be generated by AI, verification is essential.

Use automated tests to protect important functionality.

### High-priority testing areas

- Authentication.
- Household membership.
- Cross-household isolation.
- Private/shared visibility.
- Task assignment authorization.
- Recurrence calculations.
- Task completion history.
- Shopping list changes.
- File access and deletion.
- Notification scheduling.
- Duplicate notification prevention.

Use Vitest for unit and integration tests.

Use Playwright for critical end-to-end workflows.

Avoid unnecessary tests for trivial presentational components.

### Verification rules

After each implementation task:

1. Run relevant tests.
2. Run TypeScript checks.
3. Run linting/format checks.
4. Run production build when appropriate.
5. Check for authorization implications.
6. Review the changes for regressions.
7. Update the corresponding phase checklist.

Do not claim tests passed if they were not actually executed.

If verification fails, keep the task incomplete and document the blocker.

---

# 17. Working with Claude Code

Development will proceed one small task at a time.

For each task:

### Before coding

1. Read `AGENTS.md`.
2. Read the relevant phase plan.
3. Read the relevant feature specification.
4. Inspect related existing code.
5. Identify dependencies.
6. Propose a focused implementation approach.

### During coding

1. Implement only the selected task.
2. Follow established conventions.
3. Avoid unrelated refactoring.
4. Keep the code simple.
5. Add relevant tests.
6. Maintain security boundaries.
7. Avoid unnecessary dependencies.

### After coding

1. Verify behavior.
2. Run automated checks.
3. Review code changes.
4. Update the relevant Markdown checkbox.
5. Record significant architectural decisions when necessary.
6. Summarize changes and verification.
7. Stop before beginning the next task unless explicitly instructed otherwise.

Use Git commits as stable checkpoints.

Include task identifiers in commit messages when appropriate.

Do not rewrite completed, verified features without a clear reason.

---

# 18. AI-First Engineering Principles

Follow these throughout the project:

1. Optimize for time to first usable release.
2. Prefer boring, established technology.
3. Prefer managed infrastructure.
4. Keep architecture understandable.
5. Avoid speculative abstractions.
6. Implement small vertical slices.
7. Maintain consistent patterns across features.
8. Preserve type safety.
9. Keep security non-negotiable.
10. Automate critical verification.
11. Deploy regularly.
12. Update documentation to reflect the actual implementation.
13. Do not expand feature scope without approval.
14. Prefer simple UX over elaborate functionality.
15. Prioritize user-facing usefulness.

Do not overengineer for large-scale usage.

Initially, this application is intended for a small household.

The foundation should be extensible, but the implementation should remain lightweight.

---

# 19. Initial Assignment — Documentation and Planning Only

Start by analyzing this specification.

**Do not write application code yet.**

Complete the following steps:

1. Review the product requirements.
2. Identify inconsistencies, missing requirements, or unnecessary complexity.
3. Verify compatibility of the proposed stack using current official documentation where possible.
4. Evaluate whether simpler technical choices would accelerate development.
5. Propose the application architecture.
6. Propose the database tables and relationships.
7. Design household membership and private/shared authorization.
8. Define the grouping/category architecture.
9. Describe how recurrence and notification scheduling will work.
10. Propose the UI architecture and shared component patterns.
11. Review the proposed development phases and adjust if necessary.
12. Create the required Markdown directory structure.
13. Write meaningful initial documentation in every required file.
14. Break phases into small implementation tasks with stable identifiers.
15. Define acceptance criteria and verification steps for each phase.
16. Check for duplicated planning or unnecessary documentation overhead.
17. Document unresolved architectural decisions requiring my approval.

### Important instructions

Do not silently treat proposed schemas as final.

Do not add fields or tables simply because they might become useful one day.

Do not introduce complex permission systems.

Do not begin coding.

Do not initialize Supabase.

Do not create migrations.

Do not install dependencies.

Do not start Phase 0.


### Final planning response

After creating the documentation, provide a concise summary covering:

1. Your understanding of the product.
2. Recommended technology stack and any proposed changes.
3. Proposed database architecture, including households and memberships.
4. Authorization model.
5. Main architectural tradeoffs.
6. Proposed development phases.
7. The first 5–10 implementation tasks.
8. Outstanding decisions requiring my approval.
9. Any features or complexity you recommend removing from the first release.

Then **stop and wait for my review before implementation begins**.

The overall goal is to build a reliable, polished household management application that we can start using as soon as possible, rather than spending months designing features we may never need.