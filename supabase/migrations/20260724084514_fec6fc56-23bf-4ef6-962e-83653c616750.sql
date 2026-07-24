
REVOKE EXECUTE ON FUNCTION public.current_user_role()             FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_agency_admin()               FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.current_client_id()             FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.current_supplier_id()           FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.supplier_has_project(uuid)      FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.client_owns_project(uuid)       FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user()          FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.bootstrap_agency_admin(text)    FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_updated_at()                FROM anon, PUBLIC;

COMMENT ON VIEW public.client_project_pricing_view IS
  'Intentional SECURITY DEFINER view: exposes only client-safe pricing columns (no supplier_cost or margin). The underlying project_pricing table is admin-only under RLS; row filtering is done in the view WHERE clause using auth.uid() helpers.';
COMMENT ON VIEW public.client_phase_pricing_view IS
  'Intentional SECURITY DEFINER view: exposes only client-safe phase pricing (no supplier_cost). Underlying phase_pricing is admin-only under RLS; row filtering happens in the view WHERE clause.';
