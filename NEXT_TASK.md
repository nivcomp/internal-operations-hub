# Next Task

## Current result

Simple Mode can open the shared project document center without switching modes. It is now a client-safe meeting surface even when an agency admin is signed in: the chat uses the client project guide, private commercial controls are absent, and estimates/documents appear only when explicitly shared. Agency operators can generate versioned functional, technical, implementation and meeting documents from approved sections. Advanced Mode retains the private commercial controls and full document view.

Remaining limitation: the changed `project-documents` and previously changed `project-chat` Edge Functions must be deployed to the connected Supabase project and exercised with signed-in agency and client sessions. The repository also contains two pre-existing migration files that define the meeting-to-handoff tables; this work introduced no migration and did not alter that history.

## Recommended next work unit

Deploy and verify the existing project-room and document Edge Functions in the connected Supabase environment.

## Constraints

- Do not create or regenerate migrations, tables, document systems or pricing records.
- Keep `project_estimates` as the only canonical pricing source.
- Test agency generation and actual client visibility with separate authenticated roles.
- Do not publish, sign or create an execution commitment during verification.

## Acceptance criteria

- `project-chat` and `project-documents` deploy successfully from `main`.
- An agency user generates a Hebrew functional specification from approved sections.
- The saved row appears immediately in Simple and Advanced Mode.
- A client sees only a document explicitly assigned the client audience and cannot see agency documents.
- Internal cost, supplier cost and margin never appear in client output.
- Build and targeted authenticated browser checks pass.
