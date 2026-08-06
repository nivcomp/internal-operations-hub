-- Canonical meeting -> specification -> proposal -> signature -> handoff workflow.
-- Reuses projects, project_conversations, project_estimates, estimate_versions,
-- change_requests, files and project_supplier_assignments.

CREATE TABLE public.client_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.crm_leads(id) ON DELETE SET NULL,
  conversation_id uuid REFERENCES public.project_conversations(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','completed','cancelled')),
  language text NOT NULL DEFAULT 'he' CHECK (language IN ('he','en')),
  title text NOT NULL DEFAULT '',
  started_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.meeting_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.client_meetings(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  source_type text NOT NULL CHECK (source_type IN ('transcript','image','pdf','word','screenshot','link','crm_note','project_file')),
  title text NOT NULL DEFAULT '',
  storage_path text,
  external_url text,
  mime_type text,
  transcript text NOT NULL DEFAULT '',
  extracted_text text NOT NULL DEFAULT '',
  ai_derived boolean NOT NULL DEFAULT false,
  review_status text NOT NULL DEFAULT 'unreviewed' CHECK (review_status IN ('unreviewed','reviewed','rejected')),
  speaker text NOT NULL DEFAULT '',
  captured_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.specification_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  meeting_id uuid REFERENCES public.client_meetings(id) ON DELETE SET NULL,
  section_key text NOT NULL,
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'incomplete' CHECK (status IN ('ai_draft','edited','approved','incomplete')),
  client_visible boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, section_key)
);

CREATE TABLE public.specification_section_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL REFERENCES public.specification_sections(id) ON DELETE CASCADE,
  meeting_source_id uuid REFERENCES public.meeting_sources(id) ON DELETE CASCADE,
  message_id uuid REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (meeting_source_id IS NOT NULL OR message_id IS NOT NULL),
  UNIQUE NULLS NOT DISTINCT(section_id, meeting_source_id, message_id)
);

CREATE TABLE public.specification_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  version integer NOT NULL,
  snapshot jsonb NOT NULL,
  content_hash text NOT NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, version)
);

CREATE TABLE public.proposal_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  specification_version_id uuid NOT NULL REFERENCES public.specification_versions(id),
  estimate_id uuid NOT NULL REFERENCES public.project_estimates(id),
  change_request_id uuid REFERENCES public.change_requests(id) ON DELETE SET NULL,
  version integer NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','viewed','signed','superseded')),
  proposal_kind text NOT NULL DEFAULT 'full' CHECK (proposal_kind IN ('short','full','technical_appendix')),
  language text NOT NULL DEFAULT 'he',
  content jsonb NOT NULL,
  fixed_price numeric NOT NULL CHECK (fixed_price >= 0),
  currency text NOT NULL,
  payment_terms text NOT NULL DEFAULT '',
  document_hash text NOT NULL,
  published_at timestamptz,
  viewed_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, version), UNIQUE(document_hash)
);

CREATE TABLE public.proposal_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_version_id uuid NOT NULL UNIQUE REFERENCES public.proposal_versions(id),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,
  specification_version_id uuid NOT NULL REFERENCES public.specification_versions(id),
  fixed_price numeric NOT NULL,
  currency text NOT NULL,
  payment_terms text NOT NULL,
  signed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  signer_name text NOT NULL,
  signer_email text NOT NULL,
  signer_role text NOT NULL,
  signature_artifact text NOT NULL,
  signed_at timestamptz NOT NULL DEFAULT now(),
  ip_address inet,
  user_agent text NOT NULL DEFAULT '',
  document_hash text NOT NULL,
  acceptance_status text NOT NULL DEFAULT 'accepted' CHECK (acceptance_status = 'accepted'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.project_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  proposal_version_id uuid REFERENCES public.proposal_versions(id) ON DELETE SET NULL,
  document_type text NOT NULL,
  audience text NOT NULL CHECK (audience IN ('agency','client','supplier')),
  language text NOT NULL DEFAULT 'he',
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','signed','superseded')),
  markdown text NOT NULL DEFAULT '',
  storage_path text,
  content_hash text NOT NULL DEFAULT '',
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.execution_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  proposal_version_id uuid NOT NULL REFERENCES public.proposal_versions(id),
  version integer NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','superseded')),
  package jsonb NOT NULL,
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, version)
);

