# Work Log

### 2026-08-13 — Simple currency and supplier assignment refinements

**Work unit**
Make the Simple pricing and supplier handoff controls match the agency's actual daily defaults.

**Changes**
- Made ILS the application and new-estimate default, with the visible selector ordered ILS, USD and GBP.
- Kept existing estimate values unchanged; choosing another currency changes the recorded/displayed unit and does not perform a silent exchange conversion.
- Made all existing suppliers visible in the Simple project handoff selector with approved, pending-review and inactive labels.
- Allowed a pending-review supplier to be assigned for planning while keeping execution visibly blocked until supplier approval; inactive suppliers remain visible but cannot be assigned.
- Tightened the Simple ready-to-start summary so it also requires an approved assigned supplier and estimate items assigned to that supplier.

**Verification**
- `pnpm run build` passed (TypeScript + Vite, 288 modules); the existing large-chunk warning remains.
- `git diff --check` passed.
- GitHub branch `codex/simplify-admin-ui` and Lovable preview were verified at source commit `7d10205755690f2903bb1e4a99c6cc773f374370` with a clean working tree.
- Published the matching frontend to `https://project.stat.ninja/` and confirmed the live `App-CV4mLSjq.js` bundle contains the ILS/USD/GBP options plus the pending-supplier planning labels.

**Next**
- Refresh the authenticated production session and smoke-test the real project's currency selector and supplier assignment without changing unrelated production data.

### 2026-08-13 — Simplified agency-admin daily workflow

**Work unit**
Audit and simplify the agency-admin experience without changing backend, authentication, RLS, role isolation, signed proposals, estimate rules or audit history.

**Changes**
- Audited visible Simple and Advanced controls in `ADMIN_UI_AUDIT.md`, including working, partial, dead and advanced-only classifications.
- Reduced Simple primary navigation to Home, CRM, Projects and Suppliers, with pre-project lead conversations available contextually and the complete product behind `מערכת מתקדמת`.
- Added a four-area Simple project workspace: Discovery, Pricing & Proposal, Execution & Supplier, and Status.
- Added a canonical `project_estimates` pricing workspace with explicit hourly rate, hours, cost, budget, recommended price, margin, risk summary, human fixed-price approval and existing proposal publication flow.
- Added supplier assignment and supplier-safe `supplier_brief` generation, preview, print/PDF-save view and contextual supplier portal access.
- Added a plain-language project status summary and a direct control to return to the beginning of the original client conversation.
- Kept one persistent contextual Copilot and repaired the previously ignored Advanced project-tab deep-link context.
- Removed duplicate Simple project actions and reduced the Home quick-action grid to one primary and three secondary actions.

**Verification**
- `npx tsc --noEmit` passed.
- `pnpm run build` passed; the existing large-chunk warning remains.
- The Vite application and unauthenticated login boundary loaded successfully in the local in-app browser.
- No lint or automated test script exists in `package.json`.
- An authenticated real-project smoke test remains required because the matching local build had no signed-in browser session. No production data was changed and no release was published.

**Files**
- `ADMIN_UI_AUDIT.md`
- Simple layout, Home, CRM, record cards and project workspace components
- Canonical pricing, supplier handoff, status and supplier-print components
- `App.tsx`, project chat/deep-link routing and responsive/print styles
- Project memory documents

**Next**
- Review the pull request and run the single authenticated preview smoke test described in `NEXT_TASK.md`; do not merge until it passes.

### 2026-08-13 — Production release of agency-controlled lead conversations

**Work unit**
Apply the approved production database migration and publish the matching lead-to-project release.

**Changes**
- Applied `20260813100000_lead_conversation_inbox.sql` to the connected production database.
- Backfilled one existing no-project onboarding conversation as a lead while preserving its six messages.
- Deployed `onboarding-chat`, `lead-conversations`, `access-admin`, and `public-registration` from source commit `d87e0de` without source changes.
- Published the matching Lovable frontend to production; the public URL redirects to `https://project.stat.ninja/`.

**Verification**
- Confirmed both lead tables exist, all four RLS policies are installed, and the agency-only promotion guard is active.
- Confirmed client submission no longer creates a project.
- Confirmed Lovable reports the project as published and ready.
- Confirmed the production login boundary loads without browser console errors.
- The earlier `npx tsc --noEmit`, `npm run build`, and `git diff --check` checks remain green for the published source.
- A full authenticated client/admin interaction smoke test remains required because this run did not have both signed-in production roles available.

