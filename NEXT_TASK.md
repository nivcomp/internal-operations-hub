# Next Task

## Current result

The "אמיר תזרים מזומנים" campaign intake is implemented in the shared application.

`/amir-cashflow` is a public Hebrew RTL form branded as "נעים מחשבים". It validates required fields, email, the conditional "other accounting system" field and explicit contact consent, trims text before saving, and inserts a fixed-source `new` lead through the existing Supabase client.

The repeatable `cash_flow_leads` migration includes database defaults, status and source constraints, public insert-only RLS and agency-admin read/update RLS. The authenticated internal application exposes **Cash Flow Leads** in Advanced Mode and **לידים תזרים** in Simple Mode, with search, the five requested status controls, full-list Excel export, a full desktop table and mobile lead cards with direct `tel:` calling.

TypeScript and the production Vite build pass. The migration is active in the connected Supabase project (15 columns and 3 RLS policies), the Lovable build is published, and `https://project.stat.ninja/amir-cashflow` serves the Hebrew public form instead of the authenticated application. No synthetic lead was submitted during deployment, so the table remains empty.

## Recommended next work unit

Submit one approved production test lead and verify the Simple Mode mobile call/status workflow end to end.

## Constraints

- Keep `/amir-cashflow` public and submission-only.
- Never expose `cash_flow_leads` reads to anonymous, client or supplier roles.
- Keep `source = 'amir_cashflow_form'` and new submissions at `status = 'new'`.
- Do not add payment, AI or generalized marketing-site scope.

## Acceptance criteria

- Lovable remains published with the cash-flow route and internal lead wiring.
- `20260816090000_cash_flow_leads.sql` remains applied to the connected Supabase project.
- A mobile and desktop visit to `/amir-cashflow` renders Hebrew RTL and requires consent.
- One test submission is stored with trimmed values, the expected source and `new` status.
- The submission cannot be read publicly and appears for an authenticated agency admin in both desktop and mobile layouts.
- On a phone, the lead card exposes a direct call action using the submitted mobile number.
- The Excel action downloads every campaign lead, regardless of the current search filter.
- Every internal status option saves and survives refresh.
- The final public domain serves `/amir-cashflow` directly with SPA fallback enabled.
