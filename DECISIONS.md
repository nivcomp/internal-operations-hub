# Decisions

## 2026-08-13 — ILS is the operating default and pending suppliers may be planned

**Decision**
New agency estimates and generic system money displays default to ILS, with USD and GBP offered next in that order. Changing an estimate currency changes its unit and never performs an implicit exchange conversion. Simple supplier handoff shows suppliers of every status; pending-review suppliers may be associated for planning, inactive suppliers may not be assigned, and execution readiness requires an approved assigned supplier.

**Reason**
The agency operates primarily in shekels, while hiding a real supplier because approval is pending makes the daily workflow look incomplete. Planning association and authorization to begin work are separate decisions.

**Consequences**
Existing saved amounts and currencies are not rewritten. Supplier status is explicit at selection time, and the Simple readiness indicator cannot imply that a pending supplier is authorized to execute.

## 2026-08-13 — Simple Mode is the daily agency workflow, not a second system

**Decision**
The agency-admin Simple Mode has four primary destinations (Home, CRM, Projects and Suppliers). A Simple project has exactly four daily areas: Discovery, Pricing & Proposal, Execution & Supplier, and Status. Specialist controls remain available through contextual disclosure or `מערכת מתקדמת`.

**Reason**
The existing complete navigation and technical project tabs exposed too many equal choices for daily work. The agency needs an obvious next action without losing existing capabilities.

**Consequences**
Simple and Advanced continue to share the same authentication, RLS, projects, `project_estimates`, proposals and documents. The Simple pricing workspace may show agency-only commercial values, but the embedded meeting/discovery surface remains client-safe. Supplier handoff renders only supplier-audience `supplier_brief` records. No duplicate pricing, document or project model is introduced.

## 2026-08-08 — Prototypes are bounded data, not executable AI code

**Decision**
Interactive prototypes are stored as validated JSON screen/block/action schemas in immutable versions. The application renders only known React components and never evaluates generated HTML, JavaScript or external URLs.

**Consequences**
The same version is available in the meeting, Advanced project and authorized portal. Client approval references the exact immutable version. DOCX extraction occurs locally before bounded text is sent to the agency-only generator. Lovable export is a reviewed copy action, never an automatic external publish.


This file records product and architecture decisions that future automation runs should not reopen without new evidence.

## Decision format

### YYYY-MM-DD — Decision title

**Decision**  
What was decided.

**Reason**  
Why this direction was selected.

**Alternatives considered**  
Other relevant options.

**Consequences**  
Expected impact, constraints, and follow-up work.

---

### 2026-08-08 — Reviewed specification documents share the canonical project record

**Decision**
Simple Mode, Advanced Mode and the client portal use the same `project_documents` records. AI document generation uses explicitly approved specification sections; an agency operator must explicitly choose client visibility.

**Reason**
This keeps draft conversation separate from reviewed scope and avoids a parallel document or handoff system.

**Consequences**
Document generation does not publish a proposal, create a signature or approve an execution package. Client and supplier visibility continues to be enforced by RLS, with an additional client-audience filter in the portal UI.

## 2026-08-08 — One client-facing visual source

**Decision**
The project lifecycle strip in the client portal communicates persisted project status only. Process diagrams and wireframes are rendered from the project conversation artifacts; the portal does not render a second static process specification.

**Consequences**
Artifact image downloads are generated locally from sanitized chat payloads. Copied/emailed portal links are authenticated deep links and never bypass the existing client ownership and RLS checks. Portal language is a presentation preference stored in the browser and does not create translated duplicate project records.

### 2026-08-08 — Simple meeting mode is client-safe by design

**Decision**
The agency may operate Simple Mode while sitting with a client, so its meeting workspace uses the client-safe project guide and never renders calculation rate, internal cost, target margin or gross margin. Advanced Mode remains the agency's private operating surface.

**Reason**
Authentication as an agency admin must not make private commercial information appear on a screen being shared with a client.

**Consequences**
Simple and Advanced still share one application and the same canonical records. The separation is a role-and-surface visibility boundary, not another app or database. Only estimates explicitly marked `client_visible` may appear in the shared meeting.

### 2026-08-08 — Agency project chat is unmetered

**Decision**
Daily/monthly message quotas, cooldowns, automatic usage pauses and usage meters apply to client and supplier project chats, but not to `agency_admin` in either Simple or Advanced Mode.

**Reason**
The internal operator must not be blocked while running a live client meeting or managing a project. External portal usage still needs fair-use protection.

**Consequences**
Agency events remain logged for cost visibility, and message-length plus input safety validation remain active. This exception is based on the authenticated server-side profile role, not a frontend mode or caller-provided flag.

### 2026-08-08 — Meeting time deductions require an immutable agency ledger

**Decision**
Start, end and duration remain client-safe fields on `client_meetings`. Confirmed billable discovery hours and the selected existing `paid_hours` bank are stored once in an agency-only `meeting_time_charges` ledger row.

**Reason**
Updating the aggregate hour bank from the browser could double-charge a retried meeting, while putting billing metadata on a client-readable meeting would weaken visibility boundaries.

**Consequences**
The database function locks both meeting and bank, validates client/project ownership and remaining hours, then inserts one unique ledger row and updates the aggregate atomically. A meeting may finish without a bank, preserving unallocated billable time without inventing a balance deduction.

