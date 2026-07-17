# Plan: Import repo, then run first UI refinement pass

Repo confirmed public: `nivcomp/client-to-scope-ai`, `main`, 63 files, plain Vite 5 + React 18 + TypeScript SPA (no router library — `src/App.tsx` switches views via `src/views.ts`), pnpm.

## Phase 1 — Replace template with the repo

1. Remove TanStack Start scaffolding: `src/routes/`, `src/router.tsx`, `src/routeTree.gen.ts`, `src/server.ts`, `src/start.ts`, `src/styles.css`, `bun.lock`, `bunfig.toml`, current `vite.config.ts`, `tsconfig.json`, `package.json`, `components.json`, `.prettierrc`, `.prettierignore`, `eslint.config.js`. Keep `.lovable/`, `public/favicon.ico`, `AGENTS.md`, `.gitignore`.
2. Fetch all 63 files from `raw.githubusercontent.com/nivcomp/client-to-scope-ai/main/…` in batches and write them at the same paths (index.html, vite.config.ts, tsconfig.json, package.json, src/**, docs/**, top-level MD files).
3. Install deps with `pnpm install` (repo ships `pnpm-lock.yaml`). Only runtime deps are `react` + `react-dom`; devDeps are Vite 5, plugin-react, TS 5.
4. Verify baseline with `pnpm run build` before any refinement edits, so any later break is attributable to the UI pass.

## Phase 2 — First UI refinement pass (visual only)

Constraints strictly honored: no changes to `App.tsx` view/state wiring, `views.ts`, `types/domain.ts`, `data/mockData.ts`, `lib/actionQueue.ts`, `lib/domainHelpers.ts`. No new deps. No routing changes. RTL/Hebrew preserved. Restricted-visibility rules on Supplier Portal / Client Portal untouched — refine only markup and styles around already-rendered fields.

Design system (edits localized to `src/styles.css` plus per-page markup/class tweaks):
- Neutral operations palette (calm slate/zinc surface, one accent for primary actions, semantic colors for status).
- Type scale with clear H1/H2/section-label/body/meta tiers; Hebrew-friendly font stack (system + Heebo/Rubik fallback via `<link>` in `index.html`).
- Reusable tokens for spacing, radii, borders, shadows, focus ring.
- Component conventions restyled in place: `StatCard`, `StatusBadge`, `PageHeader`, `RulePanel`, `Layout` sidebar shell.
- Table pattern: compact rows, zebra optional, sticky header, right-aligned numerics, truncation with tooltip title.
- Form pattern: label above input, helper text muted, aligned buttons, consistent empty states.

Per-screen targets (markup + class changes only):
- **Action Queue** (`ActionQueuePage.tsx`): tighten grouped sections (Blockers / Approvals / Payments / Next actions), stronger section headers, status chip emphasis, better empty states.
- **Project Detail** (`ProjectDetailPage.tsx`): command-center hierarchy — summary strip (payment, approval, paid hours, ready-to-start) → assigned suppliers → changes → time entries; readability polish on supplier assignment controls without altering handlers.
- **Client Portal** (`ClientPortalPage.tsx`) and **Supplier Portal** (`SupplierPortalPage.tsx`): card + table readability, clearer role-safe labels; audit that no client-price/margin/supplier-cost fields are added or newly rendered.
- **Dashboard** (`DashboardPage.tsx`): metric grouping and spacing only; identical metric set.
- **Forms** across pages: unified inputs/labels/helper text/buttons/empty states.

Responsiveness: sidebar collapses at narrow widths (CSS only), tables become horizontally scrollable containers instead of wrapping, cards stack on mobile.

## Phase 3 — Verification

1. `pnpm run build` and record output.
2. Manual read-through checklist:
   - Supplier Portal / Supplier Detail render no client price, no agency margin, no supplier cost estimates, no internal pricing notes.
   - Client Portal / Client Detail render no supplier cost, no agency margin, no internal delivery notes.
   - "Ready to start" indicators still gated by approved scope + (payment received OR paid hours available).
   - Supplier assign/remove handlers in `ProjectDetailPage.tsx` still call the same activity-log helper.
3. Summary of files changed, screens refined, and any remaining visual issues.

## Technical notes

- Package manager switches from bun to pnpm because the repo ships `pnpm-lock.yaml` and scripts (`pnpm run build`). Lovable's harness auto-runs builds; if it insists on bun, I'll fall back to `bun install` + `bun run build` — both work for plain Vite.
- Lovable's default TanStack Start preview wiring won't apply after the replacement; preview will run as a standard Vite SPA on the repo's `vite.config.ts`.
- The two directive files `AGENTS.md` and `.gitignore` exist in both places; I'll take the repo's versions.
- Nothing in Phase 2 touches business logic, workflow gates, domain types, mock data, or the activity log.
