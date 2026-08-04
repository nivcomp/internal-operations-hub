# Excel / CSV import + Hebrew CRM pipeline

Adds a spreadsheet import flow and a lightweight lead pipeline on top of the existing hub. Existing clients, projects, AI, auth, RLS and invitations stay untouched — leads are a new layer that converts into the current client/project records.

## What Yaniv gets

1. **"ייבוא Excel / CSV"** action from the Simple dashboard, Clients page, the new CRM page, and Copilot quick actions.
2. **Upload step** — drag-drop or file pick (.xlsx, .xls, .csv). Shows file name, size, worksheets, row counts, detected headers and validation warnings. Nothing is written yet.
3. **Worksheet step** — pick one or more sheets and label each (leads / clients / contacts / previous projects / notes / unknown). AI suggests, Yaniv decides.
4. **Mapping step** — every source column shows sample values, an AI-suggested destination field with a confidence level, and options to change it, ignore it, or push it into a note field.
5. **Preview step** — counts for rows to create, rows to update, duplicates, invalid emails/phones, missing required fields, ignored columns, notes to append, projects to link, plus a downloadable error report. Import only runs after explicit confirmation.
6. **Execution** — runs server-side in batches with progress, per-row failures that don't stop the batch, and a "retry failed rows only" action.
7. **CRM page (Hebrew, RTL)** — pipeline board with the nine stages, list view, search/filter, quick notes, next follow-up, convert to client, create project, archive.
8. **Client card** — a "פרויקטים קודמים" section for imported historical projects, kept out of active financial calculations.

## Duplicates and merging

Matching runs on normalized email, normalized phone, company name and contact name against existing clients and leads. Each match offers skip / merge / create separate / update existing / review later. Merging never deletes notes (imported notes are appended with source and import date), never overwrites a non-empty email or phone without confirmation, keeps both tag sets, and writes an activity-log entry. Original row values are preserved in the import audit.

## AI enrichment

After import the AI can produce a lead summary, service interest, likely project type, priority, missing info, recommended next action, follow-up draft, duplicate hints, tags and project opportunities. All of it renders as suggestions — nothing changes stage, price or scope without confirmation.

## Copilot

The admin Copilot gains CRM read access and structured actions: list stale leads, filter by interest, summarize notes for a company, convert lead to client, create project from lead, draft follow-ups, rank hot leads, show duplicates from the last import. Risky actions keep the existing confirmation-card flow.

## Technical details

**Database (new tables only, all agency_admin-only via RLS + GRANTs):**
- `crm_leads` — name, company, email, phone, source, stage, status, service_interest, estimated_value, currency, notes, next_follow_up_at, last_contact_at, owner_profile_id, converted_client_id, archived_at, import_batch_id, source_row_id (unique per batch to block re-import of the same row).
- `contact_notes` — nullable lead_id / client_id / project_id, body, note_type, original_source, created_by, import_batch_id.
- `past_projects` — client_id, project_name, description, status, start_date, end_date, value, currency, technologies, outcome, notes, import_batch_id.
- `import_batches` — file_name, file_type, imported_by, imported_at, total_rows, successful/skipped/failed counts, mapping_json, status.
- `import_rows` — batch_id, row_index, raw jsonb, resolution, target ids, error text (drives preview, audit and retry).
- `crm_ai_suggestions` — lead/client scoped suggestion payloads, marked pending until accepted.

**Parsing:** `xlsx` (SheetJS) added as a frontend dependency for header/sheet/row extraction and preview, plus the same parse server-side inside the edge function for the authoritative import. Formula cells are read as values only, never evaluated; leading `=`, `+`, `-`, `@` in text cells is prefixed to neutralize CSV injection.

**Storage:** a private `crm-imports` bucket holding the original file, readable only by agency_admin via RLS.

**Edge functions:**
- `crm-import` — validates the JWT and admin role, parses the stored file, runs duplicate matching, returns the dry-run preview, then executes batched inserts/updates (chunked, resumable, per-row error capture) and supports retry-failed-only.
- `crm-ai-map` — Lovable AI call that suggests sheet types and column mappings with confidence.
- Copilot's shared action catalog gains CRM actions and CRM read queries.

**Frontend:**
- `src/services/crmApi.ts`, `src/services/importApi.ts`
- `src/components/import/ImportWizard.tsx` (upload → sheets → mapping → duplicates → preview → run)
- `src/pages/simple/SimpleCrmPage.tsx` + a `crm` entry in the Simple nav, and a `crm` advanced view for the full pipeline
- Past-projects panel on the client detail/card
- Hebrew labels extended in `src/lib/simpleHebrew.ts`

**Not changed:** existing domain types, pricing, estimation, scheduling, invitation and registration flows, existing RLS policies.

## Known limits

- Password-protected workbooks, `.numbers`, and Google Sheets links are not supported; export to xlsx/csv first.
- Very large files are capped (initial limit ~20k rows per import) to stay inside edge-function limits; larger files should be split.
