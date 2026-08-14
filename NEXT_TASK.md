# Next Task

## Current result

The approved-client workspace and payment gate refinement is implemented on branch `agent/client-simple-mvp-payment-gate`, based on `codex/simplify-admin-ui`.

The client now stays in one simple workspace and sees the current stage, project conversation, client-visible files and the latest shared MVP directly. The visual flow canvas, misleading node buttons and the route into the full Advanced project interface were removed from the client experience. Shared client MVP versions refresh through the existing realtime data layer.

Every agency UI route that creates a project now asks whether payment was received. Choosing paid opens the payment gate; choosing the explicit unpaid override creates the project with its payment gate blocked and records the choice. Lead promotion additionally validates the choice in the Edge Function and a new database RPC migration.

`pnpm run build` passes. These changes are not yet live: the migration, updated `lead-conversations` Edge Function and frontend deployment require an explicit production release approval and an authenticated client smoke test.

The earlier agency-admin simplification remains implemented on branch `codex/simplify-admin-ui` without changing authentication, client/supplier isolation, signed proposals, canonical estimate rules or audit history.

Simple Mode now has four primary destinations: Home, CRM, Projects and Suppliers. A selected project opens exactly four daily areas: `אפיון`, `תמחור והצעה`, `ביצוע וספק`, and `סטטוס`. Lead conversations, tasks and finance are contextual; the complete existing product remains available behind `מערכת מתקדמת`.

The pricing area reads and writes the canonical `project_estimates` record, makes the hourly calculation rate explicit, shows the budget/cost/recommended price/margin/risk summary, requires explicit fixed-price approval, and reuses the existing proposal panel. The supplier area reuses supplier-audience `supplier_brief` documents, provides an authenticated printable/PDF-save view, and never renders client price or agency margin. The project chat now has an explicit jump to the start of the promoted lead conversation.

New estimates now default to ILS. The Simple pricing selector is ordered ILS, USD and GBP and records the selected unit without silently converting existing numbers. The Simple supplier handoff selector shows every existing supplier and its status. A pending-review supplier can be associated for planning, but the handoff remains blocked until the supplier is approved and estimate items are assigned; inactive suppliers are visible but disabled.

The full control audit is recorded in `ADMIN_UI_AUDIT.md`. TypeScript and the production build pass. Source commit `7d10205755690f2903bb1e4a99c6cc773f374370` was published to `https://project.stat.ninja/`, and the live application bundle contains the new currency and supplier-status controls. An authenticated real-project browser smoke test is still required because no signed-in application session was available during the release. The pull request remains unmerged.

A small UI refinement was also completed: the public client/lead registration link now shows a scannable QR code in both the advanced Access Management page and the Simple Mode “Share links” card. The code updates automatically when the link is rotated and the build passes.

## Recommended next work unit

After explicit production approval, apply `20260814150000_require_payment_decision_for_lead_promotion.sql`, deploy `lead-conversations`, publish the frontend, and run one authenticated smoke test on a controlled client/project:

1. Create a manual project and confirm the payment dialog appears before creation.
2. Promote a lead and confirm the same paid/unpaid choice is required and recorded.
3. Confirm an unpaid override creates the project with work still blocked by payment.
4. Sign in as that client and confirm there is no Advanced/full-project link or flow-canvas button clutter.
5. Open a continuation link for a client with more than one project, confirm the linked project is selected, then create/share a client MVP as the agency and confirm it appears directly without refresh.
6. Verify another client cannot see the project, chat, files or MVP.

## Constraints

- Keep one application, repository and Supabase project.
- Do not merge or deploy the pull request until the migration order and authenticated smoke test are approved.
- Do not create a second estimate, document, project or pricing model.
- Keep the meeting/discovery surface client-safe.
- Never expose client price, calculation rate, internal cost, agency margin or internal notes to suppliers.
- Keep final price, proposal, supplier assignment, payment and work-start decisions human-controlled.

## Acceptance criteria

- The client sees one simple, project-specific workspace and the current shared MVP directly.
- Every project-creation UI path requires a paid confirmation or a deliberate unpaid override.
- An unpaid override remains blocked for work start and is visible in the audit history.
- Simple and Advanced show the same canonical records after every mutation.
- The supplier brief is readable, printable and saveable as PDF and contains no agency-only commercial information.
- Status answers only where the project is, what is missing, who is waiting and the next action.
- Existing authentication, RLS, role isolation, proposal immutability, estimate rules and audit history remain unchanged.
- The pull request remains unmerged until review and smoke verification are complete.
