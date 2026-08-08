# Republish to clear the stale schema-cache error

No database or code changes are needed. The meeting-time backend is already fully in place and reachable through the API.

## Verified current state

- `meeting_time_charges` table exists, row-level security on, one agency-admin-only policy, no anonymous access
- `client_meetings.duration_minutes` column exists
- `finish_client_meeting(uuid, numeric, uuid)` function exists
- The API already serves the table (returns 200; empty for non-admins, so clients cannot read it) and the function requires an authenticated session

The "Could not find the table 'public.meeting_time_charges' in the schema cache" message therefore comes from an older published bundle or a cached browser session, not from the database.

## What will happen

1. Publish the project so the live site serves the current build.
2. You hard-refresh the live site (Ctrl/Cmd + Shift + R) so the browser drops the cached bundle and any cached error response.

Nothing is migrated, renamed, replaced or reset. Existing tables, access rules, hour banks and pricing stay untouched.

## If the error still appears afterwards

Send the exact screen where it happens and I will trace the failing request end to end with an authenticated agency-admin session.