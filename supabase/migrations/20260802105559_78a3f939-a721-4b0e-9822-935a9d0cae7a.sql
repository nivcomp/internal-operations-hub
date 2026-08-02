CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

ALTER FUNCTION public.is_agency_admin() SET SCHEMA private;
ALTER FUNCTION public.current_user_role() SET SCHEMA private;
ALTER FUNCTION public.current_client_id() SET SCHEMA private;
ALTER FUNCTION public.current_supplier_id() SET SCHEMA private;
ALTER FUNCTION public.client_owns_project(uuid) SET SCHEMA private;
ALTER FUNCTION public.supplier_has_project(uuid) SET SCHEMA private;
ALTER FUNCTION public.bootstrap_agency_admin(text) SET SCHEMA private;

REVOKE ALL ON FUNCTION private.bootstrap_agency_admin(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.bootstrap_agency_admin(text) TO service_role;

REVOKE ALL ON FUNCTION private.is_agency_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.current_user_role() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.current_client_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.current_supplier_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.client_owns_project(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.supplier_has_project(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION private.is_agency_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.current_user_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.current_client_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.current_supplier_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.client_owns_project(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.supplier_has_project(uuid) TO authenticated, service_role;

-- guard trigger function stays internal too
ALTER FUNCTION public.guard_change_request_client_update() SET SCHEMA private;
ALTER FUNCTION public.handle_new_auth_user() SET SCHEMA private;