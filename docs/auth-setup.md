# Authentication & Access Setup

## 1. Create the first user
Public sign-up is disabled. Create the first account manually in the backend
Users area (Cloud → Users → Add user): email + password, mark it confirmed.

## 2. Promote that user to agency_admin
Run this SQL once (backend SQL editor), with your real email:

```sql
select public.bootstrap_agency_admin('yaniv@example.com');
```

This creates/updates the `profiles` row with role `agency_admin`, no linked
client or supplier, and `is_active = true`.

## 3. Sign in
Open the app, sign in with that email and password. The dashboard, action
queue, pricing, payments and admin pages become available.

## 4. Invite everyone else
Use **Admin → Access Management** in the app:
- Agency admin: no link required.
- Client: must be linked to an existing client record.
- Supplier: must be linked to an existing supplier record.

Invitations run through the `invite-user` edge function, which validates the
caller is an active agency admin and uses the service-role key server side
only. The service-role key never reaches the browser.

## 5. Password reset
"Forgot your password?" on the sign-in screen sends a reset link that lands on
`/reset-password`, where the new password is set.

## Access model
- Anonymous: no grants on any operational table — zero access.
- agency_admin: full access to all data, pricing, margin and admin pages.
- client: only their own client record, their projects and client-facing data;
  no supplier cost, no margin, no other clients.
- supplier: only their own supplier record, assigned projects and their own
  time entries; no client price, no margin, no unassigned projects.
