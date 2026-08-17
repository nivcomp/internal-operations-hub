# Next Task

## Current result

The client workspace now contains a project-owned live MVP surface instead of the unrelated flow-button canvas. A promoted-project client can explicitly create or refresh a polished app, WhatsApp-bot or automation preview from client-visible approved specification content and the client-agency conversation.

The result is bounded visual JSON rendered by the existing prototype studio, never executable code. Simulated buttons only navigate between screens. Unchanged context reuses the saved version without another model call, changed generation has a cooldown, and realtime `prototype_versions` updates refresh other authorized viewers. Full agency generation, reviewed sharing and exact-version approval remain controlled separately.

The frontend TypeScript check, production Vite build, Edge Function type-check and whitespace check pass. The bounded change set is ready on the project branch; production deployment remains a separate, explicit action.

## Recommended next work unit

Deploy and smoke-test this exact client live-preview change only:

1. Deploy the updated `project-prototype` Edge Function and matching frontend only after explicit production approval.
2. As one authenticated promoted-project client, create a preview and confirm that it is visibly view-only and tied to the correct project.
3. Without changing the conversation, click again and confirm the saved version is reused.
4. Add one client-safe message, refresh after the cooldown and confirm a new immutable version appears in realtime for the agency.

## Acceptance criteria

- Only an authenticated client who owns the project, or an agency admin, can call the client-preview action.
- The preview uses no internal notes, hidden specification sections, pricing, supplier cost, margin, secrets or executable code.
- The client sees a welcoming app/WhatsApp/automation simulation rather than the old flow-button canvas.
- An unchanged source does not spend another AI generation.
- A changed source creates a new immutable version after the cooldown and realtime refresh reaches authorized viewers.
- Client-generated early previews are not presented as final scope approval; reviewed agency versions preserve the existing exact-version approval/reconsideration flow.
