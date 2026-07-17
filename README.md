# Client-to-Scope AI

Client-to-Scope AI is an internal operating system for Yaniv to manage agency work from first client conversation through approved scope, paid hours, supplier delivery, change requests, and project communication.

This repository contains the documentation foundation and the first static internal app foundation. It is intentionally not a public SaaS demo. The first build supports Yaniv's own client and supplier workflow before considering broader reuse.

## Current Scope

The documentation foundation defines:

- Product vision and internal MVP scope
- Core user flows for Yaniv, clients, and suppliers
- Data model planning
- Roles and permissions
- Pricing, margin, payments, and paid-hour rules
- Supplier onboarding and time tracking
- Client approvals and change request controls
- AI agent placeholders and future responsibilities
- A practical Lovable build plan

The static app foundation adds:

- Internal dashboard
- Clients, client detail, and projects pages
- Project detail page
- Suppliers and supplier detail pages
- Pricing and margin page
- Change requests page
- Supplier time entries page
- Payments and hour banks page
- Client portal placeholder
- Supplier portal placeholder
- AI Workbench placeholder

## Product Principle

The agency stays in control.

Clients can explain needs, review progress, approve scopes, make payments, and request changes. Suppliers can view assigned work, provide updates, and track time. Yaniv controls pricing, scope, supplier assignment, client-facing promises, margin, and whether work is allowed to begin.

## Recommended Build Order

1. Build the basic internal dashboard for Yaniv.
2. Add client, project, supplier, pricing, approval, and time tracking records.
3. Add simple client-facing approval views.
4. Add supplier-facing assigned work and time entry views.
5. Add change request review and pricing controls.
6. Add file and link organization.
7. Add AI-assisted drafting and summarization after the workflow is stable.

## Documentation Index

- [Product Vision](docs/product-vision.md)
- [Internal Use MVP](docs/internal-use-mvp.md)
- [User Flows](docs/user-flows.md)
- [Data Model](docs/data-model.md)
- [Roles and Permissions](docs/roles-and-permissions.md)
- [Pricing and Margin](docs/pricing-and-margin.md)
- [Supplier Onboarding](docs/supplier-onboarding.md)
- [Supplier Time Tracking](docs/supplier-time-tracking.md)
- [Client Approval and Payments](docs/client-approval-and-payments.md)
- [Agency Control Rules](docs/agency-control-rules.md)
- [AI Agents Plan](docs/ai-agents-plan.md)
- [Lovable Build Plan](docs/lovable-build-plan.md)
- [Lovable UI Refinement Handoff](docs/lovable-ui-refinement-handoff.md)

## Run The App

Install dependencies:

```bash
pnpm install
```

Start the local development server:

```bash
pnpm run dev
```

Build for production:

```bash
pnpm run build
```

The app uses mock data from `src/data/mockData.ts` and TypeScript records from `src/types/domain.ts`.

Phase 2B workflow forms use local in-memory React state only. New clients, projects, change requests, payment updates, and supplier time approvals reset when the page refreshes.

Phase 2C adds an Action Queue / Agency Control Dashboard that groups the same local state into daily work queues for pricing, approvals, payments, supplier time review, blocked work, and ready-to-start projects.

The local workflow includes a Recent Activity trail for workflow actions. It is also in-memory only and resets on refresh.

The Action Queue also includes a local session reset that restores the mock seed data without connecting a backend.

Project Detail can create a local manual client payment request for projects without an existing payment record. Requested payments appear in the Action Queue and Payments / Hour Banks views, and work remains gated until the payment is marked received.

Project Detail can also assign and remove approved suppliers using local state. These assignments update the internal project command center and Action Queue during the current session, but assignment alone does not make work ready to start.

Ready-to-start indicators require both an approved scope and either received payment or available paid hours.

Supplier Detail and Supplier Portal consume local project and time-entry state for assignment-sensitive views, while still excluding client price, margin, and internal pricing notes.

Supplier Portal uses the selected supplier when available and falls back to an approved seed supplier for the placeholder view.

Supplier Portal assigned project rows show whether work is ready to start or blocked until agency approval, payment, or paid hours.

Supplier Portal assigned project rows show the project's status label without exposing client price or agency margin.

Supplier Portal assigned projects include a short context label explaining the supplier-safe delivery information shown.

Supplier Portal also shows the selected supplier's local time entries and marks only approved time as payable.

Supplier Portal time entries include a short context label explaining that approved time is payable and submitted or rejected time is excluded until agency approval.

Supplier Portal time-entry rows show the submitted description so suppliers can recognize what each entry covers.

Supplier Portal time-entry rows show the approval owner when available, or a clear agency-approval fallback when time is not approved yet.

Supplier Portal time-entry stats show approved entry count and entries still awaiting agency approval.

Supplier Portal summarizes approved payable hours and estimated payable amount from the selected supplier's hourly rate, while excluding submitted or rejected time.

Supplier Portal also breaks approved payable hours and estimated payable amount down by project without exposing client price or agency margin.

