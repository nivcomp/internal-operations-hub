# Work Log

### 2026-08-17 — Client-generated visual-only live MVP

**Work unit**
Replace the client flow-button canvas with a project-bound, inviting live MVP preview that illustrates the evolving app, WhatsApp bot or automation without building an executable system.

**Changes**
- Added an explicit create/update control above the client MVP view in both simple client surfaces.
- Added a client-safe `client_preview` action to the existing `project-prototype` function with server-side project ownership validation.
- Limited preview context to client-visible approved specification sections, client-audience conversation memory and visible client-agency messages.
- Stored previews in the existing immutable `project_prototypes` / `prototype_versions` system so existing realtime subscriptions refresh authorized viewers.
- Added a stable source fingerprint, unchanged-result reuse and a five-minute changed-generation cooldown to control token use.
- Kept the result bounded JSON with 3–5 simulated screens; it contains no code, live integration or data mutation.
- Clearly labelled early client previews as visual drafts and kept them outside the reviewed exact-version approval controls.
- Removed the orphaned client `ProjectFlowCanvas` component and its obsolete styles while preserving the separate agency artifact flow diagram.

**Verification**
- `pnpm run build` passed (TypeScript + Vite, 289 modules); the existing large-chunk warning remains.
- `npx -y deno-bin check supabase/functions/project-prototype/index.ts` passed after tightening the optional action-tone sanitizer.
- `git diff --check` passed.
- A repository search confirmed that the removed client `ProjectFlowCanvas` has no remaining imports; the separate `ProjectFlowDiagram` renderer remains intact.
- No automated test or lint script exists; authenticated client/agency and production Edge Function smoke tests remain pending.

**Next**
- Deploy and run the authenticated client/agency smoke test only with explicit production approval as recorded in `NEXT_TASK.md`.

### 2026-08-16 — Managed external API production release

**Work unit**
Implement, expose in the application and deploy the scoped external API gateway and AI Skill documentation package.

**Changes**
- Added service-role-only private storage for hashed API keys, immutable audit events and idempotency records.
- Added `api-admin` for agency-admin key lifecycle management and `external-api` for scoped discovery, CRUD, guarded business actions and audit reads.
- Added the agency-admin-only `API ואינטגרציות` screen, including one-time full-key display, masked key inventory, revocation, embedded documentation and direct OpenAPI/AI Skill downloads.
- Generated and bundled an exact runtime contract for 83 public tables, including `cash_flow_leads`, while preserving the newer cash-flow, payment-gate, client-space and MVP-reconsideration features in Lovable.
- Applied `20260816170000_external_api_gateway.sql` once to the connected production database and deployed both Edge Functions.
- Published the matching frontend to `https://project.stat.ninja/`.

**Verification**
- `pnpm run api:docs` generated 83 tables, 12 service families and 9 domain RPC functions.
- `npx -y deno-bin check supabase/functions/api-admin/index.ts supabase/functions/external-api/index.ts` passed.
- `pnpm run build` passed with 289 modules; the existing large-chunk warning remains.
- Production `/external-api/docs` returned 200; `/openapi.json` reported OpenAPI 3.1.0; the AI Skill package contained 83 tables.
- Production `/external-api/v1/me` without `X-API-Key` and `/api-admin` without JWT both returned 401.
- The published `App` asset contains the `api-integrations` view, Hebrew menu label and API screen styles.
- No API key was created automatically and no secret was logged or committed.

**Commits**
- `0772bb5 Add managed external API gateway`
- `b942955 Include cash-flow leads in API catalog`

**Next**
- Run the short-lived authenticated key creation/read/revocation smoke test recorded in `NEXT_TASK.md`.

### 2026-08-16 — External API and AI Skill design package

**Work unit**
Characterize the complete Supabase-backed system and produce a machine-readable API package from which an AI engine can generate a safe, full-featured connector or Skill.

**Changes**
- Generated an exact public-schema catalog from `src/integrations/supabase/types.ts`: 82 tables, 988 row fields, 172 relationships and 9 database functions, including separate insert/update shapes.
- Added an OpenAPI 3.1 gateway contract for identity, capability discovery, paginated reads, validated creates, optimistic-concurrency updates, guarded deletes, business actions and audit reads.
- Added a per-table authorization/mutation matrix covering agency, client and supplier boundaries, append-only/protected data, canonical pricing and legacy read-only pricing.
- Catalogued 12 existing Edge Function service families and their guarded operations.
- Added one self-contained `docs/api/ai-skill-input.json` package plus a copy-ready generator prompt and Hebrew implementation/security reference.
- Added deterministic generation commands that fail if a schema table is missing from the domain/policy mapping.
- Recorded that this is a design contract: the scoped OAuth/audit gateway must be implemented before any generated Skill can connect, and a Supabase `service_role` key must never be distributed.

**Verification**
- `pnpm run api:docs` passed and regenerated the package deterministically.
- JSON parsing and inventory assertions passed for all package files: 82 table policies, 12 service families and OpenAPI 3.1.
- All internal OpenAPI references resolved, operation ids were unique and every table had a populated Row schema.
- A secret-shape scan found no JWT, API key or service-role credential in the package.
- `pnpm run build` passed (TypeScript + Vite, 287 modules); the existing large-chunk warning remains. The first sandboxed attempt was blocked by parent-directory read restrictions, then the identical approved build completed successfully.
- `git diff --check` passed before commit. No database, production environment or deployed application was changed.

**Files**
- `docs/api/`
- `scripts/generate-api-catalog.mjs`
- `scripts/generate-api-contract.mjs`
- `README.md`, architecture/decision memory and `NEXT_TASK.md`

**Commit**
- `e2e2274 Document scoped external API contract`

**Next**
- Implement and stage-test the read-only authenticated gateway foundation recorded in `NEXT_TASK.md` before enabling writes, deletes or a generated Skill.

### 2026-08-14 — Client can withdraw an accidental MVP approval

**Work unit**
Add a safe recovery path when a client approves the exact shared MVP version by mistake.

**Changes**
- Replaced the one-decision-per-version limitation with append-only client decision history; the latest decision is current.
- Added a client-facing withdrawal control, optional correction note and confirmation dialog after approval.
- Preserved the original approval, immutable version and complete conversation while returning the current decision to `changes_requested`.
- Added an agency-visible latest-decision card and tightened client RLS reads to the signed-in client’s own approval history.

**Tests**
- `pnpm run build` passed (TypeScript + Vite, 287 modules); the existing large-chunk warning remains.
- `git diff --check` passed before the implementation commit.
- The production database was inspected read-only: the expected unique constraint exists, there is one current decision row and three prototype-approval policies. No production data or schema was changed.
- No automated test or lint script exists. The migration and authenticated client/agency browser flow require deployment verification.

**Files**
- `src/components/prototype/PrototypeStudio.tsx`
- `src/services/prototypeApi.ts`
- `src/styles.css`
- `supabase/migrations/20260814170000_allow_client_mvp_approval_reconsideration.sql`
- Project memory and approval-flow documentation.

**Commit**
- `5165e19 Allow clients to withdraw MVP approval`

**Next**
- Apply the migration, publish the frontend and run the single authenticated client/agency smoke test recorded in `NEXT_TASK.md`.

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
- Added a deployment migration that shares only the latest existing client draft per prototype, fixing clients such as Sandra without exposing older draft history.
- Corrected correlated RLS policy references so clients can read the parent prototype only when their own project has a shared/approved client version.
- Corrected the immutable-version trigger so unapproved versions can update while approved versions remain protected.
- Removed estimated monetary ranges from the Simple meeting and from saved client scenarios. Clients see hours until an agency-approved fixed price exists.
- Localized the focused portal, specification, MVP approval controls and hours simulator in Hebrew and English.

**Tests**
- `pnpm install --frozen-lockfile` passed.
- `pnpm run build` passed (TypeScript + Vite); the existing large-chunk warning remains.
- `git diff --check` passed.
- Static visibility audit found no rendered estimated budget, hourly rate, internal cost or margin in the focused client review surfaces.

**Deployment**
- Apply `20260809100000_fix_prototype_sharing_and_version_updates.sql` and deploy `project-prototype` in the Supabase project connected to Lovable.


### 2026-08-08 — Focused client specification and MVP review

**Work unit**
Simplify the client-facing project review while preserving the existing unified application, pricing source and role boundaries.

**Changes**
- Added focused project, specification, interactive MVP and conversation views with full-screen desktop/mobile modes.
- Kept client pricing transparent in hours: optional scope shows added hours, calculated money and hourly rates stay hidden, and only an approved fixed price is displayed.
- Extended newly generated prototype versions with a structured data model, integrations and automation plan.
- Added reviewed handoff copy actions for Lovable and Base44.
- Preserved immutable MVP versions and the existing client approval/change-request flow.
- Made the later duplicate prototype migration safe to apply after Lovable's earlier migration by dropping same-named policies before recreation; no duplicate tables or pricing sources were added.

**Tests**
- `pnpm install --frozen-lockfile` passed.
- `pnpm run build` passed (TypeScript + Vite); the existing large-chunk warning remains.
- `git diff --check` passed.
- Production visual verification is pending because the available browser session is not authenticated.

**Deployment**
- Deploy the updated `project-prototype` Edge Function and apply pending migrations in the Supabase project connected to Lovable.


### 2026-08-08 — Saved interactive MVP prototype studio

**Work unit**
Create a versioned, client-safe interactive MVP studio inside the existing project meeting and portal.

**Changes**
- Added project-owned prototype, immutable version and exact-version approval records with role-specific RLS.
- Added an agency-only `project-prototype` Edge Function that generates bounded app, WhatsApp or automation screen schemas from existing project context and optional supplied text.
- Added a responsive React renderer with screen navigation, realistic UI blocks, revision history, explicit client sharing and portal approval/change requests.
- Added TXT/Markdown/JSON and DOCX text intake; DOCX extraction runs locally through Mammoth.
- Added a reviewed manual Lovable handoff copy action. Generated code is never executed and no external publish occurs automatically.