**Files**
- `NEXT_TASK.md`
- `WORK_LOG.md`

**Commit**
- Production source: `d87e0de Add agency-controlled lead conversations`.
- This deployment record will be committed separately on the current feature branch.

**Next**
- Run one authenticated client/admin production smoke test through message visibility, reply/private note isolation, pause/resume, review submission, retry-safe promotion, artifact transfer, and continuation-link preservation.

### 2026-08-13 — QR code for public client/lead registration link

**Work unit**
Add a scannable QR code next to the public client registration link so leads can open it on a phone without typing the URL.

**Changes**
- Installed `qrcode` and `@types/qrcode`.
- Created reusable `src/components/ui/QrCode.tsx` that renders the link as a data-URI PNG.
- Added the QR code to the advanced Access Management page (`src/components/access/PublicLinkSettings.tsx`) below the client registration link.
- Added the QR code to the Simple Mode “Share links” card (`src/components/simple/ShareLinksCard.tsx`) for the client link.
- The QR code updates automatically when the link is rotated.

**Tests**
- `pnpm run build` passed (TypeScript + Vite); the existing large-chunk warning remains.
- Playwright smoke test confirmed the QR code renders on the Access Management page and its `src` is a valid data-URI PNG.

**Files**
- `src/components/ui/QrCode.tsx`
- `src/components/access/PublicLinkSettings.tsx`
- `src/components/simple/ShareLinksCard.tsx`
- `package.json`, `bun.lock`, `pnpm-lock.yaml`

**Next**
- Continue with the already planned production release of the lead-conversation inbox.

### 2026-08-13 — Agency-controlled pre-project lead conversations

**Work unit**
Implement the approved lead-to-project workflow so Yaniv can see and guide the full new-client conversation before deciding whether a project should exist.

**Changes**
- Added durable pre-project lead conversations and messages with separate client-visible and agency-only visibility.
- Added invited, active, awaiting-review, paused, disqualified and promoted states plus unread tracking.
- Added the “Lead Conversations” inbox to both Simple and Advanced Mode with the full transcript, evolving brief/flow, manager replies, private notes and status controls.
- Changed AI and classic client onboarding completion into “send for review”; it no longer creates a project.
- Enforced pause, review and disqualification server-side in `onboarding-chat`.
- Added agency-only, retry-safe promotion that creates one project and migrates the transcript, internal notes, brief, diagram and specification drafts.
- Created lead threads at quick invitation and public-registration claim while preserving existing project-continuation behavior.

**Tests**
- `npx tsc --noEmit` passed.
- `npm run build` passed (TypeScript + Vite); the existing large-chunk warning remains.
- `git diff --check` passed before the final documentation update and is rerun before commit.
- The production database was inspected and confirmed to still have the old auto-project submission function. Applying the new production schema/backfill was blocked pending a separate explicit approval for production data mutation, so no partial production release was attempted.

**Files**
- `supabase/migrations/20260813100000_lead_conversation_inbox.sql`
- `supabase/functions/onboarding-chat/index.ts`, `supabase/functions/lead-conversations/index.ts`
- `supabase/functions/access-admin/index.ts`, `supabase/functions/public-registration/index.ts`
- `src/pages/LeadConversationsPage.tsx`, `src/services/leadConversationsApi.ts`
- Onboarding UI, navigation, styles and project memory files

**Next**
- Obtain explicit approval for the production database migration, deploy database/functions/frontend as one release, then run the authenticated client/admin smoke test.

### 2026-08-13 — Production release of client identity and project binding

**Work unit**
Publish the personalized onboarding, exact-project handoff and authenticated business context as one production release.

**Changes**
- Fast-forwarded production `main` to the reviewed onboarding release.
- Applied the retry-safe `submit_client_onboarding` replacement to the connected production database.
- Deployed the updated `onboarding-chat` Edge Function without source changes.
- Published the matching Lovable project to its production URL.

**Verification**
- Lovable reports the production project as published and ready on the matching source revision.
- The production database function was checked for conversation copying, `_projectId` retry protection and specification-draft creation.
- The public production route loads successfully and reaches the existing authenticated login boundary.
- An authenticated new-client conversation/submission smoke test still requires a signed-in client session and remains the single recommended next work unit.

**Next**
- Run one authenticated new-client flow through business-name recall, submission and the exact project portal.

---

### 2026-08-12 — Authenticated business identity inside onboarding AI

