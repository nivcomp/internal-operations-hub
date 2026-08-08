-- Versioned, client-safe interactive prototypes attached to the existing project.
-- No duplicate client/project/chat records are introduced.

CREATE TABLE IF NOT EXISTS public.project_prototypes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  prototype_kind text NOT NULL CHECK (prototype_kind IN ('app','whatsapp','automation')),
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.prototype_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prototype_id uuid NOT NULL REFERENCES public.project_prototypes(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  version integer NOT NULL CHECK (version > 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','shared','approved','superseded')),
  audience text NOT NULL DEFAULT 'client' CHECK (audience IN ('agency','client','supplier')),
  title text NOT NULL,
  summary text NOT NULL DEFAULT '',
  content jsonb NOT NULL,
  source_notes text NOT NULL DEFAULT '',
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (prototype_id, version)
);

CREATE TABLE IF NOT EXISTS public.prototype_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prototype_version_id uuid NOT NULL REFERENCES public.prototype_versions(id) ON DELETE RESTRICT,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  decision text NOT NULL CHECK (decision IN ('approved','changes_requested')),
  comment text NOT NULL DEFAULT '',
  approved_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (prototype_version_id, approved_by)
);

CREATE INDEX IF NOT EXISTS project_prototypes_project_idx ON public.project_prototypes(project_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS prototype_versions_project_idx ON public.prototype_versions(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS prototype_approvals_project_idx ON public.prototype_approvals(project_id, created_at DESC);

ALTER TABLE public.project_prototypes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prototype_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prototype_approvals ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_prototypes, public.prototype_versions TO authenticated;
GRANT SELECT, INSERT ON public.prototype_approvals TO authenticated;

CREATE POLICY "agency manages prototypes" ON public.project_prototypes FOR ALL TO authenticated
  USING (private.is_agency_admin()) WITH CHECK (private.is_agency_admin());
CREATE POLICY "client reads own prototypes" ON public.project_prototypes FOR SELECT TO authenticated
  USING (private.client_owns_project(project_id) AND EXISTS (
    SELECT 1 FROM public.prototype_versions v WHERE v.prototype_id = id AND v.audience = 'client' AND v.status IN ('shared','approved')
  ));
CREATE POLICY "supplier reads assigned prototypes" ON public.project_prototypes FOR SELECT TO authenticated
  USING (private.supplier_has_project(project_id) AND EXISTS (
    SELECT 1 FROM public.prototype_versions v WHERE v.prototype_id = id AND v.audience = 'supplier' AND v.status IN ('shared','approved')
  ));

CREATE POLICY "agency manages prototype versions" ON public.prototype_versions FOR ALL TO authenticated
  USING (private.is_agency_admin()) WITH CHECK (private.is_agency_admin());
CREATE POLICY "client reads shared prototype versions" ON public.prototype_versions FOR SELECT TO authenticated
  USING (audience = 'client' AND status IN ('shared','approved') AND private.client_owns_project(project_id));
CREATE POLICY "supplier reads shared prototype versions" ON public.prototype_versions FOR SELECT TO authenticated
  USING (audience = 'supplier' AND status IN ('shared','approved') AND private.supplier_has_project(project_id));

CREATE POLICY "agency reads prototype approvals" ON public.prototype_approvals FOR SELECT TO authenticated
  USING (private.is_agency_admin());
CREATE POLICY "client reads own prototype approvals" ON public.prototype_approvals FOR SELECT TO authenticated
  USING (private.client_owns_project(project_id));
CREATE POLICY "client records prototype decision" ON public.prototype_approvals FOR INSERT TO authenticated
  WITH CHECK (
    approved_by = auth.uid()
    AND private.client_owns_project(project_id)
    AND EXISTS (
      SELECT 1 FROM public.prototype_versions v
      WHERE v.id = prototype_version_id AND v.project_id = project_id
        AND v.audience = 'client' AND v.status IN ('shared','approved')
    )
  );

CREATE OR REPLACE FUNCTION public.protect_approved_prototype_version()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.prototype_approvals a WHERE a.prototype_version_id = OLD.id AND a.decision = 'approved') THEN
    RAISE EXCEPTION 'Approved prototype versions are immutable';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS immutable_approved_prototype_versions ON public.prototype_versions;
CREATE TRIGGER immutable_approved_prototype_versions
BEFORE UPDATE OR DELETE ON public.prototype_versions
FOR EACH ROW EXECUTE FUNCTION public.protect_approved_prototype_version();