ALTER TABLE public.change_requests
  ADD COLUMN IF NOT EXISTS source_proposal_version_id uuid REFERENCES public.proposal_versions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS revised_proposal_version_id uuid REFERENCES public.proposal_versions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delivery_impact text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS requires_signature boolean NOT NULL DEFAULT true;

ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS planning_readiness text NOT NULL DEFAULT 'not_ready'
  CHECK (planning_readiness IN ('not_ready','ready_for_planning','planning'));

CREATE INDEX ON public.client_meetings(project_id, started_at DESC);
CREATE INDEX ON public.meeting_sources(meeting_id, captured_at);
CREATE INDEX ON public.specification_sections(project_id, sort_order);
CREATE INDEX ON public.proposal_versions(project_id, version DESC);
CREATE INDEX ON public.project_documents(project_id, created_at DESC);

CREATE TRIGGER trg_client_meetings_updated_at BEFORE UPDATE ON public.client_meetings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_meeting_sources_updated_at BEFORE UPDATE ON public.meeting_sources FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_specification_sections_updated_at BEFORE UPDATE ON public.specification_sections FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION private.prevent_signed_artifact_mutation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
BEGIN RAISE EXCEPTION 'Signed artifacts are immutable'; END $$;
REVOKE ALL ON FUNCTION private.prevent_signed_artifact_mutation() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER immutable_proposal_signatures BEFORE UPDATE OR DELETE ON public.proposal_signatures
FOR EACH ROW EXECUTE FUNCTION private.prevent_signed_artifact_mutation();
CREATE TRIGGER immutable_specification_versions BEFORE UPDATE OR DELETE ON public.specification_versions
FOR EACH ROW EXECUTE FUNCTION private.prevent_signed_artifact_mutation();

CREATE OR REPLACE FUNCTION private.prevent_signed_proposal_mutation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  -- The server may perform the single published -> signed status transition
  -- immediately after inserting the signature. No content or commercial field
  -- may change during that transition, and every later mutation is blocked.
  IF OLD.status IN ('published','viewed') AND NEW.status IN ('viewed','signed','superseded')
     AND (to_jsonb(NEW) - 'status') = (to_jsonb(OLD) - 'status') THEN
    RETURN NEW;
  END IF;
  IF OLD.status <> 'draft' OR EXISTS (SELECT 1 FROM public.proposal_signatures s WHERE s.proposal_version_id = OLD.id) THEN
    RAISE EXCEPTION 'Published proposal versions are immutable';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.prevent_signed_proposal_mutation() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER immutable_signed_proposals BEFORE UPDATE OR DELETE ON public.proposal_versions
FOR EACH ROW EXECUTE FUNCTION private.prevent_signed_proposal_mutation();

ALTER TABLE public.client_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.specification_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.specification_section_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.specification_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.execution_packages ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_meetings, public.meeting_sources, public.specification_sections,
  public.specification_section_sources, public.specification_versions, public.proposal_versions,
  public.project_documents, public.execution_packages TO authenticated;
GRANT SELECT, INSERT ON public.proposal_signatures TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