**Work unit**
Make the onboarding conversation itself know the signed-in client's stored business identity instead of only displaying it in the surrounding page.

**Changes**
- Resolved the linked `clients` row server-side from the authenticated profile's `client_id`.
- Added a bounded authoritative identity block to the onboarding AI context so it can answer the client and business names without asking for them again.
- Kept business activity and project requirements discovery-based; the AI does not infer them from an account name.
- Returned the same identity with onboarding state and message responses, with the existing role/RLS project boundary unchanged.
- Personalized the first assistant message with the stored business name so the connection is visible before the first reply.

**Tests**
- `pnpm run build` passed (TypeScript + Vite); the existing large-chunk warning remains.
- The updated Edge Function passed a TypeScript syntax transform check.
- Edge Function deployment and its authenticated production conversation check remain required.

**Files**
- `supabase/functions/onboarding-chat/index.ts`
- `src/services/onboardingChatApi.ts`
- `src/components/onboarding/AiOnboardingWorkspace.tsx`
- `ARCHITECTURE.md`, `NEXT_TASK.md`, `WORK_LOG.md`

**Next**
- Deploy the frontend, migration and `onboarding-chat`, then verify the stored business answer and exact project handoff with a new client account.

---

### 2026-08-12 — Personalized client identity and exact project binding

**Work unit**
Show a new client whose workspace they entered and preserve every onboarding artifact inside the exact project created for their authenticated account.

**Changes**
- Added a client-safe identity panel to AI onboarding and the project portal with signed-in status, client, business and project names.
- Personalized the onboarding heading with the client's business and explained what is account-bound before the project exists.
- Made onboarding submission return and open the exact created project instead of relying on the first visible project.
- Added a retry-safe replacement for `submit_client_onboarding` that prevents duplicate projects and copies the bounded transcript into the project's `client_agency` conversation.
- Stored the structured brief, workflow diagram and specification sections as reviewable drafts under the same project.
- Preserved agency authority: onboarding does not create or publish an MVP; the agency-only generator uses the exact project conversation and reviewed specification.

**Tests**
- `pnpm run build` passed after the frontend changes (TypeScript + Vite); the existing large-chunk warning remains.
- `git diff --check` passed.
- The migration and authenticated production smoke test remain deployment work and are recorded in `NEXT_TASK.md`.

**Files**
- `src/components/client/ClientWorkspaceIdentity.tsx`
- `src/components/onboarding/AiOnboardingWorkspace.tsx`
- `src/pages/ClientPortalPage.tsx`
- `src/App.tsx`
- `src/styles.css`
- `supabase/migrations/20260812210000_bind_client_onboarding_to_project.sql`
- `ARCHITECTURE.md`, `MVP_SCOPE.md`, `NEXT_TASK.md`, `WORK_LOG.md`

**Next**
- Deploy the migration and frontend, then verify one new authenticated client from invitation through the exact project portal and agency MVP source context.

---

### 2026-08-12 — Conversation-first new-client entry and link clarity

**Work unit**
Replace the confusing new-client onboarding document wall with a friendly conversation and make the agency’s client-link purposes explicit without changing the existing project-continuation contract.

**Changes**
- Rebuilt `AiOnboardingWorkspace` around one dominant, welcoming chat with one-question-at-a-time guidance and a visible composer.
- Added Hebrew/English onboarding copy selected from the registration language or browser language, with an explicit language switch.
- Removed empty document rows, draft estimate placeholders and early edit controls from the first impression.
- Added a compact conversation-to-brief-to-MVP explanation; the live summary now appears only after real content exists and stays collapsed until the client chooses to review it.
- Moved the classic form to a quiet fallback and made the agency handoff appear only after the AI marks the brief ready.
- Added responsive desktop/mobile presentation and kept the composer visible on a 390×844 viewport.
- Clarified in Simple and Advanced access controls that public registration and personal invitation links start a new brief, while an existing meeting/project must use the project-specific continuation link.
- Audited and hardened the continuation path: `/continue?t=…` is tied to `project_id`, marks onboarding complete, returns that exact project from activation, and redirects both new and existing accounts through `portalProject` so multi-project clients do not land on the wrong project.

**Tests**
- `pnpm run build` passed (TypeScript + Vite); the existing large-chunk warning remains.
- Desktop and 390×844 mobile visual checks passed in the local in-app browser with no console errors.
- `git diff --check` passed before publication.