**Tests**
- `pnpm run build` passed (TypeScript + Vite); Mammoth is lazy-loaded as a separate chunk and the existing large App chunk warning remains.
- Migration audit found one coherent prototype model and no duplicate project/chat/specification system.
- Deno and Supabase CLI are unavailable, so function type checking, migration application and live authenticated RLS verification remain deployment checks.

**Files**
- `supabase/migrations/20260808150000_interactive_prototype_studio.sql`
- `supabase/functions/project-prototype/index.ts`, `supabase/config.toml`
- `src/components/prototype/PrototypeStudio.tsx`, `src/services/prototypeApi.ts`
- Meeting, portal, styles, dependencies and project memory files

**Next**
- Add private prototype media assets, pinned review annotations and PNG/PDF export.

---

### 2026-08-08 — Responsive meeting visuals and simplified client portal

**Work unit**
Make the meeting/portal usable on mobile, improve visual artifacts, remove the duplicate client-facing flow, and add safe sharing.

**Changes**
- Added responsive foundations for Simple Mode, meeting chat, tables, modals and client portal layouts.
- Reworked chat flow and wireframe artifacts into readable cards/screens that stack vertically on mobile.
- Added local SVG image download, authenticated portal-link copy and a user-controlled email draft for chat artifacts.
- Added an authenticated `portalProject` deep link that selects only a project already visible to the signed-in user.
- Removed the separate static Project Flow from the client portal. The portal now uses persisted project status for a four-step overview and project-chat artifacts for the actual conversation-derived process/sketch.
- Added Hebrew/English portal overview preference, client-visible estimate summary and a collapsed advanced-details section.
- Reduced the Advanced project workspace from thirteen equal-weight tabs to six primary sections, with infrequent operational screens in a secondary-tools selector.
- Added an always-available exact client-view shortcut and side-by-side client-visible versus agency-only commercial cards.
- Direct estimate mutations now notify the shared application context, which reloads canonical `project_estimates` summaries for Advanced, Simple and portal views.
- No migration, table, Edge Function, RLS policy or auth rule was changed.

**Tests**
- `pnpm run build` passed (TypeScript + Vite); the existing large App chunk warning remains.
- Browser login checks at desktop/mobile were completed earlier. Authenticated portal pages were unavailable in the browser session, so signed-in visual and role verification remains a deployment check.

**Files**
- `src/App.tsx`
- `src/components/ProjectChat.tsx`
- `src/pages/ClientPortalPage.tsx`
- `src/styles.css`
- Project memory files

**Next**
- Verify the merged build with separate agency/client sessions, then continue the saved interactive visual prototype studio.

---

Add one concise entry at the end of every autonomous work cycle.

Do not delete previous entries. Record only work that actually happened and tests that actually ran.

## Entry template

### YYYY-MM-DD — Short work-unit title

**Work unit**  
The single unit selected for this cycle.

**Changes**  
- Main implementation or documentation changes.
- Important behavior added, removed, or corrected.

**Tests**  
- Commands run and results.
- Manual checks performed.
- Known checks that could not be run and why.

**Files**  
- Main files changed.

**Commit**  
- Commit SHA and message, or `Not committed` with the reason.

**Next**  
- The one recommended next work unit.

---

### 2026-07-11 — Automation memory foundation

**Work unit**  
Create the top-level project memory files used by future Codex automation cycles.

**Changes**  
- Added top-level product vision, MVP scope, architecture, decision log, and work-log documents.
- Preserved the existing detailed documentation under `docs/` and the existing `NEXT_TASK.md`.

**Tests**  
- Documentation-only change; application tests were not run as part of this setup action.

**Files**  
- `PRODUCT_VISION.md`
- `MVP_SCOPE.md`
- `ARCHITECTURE.md`
- `DECISIONS.md`
- `WORK_LOG.md`

**Commit**  
- Created through GitHub file commits on `main`.

**Next**  
- Add `AGENTS.md`, then let the first automation cycle inspect the repository and update `NEXT_TASK.md` based on the code's actual status.

---

### 2026-07-11 - Local payment request creation

**Work unit**  
Add a local manual client payment request flow from Project Detail.

**Changes**  
- Added app-level local state handling for creating requested client payments.
- Added a Project Detail payment request form for projects without an existing payment record.
- New requested payments feed the existing Action Queue and Payments / Hour Banks views through shared local state.
- Updated project memory to point the next cycle at local supplier assignment controls.

**Tests**  
- `pnpm run build` passed.
- No automated test script exists beyond the production build.

**Files**  
- `src/App.tsx`
- `src/pages/ProjectDetailPage.tsx`
- `README.md`
- `NEXT_TASK.md`
- `WORK_LOG.md`

**Commit**  
- Commit will be created after this log entry; final automation summary records the SHA.

**Next**  
- Add local supplier assignment controls in Project Detail.

---

### 2026-07-11 - Local supplier assignment controls

**Work unit**  
Add local assign and remove controls for project suppliers in Project Detail.

**Changes**  
- Added app-level local state handling for assigning and unassigning suppliers on a project.
- Added Project Detail controls to assign only approved suppliers and remove assigned suppliers.
- Local assignments update Project Detail and the Action Queue through shared project state.
- Updated project memory to point the next cycle at supplier-facing views using local assignment state.

**Tests**  
- `pnpm run build` passed.
- No automated test script exists beyond the production build.

**Files**  
- `src/App.tsx`
- `src/pages/ProjectDetailPage.tsx`
- `README.md`
- `NEXT_TASK.md`
- `WORK_LOG.md`

**Commit**  
- Commit will be created after this log entry; final automation summary records the SHA.

**Next**  
- Update Supplier Detail and Supplier Portal to use app-level local project and time-entry state.

---

### 2026-07-11 - Supplier views use local assignment state

**Work unit**  
Update supplier-facing placeholder screens to use app-level local project and time-entry state.

**Changes**  
- Passed local `projects` and `timeEntries` state into Supplier Detail.
- Passed local `projects` state into Supplier Portal.
- Added assigned-project visibility to Supplier Detail so local supplier assignments appear even before time is logged.
- Preserved supplier visibility rules by keeping client price, agency margin, and internal pricing notes out of supplier-facing screens.

**Tests**  
- `pnpm run build` passed.
- No automated test script exists beyond the production build.

**Files**  
- `src/App.tsx`
- `src/pages/SupplierDetailPage.tsx`
- `src/pages/SupplierPortalPage.tsx`
- `README.md`
- `NEXT_TASK.md`
- `WORK_LOG.md`

**Commit**  
- Commit will be created after this log entry; final automation summary records the SHA.

**Next**  
- Update Supplier Portal to use the selected supplier context instead of a fixed placeholder supplier id.

---

### 2026-07-11 - Supplier portal selected context

**Work unit**  
Update Supplier Portal to use the selected supplier context instead of a fixed placeholder supplier id.

**Changes**  
- Passed `selectedSupplierId` from app state into Supplier Portal.
- Supplier Portal now uses the selected supplier when available.
- Added a clear fallback supplier state for the placeholder portal when no supplier has been selected.
- Preserved supplier visibility rules by keeping client price, agency margin, and internal pricing notes out of the portal.

**Tests**  
- `pnpm run build` passed.
- No automated test script exists beyond the production build.

**Files**  
- `src/App.tsx`
- `src/pages/SupplierPortalPage.tsx`
- `README.md`
- `NEXT_TASK.md`
- `WORK_LOG.md`

**Commit**  
- Commit will be created after this log entry; final automation summary records the SHA.

**Next**  
- Show local supplier time entries in Supplier Portal.

---

### 2026-07-12 - Supplier portal local time entries

**Work unit**  
Show selected supplier local time entries in Supplier Portal.

**Changes**  
- Passed app-level local `timeEntries` into Supplier Portal.
- Added a supplier-facing time-entry table filtered to the selected or fallback supplier.
- Marked approved supplier time as payable and submitted/rejected time as not payable until agency approval.
- Preserved supplier visibility rules by keeping client price, agency margin, and internal pricing notes out of the portal.

**Tests**  
- `pnpm run build` passed.
- No automated test script exists beyond the production build.

**Files**  
- `src/App.tsx`
- `src/pages/SupplierPortalPage.tsx`
- `README.md`
- `NEXT_TASK.md`
- `WORK_LOG.md`

**Commit**  
- Commit will be created after this log entry; final automation summary records the SHA.

**Next**  
- Add a Supplier Detail action that opens Supplier Portal for the selected supplier context.

---

### 2026-07-12 - Supplier detail opens portal context

**Work unit**  
Add a Supplier Detail action that opens Supplier Portal for the selected supplier context.

**Changes**  
- Added an app-level handler that opens Supplier Portal while preserving `selectedSupplierId`.
- Passed the handler into Supplier Detail.
- Added an "Open supplier portal" action to Supplier Detail.
- Preserved supplier visibility rules by keeping client price, agency margin, and internal pricing notes out of supplier-facing screens.

**Tests**  
- `pnpm run build` passed.
- No automated test script exists beyond the production build.

**Files**  
- `src/App.tsx`
- `src/pages/SupplierDetailPage.tsx`
- `README.md`
- `NEXT_TASK.md`
- `WORK_LOG.md`

**Commit**  
- Commit will be created after this log entry; final automation summary records the SHA.

**Next**  
- Update Client Portal to use selected client context and local client-facing state.

---

### 2026-07-12 - Client portal selected context

**Work unit**  
Update Client Portal to use selected client context and local client-facing state.

**Changes**  
- Passed selected client, local projects, payments, hour banks, and change requests into Client Portal.
- Replaced hardcoded client seed data with selected-client or fallback-client context.
- Added client-facing project status, payment gate, payment/hour-bank, and change-request views.
- Preserved visibility rules by excluding supplier cost, agency margin, and internal pricing notes.

**Tests**  
- `pnpm run build` passed.
- No automated test script exists beyond the production build.

**Files**  
- `src/App.tsx`
- `src/pages/ClientPortalPage.tsx`
- `README.md`
- `NEXT_TASK.md`
- `WORK_LOG.md`

