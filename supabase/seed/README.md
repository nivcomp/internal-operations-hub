# Seed script

`seed.sql` mirrors the initial demo dataset used by the app (3 clients, 3 suppliers,
4 projects with briefs, scopes, pricing, approvals, change requests, time entries,
payments, hour bank, messages, decision logs, and files).

The IDs are deterministic (`md5('<mock-string-id>')::uuid`) so re-running the seed
stays idempotent when combined with `ON CONFLICT DO NOTHING` if you extend it.

To re-seed a fresh database, run this file against the project's Postgres:

```
psql "$DATABASE_URL" -f supabase/seed/seed.sql
```