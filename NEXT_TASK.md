# Next Task

## Last Completed

Guided onboarding: a resumable client project wizard, a supplier profile wizard, a non-blocking setup assistant for Yaniv, and one simple home screen per role backed by a new `onboarding_state` record.

## Recommended Next Work Unit

Extend the personal assistant so it can perform assisted data entry from the home screens (create client, set calculation rate, assign supplier) using the existing confirmation-card action pipeline.

## Acceptance Criteria

- The assistant is reachable from every role home screen with the current page and record as context.
- Every write goes through the existing pending-action confirmation card; the AI never commits pricing, scope or dates on its own.
- Client and supplier assistants keep their existing data isolation.
- `pnpm run build` passes.