**Commit**  
- Commit will be created after this log entry; final automation summary records the SHA.

**Next**  
- Add a Client Detail action that opens Client Portal for the selected client context.

---

### 2026-07-12 - Client detail opens portal context

**Work unit**  
Add a Client Detail action that opens Client Portal for the selected client context.

**Changes**  
- Added an app-level handler that opens Client Portal while preserving `selectedClientId`.
- Passed the handler into Client Detail.
- Added an "Open client portal" action to Client Detail.
- Preserved client visibility rules by keeping supplier cost, agency margin, and internal pricing notes out of Client Portal.

**Tests**  
- `pnpm run build` passed.
- No automated test script exists beyond the production build.

**Files**  
- `src/App.tsx`
- `src/pages/ClientDetailPage.tsx`
- `README.md`
- `NEXT_TASK.md`
- `WORK_LOG.md`

**Commit**  
- Commit will be created after this log entry; final automation summary records the SHA.

**Next**  
- Show client-visible files and links in Client Portal.

---

### 2026-07-12 - Client portal visible files

**Work unit**  
Show client-visible files and links in Client Portal.

**Changes**  
- Added a client-visible file/link section to Client Portal.
- Filtered project files by selected client projects and `visibility === "client_visible"`.
- Added one client-visible mock file link so the placeholder has a visible client-facing artifact.
- Preserved visibility rules by excluding agency-only and supplier-only files from Client Portal.

**Tests**  
- `pnpm run build` passed.
- No automated test script exists beyond the production build.

**Files**  
- `src/pages/ClientPortalPage.tsx`
- `src/data/mockData.ts`
- `README.md`
- `NEXT_TASK.md`
- `WORK_LOG.md`

**Commit**  
- Commit will be created after this log entry; final automation summary records the SHA.

**Next**  
- Show client-visible project messages in Client Portal.

---

### 2026-07-12 - Client portal visible messages

**Work unit**  
Show client-visible project messages in Client Portal.

**Changes**  
- Added a client-visible messages section to Client Portal.
- Filtered project messages by selected client projects and `visibility === "client_visible"`.
- Used existing mock `projectMessages`; no chat, AI, or notification integration was added.
- Preserved visibility rules by excluding agency-only and supplier-only messages from Client Portal.

**Tests**  
- `pnpm run build` passed.
- No automated test script exists beyond the production build.

**Files**  
- `src/pages/ClientPortalPage.tsx`
- `README.md`
- `NEXT_TASK.md`
- `WORK_LOG.md`

**Commit**  
- Commit will be created after this log entry; final automation summary records the SHA.

**Next**  
- Show supplier-visible files and links in Supplier Portal.

---

### 2026-07-12 - Supplier portal visible files

**Work unit**  
Show supplier-visible files and links in Supplier Portal.

**Changes**  
- Added a supplier-visible file/link section to Supplier Portal.
- Filtered project files by the selected supplier's assigned projects and `visibility === "supplier_visible"`.
- Used existing mock `fileLinks`; no upload or storage integration was added.
- Preserved visibility rules by excluding client-only and agency-only files from Supplier Portal.

**Tests**  
- `pnpm run build` passed.
- No automated test script exists beyond the production build.

**Files**  
- `src/pages/SupplierPortalPage.tsx`
- `README.md`
- `NEXT_TASK.md`
- `WORK_LOG.md`

**Commit**  
- Commit will be created after this log entry; final automation summary records the SHA.

**Next**  
- Show supplier-visible project messages in Supplier Portal.

---

### 2026-07-12 - Supplier portal visible messages

**Work unit**  
Show supplier-visible project messages in Supplier Portal.

**Changes**  
- Added a supplier-visible messages section to Supplier Portal.
- Filtered project messages by the selected supplier's assigned projects and `visibility === "supplier_visible"`.
- Added one supplier-visible mock project message so the placeholder has a visible supplier-facing communication item.
- Preserved visibility rules by excluding client-visible and agency-only messages from Supplier Portal.

**Tests**  
- `pnpm run build` passed.
- No automated test script exists beyond the production build.

**Files**  
- `src/pages/SupplierPortalPage.tsx`
- `src/data/mockData.ts`
- `README.md`
- `NEXT_TASK.md`
- `WORK_LOG.md`

**Commit**  
- Commit will be created after this log entry; final automation summary records the SHA.

**Next**  
- Add consistent empty states to Client Portal and Supplier Portal tables.

---

### 2026-07-12 - Portal empty states

**Work unit**  
Add consistent empty states to Client Portal and Supplier Portal tables.

**Changes**  
- Added a clear empty state when Client Portal has no visible projects for the selected client.
- Added a clear empty state when Supplier Portal has no assigned projects for the selected supplier.
- Kept existing empty states for payments, files, messages, time entries, and change requests unchanged.
- Preserved all existing visibility filters and business rules.

**Tests**  
- `pnpm run build` passed.
- No automated test script exists beyond the production build.

**Files**  
- `src/pages/ClientPortalPage.tsx`
- `src/pages/SupplierPortalPage.tsx`
- `README.md`
- `NEXT_TASK.md`
- `WORK_LOG.md`

**Commit**  
- Commit will be created after this log entry; final automation summary records the SHA.

**Next**  
- Show supplier-visible assigned scope items in Supplier Portal.

---

### 2026-07-12 - Supplier portal scope items

**Work unit**  
Show supplier-visible assigned scope items in Supplier Portal.

**Changes**  
- Added an assigned scope items section to Supplier Portal.
- Filtered scope items by the selected supplier's assigned projects and `supplierVisible === true`.
- Used existing mock `scopes` and `scopeItems`; no workflow, persistence, AI, auth, or payment integration was added.
- Preserved supplier visibility rules by excluding client price, agency margin, internal delivery notes, and pricing notes.

**Tests**  
- `pnpm run build` passed.
- No automated test script exists beyond the production build.

**Files**  
- `src/pages/SupplierPortalPage.tsx`
- `README.md`
- `NEXT_TASK.md`
- `WORK_LOG.md`

**Commit**  
- Commit will be created after this log entry; final automation summary records the SHA.

**Next**  
- Show client-visible scope items in Client Portal.

---

### 2026-07-12 - Client portal scope items

**Work unit**  
Show client-visible scope items in Client Portal.

**Changes**  
- Added a scope items section to Client Portal.
- Filtered scope items by the selected client's projects and `clientVisible === true`.
- Used existing mock `scopes` and `scopeItems`; no workflow, persistence, AI, auth, or payment integration was added.
- Preserved client visibility rules by excluding supplier costs, agency margin, internal delivery notes, and pricing notes.

**Tests**  
- `pnpm run build` passed.
- No automated test script exists beyond the production build.

**Files**  
- `src/pages/ClientPortalPage.tsx`
- `README.md`
- `NEXT_TASK.md`
- `WORK_LOG.md`

**Commit**  
- Commit will be created after this log entry; final automation summary records the SHA.

**Next**  
- Show scope approval details in Client Portal.

---

### 2026-07-12 - Client portal approval details

**Work unit**  
Show scope approval details in Client Portal.

**Changes**  
- Added a scope approvals section to Client Portal.
- Filtered approval records by the selected client's projects.
- Displayed project, scope version/status, approval status, notes, and approved date when available.
- Used existing mock `approvals` and `scopes`; no approval action, persistence, AI, auth, or payment integration was added.
- Preserved client visibility rules by excluding supplier costs, agency margin, internal delivery notes, and pricing notes.

**Tests**  
- `pnpm run build` passed.
- No automated test script exists beyond the production build.

**Files**  
- `src/pages/ClientPortalPage.tsx`
- `README.md`
- `NEXT_TASK.md`
- `WORK_LOG.md`

**Commit**  
- Commit will be created after this log entry; final automation summary records the SHA.

**Next**  
- Show client-facing change request prices in Client Portal.

---

### 2026-07-12 - Client portal change request prices

**Work unit**  
Show client-facing change request prices in Client Portal.

**Changes**  
- Added a client price column to Client Portal change requests.
- Displayed `agencyPrice` when present and a clear awaiting-pricing state when absent.
- Preserved client visibility rules by excluding supplier costs, agency margin, internal pricing notes, and supplier cost estimates.
- No change request action, persistence, AI, auth, or payment integration was added.

**Tests**  
- `pnpm run build` passed.
- No automated test script exists beyond the production build.

**Files**  
- `src/pages/ClientPortalPage.tsx`
- `README.md`
- `NEXT_TASK.md`
- `WORK_LOG.md`

**Commit**  
- Commit will be created after this log entry; final automation summary records the SHA.

**Next**  
- Show approved payable amounts in Supplier Portal.

---

### 2026-07-12 - Supplier portal payable summary

**Work unit**  
Show approved payable amounts in Supplier Portal.

**Changes**  
- Added a read-only payable summary to Supplier Portal.
- Calculated total approved hours for the selected supplier.
- Calculated estimated payable amount from the selected supplier's hourly rate in `supplierProfiles`.
- Clearly excluded submitted and rejected time from payable totals.
- Preserved supplier visibility rules by excluding client price, agency margin, internal pricing notes, and payment actions.

**Tests**  
- `pnpm run build` passed.
- No automated test script exists beyond the production build.

**Files**  
- `src/pages/SupplierPortalPage.tsx`
- `README.md`
- `NEXT_TASK.md`
- `WORK_LOG.md`

**Commit**  
- Commit will be created after this log entry; final automation summary records the SHA.

**Next**  
- Show project-level payable breakdown in Supplier Portal.

---

### 2026-07-12 - Supplier portal payable breakdown

**Work unit**  
Show project-level payable breakdown in Supplier Portal.

**Changes**  
- Added a payable project breakdown to Supplier Portal.
- Grouped approved time entries by project for the selected supplier.
- Displayed project name, approved hours, and estimated payable amount using the supplier's hourly rate.
- Kept submitted and rejected time excluded from payable totals.
- Preserved supplier visibility rules by excluding client price, agency margin, internal pricing notes, and payment actions.

