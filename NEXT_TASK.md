# Next Task

## Current result

The "אמיר תזרים מזומנים" campaign intake is implemented in the shared application.

`/amir-cashflow` is a public Hebrew RTL form branded as "ניב מחשבים". It validates required fields, email, the conditional "other accounting system" field and explicit contact consent, trims text before saving, and inserts a fixed-source `new` lead through the existing Supabase client.

The repeatable `cash_flow_leads` migrations include database defaults, status and source constraints, public insert-only RLS and agency-admin read/update/delete RLS. The authenticated internal application exposes **Cash Flow Leads** in Advanced Mode and **לידים תזרים** in Simple Mode, with search, full detail editing, confirmed deletion, the five requested status controls, full-list Excel export, a full desktop table and mobile lead cards with direct `tel:` calling.

The campaign brand is consistently displayed as "ניב מחשבים" across the public form, consent copy, success message and internal cash-flow lead view. TypeScript and the production Vite build pass. The migration is active in the connected Supabase project (15 columns and 3 RLS policies), the Lovable build is published, and `https://project.stat.ninja/amir-cashflow` serves the Hebrew public form instead of the authenticated application. No synthetic lead was submitted during deployment, so the table remains empty.

## Recommended next work unit

Run one approved disposable production lead through submit, edit, call, status, Excel and confirmed deletion end to end.

## Constraints

- Keep `/amir-cashflow` public and submission-only.
- Never expose `cash_flow_leads` reads to anonymous, client or supplier roles.
- Keep `source = 'amir_cashflow_form'` and new submissions at `status = 'new'`.
- Do not add payment, AI or generalized marketing-site scope.

## Acceptance criteria

- Lovable remains published with the cash-flow route and internal lead wiring.
- `20260816090000_cash_flow_leads.sql` remains applied to the connected Supabase project.
- `20260816112000_cash_flow_lead_deletion.sql` is applied and only agency admins can delete.
- A mobile and desktop visit to `/amir-cashflow` renders Hebrew RTL and requires consent.
- One test submission is stored with trimmed values, the expected source and `new` status.
- The submission cannot be read publicly and appears for an authenticated agency admin in both desktop and mobile layouts.
- On a phone, the lead card exposes a direct call action using the submitted mobile number.
- Editing trims and saves the required lead details, including the conditional other accounting system.
- Deletion always requires explicit confirmation and removes only the selected lead.
- The Excel action downloads every campaign lead, regardless of the current search filter.
- Every internal status option saves and survives refresh.
- The final public domain serves `/amir-cashflow` directly with SPA fallback enabled.
