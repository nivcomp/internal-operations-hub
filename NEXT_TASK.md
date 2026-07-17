# NEXT TASK: Prepare Lovable UI Refinement Pass

## Last Completed

Added a Lovable UI refinement handoff that documents the current internal MVP screens, app structure, UI refinement boundaries, and business rules that must be preserved during visual polish.

## Current State

- The app remains a static React + TypeScript internal MVP using mock data and local in-memory state only.
- Project supplier assignment controls already exist in Project Detail and use `Project.assignedSupplierIds`.
- Recent Activity records local workflow actions, including supplier assignment and removal.
- Ready-to-start logic requires approved scope plus payment or paid hours.
- Supplier-facing views continue to use assigned project state without exposing client price, agency margin, supplier cost estimates, or internal pricing notes.
- `docs/lovable-ui-refinement-handoff.md` now gives Lovable a focused UI-only brief.
- There is no Supabase, auth, AI integration, payment provider, notification system, deployment, or persistence.

## Recommended Next Work Unit

Prepare the existing application for the first Lovable UI refinement pass while preserving all current business logic.

## Why This Matters

The current app is functionally broad enough for a careful visual refinement pass. The next step should improve visual hierarchy and usability without changing workflow behavior or introducing integrations.

## Acceptance Criteria

- Refine only UI structure, spacing, hierarchy, and readability.
- Preserve all current business logic and local in-memory state behavior.
- Preserve supplier/client visibility rules and pricing separation.
- Preserve approval, payment, paid-hours, change-request, and supplier-time gates.
- Do not add Supabase, auth, AI APIs, payment integrations, notifications, deployment, or persistence.
- Run `pnpm run build` and record the result.