**Tests**  
- `pnpm run build` passed.
- No automated test script exists beyond the production build.

**Files**  
- `src/pages/SupplierPortalPage.tsx`
- `README.md`
- `NEXT_TASK.md`
- `WORK_LOG.md`

**Commit**  
- Commit will be created after this log entry; final automation summary records the SHA.

**Next**  
- Show payment due details in Client Portal.

---

### 2026-07-12 - Client portal payment details

**Work unit**  
Show payment due details in Client Portal.

**Changes**  
- Added due date, received date, and notes columns to Client Portal payment rows.
- Used existing local `ClientPayment` records; no payment action or provider integration was added.
- Preserved client visibility rules by excluding supplier cost, agency margin, and internal pricing notes.

**Tests**  
- `pnpm run build` passed.
- No automated test script exists beyond the production build.

**Files**  
- `src/pages/ClientPortalPage.tsx`
- `README.md`
- `NEXT_TASK.md`
- `WORK_LOG.md`

**Commit**  
- Commit will be created after this log entry; final automation summary records the SHA.

**Next**  
- Show paid hour expiry dates in Client Portal.

---

### 2026-07-13 - Client portal paid hour expiry

**Work unit**  
Show paid hour expiry dates in Client Portal.

**Changes**  
- Added an expiry column to Client Portal paid hour rows.
- Displayed `expiryDate` when available and a clear `No expiry` state when absent.
- Used existing local `HourBank` records; no billing action, persistence, AI, auth, or payment integration was added.
- Preserved client visibility rules by excluding supplier cost, agency margin, and internal pricing notes.

**Tests**  
- `pnpm run build` passed.
- No automated test script exists beyond the production build.

**Files**  
- `src/pages/ClientPortalPage.tsx`
- `README.md`
- `NEXT_TASK.md`
- `WORK_LOG.md`

**Commit**  
- Commit will be created after this log entry; final automation summary records the SHA.

**Next**  
- Show paid hour usage in Client Portal.

---

### 2026-07-13 - Client portal paid hour usage

**Work unit**  
Show paid hour usage in Client Portal.

**Changes**  
- Added a used hours column to Client Portal paid hour rows.
- Continued showing purchased, remaining, and expiry values from existing local `HourBank` records.
- Preserved client visibility rules by excluding supplier cost, agency margin, and internal pricing notes.

**Tests**  
- `pnpm run build` passed.
- No automated test script exists beyond the production build.

**Files**  
- `src/pages/ClientPortalPage.tsx`
- `README.md`
- `NEXT_TASK.md`
- `WORK_LOG.md`

**Commit**  
- Commit will be created after this log entry; final automation summary records the SHA.

**Next**  
- Show paid hour usage percentage in Client Portal.

---

### 2026-07-13 - Client portal paid hour usage percent

**Work unit**  
Show paid hour usage percentage in Client Portal.

**Changes**  
- Added a usage percentage column to Client Portal paid hour rows.
- Calculated usage from existing `hoursUsed` and `hoursPurchased` values with a safe zero-hour fallback.
- Continued showing purchased, used, remaining, and expiry values from existing local `HourBank` records.
- Preserved client visibility rules by excluding supplier cost, agency margin, and internal pricing notes.

**Tests**  
- `pnpm run build` passed.
- No automated test script exists beyond the production build.

**Files**  
- `src/pages/ClientPortalPage.tsx`
- `README.md`
- `NEXT_TASK.md`
- `WORK_LOG.md`

**Commit**  
- Commit will be created after this log entry; final automation summary records the SHA.

**Next**  
- Show change request approval dates in Client Portal.

---

### 2026-07-13 - Client portal change request approval dates

**Work unit**  
Show change request approval dates in Client Portal.

**Changes**  
- Added an approved date column to Client Portal change request rows.
- Displayed `approvedDate` when available and a clear pending approval state when absent.
- Preserved client visibility rules by excluding supplier cost, agency margin, and internal pricing notes.
- No change request action, persistence, AI, auth, or payment integration was added.

**Tests**  
- `pnpm run build` passed.
- No automated test script exists beyond the production build.

**Files**  
- `src/pages/ClientPortalPage.tsx`
- `README.md`
- `NEXT_TASK.md`
- `WORK_LOG.md`

**Commit**  
- Commit will be created after this log entry; final automation summary records the SHA.

**Next**  
- Show change request descriptions in Client Portal.

---

### 2026-07-13 - Client portal change request descriptions

**Work unit**  
Show change request descriptions in Client Portal.

**Changes**  
- Added a description column to Client Portal change request rows.
- Kept existing status, client-facing price, approved date, and rule columns visible.
- Preserved client visibility rules by excluding supplier cost, agency margin, and internal pricing notes.
- No change request action, persistence, AI, auth, or payment integration was added.

**Tests**  
- `pnpm run build` passed.
- No automated test script exists beyond the production build.

**Files**  
- `src/pages/ClientPortalPage.tsx`
- `README.md`
- `NEXT_TASK.md`
- `WORK_LOG.md`

**Commit**  
- Commit will be created after this log entry; final automation summary records the SHA.

**Next**  
- Show change request pricing state in Client Portal.

---

### 2026-07-13 - Client portal change request pricing state

**Work unit**  
Show change request pricing state in Client Portal.

**Changes**  
- Added a pricing state column to Client Portal change request rows.
- Displayed `Priced` when `agencyPrice` exists and `Awaiting agency pricing` when missing.
- Preserved client visibility rules by excluding supplier cost, agency margin, and internal pricing notes.
- No change request action, persistence, AI, auth, or payment integration was added.

**Tests**  
- `pnpm run build` passed.
- No automated test script exists beyond the production build.

**Files**  
- `src/pages/ClientPortalPage.tsx`
- `README.md`
- `NEXT_TASK.md`
- `WORK_LOG.md`

**Commit**  
- Commit will be created after this log entry; final automation summary records the SHA.

**Next**  
- Show change request work readiness in Client Portal.

---

### 2026-07-13 - Client portal change request work readiness

**Work unit**  
Show change request work readiness in Client Portal.

**Changes**  
- Added a work readiness column to Client Portal change request rows.
- Displayed `Ready for work review` when `status === "client_approved"`.
- Displayed `Blocked until priced and approved` for change requests that are not client approved.
- Preserved client visibility rules by excluding supplier cost, agency margin, and internal pricing notes.
- No change request action, persistence, AI, auth, or payment integration was added.

**Tests**  
- `pnpm run build` passed.
- No automated test script exists beyond the production build.

**Files**  
- `src/pages/ClientPortalPage.tsx`
- `README.md`
- `NEXT_TASK.md`
- `WORK_LOG.md`

**Commit**  
- Commit will be created after this log entry; final automation summary records the SHA.

**Next**  
- Show related project status for Client Portal change requests.

---

### 2026-07-13 - Client portal change request project status

**Work unit**  
Show related project status for Client Portal change requests.

**Changes**  
- Added a project status column to Client Portal change request rows.
- Displayed the related project's client-safe status label when the project is found.
- Added a clear `Project not found` fallback for missing project data.
- Preserved client visibility rules by excluding supplier cost, agency margin, and internal pricing notes.
- No change request action, persistence, AI, auth, or payment integration was added.

**Tests**  
- `pnpm run build` passed.
- No automated test script exists beyond the production build.

**Files**  
- `src/pages/ClientPortalPage.tsx`
- `README.md`
- `NEXT_TASK.md`
- `WORK_LOG.md`

**Commit**  
- Commit will be created after this log entry; final automation summary records the SHA.

**Next**  
- Show the related project start rule for Client Portal change requests.

---

### 2026-07-13 - Client portal change request project start rule

**Work unit**  
Show related project start rule for Client Portal change requests.

**Changes**  
- Added a project start rule column to Client Portal change request rows.
- Reused the existing `canWorkStart(project)` rule to show whether the base project is ready.
- Added a clear `Project not found` fallback for missing project data.
- Preserved client visibility rules by excluding supplier cost, agency margin, and internal pricing notes.
- No change request action, persistence, AI, auth, or payment integration was added.

**Tests**  
- `pnpm run build` passed.
- No automated test script exists beyond the production build.

**Files**  
- `src/pages/ClientPortalPage.tsx`
- `README.md`
- `NEXT_TASK.md`
- `WORK_LOG.md`

**Commit**  
- Commit will be created after this log entry; final automation summary records the SHA.

**Next**  
- Group project context and change request context in the Client Portal change request section.

---

### 2026-07-13 - Client portal change request context grouping

**Work unit**  
Group project context and change request context in the Client Portal change request section.

**Changes**  
- Added a short client-facing context label above the Change Requests table.
- Clarified which columns describe the base project and which describe the change request.
- Kept the existing change request table columns and values intact.
- Preserved client visibility rules by excluding supplier cost, agency margin, and internal pricing notes.
- No change request action, persistence, AI, auth, or payment integration was added.

**Tests**  
- `pnpm run build` passed.
- No automated test script exists beyond the production build.

**Files**  
- `src/pages/ClientPortalPage.tsx`
- `README.md`
- `NEXT_TASK.md`
- `WORK_LOG.md`

**Commit**  
- Commit will be created after this log entry; final automation summary records the SHA.

**Next**  
- Review Supplier Portal assigned project rows and add a supplier-safe start rule if missing.

---

### 2026-07-13 - Supplier portal assigned project start rule

**Work unit**  
Show a supplier-safe start rule for assigned project rows.

**Changes**  
- Reviewed Supplier Portal assigned project rows and confirmed a start rule column already existed.
- Replaced the vague blocked state with `Blocked until agency approval, payment, or paid hours`.
- Renamed the ready state to `Ready to start`.
- Preserved supplier visibility rules by excluding client price, agency margin, and internal pricing notes.
- No supplier action, persistence, AI, auth, or payment integration was added.

**Tests**  
- `pnpm run build` passed.
- No automated test script exists beyond the production build.

**Files**  
- `src/pages/SupplierPortalPage.tsx`
- `README.md`
- `NEXT_TASK.md`
- `WORK_LOG.md`

