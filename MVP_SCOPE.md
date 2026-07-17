# MVP Scope

## MVP objective

Help Yaniv manage client projects with less manual tracking, fewer unclear handoffs, and clear control over scope, pricing, approvals, payment, supplier work, and changes.

## Included in the MVP

- Internal dashboard showing active work, blockers, approvals, payments, and next actions.
- Client list and client detail.
- Project list and project detail.
- Supplier list and supplier detail.
- Capture of client discovery notes and project briefs.
- Scope creation, review status, and client approval status.
- Separate client price, supplier cost, and expected margin.
- Payment status and paid-hour bank tracking.
- Supplier assignment planning from approved suppliers, while supplier work remains blocked until start conditions are satisfied.
- Supplier work instructions and time entries.
- Review of supplier time and amount owed.
- Change request intake, pricing, approval, and status control.
- Files, links, notes, and decisions attached to the correct project.
- Client portal and supplier portal foundations sufficient for the internal workflow.
- AI workbench placeholders and later AI-assisted drafts, summaries, and recommendations.

## MVP non-goals

- Public SaaS onboarding.
- Subscription billing.
- Supplier marketplace or automated supplier discovery.
- Fully autonomous AI project management.
- Complex enterprise permissions.
- Advanced analytics.
- Deep accounting integration.
- Native chat replacement.
- Full digital document signing.
- Native mobile applications.
- Automatic client application generation.

## Current implementation status

The repository currently contains a React and TypeScript internal application foundation using Vite. It includes static screens and local in-memory workflow state. Mock data and local state reset on page refresh. There is not yet a production database, real authentication, payment integration, or live AI API connection.

## Definition of useful MVP

Yaniv can quickly answer:

- What projects are active?
- What requires action now?
- What is blocked and why?
- What is waiting on the client?
- Has the client approved the scope?
- Has the client paid or purchased sufficient hours?
- Who is assigned to the work?
- What has the supplier completed?
- How much is owed to each supplier?
- What changes were requested?
- Which requests need pricing or approval before work begins?

## Scope-control rule

Choose the simplest implementation that advances the internal workflow. Do not add a broad platform feature merely because it may be useful later.

## Work-start rule

Supplier assignment does not by itself make a project ready to start. A project is ready only when the relevant scope is approved and the payment or paid-hours gate is open.

## Existing detailed source

The original MVP definition is also documented in `docs/internal-use-mvp.md`. This top-level file is the automation memory entry point and must remain aligned with it.
