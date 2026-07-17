# Lovable UI Refinement Handoff

This handoff prepares the current internal MVP for a first Lovable UI refinement pass.

The goal of the pass is visual and interaction polish only. Do not change business logic, data flow, record types, workflow rules, or integrations.

## Product Context

Client-to-Scope AI is an internal operating system for Yaniv's own agency workflow. It is not a public SaaS demo and should not be redesigned as a marketing site.

The UI should stay calm, practical, and operations-focused. Prioritize scanability, clear status, table readability, form clarity, and decision confidence.

## Current App Structure

- `src/App.tsx` owns active view state, selected client/project/supplier IDs, and local in-memory workflow state.
- `src/views.ts` defines the sidebar navigation keys and labels.
- `src/pages/` contains one file per MVP screen.
- `src/components/` contains shared layout, page header, stats, rules, and status badge components.
- `src/styles.css` contains the current global styling.
- `src/data/mockData.ts` contains mock seed records.
- `src/types/domain.ts` contains the domain model.
- `src/lib/domainHelpers.ts` and `src/lib/actionQueue.ts` contain shared workflow helpers.

## Screens To Preserve

- Dashboard
- Action Queue
- Clients
- Client Detail
- Projects
- Project Detail
- Suppliers
- Supplier Detail
- Pricing / Margin
- Change Requests
- Supplier Time
- Payments / Hours
- Client Portal
- Supplier Portal
- AI Workbench

## Business Rules That Must Not Change

- Yaniv controls pricing, scope, supplier assignment, payment readiness, margin, and client-facing commitments.
- Client price, supplier cost, and agency margin stay separate.
- Supplier-facing screens must not show client price, agency margin, supplier cost estimates, or internal pricing notes.
- Client-facing screens must not show supplier cost, agency margin, or internal delivery notes.
- Supplier assignment does not make work ready to start.
- Work is ready only when scope is approved and payment is received or paid hours are available.
- Change requests require agency review, pricing, and client approval before becoming work.
- Supplier time is not payable until Yaniv approves it.
- AI areas are placeholders only; do not connect AI APIs.

## UI Refinement Boundaries

Allowed in the first Lovable pass:

- Improve spacing, visual hierarchy, table density, and empty states.
- Improve responsive behavior without changing routing or data shape.
- Refine card, badge, button, form, and table styling.
- Make internal screens easier to scan for blockers and next actions.
- Keep the existing sidebar app shell unless a small styling improvement is needed.

Not allowed in the first Lovable pass:

- No Supabase connection.
- No authentication or account system.
- No payment provider.
- No AI API calls.
- No deployment changes.
- No framework rewrite.
- No public landing page or marketing copy.
- No new product workflow unless it is separately approved in `NEXT_TASK.md`.

## Suggested First UI Targets

1. Action Queue: improve grouped section spacing and make priority items easier to scan.
2. Project Detail: improve command-center section hierarchy and supplier assignment readability.
3. Client Portal and Supplier Portal: improve table readability and role-safe context labels.
4. Dashboard: improve metric grouping without adding new metrics.
5. Forms: make local-only forms visually consistent and clearly secondary to operational status.

## Verification Expectations

After UI refinement:

- Run `pnpm run build`.
- Manually check that Action Queue, Project Detail, Client Portal, and Supplier Portal still hide restricted pricing data.
- Confirm ready-to-start indicators still require approved scope plus payment or paid hours.
- Confirm assignment and removal still record Recent Activity.