**Commit**  
- Commit will be created after this log entry; final automation summary records the SHA.

**Next**  
- Show assigned project status in Supplier Portal.

---

### 2026-07-13 - Supplier portal assigned project status

**Work unit**  
Show assigned project status in Supplier Portal.

**Changes**  
- Added a project status column to Supplier Portal assigned project rows.
- Reused the existing `statusLabels` mapping for supplier-safe project status text.
- Preserved the existing start rule and visible instruction columns.
- Preserved supplier visibility rules by excluding client price, agency margin, and internal pricing notes.
- No supplier action, persistence, AI, auth, or payment integration was added.

**Tests**  
- `pnpm run build` passed.
- No automated test script exists beyond the production build.

**Files**  
- `src/pages/SupplierPortalPage.tsx`
- `README.md`
- `NEXT_TASK.md`
- `WORK_LOG.md`

**Commit**  
- Commit will be created after this log entry; final automation summary records the SHA.

**Next**  
- Add a supplier-safe context label above the Supplier Portal assigned projects table.

---

### 2026-07-13 - Supplier portal assigned project context label

**Work unit**  
Add a supplier-safe context label above the Supplier Portal assigned projects table.

**Changes**  
- Added a short supplier-facing context label above the assigned projects table.
- Clarified that visible project context includes assigned project, delivery status, start readiness, and visible work instructions only.
- Kept existing assigned project columns and values intact.
- Preserved supplier visibility rules by excluding client price, agency margin, and internal pricing notes.
- No supplier action, persistence, AI, auth, or payment integration was added.

**Tests**  
- `pnpm run build` passed.
- No automated test script exists beyond the production build.

**Files**  
- `src/pages/SupplierPortalPage.tsx`
- `README.md`
- `NEXT_TASK.md`
- `WORK_LOG.md`

**Commit**  
- Commit will be created after this log entry; final automation summary records the SHA.

**Next**  
- Add a supplier-safe context label above the Supplier Portal time entry/payable section.

---

### 2026-07-13 - Supplier portal time entry context label

**Work unit**  
Add a supplier-safe context label above the Supplier Portal time entry/payable section.

**Changes**  
- Added a short supplier-facing context label under `My time entries`.
- Clarified that approved time is payable and submitted or rejected time is excluded until agency approval.
- Kept existing time-entry stats, payable project table, and time-entry rows intact.
- Preserved supplier visibility rules by excluding client price, agency margin, and internal pricing notes.
- No supplier action, persistence, AI, auth, or payment integration was added.

**Tests**  
- `pnpm run build` passed.
- No automated test script exists beyond the production build.

**Files**  
- `src/pages/SupplierPortalPage.tsx`
- `README.md`
- `NEXT_TASK.md`
- `WORK_LOG.md`

**Commit**  
- Commit will be created after this log entry; final automation summary records the SHA.

**Next**  
- Add descriptions to Supplier Portal time-entry rows.

---

### 2026-07-13 - Supplier portal time entry descriptions

**Work unit**  
Add descriptions to Supplier Portal time-entry rows.

**Changes**  
- Added a description column to Supplier Portal time-entry rows.
- Displayed each `TimeEntry.description` alongside project, date, hours, status, and payable rule.
- Kept existing time-entry stats and payable project table intact.
- Preserved supplier visibility rules by excluding client price, agency margin, and internal pricing notes.
- No supplier action, persistence, AI, auth, or payment integration was added.

**Tests**  
- `pnpm run build` passed.
- No automated test script exists beyond the production build.

**Files**  
- `src/pages/SupplierPortalPage.tsx`
- `README.md`
- `NEXT_TASK.md`
- `WORK_LOG.md`

**Commit**  
- Commit will be created after this log entry; final automation summary records the SHA.

**Next**  
- Add approval owner context to Supplier Portal time-entry rows.

---

### 2026-07-13 - Supplier portal time entry approval owner

**Work unit**  
Add approval owner context to Supplier Portal time-entry rows.

**Changes**  
- Added an `Approved by` column to Supplier Portal time-entry rows.
- Displayed `approvedBy` when available.
- Displayed `Awaiting agency approval` when no approver is recorded.
- Kept existing time-entry stats, payable project table, description, status, and payable rule intact.
- Preserved supplier visibility rules by excluding client price, agency margin, and internal pricing notes.
- No supplier action, persistence, AI, auth, or payment integration was added.

**Tests**  
- `pnpm run build` passed.
- No automated test script exists beyond the production build.

**Files**  
- `src/pages/SupplierPortalPage.tsx`
- `README.md`
- `NEXT_TASK.md`
- `WORK_LOG.md`

**Commit**  
- Commit will be created after this log entry; final automation summary records the SHA.

**Next**  
- Add approval counts to Supplier Portal time-entry stats.

---

### 2026-07-13 - Supplier portal time entry approval summary

**Work unit**  
Add approval counts to Supplier Portal time-entry stats.

**Changes**  
- Added an approved entry count to Supplier Portal time-entry stats.
- Added a non-approved entry count labeled as awaiting agency approval.
- Kept payable hours, payable amount, excluded hours, payable project table, and time-entry rows intact.
- Preserved supplier visibility rules by excluding client price, agency margin, and internal pricing notes.
- No supplier action, persistence, AI, auth, or payment integration was added.

**Tests**  
- `pnpm run build` passed.
- No automated test script exists beyond the production build.

**Files**  
- `src/pages/SupplierPortalPage.tsx`
- `README.md`
- `NEXT_TASK.md`
- `WORK_LOG.md`

**Commit**  
- Commit will be created after this log entry; final automation summary records the SHA.

**Next**  
- Add project status labels to Supplier Portal assigned scope item rows.

---

### 2026-07-13 - Supplier portal scope item project status

**Work unit**  
Add project status labels to Supplier Portal assigned scope item rows.

**Changes**  
- Added a project status column to Supplier Portal assigned scope item rows.
- Displayed the parent project's supplier-safe status label when available.
- Added a clear `Project not found` fallback for missing project data.
- Kept existing scope, phase, item, and acceptance columns intact.
- Preserved supplier visibility rules by excluding client price, agency margin, and internal pricing notes.
- No supplier action, persistence, AI, auth, or payment integration was added.

**Tests**  
- `pnpm run build` passed.
- No automated test script exists beyond the production build.

**Files**  
- `src/pages/SupplierPortalPage.tsx`
- `README.md`
- `NEXT_TASK.md`
- `WORK_LOG.md`

**Commit**  
- Commit will be created after this log entry; final automation summary records the SHA.

**Next**  
- Add parent project start rules to Supplier Portal assigned scope item rows.

---

### 2026-07-13 - Supplier portal scope item project start rule

**Work unit**  
Add parent project start rules to Supplier Portal assigned scope item rows.

**Changes**  
- Added a project start rule column to Supplier Portal assigned scope item rows.
- Reused the existing `canWorkStart(project)` gate for supplier-safe readiness text.
- Added a clear `Project not found` fallback for missing project data.
- Kept existing project, project status, scope, phase, item, and acceptance columns intact.
- Preserved supplier visibility rules by excluding client price, agency margin, and internal pricing notes.
- No supplier action, persistence, AI, auth, or payment integration was added.

**Tests**  
- `pnpm run build` passed.
- No automated test script exists beyond the production build.

**Files**  
- `src/pages/SupplierPortalPage.tsx`
- `README.md`
- `NEXT_TASK.md`
- `WORK_LOG.md`

**Commit**  
- Commit will be created after this log entry; final automation summary records the SHA.

**Next**  
- Add a supplier-safe context label above the Supplier Portal assigned scope items table.

---

### 2026-07-13 - Supplier portal scope item context label

**Work unit**  
Add a supplier-safe context label above the Supplier Portal assigned scope items table.

**Changes**  
- Added a short supplier-facing context label above the assigned scope items table.
- Clarified that the section shows parent project status, start readiness, scope version, phase, item details, and acceptance notes only.
- Kept existing assigned scope item columns and values intact.
- Preserved supplier visibility rules by excluding client price, agency margin, and internal pricing notes.
- No supplier action, persistence, AI, auth, or payment integration was added.

**Tests**  
- `pnpm run build` passed.
- No automated test script exists beyond the production build.

**Files**  
- `src/pages/SupplierPortalPage.tsx`
- `README.md`
- `NEXT_TASK.md`
- `WORK_LOG.md`

**Commit**  
- Commit will be created after this log entry; final automation summary records the SHA.

**Next**  
- Add project status labels to Supplier Portal supplier-visible file rows.

---

### 2026-07-13 - Supplier portal file project status

**Work unit**  
Add project status labels to Supplier Portal supplier-visible file rows.

**Changes**  
- Added a project status column to Supplier Portal supplier-visible file rows.
- Displayed the parent project's supplier-safe status label when available.
- Added a clear `Project not found` fallback for missing project data.
- Kept existing file title, project, type, and link columns intact.
- Preserved supplier visibility rules by excluding client price, agency margin, and internal pricing notes.
- No supplier action, persistence, AI, auth, or payment integration was added.

**Tests**  
- `pnpm run build` passed.
- No automated test script exists beyond the production build.

**Files**  
- `src/pages/SupplierPortalPage.tsx`
- `README.md`
- `NEXT_TASK.md`
- `WORK_LOG.md`

**Commit**  
- Commit will be created after this log entry; final automation summary records the SHA.

**Next**  
- Add parent project start rules to Supplier Portal supplier-visible file rows.

---

### 2026-07-13 - Supplier portal file project start rule

**Work unit**  
Add parent project start rules to Supplier Portal supplier-visible file rows.

**Changes**  
- Added a project start rule column to Supplier Portal supplier-visible file rows.
- Reused the existing `canWorkStart(project)` gate for supplier-safe readiness text.
- Added a clear `Project not found` fallback for missing project data.
- Kept existing file title, project, project status, type, and link columns intact.
- Preserved supplier visibility rules by excluding client price, agency margin, and internal pricing notes.
- No supplier action, persistence, AI, auth, or payment integration was added.

