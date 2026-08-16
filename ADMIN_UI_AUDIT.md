# Agency Admin UI Audit

Audit date: 2026-08-13
Scope: every agency-admin page and the reusable controls exposed by Simple and Advanced Mode.
Classification: `WORKING`, `PARTIALLY_WORKING`, `PLACEHOLDER`, `DEAD / NO EFFECT`, `ADVANCED_ONLY`.

## Findings before editing

| Surface | Visible control or group | Classification | Finding / treatment |
| --- | --- | --- | --- |
| Simple shell | Home, CRM, lead conversations, clients, projects, suppliers, tasks, finance | WORKING / ADVANCED_ONLY | Navigation works, but daily and specialist tools have equal weight. Keep only Home, CRM, Projects and Suppliers in primary navigation. |
| Simple shell | Full system | WORKING | Keep as the explicit `מערכת מתקדמת` escape hatch. |
| Simple home | Meeting launcher | WORKING | Keep as the primary discovery entry. |
| Simple home | Attention cards | WORKING | Keep, but route pricing/payment work contextually to the project instead of making Tasks/Finance primary navigation. |
| Simple home | Quick create/invite/share/search actions | WORKING | Keep; reduce visual competition through grouping and secondary styling. |
| Simple CRM | Board/list, new lead, import, call, note, enrichment, conversion, archive | WORKING | Keep. Add a contextual entry to pre-project lead conversations because it is no longer primary navigation. |
| Lead conversations | Filters, search, transcript, reply, private note, pause/resume, disqualify, promote | WORKING | Keep as contextual/Advanced access. Promoted threads remain available under their explicit filter. |
| Simple clients | Record selection and client summary card | WORKING | Remove from primary navigation; retain access through CRM, search and contextual actions. |
| Simple projects | Record selection and project summary card | WORKING | Keep in primary navigation and open the new four-area Simple project workspace. |
| Simple project card | `שיחת הלקוח` advanced deep link | PARTIALLY_WORKING | `context.tab` is passed but ignored by `openAdvanced`; replace the daily path with a direct Simple discovery area. |
| Simple suppliers | Record selection and supplier summary card | WORKING | Keep in primary navigation. |
| Simple tasks | Pricing, approval, payment and supplier-time cards | WORKING / ADVANCED_ONLY | Remove from primary navigation; retain through contextual project status and Advanced Mode. |
| Simple finance | Payment summary and advanced links | WORKING / ADVANCED_ONLY | Remove from primary navigation; retain through project status and Advanced Mode. |
| Advanced layout | All grouped navigation sections | WORKING / ADVANCED_ONLY | Preserve unchanged as the complete operator surface. |
| Advanced dashboard/action queue | Open entity, approve status/time/payment, reload | WORKING / ADVANCED_ONLY | Preserve. Not needed as the default daily product. |
| Advanced clients/projects/suppliers | Tables, create/open/detail/portal actions | WORKING / ADVANCED_ONLY | Preserve. |
| Advanced project detail | Overview, discovery, scope, estimate, proposal, suppliers plus secondary tools | WORKING / ADVANCED_ONLY | Preserve. Replace the Simple daily project path with four areas: Discovery, Pricing & Proposal, Execution & Supplier, Status. |
| EstimateControl | Items, roles, allocations, supplier reviews, buffers, versions and commercial fields | WORKING / ADVANCED_ONLY | Keep behind `הצג פירוט`; do not render it as the normal daily pricing form. |
| CommercialSettingsPanel | Rate/margin/date/visibility and special commercial controls | WORKING / ADVANCED_ONLY | Keep for scheduling and overrides; remove it from the normal pricing path to avoid duplicate entry. |
| Pricing summary cards | Canonical estimate roll-up | WORKING | Reuse calculations in `SimplePricingWorkspace`; all writes continue to the same `project_estimates` row. |
| ProposalPanel | Publish immutable proposal, signature state, execution package | WORKING | Reuse after fixed-price approval. |
| MeetingWorkspace | Conversation, transcript, files, specification, client continuation link, finish/charge | WORKING | Reuse as the Discovery area. |
| MeetingWorkspace | `onOpenAdvanced` prop | DEAD / NO EFFECT | Prop is accepted but not used in rendered controls. Do not expose a dummy action; the workspace-level Advanced details control replaces it. |
| ProjectDocumentsPanel | Generate/list/preview/print documents | WORKING | Keep for Advanced/document-center use. |
| ProjectDocumentsPanel Simple Mode | Supplier brief | PARTIALLY_WORKING | Existing Simple filter excludes `supplier_brief` and shows client documents only. Add a dedicated supplier-safe handoff workspace using the existing document API/type. |
| Supplier portal preview | Time, files, messaging | WORKING / ADVANCED_ONLY | Preserve and link from the execution area for the assigned supplier. |
| ProjectReport | Print / Save as PDF | PARTIALLY_WORKING | Generic report depends only on the browser print dialog. Add a dedicated authenticated supplier-brief print view with Preview, Print and Save as PDF actions. |
| Client portal | Overview/spec/MVP/chat, approvals, requests, messages | WORKING | Client-facing; out of admin simplification scope and preserved. |
| Supplier portal | Work, time, files, messages | WORKING | Supplier-facing; preserved without agency pricing data. |
| Copilot dock | Chat, voice, chips, confirmation-gated actions | WORKING | Keep one persistent Copilot. Register the current Simple project and area so navigation/actions retain context. |
| Access management | Invite/link/activate/deactivate/public registration controls | WORKING / ADVANCED_ONLY | Preserve in Advanced Mode. |
| AI workbench/usage | AI tools, limits, acknowledgement and pause controls | WORKING / ADVANCED_ONLY | Preserve in Advanced Mode. |
| Change requests, supplier time, payments/hours, pricing/margin | Domain actions | WORKING / ADVANCED_ONLY | Preserve and expose through contextual Advanced details. |
| Prototype studio | Generate/share/export/version/approval actions | WORKING / ADVANCED_ONLY | Preserve; available from Discovery/Advanced details, not primary project navigation. |

