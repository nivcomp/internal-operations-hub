# Next Task

## Current result

The client-facing project process is now explanatory and responsive without adding a second flow system.

`ProjectFlowCanvas` and process artifacts inside project chat render their existing nodes through shared interactive components. Every node opens an accessible side drawer on desktop or bottom sheet on mobile with a simple explanation, business purpose, next step, input, output and performer. Technical information is secondary under `פרטים טכניים`.

`src/lib/clientGlossary.ts` is the single client-safe glossary for Make, Zapier, Airtable, CRM, WhatsApp Bot, API, Webhook, OAuth, Supabase, Google Sheets, Gmail, Google Drive, Microsoft 365, Green API, OpenAI/AI, database, automation and integration. Registered terms receive a restrained inline help action; unknown terms do not.

Human, automation, AI, external-system, decision, message and meeting nodes now have quiet visual categories. Existing graph levels and edges remain the source for ordering and branching. Mobile converts the diagram to a top-to-bottom single column. No fake status or implementation dependency is created.

The old client flow CSS collision with the internal draggable `.flow-canvas` was removed by giving the client component its own class namespace. The fake CRM board with sample customer names was removed. Client project chats also use a final `clientSafe` display boundary for internal drafts, rejected-action reasons, cost and margin fields.

TypeScript and the production Vite build pass. Browser QA passed at 1440, 1024, 768, 430 and 390 pixels with no document/flow horizontal overflow, no clipped node labels, 44px technical-help/close targets, a one-column mobile flow, working Make/Airtable explanations and focus restoration after closing.

## Recommended next work unit

After this PR is reviewed and deployed, run one authenticated production smoke test with a real client-owned project whose saved flow contains marketing leads, old leads, WhatsApp Bot, Make, a decision, meeting booking and Airtable/CRM.

## Constraints

- Keep the existing LiveFlow and sanitized chat artifacts as the only process sources.
- Do not create or infer workflow status, implementation dependencies or technical architecture in the client UI.
- Never render internal cost, margin, prompts, private notes or supplier-only information to a client.
- Keep authentication, RLS, project ownership, pricing and AI behavior unchanged.

## Acceptance criteria

- The authenticated client sees the expected project and every real saved node.
- Each node and registered term opens the correct explanation and closes back to the same trigger.
- Make, WhatsApp Bot and Airtable/CRM explanations are understandable and technical details remain collapsed initially.
- Desktop uses a side drawer; 390/430 mobile uses a readable bottom sheet and vertical flow with no horizontal overflow.
- Client chat and process details contain no internal draft, cost, margin, prompt, note or supplier data.
- Existing project continuation, proposal, estimate, files, chat and MVP actions still work for that same project.
