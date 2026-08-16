# Next Task

## Current result

The "אמיר תזרים מזומנים" campaign intake is implemented in the shared application.

`/amir-cashflow` is a public Hebrew RTL form branded as "נעים מחשבים". It validates required fields, email, the conditional "other accounting system" field and explicit contact consent, trims text before saving, and inserts a fixed-source `new` lead through the existing Supabase client.

The repeatable `cash_flow_leads` migration includes database defaults, status and source constraints, public insert-only RLS and agency-admin read/update RLS. The authenticated internal application exposes **Cash Flow Leads** in Advanced Mode and **לידים תזרים** in Simple Mode, with search, the five requested status controls, a full desktop table and mobile lead cards with direct `tel:` calling.

TypeScript and the production Vite build pass. No lint or automated test script exists. The migration and frontend have not been deployed to Supabase/Lovable from this local Git workflow, so production persistence will begin only after the synchronized release applies the migration.

## Recommended next work unit

Publish and verify the cash-flow lead intake release through the existing Git-to-Lovable/Supabase flow.

## Constraints

- Keep `/amir-cashflow` public and submission-only.
- Never expose `cash_flow_leads` reads to anonymous, client or supplier roles.
- Keep `source = 'amir_cashflow_form'` and new submissions at `status = 'new'`.
- Do not add payment, AI or generalized marketing-site scope.

## Acceptance criteria

- Lovable synchronizes the pushed `main` commit and publishes the matching frontend.
- `20260816090000_cash_flow_leads.sql` is applied to the connected Supabase project.
- A mobile and desktop visit to `/amir-cashflow` renders Hebrew RTL and requires consent.
- One test submission is stored with trimmed values, the expected source and `new` status.
- The submission cannot be read publicly and appears for an authenticated agency admin in both desktop and mobile layouts.
- On a phone, the lead card exposes a direct call action using the submitted mobile number.
- Every internal status option saves and survives refresh.
- The final public domain serves `/amir-cashflow` directly with SPA fallback enabled.
