# Next Task

## Current result

The agency-admin simplification is implemented on branch `codex/simplify-admin-ui` without changing the backend, authentication, RLS, client/supplier isolation, signed proposals, estimate rules or audit history.

Simple Mode now has four primary destinations: Home, CRM, Projects and Suppliers. A selected project opens exactly four daily areas: `אפיון`, `תמחור והצעה`, `ביצוע וספק`, and `סטטוס`. Lead conversations, tasks and finance are contextual; the complete existing product remains available behind `מערכת מתקדמת`.

The pricing area reads and writes the canonical `project_estimates` record, makes the hourly calculation rate explicit, shows the budget/cost/recommended price/margin/risk summary, requires explicit fixed-price approval, and reuses the existing proposal panel. The supplier area reuses supplier-audience `supplier_brief` documents, provides an authenticated printable/PDF-save view, and never renders client price or agency margin. The project chat now has an explicit jump to the start of the promoted lead conversation.

New estimates now default to ILS. The Simple pricing selector is ordered ILS, USD and GBP and records the selected unit without silently converting existing numbers. The Simple supplier handoff selector shows every existing supplier and its status. A pending-review supplier can be associated for planning, but the handoff remains blocked until the supplier is approved and estimate items are assigned; inactive suppliers are visible but disabled.

The full control audit is recorded in `ADMIN_UI_AUDIT.md`. TypeScript and the production build pass. Source commit `7d10205755690f2903bb1e4a99c6cc773f374370` was published to `https://project.stat.ninja/`, and the live application bundle contains the new currency and supplier-status controls. An authenticated real-project browser smoke test is still required because no signed-in application session was available during the release. The pull request remains unmerged.

A small UI refinement was also completed: the public client/lead registration link now shows a scannable QR code in both the advanced Access Management page and the Simple Mode “Share links” card. The code updates automatically when the link is rotated and the build passes.

## Recommended next work unit

Review the pull request and run one authenticated preview smoke test on a real but controlled project before merge:

1. Open the project from Simple Projects and confirm the four areas and plain-language status summary.
2. Open Discovery and verify the complete promoted lead transcript, including the `לתחילת השיחה` control.
3. Confirm ILS is the new-estimate default, change the hourly calculation rate, test the ILS/USD/GBP selector, confirm the canonical estimate updates, approve a fixed price and create a proposal draft.
4. Confirm the real supplier appears with the correct status, assign it, verify a pending supplier does not mark the project ready, generate a supplier brief, verify no internal pricing appears, and test preview, Print and browser Save as PDF.
5. Open the same project in Advanced Mode and confirm the same estimate/proposal/document records and unchanged commercial/audit history.
6. Verify a client and supplier account still see only their existing role-safe records.

## Constraints

- Keep one application, repository and Supabase project.
- Do not merge the pull request until the authenticated smoke test passes.
- Do not create a second estimate, document, project or pricing model.
- Keep the meeting/discovery surface client-safe.
- Never expose client price, calculation rate, internal cost, agency margin or internal notes to suppliers.
- Keep final price, proposal, supplier assignment, payment and work-start decisions human-controlled.

## Acceptance criteria

- The daily Simple flow works from Discovery through Pricing/Proposal to Supplier handoff without requiring Advanced Mode.
- Simple and Advanced show the same canonical records after every mutation.
- The supplier brief is readable, printable and saveable as PDF and contains no agency-only commercial information.
- Status answers only where the project is, what is missing, who is waiting and the next action.
- Existing authentication, RLS, role isolation, proposal immutability, estimate rules and audit history remain unchanged.
- The pull request remains unmerged until review and smoke verification are complete.