### 2026-07-11 — Internal operating system first

**Decision**  
The first product is an internal operating system for Yaniv's own agency workflow, not a public self-serve SaaS application.

**Reason**  
The immediate value comes from solving a real workflow involving clients, suppliers, pricing, approvals, payments, hours, and change control.

**Alternatives considered**  
Starting with multi-tenant SaaS onboarding and generalized agency features.

**Consequences**  
Prefer practical internal screens and workflow rules. Do not add generalized SaaS complexity unless required by the internal MVP.

### 2026-07-11 — Agency retains final authority

**Decision**  
AI may assist with drafts, structure, summaries, and recommendations, but it cannot make final scope, pricing, supplier, payment, or work-start decisions.

**Reason**  
These decisions affect commitments, cost, margin, and delivery risk.

**Alternatives considered**  
Allowing AI to approve scopes, assign suppliers, or start work automatically.

**Consequences**  
Important AI outputs must remain reviewable and require an explicit human action before changing business status.

### 2026-07-11 — Approval and payment gate work start

**Decision**  
Supplier work must not begin until the required client approval and payment or paid-hours conditions are satisfied.

**Reason**  
This protects cash flow, margin, and scope control.

**Alternatives considered**  
Allowing work to begin on verbal agreement or pending payment.

**Consequences**  
Readiness and blocked reasons must be explicit domain state and visible in the interface.

### 2026-07-11 — Preserve the current React/Vite foundation

**Decision**  
Continue with the existing React, TypeScript, and Vite application foundation unless a documented requirement proves it unsuitable.

**Reason**  
The repository already contains useful screens, domain types, mock data, and workflows. Rewriting would delay validation of the product workflow.

**Alternatives considered**  
Immediate framework replacement or a full rebuild.

**Consequences**  
Improve incrementally. Introduce persistence and integrations in stages rather than replacing the whole application.

### 2026-07-14 - Supplier assignment does not unlock work start

**Decision**  
Local supplier assignment can happen as project planning, but it does not make a project ready to start.

**Reason**  
Yaniv may need to plan supplier coverage before final approval or payment, while the business rule still requires approved scope and payment or available paid hours before work begins.

**Alternatives considered**  
Only allowing assignment after all start gates are open, or treating assignment as the ready-to-start trigger.

**Consequences**  
Ready-to-start views must use the shared start rule instead of checking only assignment or payment status.

### 2026-08-06 — One repository, application and Supabase project

**Decision**
`nivcomp/internal-operations-hub` is the canonical repository. Simple and Advanced are presentation modes inside one React application and must share the same providers, services, records, Supabase project and deployment.

**Reason**
The implemented modes already render from one `App.tsx` and consume one authenticated data layer. Splitting them would create inconsistent records, permissions and commercial state.

**Alternatives considered**
Separate Simple/Advanced applications, repositories or databases.

**Consequences**
New workflows must be composed inside the existing app. No mode-specific duplicate clients, projects, meetings, chats, documents or persistence layers are allowed.

### 2026-08-06 — Canonical estimate pricing

**Decision**
`project_estimates` and its related estimate tables are the only canonical source for current project pricing.

**Reason**
They contain structured items, calculation rate, hours, buffers, cost, budget, margin and fixed-price approval used by the current estimate, proposal and handoff workflows.

**Alternatives considered**
Continuing to calculate current commercial state from `project_pricing` and `phase_pricing`, or synchronizing two writable pricing models.

**Consequences**
Legacy pricing tables remain read-only historical compatibility only. New writes, dashboards, AI context, proposals and calculations must use `project_estimates`.

### 2026-08-06 — Simple meeting workspace uses shared workflow records

**Decision**
The client/project meeting launcher and live discovery room run inside Simple Mode while reusing the existing client, project, meeting, conversation, source, specification and estimate records.

**Reason**
Simple Mode is the normal operating surface during an in-person meeting; changing modes must be optional and must not fork workflow state.

**Alternatives considered**
Opening Project Detail automatically in Advanced Mode or creating a separate lightweight meeting store.

**Consequences**
The active Simple Mode project id may be remembered locally for navigation recovery, but Supabase remains the durable source. Refreshing never creates records, and `startMeeting` remains the idempotent entry point that prevents duplicate active meetings.

### 2026-08-13 — Agency-controlled lead promotion

**Decision**
New-client onboarding is a durable pre-project lead conversation. A client may talk, edit the draft and submit it for review, but only an active agency admin may promote it into a project.

**Reason**
The agency needs to see and guide the entire conversation, stop unqualified leads and decide when a real delivery workspace should exist. Automatically creating a project from every intake obscures the pipeline and gives the client control over an agency commitment.

**Alternatives considered**
Creating a project on the client's first message, creating it on client submission, or storing the pre-project thread inside project chat tables with a placeholder project.

**Consequences**
Lead conversations and messages have their own pre-project tables. Client-visible messages and agency-only notes are separated. Pause and disqualification are enforced server-side. Promotion is agency-only, retry-safe and migrates the transcript, brief, flow and internal notes into one canonical project. Existing project-continuation links remain unchanged.
