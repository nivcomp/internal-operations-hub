# Next Task

## Current result

The approved pre-project lead workflow is implemented locally as one coherent work unit.

A new client invitation or approved public registration now creates a lead conversation, not a project. The client keeps the friendly, account-personalized AI conversation and can submit the evolving brief for review. Submission locks the conversation in an agency-review state and cannot create a project or MVP.

Agency admins have a shared “Lead Conversations” inbox in both Simple and Advanced Mode. It shows invited, active, awaiting-review, paused, disqualified and promoted leads; the full client/AI/agency transcript; unread state; the evolving brief and flow; client-visible manager replies; private agency notes; pause/resume/disqualify controls; and an explicit project-promotion action.

Promotion is agency-only, row-locked and retry-safe. It creates one project and transfers the complete lead history, internal notes, structured brief, flow diagram and editable specification drafts. The client onboarding state is completed only after that action, so the client then enters the exact new project portal and can continue toward an MVP. Existing project-continuation links remain bound to their existing projects and are unchanged.

Frontend TypeScript and the production Vite build pass. The production database migration, updated Edge Functions and frontend are not yet deployed: the production database tool requires a separate explicit approval for the live schema/backfill and behavior change.

## Recommended next work unit

After explicit production-database approval, publish this exact release in a controlled order:

1. Apply `20260813100000_lead_conversation_inbox.sql` to the connected production database.
2. Deploy `onboarding-chat`, `lead-conversations`, `access-admin` and `public-registration`.
3. Publish the matching frontend source.
4. Run one authenticated client/admin smoke test: client message, agency-visible inbox, agency reply, private note, pause/resume, submit for review and one promotion.
5. Verify that a repeated promotion returns the same project, all history is present and the existing continuation link still opens its original project.

## Constraints

- Keep one application, repository and Supabase project.
- A pre-project lead is not a project and cannot request an MVP.
- Only an active agency admin may promote a lead.
- Enforce paused and disqualified status on the server, not only in the interface.
- Never expose agency-only notes to a client.
- Keep promotion retry-safe and preserve the complete lead history.
- Do not change existing project-continuation links.

## Acceptance criteria

- New invited clients appear in the agency lead inbox before they start talking.
- Client and AI messages appear in the same agency thread without creating a project.
- Agency replies are visible to the client and influence the next AI turn; agency-only notes remain private.
- Paused, submitted and disqualified leads cannot keep messaging through the server.
- Client submission creates no project.
- Agency promotion creates exactly one client-owned project and transfers transcript, brief, flow and notes.
- The promoted client enters that exact project portal; only there can the MVP workflow begin.
- Existing continuation links still bypass new-client onboarding and retain their project context.
- Authenticated RLS, retry, TypeScript/build and visual smoke tests pass in production.

**Next**
- After the lead workflow production smoke test, return to automatic specification documents and the Simple Mode document center.