**Files**
- `src/components/onboarding/AiOnboardingWorkspace.tsx`
- `src/components/simple/ShareLinksCard.tsx`
- `src/components/access/PublicLinkSettings.tsx`
- `src/components/QuickInvitePanel.tsx`
- `src/pages/ContinueProjectPage.tsx`
- `src/services/publicRegistrationApi.ts`
- `src/styles.css`
- `supabase/functions/public-registration/index.ts`
- `NEXT_TASK.md`, `WORK_LOG.md`

**Next**
- Deploy the frontend and updated `public-registration` Edge Function, then run one authenticated production smoke test for a new-client link and one multi-project continuation link.

---

### 2026-08-09 — Copilot MVP and project-hours context

**Work unit**
Allow the floating agency Copilot to inspect the saved MVP and answer or prepare project-hour estimates from canonical records.

**Changes**
- Added role-filtered MVP version, summary, screen, block, action, data-model and automation context to the Copilot.
- Added canonical project estimate totals and item-level hour ranges.
- Added recorded discovery meeting hours and agency-only supplier logged/approved hours.
- On a client detail with up to three projects, the agency Copilot receives each project’s detailed context instead of only project names.
- If no estimate exists, an explicit owner request can produce a grounded `add_estimate_items` draft from the saved MVP; it cannot silently save or return an unexplained screen-count multiplier.
- Client and supplier roles remain filtered from internal pricing, margin and unrelated records.
- Added one shared agency client-details editor to the client list, Simple client card and Advanced client detail. It updates the existing `clients` row and local shared state immediately; no duplicate client model or broader portal permission was introduced.

**Tests**
- `pnpm run build` passed (TypeScript + Vite); the existing large-chunk warning remains.
- `git diff --check` passed.
- No database migration or new pricing source was added.


### 2026-08-09 — Durable conversation memory for MVP revisions

**Work unit**
Preserve long client conversations for first-time and revised MVP generation, and tell clients when conversation occurred after the shared MVP.

**Changes**
- Reworked the existing `ai_project_summaries` usage into a versioned rolling memory that merges new message batches instead of replacing early history.
- Legacy/incomplete summaries are rebuilt in batches from the available client conversation before MVP generation.
- MVP generation now receives durable conversation memory, the latest 30 messages, the approved specification and active change requests.
- Added a client-safe freshness check comparing the latest shared MVP with the latest human conversation message.
- When an MVP exists and newer conversation is present, the chat shows “I’m done explaining — request an updated MVP” and routes to the existing controlled request form.

**Tests**
- `pnpm run build` passed (TypeScript + Vite); the existing large-chunk warning remains.
- `git diff --check` passed.
- No database migration or new table is required; the existing role-safe `ai_project_summaries` table is reused.


### 2026-08-09 — Client-requested MVP refresh

**Work unit**
Let a client request a new MVP version after a significant project change without giving the client direct AI or publishing authority.

**Changes**
- Added a focused Hebrew/English “Request an MVP update” form below the shared MVP in the client portal.
- Saves the request in the existing `change_requests` workflow so agency review, hour impact, pricing and approval rules remain canonical.
- The agency-only prototype generator now includes active project change requests in its source context.
- Creating the next MVP revision still produces immutable version history and uses the existing automatic client sharing flow.

**Tests**
- `pnpm run build` passed (TypeScript + Vite); the existing large-chunk warning remains.
- `git diff --check` passed.
- No table, pricing model or client-side AI execution path was added.


### 2026-08-09 — Reliable automatic MVP sharing and client-safe review

**Work unit**
Repair existing and future client MVP visibility, remove remaining estimated-money exposure, and complete portal localization.

**Changes**
- New prototype versions are now created as client-shared atomically by the agency-only Edge Function; sharing no longer depends on browser local storage or a second request.
- Added a deployment migration that shares only the latest existing client draft per prototype, fixing c…20044 tokens truncated…workspace-wide copilot: a persistent bubble/panel, live screen context, voice conversation, form assistance, navigation shortcuts, and safe (confirmation-gated) actions.

