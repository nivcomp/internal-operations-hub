# Architecture

## Repository and application boundary

The canonical repository is `nivcomp/internal-operations-hub`.

It contains one React 18 + TypeScript + Vite application. `simple` and `advanced` are presentation modes selected inside `src/App.tsx`; they are not separate applications. Both modes share:

- `AuthProvider`, `AppDataProvider`, `OnboardingProvider`, `CopilotProvider` and navigation context.
- The same domain records and services under `src/services/`.
- The same Supabase client and project (`jvluliwmugamojdqstha`).
- The same authentication, RLS policies, migrations, storage buckets and Edge Functions.

Do not split the modes into different repositories, applications, deployments or databases.

## Runtime architecture

- Frontend: React 18, TypeScript and Vite 5.
- Persistence and authentication: Supabase Postgres, Auth, Storage and RLS.
- Server operations and AI: Supabase Edge Functions. AI calls are server-side and use role-filtered context, typed actions and explicit human confirmation for business mutations.
- State: `AppDataProvider` loads shared operational records from Supabase. Simple and advanced screens consume the same provider state; neither owns a parallel data model.
- Simple meeting navigation remembers only the selected project id locally so a refresh can restore the view; durable meeting, source, specification, conversation and estimate state remains in Supabase, and `startMeeting` is idempotent for active meetings.
- Simple meeting sessions are intentionally client-safe even when an agency admin is signed in: they use the `project_guide` conversation/context and show only estimates explicitly marked `client_visible`. Internal rate, cost and margin controls exist only in Advanced Mode.
- Simple agency navigation exposes Home, CRM, Projects and Suppliers. A selected project opens one four-area daily workspace (Discovery, Pricing & Proposal, Execution & Supplier, Status); the detailed estimate, commercial, payment, change, document and administration screens remain in Advanced Mode or contextual disclosure.
- The daily pricing area reuses `project_estimates` and related canonical tables. The supplier area reuses supplier-audience `supplier_brief` rows in `project_documents`; its dedicated print route is authenticated and rechecks document type/audience before rendering.
- Public registration is bundled separately at startup to avoid authenticated-client boot failures, but writes to the same Supabase project.
- The external automation API runs in the `external-api` Supabase Edge Function and is administered through `api-admin`. Generated OpenAPI/schema artifacts under `docs/api/` are compiled into the function and exposed as live documentation. Agency-issued keys are stored only as hashes in the private schema; the gateway enforces scopes, table policy, field validation, idempotency, optimistic concurrency, guarded deletion, rate limits and immutable audit events. Guarded business actions additionally require a current agency-admin session. Third-party agents never receive the Supabase `service_role` key or unrestricted raw database access.
- New-client AI onboarding is initially bound to the authenticated profile. The onboarding Edge Function resolves the linked client record server-side and gives the AI the authoritative client and business names, while the activity, need and project scope still come only from what the client shares. Submission creates or updates a pre-project lead conversation and does not create a project. Only an agency-admin promotion creates the exact project, retry-safely transfers the complete transcript, internal notes, structured brief, flow and specification drafts, and binds subsequent project/MVP work to that project. Full agency MVP generation and handoff remain agency-only; after promotion, an authenticated client may explicitly generate a bounded visual-only preview from client-safe project context.
- Every agency UI route that creates a project requires an explicit payment choice. Lead promotion repeats this validation at the Edge Function and database RPC boundary. A paid choice sets the project payment gate to `paid`; an intentional unpaid override keeps it `blocked` and records the exception, so work cannot silently become ready.
- An authenticated client uses only the simple home workspace. It shows the current project stage, project chat, client-visible files and project-owned MVP versions directly; it does not expose the old flow-button canvas or a link into the Advanced project workspace. The client can explicitly create or refresh a visual-only live preview above the MVP surface. Unchanged inputs are deduplicated, new model generations are cooled down, and realtime updates on `prototype_versions` refresh authorized viewers without creating a parallel client-side record.

## Canonical domain systems