CREATE POLICY "admin manages meetings" ON public.client_meetings FOR ALL TO authenticated USING (private.is_agency_admin()) WITH CHECK (private.is_agency_admin());
CREATE POLICY "client reads own meetings" ON public.client_meetings FOR SELECT TO authenticated USING (private.client_owns_project(project_id));
CREATE POLICY "admin reads meeting sources" ON public.meeting_sources FOR SELECT TO authenticated USING (private.is_agency_admin());
CREATE POLICY "admin adds meeting sources" ON public.meeting_sources FOR INSERT TO authenticated WITH CHECK (private.is_agency_admin());
CREATE POLICY "admin updates meeting sources" ON public.meeting_sources FOR UPDATE TO authenticated USING (private.is_agency_admin()) WITH CHECK (private.is_agency_admin());
CREATE POLICY "client reads own meeting sources" ON public.meeting_sources FOR SELECT TO authenticated USING (private.client_owns_project(project_id));
CREATE POLICY "client adds own meeting sources" ON public.meeting_sources FOR INSERT TO authenticated WITH CHECK (private.client_owns_project(project_id));
CREATE POLICY "client updates own meeting sources" ON public.meeting_sources FOR UPDATE TO authenticated USING (private.client_owns_project(project_id)) WITH CHECK (private.client_owns_project(project_id));
CREATE POLICY "admin manages specification" ON public.specification_sections FOR ALL TO authenticated USING (private.is_agency_admin()) WITH CHECK (private.is_agency_admin());
CREATE POLICY "client reads safe specification" ON public.specification_sections FOR SELECT TO authenticated USING (client_visible AND private.client_owns_project(project_id));
CREATE POLICY "admin manages section sources" ON public.specification_section_sources FOR ALL TO authenticated USING (private.is_agency_admin()) WITH CHECK (private.is_agency_admin());
CREATE POLICY "admin manages specification versions" ON public.specification_versions FOR ALL TO authenticated USING (private.is_agency_admin()) WITH CHECK (private.is_agency_admin());
CREATE POLICY "client reads own specification versions" ON public.specification_versions FOR SELECT TO authenticated USING (private.client_owns_project(project_id));
CREATE POLICY "admin manages proposals" ON public.proposal_versions FOR ALL TO authenticated USING (private.is_agency_admin()) WITH CHECK (private.is_agency_admin());
CREATE POLICY "client reads published proposals" ON public.proposal_versions FOR SELECT TO authenticated USING (status IN ('published','viewed','signed','superseded') AND private.client_owns_project(project_id));
CREATE POLICY "admin reads signatures" ON public.proposal_signatures FOR SELECT TO authenticated USING (private.is_agency_admin());
CREATE POLICY "client reads own signatures" ON public.proposal_signatures FOR SELECT TO authenticated USING (private.client_owns_project(project_id));
CREATE POLICY "admin manages documents" ON public.project_documents FOR ALL TO authenticated USING (private.is_agency_admin()) WITH CHECK (private.is_agency_admin());
CREATE POLICY "client reads client documents" ON public.project_documents FOR SELECT TO authenticated USING (audience = 'client' AND private.client_owns_project(project_id));
CREATE POLICY "supplier reads assigned documents" ON public.project_documents FOR SELECT TO authenticated USING (audience = 'supplier' AND private.supplier_has_project(project_id));
CREATE POLICY "admin manages execution packages" ON public.execution_packages FOR ALL TO authenticated USING (private.is_agency_admin()) WITH CHECK (private.is_agency_admin());

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('meeting-sources', 'meeting-sources', false, 20971520, ARRAY['image/jpeg','image/png','image/webp','application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain'])
ON CONFLICT (id) DO NOTHING;
CREATE POLICY "meeting source admin upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='meeting-sources' AND private.is_agency_admin());
CREATE POLICY "meeting source admin read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id='meeting-sources' AND private.is_agency_admin());
CREATE POLICY "meeting source admin update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id='meeting-sources' AND private.is_agency_admin()) WITH CHECK (bucket_id='meeting-sources' AND private.is_agency_admin());
CREATE POLICY "client uploads own meeting sources" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id='meeting-sources' AND array_length(storage.foldername(name), 1) >= 1
    AND private.client_owns_project((storage.foldername(name))[1]::uuid));
CREATE POLICY "client reads own meeting sources" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id='meeting-sources' AND array_length(storage.foldername(name), 1) >= 1
    AND private.client_owns_project((storage.foldername(name))[1]::uuid));

CREATE OR REPLACE FUNCTION private.link_change_to_signed_proposal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  IF NEW.source_proposal_version_id IS NULL THEN
    SELECT id INTO NEW.source_proposal_version_id FROM public.proposal_versions
    WHERE project_id = NEW.project_id AND status = 'signed' ORDER BY version DESC LIMIT 1;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.link_change_to_signed_proposal() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER link_change_request_to_signed_scope BEFORE INSERT ON public.change_requests
FOR EACH ROW EXECUTE FUNCTION private.link_change_to_signed_proposal();
