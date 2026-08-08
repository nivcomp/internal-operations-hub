# Next Task

## Current result

The Simple meeting now shows a live timer, start/end times and final duration. On finish, the agency confirms billable discovery hours in quarter-hour increments and may select an eligible existing client/project hour bank. A protected database function performs a retry-safe atomic deduction and stores one agency-only charge ledger row. Client-readable meeting records do not expose bank or internal billing metadata.

Remaining limitation: the new migration must be applied to the connected Supabase project. The latest `project-chat` and `project-documents` Edge Functions also still require deployment and authenticated role verification.

## Recommended next work unit

Build a saved interactive visual prototype studio inside the project meeting.

The AI should create client-safe screen prototypes for apps, bots and automation systems from reviewed project content. The operator and client should be able to navigate between screens, request revisions, compare versions and explicitly approve a version. Store the prototype and approval in existing project/chat/specification infrastructure where possible, adding only the minimum migration required for immutable prototype versions and approval evidence. Provide a safe export package or prompt for Lovable; do not publish directly to an external service without explicit agency confirmation.

## Constraints

- Keep one application, repository and Supabase project.
- Reuse project chat, approved specification, documents and role visibility.
- Never expose internal pricing, supplier cost or margin in a client prototype.
- Treat generated UI/code as a draft until explicit agency/client approval.
- Do not execute generated code inside the authenticated application without a sandbox.

## Acceptance criteria

- Simple Mode can generate and display a navigable multi-screen prototype during a meeting.
- Prototypes support app, chatbot and automation-flow presentations.
- Revisions create versions instead of overwriting approved evidence.
- Client approval records the exact immutable version and approver.
- The approved prototype is accessible later from the project and client portal.
- A reviewed export for Lovable can be copied/downloaded only after explicit agency action.
- RLS tests, TypeScript/build and `git diff --check` pass.