**Changes**  
- New tables `copilot_messages` and `copilot_state` (per-profile RLS, threads keyed by the entity on screen).
- New edge function `copilot`: re-reads and role-filters all context server-side, refuses to trust ids sent by the browser, reuses the existing usage guard and the validated `ai_generated_drafts` action pipeline. It can only propose changes; a human confirms.
- New edge function `copilot-voice`: speech-to-text and text-to-speech via Lovable AI.
- Shared server modules moved to `supabase/functions/_shared/` (`actions.ts`, `guard.ts`, `estimation.ts`) so both chat surfaces can import them.
- Frontend: `CopilotProvider`/`useCopilotScreen`/`useCopilotForm`, `CopilotDock`, WAV recorder in `src/lib/voice.ts`, form bridge in `src/lib/copilotForms.ts`, copilot styles; wired into the app shell and the target-date form.
- Chips (navigate / open record / focus or pre-fill a field) are validated server-side against what the role may reach; pre-filling never saves.

**Tests**  
- `pnpm run build` — passed.
- Preview check as the agency admin: bubble opens, context header reads the current screen, the model returned a role-correct next step and a working navigation chip, no console errors.
- Not covered: client and supplier copilot sessions, and the voice round-trip (no microphone in the check environment).

**Main files changed**  
`supabase/functions/copilot/*`, `supabase/functions/copilot-voice/index.ts`, `supabase/functions/_shared/*`, `src/context/CopilotContext.tsx`, `src/components/copilot/CopilotDock.tsx`, `src/services/copilotApi.ts`, `src/lib/voice.ts`, `src/lib/copilotForms.ts`, `src/App.tsx`, `src/styles.css`.

**Next work unit**  
See `NEXT_TASK.md`.

## 2026-08-03 — Copilot Operator Mode (agency_admin)

- Work unit: upgrade the agency_admin copilot into a typed AI system operator.
- Main changes: new `copilot_operator_actions` queue and `copilot_audit_log` tables; `archived_at` on clients/projects/suppliers; new `supabase/functions/_shared/operator.ts` catalog of 33 typed admin actions with entity resolution, risk classification, dependency-aware delete/archive safety and business-rule checks; agency-wide snapshot in `copilot/context.ts`; operator prompt, queue endpoints (`operator_queue|confirm|cancel|retry`) and deferred multi-step plan resolution in `copilot/index.ts`; Operator Mode badge, risk cards and action queue in `CopilotDock.tsx`.
- Tests: `pnpm run build` passed; live edge-function tests as agency_admin — cross-project question, client creation + confirmation, Hebrew two-step plan (create project + requested date) executed in order, delete-with-history refusal, `paid_ready_to_start` blocked without approved scope/payment, audit + activity rows verified in the database.
- Known limitations: scope publication, estimate publishing/fixed price and change-request pricing still run through the existing project-chat proposal pipeline; supplier payments and printable flow-diagram export are not operator actions yet.

### 2026-08-03 — Public registration blank-screen fix

**Work unit**  
Restore the public client/supplier registration routes on the custom domain.

**Changes**  
- Reproduced the blank page on `project.stat.ninja/join/supplier` and identified the pre-render crash: `supabaseUrl is required`.
- Added a public-registration-only API module that does not import or initialize the authenticated app client.
- Changed the application entry point to dynamically load public join routes separately from the authenticated application bundle.
- Preserved the canonical production-domain redirect, public-link validation, throttling, honeypot, and daily-limit behavior.

**Tests**  
- `pnpm run build` passed; Vite emitted a separate `JoinPage` chunk.
- Playwright loaded `/join/supplier?c=fd6bac99f4a7` at 1280×1800, rendered the complete supplier form, and reported no page errors or failed requests.
- The repaired build was verified locally; the custom domain continues serving the previous deployment until this change is published.

**Files**  
- `src/main.tsx`
- `src/pages/JoinPage.tsx`
- `src/services/publicRegistrationApi.ts`
- `NEXT_TASK.md`
- `WORK_LOG.md`

**Commit**  
- Not committed: repository Git state is managed by the platform in this environment.

**Next**  
- Extend the operator catalog to estimate publishing, fixed-price approval and change-request pricing through the existing confirmation pipeline.

## 2026-08-03 — Excel/CSV import + CRM pipeline
- Work unit: Import system (xlsx/csv) and Hebrew CRM lead pipeline.
- Main changes: crm_leads/contact_notes/past_projects/import_batches/import_rows/crm_ai_suggestions tables, private `crm-imports` bucket, `crm-import` and `crm-ai-map` edge functions, `ImportWizard`, `CrmWorkspace`, `PastProjectsPanel`, new `crm` view in both Simple and Advanced modes.
- Tests: `pnpm run build` passed.
- Notes: AI mapping and lead enrichment are suggestions only; nothing is written without explicit confirmation. Past projects are reference-only and excluded from pricing/margin.

