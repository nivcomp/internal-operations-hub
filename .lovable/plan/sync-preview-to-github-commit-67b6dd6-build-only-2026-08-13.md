# Sync preview to GitHub commit 67b6dd6 (build only)

## Current state
- Working tree is clean (no uncommitted changes).
- The preview is on the Lovable edit branch `edit/edt-fa3109ee-...`, at commit `a0ffff6` ("הוסף QR ללינקים ציבוריים").
- Target requested: `67b6dd6bea87c1ffed0513e857c82cbe9583c6fe` on branch `codex/simplify-admin-ui` in `nivcomp/internal-operations-hub`.

## What I can and cannot do
Git state in this environment is managed by the Lovable platform. I cannot run checkout, fetch, reset, or branch switching myself, so I cannot move the preview onto another branch or commit from here. That switch has to come from the Lovable GitHub integration.

## Proposed steps
1. You switch the project to branch `codex/simplify-admin-ui` using Lovable's GitHub branch switching (Account Settings > Labs > GitHub Branch Switching, then pick the branch in the editor). If the branch head is not exactly `67b6dd6`, the preview will land on the branch head instead — tell me and we decide from there.
2. I verify the checked-out commit with `git log -1` and confirm it matches `67b6dd6bea87c1ffed0513e857c82cbe9583c6fe`.
3. I confirm the working tree is clean (`git status --porcelain` empty) — no source file edits, no formatting, no generated files.
4. I run `pnpm run build` only. No migrations, no Edge Function deploys, no publish.
5. I report: exact commit SHA and subject, build result, and confirmation that zero source files changed.

## Guarantees
- No source file will be edited, created, or deleted (this plan file aside).
- No database migration applied, no Edge Function deployed.
- No publish — the current production deployment stays as-is.
