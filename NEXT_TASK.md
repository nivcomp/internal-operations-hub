# Next Task

## Current result

The managed external API gateway is implemented and deployed to the connected production Supabase project.

The production application now includes an agency-admin-only `API ואינטגרציות` screen with scoped key creation, masked key inventory, revocation, embedded documentation, OpenAPI 3.1 and a self-contained AI Skill input package. The full key is returned only once after creation; only its SHA-256 hash and display prefix are stored.

The gateway covers the exact generated catalog of 83 public-schema tables, including `cash_flow_leads`, plus guarded business actions and immutable audit events. The production smoke test confirmed `/docs` and `/openapi.json` return 200, the AI Skill package reports 83 tables, and unauthenticated `/v1/me` and `api-admin` calls return 401.

## Recommended next work unit

Run one authenticated agency-admin connector smoke test without changing unrelated production data:

1. Sign in at `https://project.stat.ninja/` as an agency administrator and open `API ואינטגרציות`.
2. Create one deliberately named short-lived test key with `schema.read` and `data.read` only; copy the full value from the one-time display.
3. Call `/v1/me`, `/v1/schema/tables` and one bounded read against a non-sensitive table.
4. Confirm the request appears in the API audit view without the raw key or sensitive payload.
5. Revoke the test key in the application and verify the next request returns 401.
6. Generate the first real connector key only after its owner, scopes and expiry are agreed.

Do not paste a production key into source control, Lovable chat, work logs or support conversations.

## Acceptance criteria

- Only an authenticated `agency_admin` can create, list or revoke integration keys.
- A full key is visible once after creation and cannot be recovered later.
- Revocation takes effect immediately.
- Schema and data responses stay inside the key's declared scopes and generated allowlists.
- Audit events contain request metadata but no raw key or full sensitive payload.
- Existing cash-flow, payment-gate, client-space and MVP-reconsideration flows remain available after the release.
