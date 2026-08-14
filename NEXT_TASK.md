# Next Task

## Current result

The client MVP reconsideration flow is implemented on branch `agent/client-simple-mvp-payment-gate` in commit `5165e19`.

After approving a shared MVP version, the client now sees a clear option to withdraw the approval and return to corrections. A confirmation dialog explains that the version, conversation and original approval remain saved. The withdrawal is appended as a newer `changes_requested` decision, and agency MVP surfaces show that latest decision. The previously approved version remains immutable; corrections still create a new version.

The production build passes. The production schema was inspected and the existing unique constraint was confirmed, but the new migration and frontend have not been deployed in this work unit.

## Recommended next work unit

Publish and smoke-test the MVP reconsideration release as one controlled production unit:

1. Apply `20260814170000_allow_client_mvp_approval_reconsideration.sql`.
2. Publish the matching frontend.
3. Sign in as a controlled client, approve one shared MVP version, withdraw the approval and confirm the latest state is “changes requested” after refresh.
4. Sign in as the agency admin and confirm the same version shows the latest client decision while the original approval remains in history.
5. Confirm another client cannot read or append decisions for that project.

## Acceptance criteria

- Approval withdrawal succeeds only for the authenticated client’s own project and shared version.
- The original approval is preserved and the latest decision drives the interface.
- The already approved version remains immutable and corrections create a new version.
- The client and agency see the updated state without exposing another client’s decisions.
- The production build and authenticated role/RLS smoke test pass.
