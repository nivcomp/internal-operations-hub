# Next Task

## Current result

The meeting and client portal now include a saved interactive prototype studio. Agency operators can create app, WhatsApp-bot or automation MVPs from existing chat/specification/meeting context plus pasted TXT/Markdown/JSON or locally extracted DOCX text. The output is a bounded React-rendered screen schema with buttons and navigation, not executable AI code. Revisions create immutable history; an explicit agency share makes one version client-visible; the client can approve or request changes against that exact version. A reviewed Lovable handoff can be copied manually.

Remaining limitation: the migration and `project-prototype` Edge Function require deployment to the connected Supabase project. Deno/Supabase CLI and authenticated production sessions are unavailable here, so live agency/client RLS verification remains required. Generated image prompts currently render as safe visual placeholders; persistent uploaded or AI-generated prototype images are not yet implemented.

## Recommended next work unit

Add protected prototype media assets and visual review annotations.

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
