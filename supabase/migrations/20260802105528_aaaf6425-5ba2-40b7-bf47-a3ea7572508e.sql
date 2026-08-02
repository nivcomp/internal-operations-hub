-- 1) Drop unused SECURITY DEFINER views (no app code uses them)
DROP VIEW IF EXISTS public.client_phase_pricing_view;
DROP VIEW IF EXISTS public.client_project_pricing_view;

-- 2) Lock down SECURITY DEFINER functions that must never be callable by signed-in users
REVOKE ALL ON FUNCTION public.bootstrap_agency_admin(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_agency_admin(text) TO service_role;

REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.guard_change_request_client_update() FROM PUBLIC, anon, authenticated;

-- 3) Trigger helper is not a definer function but should not be API-callable
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

-- 4) RLS helper functions stay executable by authenticated (required for policy evaluation),
--    but are removed from anonymous access.
REVOKE ALL ON FUNCTION public.is_agency_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_client_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_supplier_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.client_owns_project(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.supplier_has_project(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_agency_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_client_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_supplier_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.client_owns_project(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.supplier_has_project(uuid) TO authenticated, service_role;