## Hidden placeholders and dead actions

- No intentional placeholder button will remain in Simple Mode.
- The ignored project-tab deep link is removed from the daily Simple flow.
- The unused `onOpenAdvanced` meeting prop is not surfaced as an action.
- Empty states remain only when they explain missing data and point to a real next action.

## Duplicate UI to remove from the daily flow

- Calculation rate, target margin and fixed price must be entered only through `SimplePricingWorkspace` during normal work.
- `EstimateControl` remains the technical item/allocation/version editor.
- `CommercialSettingsPanel` remains the advanced scheduling, visibility and override editor.
- All three read and write the same canonical `project_estimates` records; no synchronization table or second pricing model is introduced.

## Advanced-only components

- Action queue, Tasks, Finance, detailed access administration, AI usage/workbench.
- Technical estimate items, roles, supplier allocations, complexity, buffers and versions.
- Commercial/date internals, raw payment/change/time tables, timeline, document center, files and decisions.
- Debug/raw database status labels.

## Result after implementation

- `WORKING`: Simple primary navigation now contains only Home, CRM, Projects and Suppliers. Lead conversations, tasks and finance remain reachable contextually; the complete operator surface remains behind `מערכת מתקדמת`.
- `WORKING`: Projects now open a Simple workspace with exactly four areas: `אפיון`, `תמחור והצעה`, `ביצוע וספק`, and `סטטוס`.
- `WORKING`: The daily pricing form reads and writes the canonical `project_estimates` record, requires explicit final-price approval, and reveals the existing detailed estimate editor only on request.
- `WORKING`: New pricing defaults to ILS and the daily selector presents ILS, USD and GBP in that order without silently converting amounts.
- `WORKING`: Proposal creation reuses `ProposalPanel` only after price approval.
- `WORKING`: Supplier handoff uses only `supplier_brief` documents whose audience is `supplier`, with preview, print, PDF-save and supplier-portal actions.
- `WORKING`: The Simple handoff selector displays existing suppliers with status labels; pending suppliers can be planned but cannot satisfy execution readiness, while inactive suppliers are visible and disabled.
- `WORKING`: A dedicated authenticated supplier-brief print route now exists and revalidates document type and audience before rendering.
- `WORKING`: Project chat has an explicit `לתחילת השיחה` control so a promoted lead's first message is reachable without manual scrolling.
- `WORKING`: Copilot keeps the current Simple project/area context and opens Simple project records instead of forcing Advanced Mode.
- `WORKING`: The previously ignored Advanced project-tab context is now consumed when an Advanced deep link is used.

## Remaining limitations

- `PARTIALLY_WORKING`: “Save as PDF” uses the dedicated print layout and the browser's native PDF destination; there is no server-generated binary PDF endpoint.
- `PARTIALLY_WORKING`: The production build and unauthenticated login boundary were verified, but an authenticated real-project browser smoke test still requires a signed-in preview or production session on the matching deployed code.
- `ADVANCED_ONLY`: Raw commercial/date overrides, payment/change/time tables, access administration, AI usage and specialist estimate fields intentionally remain outside the daily Simple flow.