## 2026-08-06 — Unified repository and memory synchronization

**Work unit**
Audit and synchronize the unified repository, application architecture and persistent project memory without developing the next Simple Mode meeting flow.

**Changes**
- Confirmed `simple` and `advanced` render from one `App.tsx` and share authentication, providers, services, records and one Supabase project.
- Confirmed every workflow table is created once across migrations; no duplicate core table definition was found.
- Corrected the canonical repository reference to `nivcomp/internal-operations-hub` and prohibited splitting modes across apps, repositories or databases.
- Updated top-level memory to reflect durable Supabase persistence, RLS, AI, meetings, canonical estimates, proposals, signatures and execution packages.
- Declared `project_estimates` the only canonical pricing source; legacy pricing tables remain historical read-only compatibility data.
- Removed remaining legacy-pricing reads from the current Dashboard, Simple Finance and project-chat AI context.
- Recorded the next work unit as the complete client/project/meeting start flow contained inside Simple Mode.

**Tests**
- `pnpm install --frozen-lockfile` passed.
- `pnpm run build` passed, including TypeScript; the existing large-chunk warning remains.
- `git diff --check` initially found documentation trailing spaces; corrected before final validation.
- Migration table-definition audit found no duplicate `CREATE TABLE` definitions.
- Edge Function syntax check and final validation are recorded in the completion report.
- No automated test or lint script exists in `package.json`.

**Files**
- `AGENTS.md`, `README.md`, `ARCHITECTURE.md`, `MVP_SCOPE.md`, `DECISIONS.md`, `NEXT_TASK.md`, `WORK_LOG.md`
- `src/pages/DashboardPage.tsx`, `src/pages/simple/SimpleFinancePage.tsx`
- `supabase/functions/project-chat/index.ts`

**Commit**
- Created after this log entry; the final task report records the SHA and PR.

**Next**
- Build the complete existing/new client → existing/new project → meeting workspace flow inside Simple Mode without automatically navigating to Advanced Mode and without duplicating infrastructure.

---

### 2026-08-06 — Simple Mode live discovery meeting

**Work unit**
Build the complete client/project meeting-start flow and reusable live discovery room inside Simple Mode.

**Changes**
- Added a Hebrew existing/new client and existing/new project wizard using `AppDataProvider` mutations, including phone/email duplicate warnings.
- Added a persistent Simple Mode meeting view that reuses `startMeeting` and safely resumes the selected project after refresh without creating records.
- Expanded the shared meeting workspace with AI chat, editable voice transcription, multi-file upload and source history, protected live specification editing, canonical estimate pricing and a finish summary.
- Kept Advanced Mode optional and unchanged as the detailed tooling surface.
- Added no migration, table, bucket, Edge Function, pricing model or database.

**Tests**
- `pnpm run build` passed, including TypeScript; the existing large-chunk warning remains.
- `git diff --check` passed.
- Frozen install and final build are recorded in the completion report.
- No automated test script exists in `package.json`; signed-in microphone, storage and RLS paths require a deployed authenticated browser session for full end-to-end verification.

**Files**
- `src/App.tsx`, `src/context/ModeContext.tsx`, `src/pages/simple/SimpleHomePage.tsx`
- `src/components/meeting/SimpleMeetingWizard.tsx`, `src/components/meeting/MeetingWorkspace.tsx`
- `src/services/meetingWorkflowApi.ts`, `src/styles.css`
- `DECISIONS.md`, `NEXT_TASK.md`, `WORK_LOG.md`

**Commit**
- Created after this log entry; the final report records the SHA and PR.

**Next**
- Create automatic specification documents and an accessible document center from Simple Mode using existing document infrastructure.

---

### 2026-08-08 — Chat-first Simple meeting refinement

**Work unit**
Replace the long form-first meeting experience with a guided conversational flow before merging PR #6.

**Changes**
- Made one Hebrew discovery question at a time the primary Simple Mode meeting surface.
- Added text or voice answers with explicit draft/approval controls before updating existing specification sections.
- Stored approved guided answers through the existing meeting/specification services; raw audio is not retained.
- Moved free AI chat, file/source management, canonical estimate controls and manual section forms behind an optional advanced-tools disclosure.
- Kept the meeting inside Simple Mode and retained the optional explicit Advanced Mode link.

