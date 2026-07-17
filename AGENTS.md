# Codex Automation Instructions

Work on the repository `nivcomp/client-to-scope-ai` from the project directory attached to the task.

## Product goal

Client-to-Scope AI is an internal operating system for Yaniv's agency work. It turns loose client conversations into structured projects with clear scope, pricing, approvals, paid hours, supplier assignments, time tracking, change requests, payments, and organized communication.

The first product is for Yaniv's own operation, not a public self-serve SaaS platform. The agency retains final authority over scope, pricing, supplier assignment, payment readiness, margin, and permission to start work.

## Start of every run

Before selecting a task or changing code:

1. Read these project documents when they exist:
   - `PRODUCT_VISION.md`
   - `MVP_SCOPE.md`
   - `ARCHITECTURE.md`
   - `DECISIONS.md`
   - `NEXT_TASK.md`
   - `WORK_LOG.md`
   - `README.md`
   - `AGENTS.md`
   - Relevant documents under `docs/` for the selected domain.
2. Inspect Git status, the active branch, the latest commit, and all existing uncommitted changes.
3. Treat these documents as the project's persistent memory. Do not assume a previous chat history is available.
4. Inspect the actual code before trusting a document's implementation-status claim.
5. When important knowledge exists only in code or another document, add a concise summary to the appropriate top-level memory file.
6. Preserve existing changes you do not fully understand. Do not reset, overwrite, or discard them.
7. If sources conflict, use this priority order:
   1. System safety and permission constraints.
   2. `AGENTS.md`.
   3. `PRODUCT_VISION.md` and `MVP_SCOPE.md`.
   4. Decisions recorded in `DECISIONS.md`.
   5. `NEXT_TASK.md`.
   6. Detailed documents under `docs/`.
   7. Existing code.

## Before implementation

Post the following in the automation task chat before writing code:

- A short project-status summary.
- What is already complete.
- The one work unit selected for the current cycle.
- Why it is the right next step for the MVP.
- A short implementation plan.
- Clear acceptance criteria.

After posting the plan, begin implementation immediately without waiting for approval.

Post a concise progress update after every meaningful stage, such as:

- Repository and documentation review completed.
- Implementation completed.
- Tests completed.
- Documentation and Git updates completed.

## Work-cycle rules

- Select exactly one coherent work unit per cycle.
- Do not create sub-agents or separate autonomous tasks.
- Do not expand the cycle into a broad roadmap or unrelated cleanup.
- Prefer the smallest change that creates real MVP value.
- Preserve the existing React, TypeScript, and Vite foundation unless a documented requirement proves a change is necessary.
- Do not introduce a framework rewrite.
- Do not add public SaaS complexity unless it is explicitly required by the internal MVP.
- Keep client price, supplier cost, and margin separate.
- Do not let supplier-facing views expose client price, agency margin, or internal pricing notes.
- A client change request is not approved work until Yaniv has reviewed and priced it.
- Work must not become ready to start unless the required approval and payment or paid-hours conditions are met.
- AI can assist with drafts, summaries, structure, and recommendations, but must not make final business decisions.
- Never place secrets, credentials, tokens, or production personal data in the repository.
- Validate external and AI-generated input before using it for persistence or business actions.
- Any future persistent database change must include a repeatable migration.

## Testing

Before completing a cycle:

1. Run the most relevant available checks.
2. At minimum, run:
   - `pnpm run build`
3. Run additional lint or test commands only if they actually exist in the repository.
4. Exercise the changed workflow manually when the environment permits.
5. Never claim a test passed if it was not run.
6. Record environment limitations and missing coverage honestly in `WORK_LOG.md`.

## End of every run

1. Update `NEXT_TASK.md` with:
   - The result of the completed work unit.
   - Remaining limitations.
   - Exactly one recommended next work unit.
   - Acceptance criteria for that next unit.
2. Append a concise dated entry to `WORK_LOG.md` containing:
   - Work unit.
   - Main changes.
   - Tests and results.
   - Main files changed.
   - Commit SHA and message.
   - Next work unit.
3. If a new product or architecture decision was made, update `DECISIONS.md`.
4. If the implementation changed the actual architecture or project status, update `ARCHITECTURE.md`, `MVP_SCOPE.md`, or `README.md` as appropriate.
5. Run all relevant checks again after final documentation changes when those changes affect code or configuration.
6. If the work is complete and checks pass, commit and push to the current branch without requesting further approval.
7. Do not commit or push when:
   - Required tests fail.
   - The change is incomplete or knowingly broken.
   - Secrets or sensitive data are present.
   - Existing unrelated changes cannot be safely separated.
8. When a commit or push cannot be completed, explain the exact reason in the task chat and `WORK_LOG.md`.

## Git discipline

- Work on the branch already attached to the automation task unless the task explicitly requires another branch.
- Do not force-push.
- Do not rewrite published history.
- Keep commits focused on the selected work unit.
- Use a clear commit message describing the completed outcome.
- Check Git status immediately before committing.

## Communication format

Keep all planning, progress updates, test results, and the final summary in the chat of the same automation run.

The final summary must include:

- What changed.
- What was tested and the results.
- The commit and branch.
- Known limitations.
- The next task recorded in `NEXT_TASK.md`.