**Tests**  
- `pnpm run build` passed.
- No automated test script exists beyond the production build.

**Files**  
- `src/pages/SupplierPortalPage.tsx`
- `README.md`
- `NEXT_TASK.md`
- `WORK_LOG.md`

**Commit**  
- Commit will be created after this log entry; final automation summary records the SHA.

**Next**  
- Add a supplier-safe context label above the Supplier Portal files and links table.

---

### 2026-07-13 - Supplier portal file context label

**Work unit**  
Add a supplier-safe context label above the Supplier Portal files and links table.

**Changes**  
- Added a short supplier-facing context label above the files and links table.
- Clarified that the section shows parent project status, start readiness, file type, and supplier-visible links only.
- Kept existing file title, project, project status, project start rule, type, and link columns intact.
- Preserved supplier visibility rules by excluding client price, agency margin, and internal pricing notes.
- No supplier action, persistence, AI, auth, or payment integration was added.

**Tests**  
- `pnpm run build` passed.
- No automated test script exists beyond the production build.

**Files**  
- `src/pages/SupplierPortalPage.tsx`
- `README.md`
- `NEXT_TASK.md`
- `WORK_LOG.md`

**Commit**  
- Commit will be created after this log entry; final automation summary records the SHA.

**Next**  
- Add project status labels to Supplier Portal supplier-visible message rows.

---

### 2026-07-13 - Supplier portal message project status

**Work unit**  
Add parent project status labels to Supplier Portal supplier-visible message rows.

**Changes**  
- Added a project status column to Supplier Portal supplier-visible message rows.
- Used the existing supplier-safe `statusLabels` mapping for assigned project status.
- Added a clear `Project not found` fallback for missing project data.
- Kept existing message project, from, message, and date columns intact.
- Preserved supplier visibility rules by excluding client price, agency margin, and internal pricing notes.
- No supplier action, persistence, AI, auth, notification, or payment integration was added.

**Tests**  
- `pnpm run build` passed.
- No automated test script exists beyond the production build.

**Files**  
- `src/pages/SupplierPortalPage.tsx`
- `README.md`
- `NEXT_TASK.md`
- `WORK_LOG.md`

**Commit**  
- Commit will be created after this log entry; final automation summary records the SHA.

**Next**  
- Add a supplier-safe context label above the Supplier Portal messages table.

---

### 2026-07-13 - Supplier portal message context label

**Work unit**  
Add a supplier-safe context label above the Supplier Portal messages table.

**Changes**  
- Added a short supplier-facing context label above the messages table.
- Clarified that the section shows parent project status, sender role, message body, and date for supplier-visible updates only.
- Kept existing message project, project status, from, message, and date columns intact.
- Preserved supplier visibility rules by excluding client price, agency margin, and internal pricing notes.
- No supplier action, persistence, AI, auth, notification, or payment integration was added.

**Tests**  
- `pnpm run build` passed.
- No automated test script exists beyond the production build.

**Files**  
- `src/pages/SupplierPortalPage.tsx`
- `README.md`
- `NEXT_TASK.md`
- `WORK_LOG.md`

**Commit**  
- Commit will be created after this log entry; final automation summary records the SHA.

**Next**  
- Add parent project start rules to Supplier Portal supplier-visible message rows.

---

### 2026-07-13 - Supplier portal message start rule

**Work unit**  
Add parent project start rules to Supplier Portal supplier-visible message rows.

**Changes**  
- Added a project start rule column to Supplier Portal supplier-visible message rows.
- Reused the existing `canWorkStart(project)` gate for supplier-safe readiness text.
- Added a clear `Project not found` fallback for missing project data.
- Kept existing message project, project status, from, message, and date columns intact.
- Preserved supplier visibility rules by excluding client price, agency margin, and internal pricing notes.
- No supplier action, persistence, AI, auth, notification, or payment integration was added.

**Tests**  
- `pnpm run build` passed.
- No automated test script exists beyond the production build.

**Files**  
- `src/pages/SupplierPortalPage.tsx`
- `README.md`
- `NEXT_TASK.md`
- `WORK_LOG.md`

**Commit**  
- Commit will be created after this log entry; final automation summary records the SHA.

**Next**  
- Review Client Portal files and links, then add one small client-safe context improvement if missing.

---

### 2026-07-13 - Client portal file context label

**Work unit**  
Review Client Portal files and links, then add one small client-safe context improvement if missing.

**Changes**  
- Reviewed the Client Portal files and links section.
- Added a short client-facing context label above the files and links table.
- Clarified that the section shows project, file type, and client-visible links only.
- Kept existing file title, project, type, and link columns intact.
- Preserved client visibility rules by excluding supplier cost, agency margin, and internal pricing notes.
- No client action, persistence, AI, auth, notification, or payment integration was added.

**Tests**  
- `pnpm run build` passed.
- No automated test script exists beyond the production build.

**Files**  
- `src/pages/ClientPortalPage.tsx`
- `README.md`
- `NEXT_TASK.md`
- `WORK_LOG.md`

**Commit**  
- Commit will be created after this log entry; final automation summary records the SHA.

**Next**  
- Add parent project status labels to Client Portal client-visible file rows.

---

### 2026-07-13 - Client portal file project status

**Work unit**  
Add parent project status labels to Client Portal client-visible file rows.

**Changes**  
- Added a project status column to Client Portal client-visible file rows.
- Used the existing `statusLabels` mapping for client-safe project status text.
- Added a clear `Project not found` fallback for missing project data.
- Kept existing file title, project, type, and link columns intact.
- Preserved client visibility rules by excluding supplier cost, agency margin, and internal pricing notes.
- No client action, persistence, AI, auth, notification, or payment integration was added.

**Tests**  
- `pnpm run build` passed.
- No automated test script exists beyond the production build.

**Files**  
- `src/pages/ClientPortalPage.tsx`
- `README.md`
- `NEXT_TASK.md`
- `WORK_LOG.md`

**Commit**  
- Commit will be created after this log entry; final automation summary records the SHA.

**Next**  
- Add parent project start rules to Client Portal client-visible file rows.

---

### 2026-07-13 - Client portal file start rule

**Work unit**  
Add parent project start rules to Client Portal client-visible file rows.

**Changes**  
- Added a project start rule column to Client Portal client-visible file rows.
- Reused the existing `canWorkStart(project)` gate for client-safe readiness text.
- Added a clear `Project not found` fallback for missing project data.
- Kept existing file title, project, project status, type, and link columns intact.
- Preserved client visibility rules by excluding supplier cost, agency margin, and internal pricing notes.
- No client action, persistence, AI, auth, notification, or payment integration was added.

**Tests**  
- `pnpm run build` passed.
- No automated test script exists beyond the production build.

**Files**  
- `src/pages/ClientPortalPage.tsx`
- `README.md`
- `NEXT_TASK.md`
- `WORK_LOG.md`

**Commit**  
- Commit will be created after this log entry; final automation summary records the SHA.

**Next**  
- Add a short client-safe context label above the Client Portal messages table.

---

### 2026-07-13 - Client portal message context label

**Work unit**  
Add a short client-safe context label above the Client Portal messages table.

**Changes**  
- Added a short client-facing context label above the messages table.
- Clarified that the section shows project, sender role, message body, and date for client-visible updates only.
- Kept existing message project, from, message, and date columns intact.
- Preserved client visibility rules by excluding supplier cost, agency margin, and internal pricing notes.
- No client action, persistence, AI, auth, notification, or payment integration was added.

**Tests**  
- `pnpm run build` passed.
- No automated test script exists beyond the production build.

**Files**  
- `src/pages/ClientPortalPage.tsx`
- `README.md`
- `NEXT_TASK.md`
- `WORK_LOG.md`

**Commit**  
- Commit will be created after this log entry; final automation summary records the SHA.

**Next**  
- Add parent project status labels to Client Portal client-visible message rows.

---

### 2026-07-13 - Client portal message project status

**Work unit**  
Add parent project status labels to Client Portal client-visible message rows.

**Changes**  
- Added a project status column to Client Portal client-visible message rows.
- Used the existing `statusLabels` mapping for client-safe project status text.
- Added a clear `Project not found` fallback for missing project data.
- Kept existing message project, from, message, and date columns intact.
- Preserved client visibility rules by excluding supplier cost, agency margin, and internal pricing notes.
- No client action, persistence, AI, auth, notification, or payment integration was added.

**Tests**  
- `pnpm run build` passed.
- No automated test script exists beyond the production build.

**Files**  
- `src/pages/ClientPortalPage.tsx`
- `README.md`
- `NEXT_TASK.md`
- `WORK_LOG.md`

**Commit**  
- Commit will be created after this log entry; final automation summary records the SHA.

**Next**  
- Add parent project start rules to Client Portal client-visible message rows.

---

### 2026-07-13 - Client portal message start rule

**Work unit**  
Add parent project start rules to Client Portal client-visible message rows.

**Changes**  
- Added a project start rule column to Client Portal client-visible message rows.
- Reused the existing `canWorkStart(project)` gate for client-safe readiness text.
- Added a clear `Project not found` fallback for missing project data.
- Kept existing message project, project status, from, message, and date columns intact.
- Preserved client visibility rules by excluding supplier cost, agency margin, and internal pricing notes.
- No client action, persistence, AI, auth, notification, or payment integration was added.

**Tests**  
- `pnpm run build` passed.
- No automated test script exists beyond the production build.

**Files**  
- `src/pages/ClientPortalPage.tsx`
- `README.md`
- `NEXT_TASK.md`
- `WORK_LOG.md`

**Commit**  
- Commit will be created after this log entry; final automation summary records the SHA.

**Next**  
- Add a short client-safe context label above the Client Portal scope items table.

---

### 2026-07-13 - Client portal scope context label

**Work unit**  
Add a short client-safe context label above the Client Portal scope items table.

