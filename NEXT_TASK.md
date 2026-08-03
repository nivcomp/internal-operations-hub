# Next Task

## Last Completed

A persistent, context-aware, voice-enabled copilot across the whole workspace: floating bubble and panel, per-entity threads, server-side role-filtered context, spoken input and answers, form pre-fill suggestions, navigation chips, and data changes that are only ever proposals confirmed by a human.

## Remaining Limitations

- Only the target-date form publishes rich form context; other forms expose screen context only.
- Client and supplier copilot sessions and the voice round-trip were not exercised in an automated check.
- Proactive observations appear only after the user sends a message; the copilot does not speak first.

## Recommended Next Work Unit

Give the copilot proactive, silent screen observations: when a screen opens, show one short risk or next-step note in the bubble without the user asking, using a cached server call that respects the existing AI usage limits.

## Acceptance Criteria

- Opening a project, client or supplier screen produces at most one observation, cached per entity and reused for a sensible period.
- Observations never contain data the role may not see, and never claim an action was taken.
- The observation is dismissible and never blocks the screen.
- `pnpm run build` passes.
