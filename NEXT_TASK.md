# Next Task

## Current result

Brand-new clients now enter a conversation-first onboarding workspace instead of seeing an internal-looking live document with empty rows. The workspace uses the registration language, keeps the composer visible on desktop and mobile, explains the path from conversation to brief to MVP, reveals only captured summary content, and shows the agency handoff only when the brief is ready. Agency link controls now distinguish a brand-new client/new brief from the existing project-continuation link. The continuation flow itself remains project-specific and bypasses new-client onboarding so the existing conversation, specification and MVP stay attached to the same project.

The new-client workspace now identifies the signed-in client, business and evolving project name before any answers are submitted. Submission is retry-safe, redirects to the exact created project, and moves the complete onboarding transcript, structured brief, diagram and editable specification drafts into that project's records. The agency-only MVP generator already reads the same project conversation and reviewed specification, so the client cannot accidentally generate an MVP for another project.

The onboarding AI now receives the authoritative client and business identity from the authenticated profile's linked client record. It can answer which business is signed in and no longer asks the client to repeat the stored name; it still asks what the business does because that discovery information is not inferred from the account name.

The frontend, retry-safe onboarding migration and updated `onboarding-chat` Edge Function were deployed to production on 2026-08-13. Lovable production is running the matching `main` source, and the production database function was checked for conversation copying, duplicate-project protection and specification-draft creation.

The client portal now has four large focus views: project status, specification, interactive MVP and conversation/change requests. Each can be opened without the advanced agency interface and the whole client view or MVP can run full-screen on desktop and mobile. Clients see estimate hours and the incremental hours of optional requests, but no calculated money, hourly rate, supplier cost or margin; money appears only after an agency-approved fixed price exists.

The saved prototype includes immutable versions, client approval/change requests and a reviewed handoff for both Lovable and Base44. New versions are shared atomically by the agency-only Edge Function, while the repair migration shares the latest existing client draft and corrects the client RLS correlation. New AI-generated versions describe the approved UI, data model, integrations and automation flows in one bounded payload. The repair migration and updated `project-prototype` Edge Function require deployment to the connected Supabase project. Authenticated agency/client RLS verification remains required.

Clients can now request an MVP refresh from the shared MVP view. The request reuses `change_requests`; it does not execute AI directly. The next agency-generated revision includes active project requests and is shared through the existing versioned workflow.

Long client conversations now use the existing `ai_project_summaries` table as durable rolling memory. MVP generation combines that memory with the latest 30 messages rather than treating 30 messages as the entire history. The client chat warns when conversation is newer than the shared MVP and links to the controlled refresh-request flow.

The floating Copilot now reads the saved MVP plus canonical estimate items, discovery charges and role-safe logged hours. It can report existing hour ranges or prepare a reviewable itemized estimate proposal when no canonical estimate exists.

## Recommended next work unit

Run one authenticated end-to-end new-client smoke test in production.

Open a brand-new client invitation, confirm the displayed identity and the AI's stored-business answer, complete onboarding once, and compare the resulting portal project id with the created conversation, diagram and specification drafts. Then verify the agency MVP source context uses that project only.

## Constraints

- Keep one application, repository and Supabase project.
- Reuse the existing authenticated profile, client, project, conversation and specification records.
- Never expose a different client's or project's identity or data.
- Keep onboarding submission retry-safe so a repeated request returns the same project.
- Keep MVP creation agency-only and based on the exact project's client-safe context.

## Acceptance criteria

- A newly signed-in client sees their own name/email, business and pending or captured project name.
- When asked for the business name, the onboarding AI answers from that authenticated client's record and never exposes another client.
- Submitting once or retrying returns one project owned by that client's `client_id` and opens that exact portal project.
- The project's client conversation contains the onboarding transcript and diagram; specification sections remain `ai_draft` until agency review.
- Agency MVP generation reads that project's conversation and only reviewed/edited specification sections; the client cannot execute generation.
- Authenticated RLS smoke tests, TypeScript/build and `git diff --check` pass.
