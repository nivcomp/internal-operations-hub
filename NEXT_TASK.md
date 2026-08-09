# Next Task

## Current result

The client portal now has four large focus views: project status, specification, interactive MVP and conversation/change requests. Each can be opened without the advanced agency interface and the whole client view or MVP can run full-screen on desktop and mobile. Clients see estimate hours and the incremental hours of optional requests, but no calculated money, hourly rate, supplier cost or margin; money appears only after an agency-approved fixed price exists.

The saved prototype includes immutable versions, client approval/change requests and a reviewed handoff for both Lovable and Base44. New versions are shared atomically by the agency-only Edge Function, while the repair migration shares the latest existing client draft and corrects the client RLS correlation. New AI-generated versions describe the approved UI, data model, integrations and automation flows in one bounded payload. The repair migration and updated `project-prototype` Edge Function require deployment to the connected Supabase project. Authenticated agency/client RLS verification remains required.

Clients can now request an MVP refresh from the shared MVP view. The request reuses `change_requests`; it does not execute AI directly. The next agency-generated revision includes active project requests and is shared through the existing versioned workflow.

Long client conversations now use the existing `ai_project_summaries` table as durable rolling memory. MVP generation combines that memory with the latest 30 messages rather than treating 30 messages as the entire history. The client chat warns when conversation is newer than the shared MVP and links to the controlled refresh-request flow.

The floating Copilot now reads the saved MVP plus canonical estimate items, discovery charges and role-safe logged hours. It can report existing hour ranges or prepare a reviewable itemized estimate proposal when no canonical estimate exists.

## Recommended next work unit

Add protected prototype media assets, visual review annotations and a downloadable reviewed handoff.

Store uploaded and AI-generated prototype images in a private Supabase bucket, associate assets with immutable prototype versions, allow comments pinned to a screen/block, and produce PNG/PDF exports from the reviewed version. Preserve the bounded renderer and never expose agency-only data in asset prompts or exports.

## Constraints

- Keep one application, repository and Supabase project.
- Reuse the existing prototype versions, project records and role helpers.
- Keep the asset bucket private and use RLS/signed reads.
- Never include pricing, supplier cost, margin, secrets or personal data in image prompts.
- Never mutate an approved version; create a new version instead.

## Acceptance criteria

- Agency can upload or generate an image for a specific prototype screen without making the bucket public.
- Clients can read only assets belonging to shared versions in their own projects.
- Screen/block annotations are version-specific and role-auditable.
- PNG/PDF export matches the reviewed version and excludes internal data.
- RLS tests, TypeScript/build and `git diff --check` pass.
