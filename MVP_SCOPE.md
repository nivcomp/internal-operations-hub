# MVP Scope

## Objective

Help Yaniv move agency work from lead and client discovery through a controlled project, estimate, proposal, approval, payment gate, supplier delivery and change control without parallel spreadsheets or duplicate systems.

## Implemented foundation

- One React application with shared `simple` and `advanced` presentation modes.
- Supabase-backed authentication, profiles, durable records, storage, RLS and role isolation.
- Clients, CRM leads, projects, suppliers, invitations and role-specific home/portal screens.
- A personalized new-client workspace that visibly confirms the signed-in client and business context, preserves the pre-project conversation for agency review, and creates the exact project only when an agency admin promotes the lead.
- Project conversations and server-side AI for client, agency and supplier roles.
- A shared interactive project room with persistent chat, voice input, visual process/screen artifacts, confirmation-gated estimate proposals and client-safe live estimate visibility.
- A versioned interactive prototype studio for app, WhatsApp-bot and automation demonstrations, with DOCX/text intake, client sharing, exact-version approval and reviewed Lovable export.
- Responsive phone/tablet presentation for Simple Mode and client-safe artifact export/share actions that lead back to the authorized portal project.
- Persistent Copilot with voice support, role-filtered context and typed confirmation-gated operator actions.
- A complete Hebrew-first Simple Mode meeting flow: existing/new client, existing/new project, resumable live workspace, chat, reviewed voice transcripts, source uploads, specification and canonical pricing.
- Live discovery timing, explicit quarter-hour billable adjustment and a retry-safe deduction from an eligible existing hour bank when the agency finishes a meeting.
- The Simple meeting is a shared client-safe presentation surface; internal calculation rate, supplier cost and margin remain restricted to Advanced Mode.
- A daily agency Simple project workspace with exactly four areas: discovery, canonical pricing/proposal, supplier-safe execution handoff, and plain-language status. Internal commercial values appear only in the admin pricing area, not in the client-safe meeting surface or external portals.
- Structured requirements, assumptions, questions and specification sections/versions.
- Canonical project estimation with structured items, roles, buffers, internal cost, budget ranges, supplier reviews, scenarios and snapshots.
- Proposal versions, immutable digital signatures, stored project documents, change requests and draft execution packages.
- A shared document center that creates versioned specification, technical and implementation drafts from approved sections and exposes only client-audience documents in the client portal.
- Scope approval, payments/paid hours, schedules, supplier assignment, start gates, time tracking and supplier payables.
- Excel/CSV import and CRM enrichment suggestions.

## Canonical pricing rule

`project_estimates` is the only current pricing source of truth. Legacy `project_pricing` and `phase_pricing` are historical read-only compatibility data and must not drive current calculations, AI context, dashboards, proposals or new writes.

## Current limitations

- Automatic AI-to-specification section updates are intentionally deferred; AI suggestions must not silently overwrite reviewed or approved sections.
- Signed-in browser verification is still required for microphone, private storage and role-specific RLS paths after deployment.
- Database migrations and Edge Functions require deployment verification in the connected Supabase environment.
- No automated test or lint script is configured.
- Payment-provider and accounting integrations are outside the current MVP.

## Work-start rule

Supplier assignment alone never unlocks delivery. Work starts only after the required scope/proposal approval and payment or paid-hours condition are satisfied. AI cannot approve these gates.

## Non-goals

- Splitting Simple and Advanced modes into separate products.
- A second repository or database for the meeting flow.
- Public multi-tenant SaaS complexity.
- Autonomous AI commercial decisions.
- A supplier marketplace or native mobile application.