**Tests**
- `pnpm run build` passed, including TypeScript; the existing large-chunk warning remains.
- `git diff --check` passed.
- No Edge Function or new migration was introduced by this refinement.

**Files**
- `src/components/meeting/MeetingWorkspace.tsx`
- `src/styles.css`
- `WORK_LOG.md`

**Commit**
- Created after this log entry; the final report records the SHA and merge commit.

**Next**
- Verify the deployed Simple Mode flow, then continue with the existing document-center work unit.

---

### 2026-08-08 — Interactive AI project room

**Work unit**
Make the existing persistent project chat the primary Simple Mode meeting experience and add safe visual artifacts and voice input shared with the client portal.

**Changes**
- Replaced the rigid guided questionnaire surface with the full persistent `ProjectChat` conversation.
- Added microphone transcription directly to the shared chat composer for agency and client sessions.
- Added bounded AI-generated flow, wireframe, table and checklist artifacts rendered inside saved messages.
- Extended the server prompt and sanitized structured artifact persistence without accepting HTML, executable code or external URLs.
- Added a client-safe live estimate summary; internal cost and margin remain restricted to agency-only controls.
- Reused existing conversations, messages, estimates, portal and approval actions; no migration or duplicate system was added.

**Tests**
- `pnpm run build` passed, including TypeScript; the existing large-chunk warning remains.
- `git diff --check` passed.
- Deno validation could not run because Deno is not installed in the environment; frontend TypeScript cannot type-check the Deno Edge Function.

**Files**
- `src/components/ProjectChat.tsx`, `src/components/meeting/MeetingWorkspace.tsx`
- `src/services/chatApi.ts`, `src/styles.css`
- `supabase/functions/project-chat/index.ts`
- `README.md`, `ARCHITECTURE.md`, `MVP_SCOPE.md`, `WORK_LOG.md`

**Commit**
- Created after this log entry; the final report records the SHA and PR.

**Next**
- Build automatic specification documents and the Simple Mode document center from approved project-room content.

---

### 2026-08-08 — Shared Simple Mode document center

**Work unit**
Create automatic reviewed specification documents and expose the existing project document system in Simple Mode and the client portal.

**Changes**
- Added a shared document center with version history and safe Markdown preview to Simple and Advanced Mode.
- Added explicit agency/client audience selection and a client portal view that filters to client-audience documents even during agency preview.
- Separated the client-facing Simple meeting from private agency operations: it now uses the client-safe project guide, hides rate/cost/margin controls and displays only explicitly client-visible estimates and documents.
- Simplified the shared meeting chat presentation with wider conversational bubbles, a single conversation column and lighter suggestion controls.
- Extended `project-documents` to require approved specification content for specification-derived documents, use only approved sections, hide unpublished estimates and internal commercial data from client output, and return the saved document row.
- Reused `project_documents`, `specification_sections` and `project_estimates`; no migration or duplicate service was added.

**Tests**
- `pnpm run build` passed (TypeScript + Vite); the existing large-chunk warning remains.
- `git diff --check` passed before documentation updates and is rerun before publication.
- No automated test or lint script exists. Deno and a signed-in Supabase browser session are unavailable in this environment, so the Edge Function and role-specific runtime paths require deployment verification.

**Files**
- `src/components/meeting/MeetingWorkspace.tsx`
- `src/components/project/ProjectDocumentsPanel.tsx`
- `src/pages/ClientPortalPage.tsx`
- `src/services/documentsApi.ts`, `src/styles.css`
- `supabase/functions/project-documents/index.ts`
- Project memory files

**Commit**
- Created after this log entry; the final task report records the SHA and PR.

**Next**
- Deploy and verify the existing `project-chat` and `project-documents` Edge Functions with agency and client sessions.

---

### 2026-08-08 — Unmetered agency project chat

**Work unit**
Remove project-chat usage quotas from the agency admin while preserving client and supplier portal limits.

**Changes**
- `project-chat` no longer returns a usage meter or enforces quota, cooldown, automatic pause or burst blocking when the authenticated profile is `agency_admin`.
- Client and supplier behavior is unchanged.
- Usage events and message-length/input safety checks remain active for the agency.
- The frontend clears stale usage state when the server intentionally omits a meter.

**Tests**
- `pnpm run build` passed (TypeScript + Vite); the existing large-chunk warning remains.
- `git diff --check` passed.
- No automated test suite exists. The changed Edge Function still requires deployment and authenticated role verification.