- Clients and projects: `clients`, `projects`; imported prospects stay in `crm_leads` until linked or converted.
- Meeting and discovery: `client_meetings`, `meeting_sources`.
- Meeting accounting: client-safe timing is stored on `client_meetings`; one immutable agency-only `meeting_time_charges` row records confirmed billable discovery hours and the existing `paid_hours` bank deduction.
- Project conversation: `project_conversations`, `conversation_participants`, `chat_messages`, `ai_runs`, `ai_generated_drafts`.
- Specification: `specification_sections`, `specification_section_sources`, `specification_versions`, plus existing briefs, requirements, assumptions and questions.
- Pricing: `project_estimates`, `estimate_items`, allocations, adjustments, scenarios, supplier reviews and estimate versions.
- Proposals and acceptance: `proposal_versions`, `proposal_signatures`, `project_documents`.
- Change and delivery: `change_requests`, `execution_packages`, schedules, supplier assignments, payments and paid hours.

## Pricing source of truth

`project_estimates` is the only canonical source for calculation rate, hours, budget range, internal cost, buffers, margin and fixed price. Current screens, AI context, proposal publication and handoff generation must use it and its related estimate tables.

`project_pricing` and `phase_pricing` are legacy historical tables. They remain available for read-only compatibility when a project has no estimate, but they must not be written by new code or drive current commercial calculations.

## Security boundaries

- `agency_admin` sees agency-authorized internal data.
- Clients see only their own client-safe project data and published artifacts.
- Suppliers see only assigned supplier-safe work and their own terms; never client price, calculation rate, internal cost or agency margin.
- AI context is built server-side and role-filtered. AI produces suggestions or typed proposed actions; final scope, price, assignment, approval and readiness remain human-controlled.
- Project-chat quotas, cooldowns and automatic usage pauses apply to client and supplier profiles. The agency admin remains unmetered across Simple and Advanced presentation modes; events are still logged and message-length/input safety checks remain active.
- Project chat may return bounded structured visual artifacts (`flow`, `wireframe`, `table`, `checklist`) inside `chat_messages.structured_payload`. The Edge Function sanitizes and caps these structures; the frontend renders them without HTML or executable diagram syntax.
- Visual-artifact sharing is client-safe by construction: image export is generated locally from the sanitized artifact, email opens a user-controlled draft, and `portalProject` deep links still require authentication and are resolved only through the existing role/RLS-visible project set.
- `project_estimates` commercial changes emit one shared refresh event. The application context reloads canonical estimate summaries so Advanced, Simple and the client portal update without maintaining separate pricing state. Internal cost, supplier cost, calculation rate and margin remain agency-only; the client card renders only a client-visible estimate or an agency-approved fixed price.
- Interactive MVPs are project-owned records in `project_prototypes` with immutable `prototype_versions` and append-only exact-version `prototype_approvals`. The latest decision by a client for a version is current, so an accidental approval can be followed by a change request without deleting either event. A previously approved version remains immutable; corrections create a new version. The `project-prototype` function builds bounded JSON UI schemas and never returns executable code. Its full generation/share operations are agency-only; its client-preview action verifies the signed-in client's project ownership, uses only client-visible approved sections and the client-agency conversation, deduplicates an unchanged source fingerprint and rate-limits changed generations. RLS exposes only shared versions for projects the reader may access, and clients read only their own decision history.
- Signed proposal versions and signatures are immutable.
- AI-generated specification documents are new drafts based on explicitly approved `specification_sections`. Choosing a client audience is an explicit agency sharing action; portal reads remain restricted to client-audience rows by RLS and frontend filtering.
- Uploaded meeting/import files use private storage buckets.
- No service-role key is present in frontend code.
- External API CRUD is permission-aware rather than universally destructive: append-only approvals, messages, signatures, audit and financial records use corrections or reversals; protected commercial changes use existing guarded business actions; allowed deletes require an explicit reason and confirmation.

## Quality

`pnpm run build` runs TypeScript compilation and a production Vite build. There is currently no lint or automated test script in `package.json`; missing runtime coverage must be recorded honestly in `WORK_LOG.md`.
