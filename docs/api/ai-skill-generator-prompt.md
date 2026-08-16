# Prompt ליצירת AI Skill / Connector

העלה למנוע ה־AI את הקבצים `openapi.json`, `table-catalog.json`, `permissions-matrix.json` ו־`business-actions.json`, ואז הדבק את הטקסט הבא. אם המנוע מקבל קובץ אחד, העלה במקום זאת את `ai-skill-input.json`; ה־Prompt כבר נמצא בתוכו.

```text
Create a production-quality AI Skill/connector for the API contract in the attached package.

Treat openapi.json as the protocol contract, table-catalog.json as the exact public database schema, permissions-matrix.json as mandatory policy, and business-actions.json as the preferred interface for guarded business mutations.

Deliver:
1. A concise SKILL.md that explains when and how to use the connector.
2. Focused reference files for authentication, CRUD, business actions, permissions, errors, and examples.
3. Small deterministic scripts or a typed client only where they materially reduce mistakes.
4. Contract tests that use non-production fixtures and cover agency_admin, client, and supplier boundaries.

Connection rules:
- Use the agency-issued X-API-Key with least-privilege scopes.
- Read API_BASE_URL and API_KEY only from environment variables or a secret manager.
- Never request, store, log, or expose a Supabase service_role key.
- At startup call GET /v1/me and GET /v1/schema/tables. Refuse operations not returned as effective capabilities.

Behavior rules:
- Support paginated reads, safe field selection, filter ASTs, create, optimistic-concurrency patch, guarded delete, business actions, idempotency keys, structured errors, and safe rate-limit retries.
- Use business actions instead of raw writes for lead promotion, scope/pricing publication, supplier assignment, supplier cost, payment overrides, MVP/prototype decisions, approvals, proposals, signatures, execution start, and protected deletes.
- Before destructive or high-impact operations, show the target, current state, proposed change, side effects, and required confirmation. Never infer approval from silence.
- Respect client/supplier row ownership and visibility. Never broaden access after a 403 or attempt to bypass RLS or gateway policy.
- Do not invent endpoints, columns, actions, scopes, or permissions not present in the package.
- Use the deployed Supabase Edge Function URL from openapi.json unless the operator supplies another API_BASE_URL.
- Guarded business actions additionally require a short-lived X-User-Access-Token for the active agency admin; never persist that session token.

Include copy-ready setup instructions, common command examples, troubleshooting, and an end-to-end smoke test that reads identity, discovers capabilities, reads one safe table, creates and updates a disposable fixture, executes one non-destructive business action, and cleans up only when guarded delete is permitted.
```
