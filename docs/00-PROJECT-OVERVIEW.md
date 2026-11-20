# 00 — Project Overview

A mobile-first household management app for two partners sharing a home. Four pages, each with its own URL:

| Route | Purpose |
|---|---|
| `/tasks` | One-time tasks and recurring routines (with completion history) |
| `/files` | Searchable library of photos/documents (manuals, receipts, …) |
| `/shopping` | Shared shopping list with custom sections, built for fast phone entry |
| `/notifications` | Push reminders for upcoming recurring tasks |

## Goals
Useful in production quickly; fast everyday UX; multi-user/household and private/shared data from day one; boring established tech; small deployable vertical slices.

## Non-goals
Project management, habit tracking, finance/credit-card features, household administration platform, offline-first sync (first release), notes UI (table only), roles/permissions.

## Data layers
Personal (private to a user), Family (shared in household), Home (property-related) are *conceptual*. They are expressed only through `visibility` (`private`/`shared`) on tasks and notes plus household scoping — no extra navigation or modules.

## Key decisions at a glance
See 07-DECISIONS.md. Stack: 01-TECH-STACK.md. Architecture: 02. Schema: 03. Auth: 04. UX: 05. Roadmap: 06. Specs: `features/`. Progress: `plans/` (the only progress tracker).

## Scale
A single small household. No premature scaling work.