**Files**
- `supabase/functions/project-chat/index.ts`
- `src/components/ProjectChat.tsx`
- Project memory files

**Commit**
- Created after this log entry; the final task report records the SHA and PR.

**Next**
- Deploy and verify `project-chat` and `project-documents` with separate agency, client and supplier sessions.

---

### 2026-08-08 — Discovery meeting time accounting

**Work unit**
Track live discovery duration and safely deduct confirmed meeting hours from the existing paid-hours bank.

**Changes**
- Added a live start/end/duration strip to the Simple meeting workspace.
- Added a finish flow with editable quarter-hour billing and eligible project/client bank selection.
- Added client-safe `duration_minutes` to `client_meetings` and an agency-only `meeting_time_charges` ledger.
- Added `finish_client_meeting`, which locks the meeting and selected bank, validates ownership and balance, prevents duplicate deductions and updates the existing `paid_hours` aggregate atomically.
- Meetings without an available bank retain their billable time in the ledger without falsely deducting a balance.

**Tests**
- `pnpm run build` passed (TypeScript + Vite); the existing large-chunk warning remains.
- `git diff --check` passed.
- Migration/table audit confirmed this change alters the existing meeting record and adds only the required charge ledger; it does not duplicate meetings or hour banks.
- Supabase CLI and an authenticated production session are unavailable, so migration application and live role/balance verification remain required.

**Files**
- `supabase/migrations/20260808113000_meeting_time_accounting.sql`
- `src/components/meeting/MeetingWorkspace.tsx`
- `src/services/meetingWorkflowApi.ts`
- `src/integrations/supabase/types.ts`, `src/styles.css`
- Project memory files

**Commit**
- Created after this log entry; the final report records the SHA and PR.

**Next**
- Build the saved interactive visual prototype studio with versioned client approval and reviewed Lovable export.

---

### 2026-08-14 — Simple approved-client workspace and payment gate

**Work unit**
Make the approved client experience project-specific and simple, surface shared MVPs directly, and require an explicit payment decision before every project-creation path.

**Changes**
- Rebuilt the authenticated client home as one simple workspace with project identity, current stage, project chat, client-visible files and a direct shared-MVP preview.
- Kept continuation links bound to the requested client-owned project and added a compact project selector when the same client has multiple projects.
- Removed the client flow canvas, misleading node/button controls and the route into the full Advanced project interface.
- Restricted client MVP reads in the UI to client-audience shared/approved versions and added realtime refresh for `prototype_versions`.
- Hid invalid legacy prototype actions from clients and replaced internal version/status wording with friendly version labels.
- Added one reusable payment decision dialog to manual project creation, Simple meeting project creation and lead promotion.
- Added typed payment decisions through the application service boundary. Paid creation sets the gate to paid; an unpaid override keeps it blocked and records the choice.
- Added server and database validation for lead promotion plus activity and decision log entries while preserving retry safety.
- Added migration `20260814150000_require_payment_decision_for_lead_promotion.sql`; it has not been applied to production in this work unit.

**Tests**
- `pnpm install --frozen-lockfile` passed.
- The first TypeScript build found an uncovered Simple meeting project-creation call; it was corrected to use the payment dialog.
- `pnpm run build` then passed (TypeScript + production Vite build). The existing large-chunk warning remains.
- `git diff --check` is run again before publication.
- No automated test or lint script exists. Authenticated role/RLS, realtime MVP display and the production migration still require a deployed browser smoke test.

**Files**
- Client workspace and MVP: `src/pages/home/ClientHomePage.tsx`, `src/components/prototype/PrototypeStudio.tsx`, `src/context/AppDataContext.tsx`, `src/App.tsx`, `src/styles.css`.
- Payment gate: `src/components/ui/PaymentGateDialog.tsx`, `src/components/meeting/SimpleMeetingWizard.tsx`, `src/pages/ClientDetailPage.tsx`, `src/pages/LeadConversationsPage.tsx`, service/domain files.
- Server/data: `supabase/functions/lead-conversations/index.ts`, `supabase/migrations/20260814150000_require_payment_decision_for_lead_promotion.sql`.
- Memory: `ARCHITECTURE.md`, `DECISIONS.md`, `NEXT_TASK.md`, `WORK_LOG.md`.

**Commit**
- Created after this log entry; the final task report records the SHA and pull request.

**Next**
- With explicit production approval: apply the migration, deploy `lead-conversations`, publish the frontend and run an authenticated agency/client smoke test before merge.
