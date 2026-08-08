# Next Task

## Current result

The Simple Mode meeting now uses the persistent full project chat as its primary surface. Agency and client portal conversations share the existing project conversation records, support voice input, and can display sanitized flow, wireframe, table and checklist artifacts. Client-facing estimates remain visibility-gated and all commercial mutations require confirmation.

Remaining limitation: the changed `project-chat` Edge Function must be deployed to the connected Supabase project before newly generated visual artifacts appear in live AI responses.

## Recommended next work unit

Create automatic specification documents and an accessible document center from Simple Mode.

Use the existing approved `specification_sections`, `specification_versions`, `project_documents`, proposal/signature infrastructure and current project records. Do not create another document, proposal or storage system.

## Constraints

- Keep one React application, repository and Supabase project.
- Keep Simple and Advanced as two views over the same records.
- Generate documents only from reviewed or explicitly approved source data.
- Keep `project_estimates` as the only canonical pricing source.
- Preserve authentication, RLS and client/supplier visibility.
- Do not publish, email, sign or create a commercial commitment without explicit agency approval.

## Acceptance criteria

- Simple Mode can open a project document center without switching modes.
- The operator can generate a reviewed specification document from existing sections.
- Generated documents are stored through the existing `project_documents` infrastructure.
- Existing Advanced Mode document, proposal and signature workflows continue to use the same records.
- No duplicate migrations, tables, services, buckets or records are introduced.
- Frozen install, TypeScript/build and `git diff --check` pass.