**Changes**  
- Added a short client-facing context label above the scope items table.
- Clarified that the section shows project, scope version, phase, item details, and acceptance notes only.
- Kept existing scope item project, scope, phase, item, and acceptance columns intact.
- Preserved client visibility rules by excluding supplier cost, agency margin, and internal pricing notes.
- No client action, persistence, AI, auth, notification, or payment integration was added.

**Tests**  
- `pnpm run build` passed.
- No automated test script exists beyond the production build.

**Files**  
- `src/pages/ClientPortalPage.tsx`
- `README.md`
- `NEXT_TASK.md`
- `WORK_LOG.md`

**Commit**  
- Commit will be created after this log entry; final automation summary records the SHA.

**Next**  
- Add parent project status labels to Client Portal client-visible scope item rows.

---

### 2026-07-13 - Client portal scope project status

**Work unit**  
Add parent project status labels to Client Portal client-visible scope item rows.

**Changes**  
- Added a project status column to Client Portal client-visible scope item rows.
- Used the existing `statusLabels` mapping for client-safe project status text.
- Added a clear `Project not found` fallback for missing project data.
- Kept existing scope item project, scope, phase, item, and acceptance columns intact.
- Preserved client visibility rules by excluding supplier cost, agency margin, and internal pricing notes.
- No client action, persistence, AI, auth, notification, or payment integration was added.

**Tests**  
- `pnpm run build` passed.
- No automated test script exists beyond the production build.

**Files**  
- `src/pages/ClientPortalPage.tsx`
- `README.md`
- `NEXT_TASK.md`
- `WORK_LOG.md`

**Commit**  
- Commit will be created after this log entry; final automation summary records the SHA.

**Next**  
- Add parent project start rules to Client Portal client-visible scope item rows.

---

### 2026-07-13 - Client portal scope start rule

**Work unit**  
Add parent project start rules to Client Portal client-visible scope item rows.

**Changes**  
- Added a project start rule column to Client Portal client-visible scope item rows.
- Reused the existing `canWorkStart(project)` gate for client-safe readiness text.
- Added a clear `Project not found` fallback for missing project data.
- Kept existing scope item project, project status, scope, phase, item, and acceptance columns intact.
- Preserved client visibility rules by excluding supplier cost, agency margin, and internal pricing notes.
- No client action, persistence, AI, auth, notification, or payment integration was added.

**Tests**  
- `pnpm run build` passed.
- No automated test script exists beyond the production build.

**Files**  
- `src/pages/ClientPortalPage.tsx`
- `README.md`
- `NEXT_TASK.md`
- `WORK_LOG.md`

**Commit**  
- Commit will be created after this log entry; final automation summary records the SHA.

**Next**  
- Add a short client-safe context label above the Client Portal scope approvals table.

---

### 2026-07-13 - Client portal scope approval context label

**Work unit**  
Add a short client-safe context label above the Client Portal scope approvals table.

**Changes**  
- Added a short client-facing context label above the scope approvals table.
- Clarified that the section shows project, scope version, approval state, notes, and approved date only.
- Kept existing scope approval project, scope, approval, notes, and approved date columns intact.
- Preserved client visibility rules by excluding supplier cost, agency margin, and internal pricing notes.
- No approval action, persistence, AI, auth, notification, or payment integration was added.

**Tests**  
- `pnpm run build` passed.
- No automated test script exists beyond the production build.

**Files**  
- `src/pages/ClientPortalPage.tsx`
- `README.md`
- `NEXT_TASK.md`
- `WORK_LOG.md`

**Commit**  
- Commit will be created after this log entry; final automation summary records the SHA.

**Next**  
- Add parent project status labels to Client Portal scope approval rows.

---

### 2026-07-13 - Client portal approval project status

**Work unit**  
Add parent project status labels to Client Portal scope approval rows.

**Changes**  
- Added a project status column to Client Portal scope approval rows.
- Used the existing `statusLabels` mapping for client-safe project status text.
- Added a clear `Project not found` fallback for missing project data.
- Kept existing scope approval project, scope, approval, notes, and approved date columns intact.
- Preserved client visibility rules by excluding supplier cost, agency margin, and internal pricing notes.
- No approval action, persistence, AI, auth, notification, or payment integration was added.

**Tests**  
- `pnpm run build` passed.
- No automated test script exists beyond the production build.

**Files**  
- `src/pages/ClientPortalPage.tsx`
- `README.md`
- `NEXT_TASK.md`
- `WORK_LOG.md`

**Commit**  
- Commit will be created after this log entry; final automation summary records the SHA.

**Next**  
- Add parent project start rules to Client Portal scope approval rows.

---

### 2026-07-13 - Client portal approval start rule

**Work unit**  
Add parent project start rules to Client Portal scope approval rows.

**Changes**  
- Added a project start rule column to Client Portal scope approval rows.
- Reused the existing `canWorkStart(project)` gate for client-safe readiness text.
- Added a clear `Project not found` fallback for missing project data.
- Kept existing scope approval project, project status, scope, approval, notes, and approved date columns intact.
- Preserved client visibility rules by excluding supplier cost, agency margin, and internal pricing notes.
- No approval action, persistence, AI, auth, notification, or payment integration was added.

**Tests**  
- `pnpm run build` passed.
- No automated test script exists beyond the production build.

**Files**  
- `src/pages/ClientPortalPage.tsx`
- `README.md`
- `NEXT_TASK.md`
- `WORK_LOG.md`

**Commit**  
- Commit will be created after this log entry; final automation summary records the SHA.

**Next**  
- Review Client Portal payments and paid hours, then add one small client-safe context improvement if missing.

---

### 2026-07-13 - Client portal payment context label

**Work unit**  
Review Client Portal payments and paid hours, then add one small client-safe context improvement if missing.

**Changes**  
- Reviewed the Client Portal payments and paid hours section.
- Added a short client-facing context label above the payments table.
- Clarified that the payment table shows project, requested amount, payment status, due date, received date, and payment notes only.
- Kept existing payment project, amount, status, due, received, and notes columns intact.
- Preserved client visibility rules by excluding supplier cost, agency margin, and internal financial notes.
- No payment action, persistence, AI, auth, notification, or payment integration was added.

**Tests**  
- `pnpm run build` passed.
- No automated test script exists beyond the production build.

**Files**  
- `src/pages/ClientPortalPage.tsx`
- `README.md`
- `NEXT_TASK.md`
- `WORK_LOG.md`

**Commit**  
- Commit will be created after this log entry; final automation summary records the SHA.

**Next**  
- Add a short client-safe context label above the Client Portal paid hours table.

---

### 2026-07-13 - Client portal paid hours context label

**Work unit**  
Add a short client-safe context label above the Client Portal paid hours table.

**Changes**  
- Added a short client-facing context label above the paid hours table.
- Clarified that the paid hours table shows project, purchased hours, used hours, usage, remaining hours, and expiry only.
- Kept existing paid hours project, purchased, used, usage, remaining, and expiry columns intact.
- Preserved client visibility rules by excluding supplier cost, agency margin, and internal financial notes.
- No payment action, persistence, AI, auth, notification, or payment integration was added.

**Tests**  
- `pnpm run build` passed.
- No automated test script exists beyond the production build.

**Files**  
- `src/pages/ClientPortalPage.tsx`
- `README.md`
- `NEXT_TASK.md`
- `WORK_LOG.md`

**Commit**  
- Commit will be created after this log entry; final automation summary records the SHA.

**Next**  
- Add parent project status labels to Client Portal paid hour rows.

---

### 2026-07-13 - Client portal paid hours project status

**Work unit**  
Add parent project status labels to Client Portal paid hour rows.

**Changes**  
- Added a project status column to Client Portal paid hour rows.
- Used the existing `statusLabels` mapping for linked project status.
- Added a `General hour bank` fallback when no project is linked.
- Kept existing paid hours project, purchased, used, usage, remaining, and expiry columns intact.
- Preserved client visibility rules by excluding supplier cost, agency margin, and internal financial notes.
- No payment action, persistence, AI, auth, notification, or payment integration was added.

**Tests**  
- `pnpm run build` passed.
- No automated test script exists beyond the production build.

**Files**  
- `src/pages/ClientPortalPage.tsx`
- `README.md`
- `NEXT_TASK.md`
- `WORK_LOG.md`

**Commit**  
- Commit will be created after this log entry; final automation summary records the SHA.

**Next**  
- Add parent project start rules to Client Portal paid hour rows.

---

### 2026-07-13 - Client portal paid hours start rule

**Work unit**  
Add parent project start rules to Client Portal paid hour rows.

**Changes**  
- Added a project start rule column to Client Portal paid hour rows.
- Reused the existing `canWorkStart(project)` gate for client-safe readiness text.
- Added a `General hour bank` fallback when no project is linked.
- Kept existing paid hours project, project status, purchased, used, usage, remaining, and expiry columns intact.
- Preserved client visibility rules by excluding supplier cost, agency margin, and internal financial notes.
- No payment action, persistence, AI, auth, notification, or payment integration was added.

**Tests**  
- `pnpm run build` passed.
- No automated test script exists beyond the production build.

**Files**  
- `src/pages/ClientPortalPage.tsx`
- `README.md`
- `NEXT_TASK.md`
- `WORK_LOG.md`

**Commit**  
- Commit will be created after this log entry; final automation summary records the SHA.

**Next**  
- Ask for an explicit push decision before continuing more local-only automation commits.

---

### 2026-07-14 - Project supplier assignment controls

**Work unit**  
Add local supplier assignment controls in Project Detail.

**Changes**  
- Reviewed the existing local assignment flow and preserved `Project.assignedSupplierIds`.
- Improved Project Detail with an approved supplier pool showing assigned and available suppliers.
- Kept assign and remove actions local to app-level React state.
- Preserved Recent Activity recording for supplier assignment and removal actions.
- Updated Action Queue ready-to-start logic so supplier assignment alone does not make work ready; projects must have approved scope and payment or paid hours.
- Preserved supplier-facing visibility rules by not adding client price, agency margin, supplier cost, or internal pricing notes to supplier views.

