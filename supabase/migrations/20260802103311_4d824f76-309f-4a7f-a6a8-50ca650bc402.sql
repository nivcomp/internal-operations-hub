CREATE OR REPLACE FUNCTION public.guard_change_request_client_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_agency_admin() THEN
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
END $$;

DROP TRIGGER IF EXISTS guard_change_request_client_update ON public.change_requests;
CREATE TRIGGER guard_change_request_client_update
  BEFORE UPDATE ON public.change_requests
  FOR EACH ROW EXECUTE FUNCTION public.guard_change_request_client_update();

DROP POLICY IF EXISTS cr_client_decision ON public.change_requests;
CREATE POLICY cr_client_decision
  ON public.change_requests
  FOR UPDATE
  TO authenticated
  USING (public.client_owns_project(project_id) AND status = 'priced')
  WITH CHECK (public.client_owns_project(project_id) AND status IN ('client_approved', 'declined'));