# Next Task

## Current result

The external API and AI Skill design package is complete under `docs/api/`.

It contains a validated OpenAPI 3.1 contract, an exact generated catalog of all 82 public-schema tables and 9 RPC functions, a policy entry for every table, the existing 12 Edge Function service families, and one self-contained `ai-skill-input.json` file for an AI Skill generator. No secrets or production data are included.

The package deliberately describes a gateway that is not implemented or deployed yet. The current application continues to use Supabase/RLS and existing Edge Functions directly.

## Recommended next work unit

Implement the read-only foundation of the external API gateway as one controlled unit:

1. Choose the existing deployment runtime and add an authenticated `/v1/me` endpoint.
2. Add OAuth2 client-credential issuance or verification with short-lived scopes; store credentials only in the deployment secret manager.
3. Implement `GET /v1/schema/tables`, `GET /v1/schema/tables/{table}`, `GET /v1/data/{table}` and `GET /v1/data/{table}/{recordId}` from `docs/api/openapi.json`.
4. Resolve every integration to an application role plus client/supplier/agency row boundary and preserve Supabase RLS.
5. Add field allowlists, cursor pagination, rate limits and immutable audit events.
6. Deploy to a staging URL and run role-isolation contract tests with non-production admin, client and supplier fixtures.

Do not implement writes or deletes in this unit; establish and verify the authorization boundary first.

## Acceptance criteria

- No endpoint accepts or exposes a Supabase `service_role` key to the caller.
- `/v1/me` reports only the caller's effective identity and scopes.
- Schema discovery returns only tables/capabilities the caller may use.
- Reads obey agency, client and supplier row/visibility boundaries, including cross-client denial.
- Filters cannot inject SQL or request non-allowlisted fields; pagination is bounded.
- Every request has a request id and every successful/denied read is auditable without logging secrets or full sensitive payloads.
- OpenAPI contract tests pass against staging and the production frontend build remains green.
