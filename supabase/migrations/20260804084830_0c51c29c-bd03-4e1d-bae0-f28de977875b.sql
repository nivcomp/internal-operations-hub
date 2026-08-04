
CREATE TABLE public.import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  file_type text NOT NULL,
  storage_path text,
  imported_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  imported_at timestamptz NOT NULL DEFAULT now(),
  total_rows integer NOT NULL DEFAULT 0,
  successful_rows integer NOT NULL DEFAULT 0,
  skipped_rows integer NOT NULL DEFAULT 0,
  failed_rows integer NOT NULL DEFAULT 0,
  mapping_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_batches TO authenticated;
GRANT ALL ON public.import_batches TO service_role;
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manages import batches" ON public.import_batches FOR ALL TO authenticated
  USING (private.is_agency_admin()) WITH CHECK (private.is_agency_admin());
CREATE TRIGGER import_batches_updated_at BEFORE UPDATE ON public.import_batches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.crm_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  company text NOT NULL DEFAULT '',
  email text,
  phone text,
  email_normalized text,
  phone_normalized text,
  source text,
  stage text NOT NULL DEFAULT 'new',
  status text NOT NULL DEFAULT 'open',
  service_interest text,
  estimated_value numeric,
  currency text NOT NULL DEFAULT 'GBP',
  notes text NOT NULL DEFAULT '',
  tags text[] NOT NULL DEFAULT '{}',
  next_follow_up_at date,
  last_contact_at date,
  owner_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  converted_client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  converted_at timestamptz,
  archived_at timestamptz,
  extra jsonb NOT NULL DEFAULT '{}'::jsonb,
  import_batch_id uuid REFERENCES public.import_batches(id) ON DELETE SET NULL,
  source_row_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_leads TO authenticated;
GRANT ALL ON public.crm_leads TO service_role;
ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manages leads" ON public.crm_leads FOR ALL TO authenticated
  USING (private.is_agency_admin()) WITH CHECK (private.is_agency_admin());
CREATE TRIGGER crm_leads_updated_at BEFORE UPDATE ON public.crm_leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX crm_leads_email_idx ON public.crm_leads (email_normalized);
CREATE INDEX crm_leads_phone_idx ON public.crm_leads (phone_normalized);
CREATE INDEX crm_leads_stage_idx ON public.crm_leads (stage);
CREATE UNIQUE INDEX crm_leads_batch_row_idx ON public.crm_leads (import_batch_id, source_row_id)
  WHERE import_batch_id IS NOT NULL AND source_row_id IS NOT NULL;

CREATE TABLE public.contact_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  body text NOT NULL,
  note_type text NOT NULL DEFAULT 'note',
  original_source text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  import_batch_id uuid REFERENCES public.import_batches(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contact_notes TO authenticated;
GRANT ALL ON public.contact_notes TO service_role;
ALTER TABLE public.contact_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manages contact notes" ON public.contact_notes FOR ALL TO authenticated
  USING (private.is_agency_admin()) WITH CHECK (private.is_agency_admin());
CREATE INDEX contact_notes_lead_idx ON public.contact_notes (lead_id);
CREATE INDEX contact_notes_client_idx ON public.contact_notes (client_id);

CREATE TABLE public.past_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.crm_leads(id) ON DELETE SET NULL,
  project_name text NOT NULL,
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'completed',
  start_date date,
  end_date date,
  value numeric,
  currency text NOT NULL DEFAULT 'GBP',
  technologies text[] NOT NULL DEFAULT '{}',
  outcome text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  archived_at timestamptz,
  import_batch_id uuid REFERENCES public.import_batches(id) ON DELETE SET NULL,
  source_row_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.past_projects TO authenticated;
GRANT ALL ON public.past_projects TO service_role;
ALTER TABLE public.past_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manages past projects" ON public.past_projects FOR ALL TO authenticated
  USING (private.is_agency_admin()) WITH CHECK (private.is_agency_admin());
CREATE TRIGGER past_projects_updated_at BEFORE UPDATE ON public.past_projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE UNIQUE INDEX past_projects_batch_row_idx ON public.past_projects (import_batch_id, source_row_id)
  WHERE import_batch_id IS NOT NULL AND source_row_id IS NOT NULL;

CREATE TABLE public.import_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.import_batches(id) ON DELETE CASCADE,
  sheet_name text NOT NULL DEFAULT '',
  sheet_type text NOT NULL DEFAULT 'leads',
  row_index integer NOT NULL,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolution text NOT NULL DEFAULT 'create',
  target_table text,
  target_id uuid,
  status text NOT NULL DEFAULT 'pending',
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_rows TO authenticated;
GRANT ALL ON public.import_rows TO service_role;
ALTER TABLE public.import_rows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manages import rows" ON public.import_rows FOR ALL TO authenticated
  USING (private.is_agency_admin()) WITH CHECK (private.is_agency_admin());
CREATE TRIGGER import_rows_updated_at BEFORE UPDATE ON public.import_rows
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE UNIQUE INDEX import_rows_batch_sheet_row_idx ON public.import_rows (batch_id, sheet_name, row_index);

CREATE TABLE public.crm_ai_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  kind text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'suggested',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_ai_suggestions TO authenticated;
GRANT ALL ON public.crm_ai_suggestions TO service_role;
ALTER TABLE public.crm_ai_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manages crm suggestions" ON public.crm_ai_suggestions FOR ALL TO authenticated
  USING (private.is_agency_admin()) WITH CHECK (private.is_agency_admin());
CREATE TRIGGER crm_ai_suggestions_updated_at BEFORE UPDATE ON public.crm_ai_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
