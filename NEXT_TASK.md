# Next Task

## Last Completed

Turned the internal hub into a usable operational MVP: supplier creation, invitation-link based access for clients and suppliers, a filterable Access Management page, and fully actionable client and supplier portals.

## Current State

- Supabase (Lovable Cloud) is the single source of truth. No mock data remains.
- Email/password auth with `profiles`, roles (`agency_admin`, `client`, `supplier`), and strict RLS.
- `access-admin` edge function (agency-admin only) lists accounts, invites users, regenerates copyable invitation links, and enables/disables accounts.
- Suppliers can be created in-app with a profile (skills, tools, rate, currency, availability).
- Client portal: project overview, approved scope, approve/decline scope approvals, payment requests, paid hours, change requests (submit + approve/decline priced ones), files, messages.
- Supplier portal: assigned work, delivery instructions, log time, edit non-approved entries, approved value, files, messages. Client price, margin, and internal notes are never exposed.
- A database trigger guarantees a client can only change the decision on a `priced` change request — never the title, description, price, or supplier cost.
- Dashboard quick actions cover add client, add supplier, invite account, action queue, projects, payments, supplier time, change requests.

## Recommended Next Work Unit

Add an agency-side project delivery workspace for scope authoring: create and version a scope, add scope items with client/supplier visibility flags, and send a scope for client approval from one place.

## Why This Matters

Scope is the core artefact of the product, but it can still only be read, not authored, inside the app. Without scope authoring Yaniv must prepare scope outside the system and the approval gate stays partly manual.

## Acceptance Criteria

- Agency admin can create a scope version for a project and edit its client-facing summary and internal delivery notes.
- Agency admin can add, edit, and remove scope items with phase, description, acceptance notes, and client/supplier visibility.
- Agency admin can send a scope version for client approval, creating a pending client approval row.
- Client portal reflects the new scope and approval without further changes.
- RLS remains strict; suppliers never see client price, margin, or internal notes.
- Mutations await the database, use returned rows, and expose saving/error states.
- `pnpm run build` passes and the result is recorded.
