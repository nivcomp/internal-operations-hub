# Work Log

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
