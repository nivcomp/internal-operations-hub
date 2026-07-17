-- Seed data for Client-to-Scope AI (mirrors initial demo dataset).
-- IDs are deterministic via md5(mock-string-id)::uuid so relationships stay stable.

INSERT INTO public.clients (id, name, company, email, phone, notes, status) VALUES
  (md5('client-1')::uuid, 'Maya Cohen',   'Northline Health', 'maya@northline.example', '+44 20 0000 0101', 'Needs a clear path from messy operations notes to a scoped client portal project.', 'active'),
  (md5('client-2')::uuid, 'Daniel Hart',  'Hart Advisory',    'daniel@hart.example',    NULL,               'New lead. Wants AI-assisted intake for his consulting clients.', 'lead'),
  (md5('client-3')::uuid, 'Leah Brooks',  'Brooks Supply',    'leah@brooks.example',    NULL,               'Retainer client with paid hours available.', 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.suppliers (id, name, email, phone, country, timezone, status) VALUES
  (md5('supplier-1')::uuid, 'Sam Reed',   'sam@supplier.example',   '+44 7700 900100', 'United Kingdom', 'Europe/London',   'approved'),
  (md5('supplier-2')::uuid, 'Iris Novak', 'iris@supplier.example',  NULL,              'Portugal',       'Europe/Lisbon',   'approved'),
  (md5('supplier-3')::uuid, 'Nadia Park', 'nadia@supplier.example', NULL,              'Canada',         'America/Toronto', 'pending_review')
ON CONFLICT (id) DO NOTHING;

-- (See migration 20260717 for full statements. This file is the canonical
-- re-seed script; keep it in sync with any future demo-data edits.)
