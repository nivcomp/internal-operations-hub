# Lovable Build Plan

This plan is for the first application pass after the documentation foundation.

For the next visual refinement pass, use `docs/lovable-ui-refinement-handoff.md` as the practical handoff. It defines the screens, constraints, and business rules that must be preserved while improving the UI.

## Build Style

Build a practical internal dashboard, not a public SaaS landing page.

Use:

- React
- TypeScript
- Supabase when ready
- Simple, readable components
- Mock data first
- Clear role-based visibility

Avoid:

- Complex authentication in the first pass
- Payment integrations
- Real AI API calls
- Overbuilt design systems
- Marketing pages
- Marketplace features

## Phase 1: Static Internal MVP

Create:

- App shell and navigation
- Internal dashboard
- Clients page
- Projects page
- Project detail page
- Suppliers page
- Pricing and margin view
- Change requests page
- Supplier time entries page

Use mock data from the planned data model.

## Phase 2: Client and Supplier Views

Create simple role-specific views:

- Client portal
- Client approval view
- Client change request form
- Supplier portal
- Supplier registration form
- Supplier time entry form

Keep role visibility strict.

## Phase 3: Supabase Data Layer

Add tables based on `docs/data-model.md`.

Start with:

- clients
- projects
- project_briefs
- scopes
- scope_items
- project_pricing
- suppliers
- supplier_profiles
- supplier_skill_suggestions
- time_entries
- change_requests
- client_payments
- hour_banks
- files_links
- project_messages
- decision_logs

## Phase 4: Workflow Rules

Implement:

- Payment gate before supplier work starts
- Scope approval status
- Change request pricing and approval flow
- Supplier time approval
- Margin calculation
- Hour bank remaining balance

## Phase 5: AI Placeholders

Add interface areas for:

- Client Guide Agent
- Agency Control Agent
- Supplier Work Agent
- Architect Agent
- Change Control Agent

Do not connect real AI yet. Use static placeholder outputs and editable drafts.

## Phase 6: Real AI Later

Only after the workflow is stable:

- Add AI summarization for discovery notes.
- Add draft brief generation.
- Add scope review prompts.
- Add change request impact summaries.
- Add supplier update drafting.

Every AI output should stay reviewable and editable by Yaniv.