Supplier Detail includes a direct action to open Supplier Portal for the same selected supplier context.

Client Portal consumes selected client context and local app state to show client-facing projects, payments, paid hours, and change-request status without exposing agency-only pricing data.

Client Portal payment rows include due date, received date, and payment notes from existing local client payment records.

Client Portal payment rows include a short context label explaining the client-safe payment details shown.

Client Portal paid hour rows include hour bank expiry dates when available.

Client Portal paid hour rows also show used hours from existing local hour bank records.

Client Portal paid hour rows show a simple usage percentage calculated from existing local hour bank records.

Client Portal paid hour rows include a short context label explaining the client-safe hour-bank details shown.

Client Portal paid hour rows show the parent project's status label, or a general hour-bank fallback when no project is linked.

Client Portal paid hour rows show the parent project's client-safe start rule, or a general hour-bank fallback when no project is linked.

Client Detail includes a direct action to open Client Portal for the same selected client context.

Client Portal lists client-visible files and links from project records without exposing agency-only or supplier-only files.

Client Portal client-visible files include a short context label explaining the client-safe project and file details shown.

Client Portal client-visible file rows show the parent project's status label with a clear fallback when project data is missing.

Client Portal client-visible file rows show the parent project's client-safe start rule with a clear fallback when project data is missing.

Client Portal also lists client-visible project messages without adding chat, AI, or notification integrations.

Client Portal client-visible messages include a short context label explaining the client-safe project and message details shown.

Client Portal client-visible message rows show the parent project's status label with a clear fallback when project data is missing.

Client Portal client-visible message rows show the parent project's client-safe start rule with a clear fallback when project data is missing.

Client Portal lists client-visible scope items from selected client projects without exposing supplier costs, agency margin, or internal delivery notes.

Client Portal client-visible scope items include a short context label explaining the client-safe project and scope details shown.

Client Portal client-visible scope item rows show the parent project's status label with a clear fallback when project data is missing.

Client Portal client-visible scope item rows show the parent project's client-safe start rule with a clear fallback when project data is missing.

Client Portal also lists scope approval details for selected client projects without adding approval actions or exposing internal scope notes.

Client Portal scope approvals include a short context label explaining the client-safe approval details shown.

Client Portal scope approval rows show the parent project's status label with a clear fallback when project data is missing.

Client Portal scope approval rows show the parent project's client-safe start rule with a clear fallback when project data is missing.

Client Portal change requests show the client-facing agency price when available and keep supplier cost, margin, and internal pricing notes hidden.

Client Portal change requests also show approved dates when available, or a pending approval state.

Client Portal change requests include the existing request description for client-facing context.

Client Portal change requests show a client-safe pricing state so clients can distinguish priced changes from requests still awaiting agency pricing.

Client Portal change requests show a client-safe work readiness state so approved changes are distinguishable from blocked or waiting requests.

Client Portal change requests show the related project status in client-safe terms for additional delivery context.

Client Portal change requests show the related project's start rule so clients can see whether the base project is ready or waiting on approval, payment, or paid hours.

Client Portal change requests include a short context label separating base project context from change request context.

Supplier Portal lists supplier-visible files and links from assigned projects without exposing client-only or agency-only files.

Supplier Portal supplier-visible file rows show the parent project's status label with a clear fallback when project data is missing.

Supplier Portal supplier-visible file rows show the parent project's supplier-safe start rule with a clear fallback when project data is missing.

Supplier Portal supplier-visible files include a short context label explaining the supplier-safe project and file details shown.

Supplier Portal also lists supplier-visible project messages without adding chat, AI, or notification integrations.

Supplier Portal supplier-visible message rows show the parent project's status label with a clear fallback when project data is missing.

Supplier Portal supplier-visible messages include a short context label explaining the supplier-safe project and message details shown.

Supplier Portal supplier-visible message rows show the parent project's supplier-safe start rule with a clear fallback when project data is missing.

Client Portal and Supplier Portal show explicit empty states when selected records have no related visible data.

Supplier Portal lists supplier-visible scope items for the selected supplier's assigned projects without exposing client price, agency margin, or internal pricing notes.

Supplier Portal assigned scope item rows show the parent project's status label with a clear fallback when project data is missing.

Supplier Portal assigned scope item rows show the parent project's supplier-safe start rule with a clear fallback when project data is missing.

Supplier Portal assigned scope items include a short context label explaining the supplier-safe project and scope details shown.

## App Structure

- `src/App.tsx` keeps the active view state and renders the selected page.
- `src/pages/` contains one file per internal MVP screen.
- `src/components/` contains shared UI pieces.
- `src/lib/domainHelpers.ts` contains shared formatting and lookup helpers.
- `src/data/mockData.ts` contains static mock records for the current app foundation.
- `src/types/domain.ts` contains the domain record definitions from the docs.

## Not Yet Included

- No AI API calls
- No payment provider integration
- No complex authentication
- No Supabase connection yet
- No real client or supplier accounts

The next builder should keep the docs as the source of truth and replace mock data with Supabase records only after the workflow is stable.