**Tests**  
- `pnpm run build` failed once because the new assignment badge used an unsupported `default` tone.
- `pnpm run build` passed after changing the badge tone to `neutral`.
- No automated test script exists beyond the production build.

**Files**  
- `src/lib/domainHelpers.ts`
- `src/lib/actionQueue.ts`
- `src/pages/ActionQueuePage.tsx`
- `src/pages/ProjectDetailPage.tsx`
- `README.md`
- `MVP_SCOPE.md`
- `ARCHITECTURE.md`
- `DECISIONS.md`
- `NEXT_TASK.md`
- `WORK_LOG.md`

**Commit**  
- Commit will be created after this log entry; final automation summary records the SHA.

**Next**  
- Prepare the existing application for the first Lovable UI refinement pass without changing business logic or connecting a backend.

---

### 2026-07-14 - Lovable UI refinement handoff

**Work unit**  
Prepare the existing application for the first Lovable UI refinement pass without changing business logic or connecting a backend.

**Changes**  
- Confirmed Project Detail supplier assignment controls were already completed in `9beee06`.
- Inspected the current app shell, navigation, local app state, page structure, and global styles.
- Added a focused Lovable UI handoff document with screens to preserve, business rules, allowed UI-only changes, forbidden integration changes, and verification expectations.
- Linked the new handoff from the README and existing Lovable build plan.
- Updated `NEXT_TASK.md` to point at the first Lovable UI refinement pass while preserving all current business logic.
- Did not change app behavior, local state, supplier visibility, pricing separation, or workflow gates.

**Tests**  
- `pnpm run build` passed.
- No automated test script exists beyond the production build.

**Files**  
- `docs/lovable-ui-refinement-handoff.md`
- `docs/lovable-build-plan.md`
- `README.md`
- `NEXT_TASK.md`
- `WORK_LOG.md`

**Commit**  
- Commit will be created after this log entry; final automation summary records the SHA.

**Next**  
- Prepare the existing application for the first Lovable UI refinement pass while preserving all current business logic.

## 2026-08-02 — Operational MVP usability

**Work unit**  
Make normal daily workflows completable in-app: supplier creation, client/supplier access, and actionable portals.

**Main changes**  
- Replaced `invite-user` with the `access-admin` edge function (list accounts with auth metadata, invite, regenerate copyable invitation link, enable/disable), plus `src/services/accessApi.ts` and a shared `AccessPanel` used by client and supplier detail pages.
- Added supplier creation with profile fields on the Suppliers page, including a per-supplier rate currency.
- Rebuilt Access Management with search, role/status filters, copyable invitation links, and activity toggles.
- Rebuilt the client portal: approvals with approve/decline, approved scope, payment requests, paid hours, change-request submission and priced-request decisions, files, and messaging.
- Rebuilt the supplier portal: assigned work with start-readiness, delivery instructions, time logging, editing of non-approved entries, approved value, files, and messaging. No client price or margin is exposed.
- Added dashboard quick actions for add client, add supplier, and invite account.
- Migration: added a narrow client UPDATE policy on `change_requests` plus a `SECURITY DEFINER` guard trigger so a client may only move a `priced` request to `client_approved`/`declined` and may not alter title, description, agency price, or supplier cost. Execute on the guard function is revoked from `anon`/`authenticated`.

**Tests and results**  
- `pnpm run build` passed (tsc + vite).
- Supabase security linter: back to the pre-existing baseline (2 SECURITY DEFINER view errors and 8 SECURITY DEFINER function warnings that predate this work); no new findings.
- No automated test suite exists in the repository.

**Main files changed**  
- `supabase/functions/access-admin/index.ts`
- `src/services/accessApi.ts`, `src/services/api.ts`
- `src/components/AccessPanel.tsx`
- `src/context/AppDataContext.tsx`, `src/lib/domainHelpers.ts`, `src/types/domain.ts`
- `src/pages/ClientPortalPage.tsx`, `src/pages/SupplierPortalPage.tsx`, `src/pages/SuppliersPage.tsx`, `src/pages/AccessManagementPage.tsx`, `src/pages/ClientDetailPage.tsx`, `src/pages/SupplierDetailPage.tsx`, `src/pages/DashboardPage.tsx`
- `src/App.tsx`, `src/styles.css`

**Limitations**  
- Invitation emails rely on the default managed auth mailer; the copyable link is the reliable path.
- Scope authoring is still read-only in the app.

**Next**  
- Agency-side scope authoring workspace (see `NEXT_TASK.md`).

## 2026-08-02 — Multi-party AI project chat (phase 1)

- Work unit: shared project conversation model + secure AI edge function + three role chats.
- Migration: `project_conversations`, `conversation_participants`, `chat_messages`, `ai_runs`,
  `ai_generated_drafts`, `project_requirements`, `project_assumptions`, `project_questions`,
  `project_progress_updates`, all with GRANTs, RLS and updated_at triggers. Clients read only
  `client_agency`/`shared_all` messages on their own projects; suppliers only
  `supplier_agency`/`shared_all` on assigned projects; agency admin sees everything.
- `supabase/functions/project-chat`: verifies the JWT, resolves the profile/role, checks project
  access, ensures the conversation, rate-limits to 12 AI runs per profile per minute, builds a
  role-filtered context (supplier context never contains client price/margin; client context never
  contains supplier cost), calls `openai/gpt-5.6-sol` on the Lovable AI gateway Responses API with
  streaming consumed server-side, and persists the user message, AI message, AI run and draft.
- Frontend: `src/services/chatApi.ts`, `src/components/ProjectChat.tsx` (thinking/failed/retry
  states, RTL-aware Hebrew/English, drafts, open questions, proposed actions, visibility labels for
  the agency), wired into Client Portal, Supplier Portal and Project Detail.
- AI never mutates records: scope/price/assignment/approval/payment changes come back as
  "proposed actions" only.
- Tests: `pnpm run build` passes. Edge function deployed and rejects unauthenticated calls (401).
  A signed-in end-to-end AI round trip was NOT run in this environment (no preview session).
- Next: agency confirmation cards that apply proposed actions as real mutations, plus pricing
  configuration, chat file attachments, Supplier Mode and the Role Test Lab.

## 2026-08-03 — Project estimation & budget simulation

- **Work unit:** Database-backed estimation model, client budget simulator, supplier estimate review, Yaniv estimate control.
- **Main changes:** New tables `project_estimates`, `estimate_items`, `estimate_role_allocations`, `estimate_supplier_reviews`, `estimate_adjustments`, `estimate_scenarios`, `estimate_versions` with strict RLS. New `src/types/estimation.ts`, `src/lib/estimation.ts` (hours, buffers, internal cost, recommended fixed price, margin, warnings, calendar duration), `src/services/estimationApi.ts`, and three components mounted in Project Detail, Client Portal and Supplier Portal.
- **Tests:** `pnpm run build` passed; Playwright run against the live preview created an estimate and a work item, confirmed hours/margin rendering and DB persistence (test row removed afterwards).
- **Known gaps:** No AI-generated estimates (deliberately out of scope), no phase-level milestone pricing sync with `project_pricing`, adjustments are creatable via API but have no dedicated UI form yet.

## 2026-08-03 — AI chat connected to the estimation system

**Work unit:** Make the multi-party AI chat estimate-aware, with human-confirmed actions only.

**Main changes**
- Migration: `ai_generated_drafts` gained `estimate_id`, `estimate_version`, `agent_type`, `action_kind`, `confirm_role`, `preview`, `created_by_profile_id`, `applied_by_profile_id`, `applied_at`, plus `applied`/`cancelled` statuses. `estimate_items` gained `ai_generated` + `source_message_id`; `estimate_scenarios` and `estimate_supplier_reviews` gained `source_message_id`.
- `supabase/functions/project-chat/estimation.ts`: server-side mirror of the estimation math, used for previews and validation.
- `supabase/functions/project-chat/actions.ts`: 11 whitelisted action kinds, per-agent allow-lists, strict payload normalisation and clamping, before/after preview computation, and the apply layer.
- `supabase/functions/project-chat/index.ts`: role-filtered estimate context per agent, estimation-aware system prompts, server-side validation of every proposed action, and `confirm_action` / `cancel_action` endpoints that log to `activity_logs` and `decision_logs` and post a system confirmation message.
- Frontend: confirmation cards in `ProjectChat.tsx`, new chat API calls, `src/lib/estimationEvents.ts` refresh bus wired into the three estimation screens, and an "AI estimate" badge on AI-generated items.

**Safety rules enforced server-side:** the AI can never write; suppliers never see client price or margin; clients never see supplier cost, internal cost or margin; estimate mutations are blocked once a fixed price is approved; fixed-price approval snapshots the version first.

**Tests:** `pnpm run build` passes. Edge function boots and returns 401 without auth.

**Limitations:** action payload editing before confirmation is supported by the API but not yet exposed as an inline form in the UI — the user asks the assistant to revise instead.

## 2026-08-03 — Guided onboarding and role home screens

- Work unit: guided onboarding wizards (client, supplier), Yaniv setup assistant, and simple role-specific home screens.
- Main changes: new `public.onboarding_state` table with own-row RLS plus agency-admin read; `submit_client_onboarding` / `submit_supplier_onboarding` security-definer RPCs that only touch the caller's own linked records; `src/services/onboardingApi.ts`; `src/context/OnboardingContext.tsx`; `WizardShell`, `ClientOnboardingWizard`, `SupplierOnboardingWizard`, `AgencySetupAssistant`; `AgencyHomePage`, `ClientHomePage`, `SupplierHomePage`; new `home` view wired as the first view for every role.
- Tests: `pnpm run build` passes; headless browser check of the agency home screen (no console errors). Client and supplier wizards were not exercised end-to-end because no client/supplier session is available in this environment.
- Next work unit: recorded in NEXT_TASK.md.

### 2026-08-03 — Persistent voice-enabled AI copilot

**Work unit**  
A workspace-wide copilot: a persistent bubble/panel, live screen context, voice conversation, form assistance, navigation shortcuts, and safe (confirmation-gated) actions.

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
