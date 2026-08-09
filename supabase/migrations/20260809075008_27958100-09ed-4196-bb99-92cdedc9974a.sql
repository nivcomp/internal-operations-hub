DROP POLICY IF EXISTS "client records prototype decision" ON public.prototype_approvals;
CREATE POLICY "client records prototype decision" ON public.prototype_approvals FOR INSERT TO authenticated
  WITH CHECK (
    approved_by = auth.uid()
    AND private.client_owns_project(project_id)
    AND EXISTS (
      SELECT 1 FROM public.prototype_versions v
      WHERE v.id = prototype_version_id
        AND v.project_id = project_id
        AND v.audience = 'client'
        AND v.status IN ('shared','approved')
    )
  );