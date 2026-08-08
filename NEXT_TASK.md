# Next Task

## Current result

Simple Mode and the client portal now have a responsive phone/tablet foundation. Conversation-generated flows and wireframes use readable responsive cards, can be downloaded as SVG images, and can be shared through an authenticated project-portal deep link or a user-controlled email draft. The client portal no longer displays a competing static process diagram: it shows a concise persisted-status journey and keeps the live process/sketch inside project chat. The portal adds a Hebrew/English presentation choice, a client-visible estimate summary and a collapsed details area. The Advanced project workspace now has six primary sections, a secondary-tools selector, an exact client-view shortcut, explicit client-visible/internal pricing cards and shared commercial refresh after estimate changes.

Remaining limitation: authenticated agency/client visual verification is still required after deployment. The language choice translates the new portal overview; older embedded project modules retain some existing English copy and should be moved to a shared portal locale layer in a focused follow-up.

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
