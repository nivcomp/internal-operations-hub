-- Repair already-deployed prototype installations and make the most recent
-- client MVP available without exposing older draft history.
CREATE OR REPLACE FUNCTION public.protect_approved_prototype_version()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.prototype_approvals a
    WHERE a.prototype_version_id = OLD.id AND a.decision = 'approved'
  ) THEN
    RAISE EXCEPTION 'Approved prototype versions are immutable';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS "client reads own prototypes" ON public.project_prototypes;
CREATE POLICY "client reads own prototypes" ON public.project_prototypes FOR SELECT TO authenticated
  USING (private.client_owns_project(project_id) AND EXISTS (
    SELECT 1 FROM public.prototype_versions v
    WHERE v.prototype_id = project_prototypes.id
      AND v.audience = 'client' AND v.status IN ('shared','approved')
  ));

DROP POLICY IF EXISTS "supplier reads assigned prototypes" ON public.project_prototypes;
CREATE POLICY "supplier reads assigned prototypes" ON public.project_prototypes FOR SELECT TO authenticated
  USING (private.supplier_has_project(project_id) AND EXISTS (
    SELECT 1 FROM public.prototype_versions v
    WHERE v.prototype_id = project_prototypes.id
      AND v.audience = 'supplier' AND v.status IN ('shared','approved')
  ));

DROP POLICY IF EXISTS "client records prototype decision" ON public.prototype_approvals;
CREATE POLICY "client records prototype decision" ON public.prototype_approvals FOR INSERT TO authenticated
  WITH CHECK (
    approved_by = auth.uid()
    AND private.client_owns_project(project_id)
    AND EXISTS (
      SELECT 1 FROM public.prototype_versions v
      WHERE v.id = prototype_approvals.prototype_version_id
        AND v.project_id = prototype_approvals.project_id
        AND v.audience = 'client' AND v.status IN ('shared','approved')
    )
  );

WITH latest_client_drafts AS (
  SELECT DISTINCT ON (prototype_id) id
  FROM public.prototype_versions
  WHERE status = 'draft' AND audience = 'client'
  ORDER BY prototype_id, version DESC
)
UPDATE public.prototype_versions v
SET status = 'shared'
FROM latest_client_drafts d
WHERE v.id = d.id;
