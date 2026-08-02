CREATE OR REPLACE FUNCTION private.client_owns_project(_project_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
 SET search_path TO 'private', 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.projects p
     WHERE p.id = _project_id
       AND p.client_id = private.current_client_id()
  )
$function$;

CREATE OR REPLACE FUNCTION private.supplier_has_project(_project_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
 SET search_path TO 'private', 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.project_supplier_assignments psa
     WHERE psa.project_id = _project_id
       AND psa.supplier_id = private.current_supplier_id()
  )
$function$;

CREATE OR REPLACE FUNCTION private.guard_change_request_client_update()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO 'private', 'public'
AS $function$
BEGIN
  IF private.is_agency_admin() THEN
    RETURN NEW;
  END IF;

  IF OLD.status IS DISTINCT FROM 'priced' THEN
    RAISE EXCEPTION 'Only a priced change request can be decided.';
  END IF;
  IF NEW.status NOT IN ('client_approved', 'declined') THEN
    RAISE EXCEPTION 'A client may only approve or decline a priced change request.';
  END IF;
  IF NEW.project_id IS DISTINCT FROM OLD.project_id
     OR NEW.requested_by_client_id IS DISTINCT FROM OLD.requested_by_client_id
     OR NEW.title IS DISTINCT FROM OLD.title
     OR NEW.description IS DISTINCT FROM OLD.description
     OR NEW.agency_price IS DISTINCT FROM OLD.agency_price
     OR NEW.supplier_cost IS DISTINCT FROM OLD.supplier_cost THEN
    RAISE EXCEPTION 'Only the decision may be changed on a priced change request.';
  END IF;

  RETURN NEW;
END $function$;

REVOKE EXECUTE ON FUNCTION private.guard_change_request_client_update() FROM PUBLIC, anon, authenticated;