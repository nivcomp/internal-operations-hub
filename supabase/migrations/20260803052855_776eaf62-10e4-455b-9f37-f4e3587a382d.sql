CREATE TABLE public.project_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL UNIQUE REFERENCES public.projects(id) ON DELETE CASCADE,
  requested_completion_date date,
  date_priority text NOT NULL DEFAULT 'flexible',
  date_reason text NOT NULL DEFAULT '',
  partial_delivery_ok boolean NOT NULL DEFAULT false,
  phase_one_date date,
  target_date_status text NOT NULL DEFAULT 'no_date_requested',
  status_reason text NOT NULL DEFAULT '',
  earliest_start_date date,
  weekly_capacity_hours numeric NOT NULL DEFAULT 0,
  client_response_delay_days integer NOT NULL DEFAULT 3,
  external_approval_delay_days integer NOT NULL DEFAULT 0,
  recommended_delivery_start date,
  recommended_delivery_end date,
  approved_delivery_date date,
  supplier_availability_confirmed boolean NOT NULL DEFAULT false,
  scope_changed_after_date_approval boolean NOT NULL DEFAULT false,
  delivery_notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_schedule TO authenticated;
GRANT ALL ON public.project_schedule TO service_role;

ALTER TABLE public.project_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY project_schedule_admin_all ON public.project_schedule FOR ALL TO authenticated
  USING (private.is_agency_admin()) WITH CHECK (private.is_agency_admin());

CREATE POLICY project_schedule_client_read ON public.project_schedule FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.client_id = private.current_client_id()));

CREATE POLICY project_schedule_client_insert ON public.project_schedule FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.client_id = private.current_client_id()));

CREATE POLICY project_schedule_client_update ON public.project_schedule FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.client_id = private.current_client_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.client_id = private.current_client_id()));

CREATE POLICY project_schedule_supplier_read ON public.project_schedule FOR SELECT TO authenticated
  USING (private.supplier_has_project(project_id));

CREATE OR REPLACE FUNCTION public.guard_project_schedule_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT private.is_agency_admin() THEN
    NEW.target_date_status := OLD.target_date_status;
    NEW.status_reason := OLD.status_reason;
    NEW.earliest_start_date := OLD.earliest_start_date;
    NEW.weekly_capacity_hours := OLD.weekly_capacity_hours;
    NEW.client_response_delay_days := OLD.client_response_delay_days;
    NEW.external_approval_delay_days := OLD.external_approval_delay_days;
    NEW.recommended_delivery_start := OLD.recommended_delivery_start;
    NEW.recommended_delivery_end := OLD.recommended_delivery_end;
    NEW.approved_delivery_date := OLD.approved_delivery_date;
    NEW.supplier_availability_confirmed := OLD.supplier_availability_confirmed;
    NEW.delivery_notes := OLD.delivery_notes;
    IF NEW.requested_completion_date IS DISTINCT FROM OLD.requested_completion_date
       OR NEW.date_priority IS DISTINCT FROM OLD.date_priority THEN
      NEW.target_date_status := 'under_review';
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER project_schedule_guard BEFORE UPDATE ON public.project_schedule
  FOR EACH ROW EXECUTE FUNCTION public.guard_project_schedule_columns();
