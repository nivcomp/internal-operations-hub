
REVOKE ALL ON FUNCTION public.submit_client_onboarding(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.submit_supplier_onboarding(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_client_onboarding(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_supplier_onboarding(jsonb) TO authenticated;
