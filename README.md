# Internal Operations Hub

Internal Operations Hub is Yaniv's agency operating system. It manages the path from lead and client conversation through specification, estimate, fixed proposal, signature, payment readiness, supplier delivery and controlled changes.

Canonical repository: `nivcomp/internal-operations-hub`.

## One application, two modes

The repository contains one React application. `simple` and `advanced` are two views rendered by the same `src/App.tsx`. They share authentication, providers, Supabase records, services, AI conversations and business rules. They must not be separated into different applications, repositories or databases.

## Stack

- React 18, TypeScript and Vite 5.
- pnpm.
- Supabase Postgres, Auth, Storage, RLS and Edge Functions.
- Server-side AI through role-filtered Edge Functions and confirmation-gated typed actions.

The connected Supabase project id is declared in `supabase/config.toml`. Frontend clients use the publishable key only; service-role access stays inside Edge Functions.

## Existing systems

- Client, CRM lead, project, supplier and invitation management.
- Simple and advanced dashboards over the same `AppDataProvider` state.
- Client and supplier portals with strict visibility rules.
- Project chat, onboarding chat, persistent Copilot and voice Copilot.
- Interactive project-room chat shared with the client portal, including voice input and safe structured flow, wireframe, table and checklist artifacts.
- Shared project document center in Simple, Advanced and the client portal, using approved specification sections and existing `project_documents` records.
- Meetings, source uploads/transcripts and structured specification records.
- Simple Mode meeting launcher for existing/new clients and projects, with a resumable live discovery room that stays inside the compact application.
- Client-safe Simple Mode meeting surface: it uses the shared client conversation and never renders calculation rate, internal cost, target margin or gross margin; those remain in Advanced Mode.
- Structured estimates, client budget simulation and supplier estimate reviews.
- Proposal versions, digital signatures and stored project documents.
- Change requests, schedules, payment/paid-hours gates and supplier assignments.
- Draft execution packages based on signed scope.
- Excel/CSV import and CRM pipeline.

## Pricing rule

`project_estimates` and its related estimate tables are the only canonical source for current commercial settings and calculations. They provide the client calculation rate, currency, itemized hours, budget range, buffers, internal cost, recommended/final fixed price and margin.

`project_pricing` and `phase_pricing` are legacy historical records. They are read-only compatibility data and must not receive new writes or drive current calculations, AI context, proposals or dashboards.

## Meeting-to-handoff records

The existing workflow reuses one project and these persistent systems:

- Meetings and sources: `client_meetings`, `meeting_sources`.
- Conversation: `project_conversations`, `chat_messages`.
- Specification: `specification_sections`, `specification_versions`.
- Estimate: `project_estimates`, `estimate_items` and related estimate tables.
- Proposal and signature: `proposal_versions`, `proposal_signatures`, `project_documents`.
- Change and execution: `change_requests`, `execution_packages`.

Do not create duplicate clients, projects, chats, documents, estimates or databases for the Simple Mode flow.

## Run locally

```bash
pnpm install --frozen-lockfile
pnpm run dev
```

Production verification:

```bash
pnpm run build
```

`pnpm run build` includes TypeScript compilation. No lint or automated test script is currently configured.

## Security invariants

- Agency admin owns final scope, pricing, supplier assignment and work readiness.
- Clients see only their own client-safe records.
- Suppliers see only assigned supplier-safe work and never client pricing or agency margin.
- AI suggestions never become commercial commitments without explicit human confirmation.
- Signed proposal artifacts are immutable.
- Private uploads remain in private storage buckets.

## Project memory

- `PRODUCT_VISION.md` — product purpose and principles.
- `MVP_SCOPE.md` — implemented MVP and current limits.
- `ARCHITECTURE.md` — actual architecture and canonical systems.
- `DECISIONS.md` — decisions that future work must preserve.
- `NEXT_TASK.md` — exactly one next work unit.
- `WORK_LOG.md` — chronological implementation history.
- `AGENTS.md` — automation rules.
- `docs/` — historical and detailed domain references; where they conflict with current code and top-level memory, verify the code and update the top-level memory.
