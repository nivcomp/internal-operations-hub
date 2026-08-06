# Next Task

## Recommended next work unit

Build the complete meeting-start flow inside `simple` mode, without automatically switching to `advanced`:

Existing or new client → create or select client → create or select project → open the meeting workspace inside the small application while reusing the existing infrastructure.

## Constraints

- Keep one React application, repository and Supabase project.
- Reuse `clients`, `crm_leads`, `projects`, `client_meetings`, `meeting_sources`, project conversations, specification records and existing services.
- Keep `project_estimates` as the only canonical pricing source.
- Do not create a second chat, meeting, document, estimate or database system.
- Preserve authentication, RLS, role visibility, client/supplier pricing privacy and start gates.
- Do not navigate to `advanced` as a side effect of starting the meeting.

## Acceptance criteria

- Simple Mode offers one clear meeting action.
- The operator can choose an existing client or create a minimal new client without leaving Simple Mode.
- The operator can choose an existing project or create a draft project for that client without leaving Simple Mode.
- The meeting workspace renders inside Simple Mode and uses the same project and Supabase records as Advanced Mode.
- Returning to either mode shows the same meeting, conversation, specification and estimate data.
- No duplicate migrations, tables, services or records are introduced.
- `pnpm install --frozen-lockfile`, `pnpm run build` and `git diff --check` pass.
