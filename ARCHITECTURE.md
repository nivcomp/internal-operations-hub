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
- Public registration is bundled separately at startup to avoid authenticated-client boot failures, but writes to the same Supabase project.

## Canonical domain systems

- Clients and projects: `clients`, `projects`; imported prospects stay in `crm_leads` until linked or converted.
- Meeting and discovery: `client_meetings`, `meeting_sources`.
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
- Signed proposal versions and signatures are immutable.
- Uploaded meeting/import files use private storage buckets.
- No service-role key is present in frontend code.

## Quality

`pnpm run build` runs TypeScript compilation and a production Vite build. There is currently no lint or automated test script in `package.json`; missing runtime coverage must be recorded honestly in `WORK_LOG.md`.
