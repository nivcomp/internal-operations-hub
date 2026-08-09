DROP POLICY IF EXISTS "client reads own prototypes" ON public.project_prototypes;
DROP POLICY IF EXISTS "supplier reads assigned prototypes" ON public.project_prototypes;

CREATE POLICY "client reads own prototypes" ON public.project_prototypes
FOR SELECT TO authenticated
USING (
  private.client_owns_project(project_id)
  AND EXISTS (
    SELECT 1 FROM public.prototype_versions v
    WHERE v.prototype_id = project_prototypes.id
      AND v.audience = 'client'
      AND v.status IN ('shared','approved')
  )
);

CREATE POLICY "supplier reads assigned prototypes" ON public.project_prototypes
FOR SELECT TO authenticated
USING (
  private.supplier_has_project(project_id)
  AND EXISTS (
    SELECT 1 FROM public.prototype_versions v
    WHERE v.prototype_id = project_prototypes.id
      AND v.audience = 'supplier'
      AND v.status IN ('shared','approved')
  )
);