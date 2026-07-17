# Architecture

## Current stack

- Frontend: React 18.
- Language: TypeScript.
- Build tool and development server: Vite 5.
- Package manager used in repository instructions: pnpm.
- Current persistence: mock records and local in-memory React state.
- Current deployment, database, authentication, payment, and AI providers: not yet implemented.

## Current application structure

- `src/App.tsx` owns the active view and shared in-memory workflow state.
- `src/pages/` contains the internal MVP screens.
- `src/components/` contains reusable UI components.
- `src/types/domain.ts` contains the domain record types.
- `src/data/mockData.ts` contains static development records.
- `src/lib/domainHelpers.ts` contains shared lookup and formatting helpers.
- `src/lib/domainHelpers.ts` also centralizes the current local work-start rule: approved scope plus received payment or available paid hours.
- `docs/` contains detailed product and workflow documentation.

## Current constraints

- Workflow changes reset after a page refresh.
- There is no production database.
- There is no real user authentication or role enforcement.
- There are no real client or supplier accounts.
- There are no live AI API calls.
- There is no payment provider integration.
- The current system is an internal application foundation, not a public SaaS application.

## Architecture principles

- Preserve and improve the existing stack unless a documented requirement justifies a change.
- Prefer small, testable, reversible work units.
- Keep UI, business rules, persistence, and external integrations separated.
- Centralize workflow rules so pages do not each implement different versions of the same rule.
- Treat client approval and payment readiness as explicit domain state.
- Keep client pricing, supplier costs, and margin separate.
- Do not store secrets in the repository.
- Validate all external and AI-generated input before persistence or business action.
- Any future database schema change must be represented by a repeatable migration.
- Add real persistence only after confirming the workflow and domain model against the current MVP documents.

## Planned domain boundaries

- Authentication and roles.
- Clients.
- Projects and discovery.
- Scope and approval.
- Pricing and margin.
- Payments and hour banks.
- Suppliers and assignments.
- Supplier time tracking and payables.
- Change requests.
- Files, links, notes, and activity history.
- AI-assisted drafting and summarization.

## Testing and quality

The current package scripts provide `pnpm run build`, which runs TypeScript compilation and a Vite production build. No lint or automated test script is currently defined in `package.json`.

Until tests are introduced, every implementation cycle must at minimum:

1. Run `pnpm run build`.
2. Exercise the changed workflow manually when the environment permits.
3. Record missing test coverage in `WORK_LOG.md` rather than claiming tests exist.

## Evolution path

1. Stabilize internal workflows and shared domain rules.
2. Introduce durable persistence.
3. Introduce authentication and role-aware access.
4. Replace mock and local state incrementally rather than rewriting the application at once.
5. Add client and supplier portals backed by real records.
6. Add external services such as payments and AI only after the core workflow is reliable.

This document must be updated whenever the actual implementation or selected infrastructure changes.
