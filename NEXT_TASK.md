# Next Task

## Current result

The agency-controlled pre-project lead workflow is live in production.

The production migration `20260813100000_lead_conversation_inbox.sql` was applied successfully. Production now has durable lead conversations and messages, agency-only promotion, server-enforced paused/review/disqualified states, and a client submission path that cannot create a project. One existing no-project onboarding conversation was safely backfilled as one lead with its six existing messages.

The four matching Edge Functions (`onboarding-chat`, `lead-conversations`, `access-admin`, and `public-registration`) were deployed from source commit `d87e0de`, and the matching frontend was published. Lovable reports the project as published and ready. The public production address redirects to `https://project.stat.ninja/`, reaches the authenticated login boundary, and loads without browser console errors.

New invitations and approved public registrations now enter the lead inbox before a project exists. Agency admins can review the complete thread, reply visibly, add private notes, pause, resume, disqualify, or explicitly promote the lead. Only promotion creates the exact client-owned project and transfers the transcript, brief, flow, notes, and specification drafts. Existing project-continuation links remain unchanged.

Build, TypeScript, migration verification, function deployment, public production loading, and database invariants pass. The release has not yet received a full authenticated client/admin interaction smoke test because no signed-in production client/admin browser session was available in this run.

## Recommended next work unit

Run one controlled authenticated production smoke test across both roles:

1. Send one client message and confirm it appears in the agency lead inbox without creating a project.
2. Send one client-visible agency reply and one private note; verify only the reply reaches the client and the reply influences the next AI turn.
3. Pause and resume the lead, then submit it for review; verify blocked statuses are enforced by the server.
4. Promote the lead once and repeat the promotion request; verify both calls resolve to the same project.
5. Confirm the complete transcript, brief, flow, internal notes and specification drafts are attached to that project, and that an existing continuation link still opens its original project.

## Constraints

- Keep one application, repository and Supabase project.
- A pre-project lead is not a project and cannot request an MVP.
- Only an active agency admin may promote a lead.
- Enforce paused and disqualified status on the server, not only in the interface.
- Never expose agency-only notes to a client.
- Keep promotion retry-safe and preserve the complete lead history.
- Do not change existing project-continuation links.

## Acceptance criteria

- The authenticated client and agency views expose the same lead thread before any project exists.
- Agency-visible replies reach the client; private notes do not.
- Paused, submitted and disqualified leads cannot keep messaging through direct API calls.
- Client submission creates no project.
- Repeated agency promotion creates exactly one project and returns that same project.
- The promoted project contains the complete transcript, brief, flow, notes and specification drafts.
- The promoted client enters that exact project portal and can begin the project/MVP workflow there.
- An existing continuation link still opens its original project.
- No client-facing view exposes agency-only notes or internal commercial data.

**Next after the smoke test**
- Return to automatic specification documents and the Simple Mode document center.
