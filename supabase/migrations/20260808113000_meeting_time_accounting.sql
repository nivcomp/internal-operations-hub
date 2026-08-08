-- Idempotent meeting-time accounting against the existing paid-hours bank.
-- Client-safe timing stays on client_meetings; agency-only billing data has a protected ledger row.

ALTER TABLE public.client_meetings
  ADD COLUMN IF NOT EXISTS duration_minutes integer,
  DROP CONSTRAINT IF EXISTS client_meetings_duration_minutes_check,
  ADD CONSTRAINT client_meetings_duration_minutes_check CHECK (duration_minutes IS NULL OR duration_minutes >= 0);

CREATE TABLE IF NOT EXISTS public.meeting_time_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL UNIQUE REFERENCES public.client_meetings(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  actual_minutes integer NOT NULL CHECK (actual_minutes >= 0),
  billable_hours numeric(10,2) NOT NULL CHECK (billable_hours >= 0),
  paid_hours_id uuid REFERENCES public.paid_hours(id) ON DELETE SET NULL,
  deducted_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.meeting_time_charges ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.meeting_time_charges TO authenticated;
CREATE POLICY "admin reads meeting time charges" ON public.meeting_time_charges
  FOR SELECT TO authenticated USING (private.is_agency_admin());

CREATE INDEX IF NOT EXISTS meeting_time_charges_project_idx ON public.meeting_time_charges(project_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.finish_client_meeting(
  p_meeting_id uuid,
  p_billable_hours numeric DEFAULT NULL,
  p_paid_hours_id uuid DEFAULT NULL
)
RETURNS public.client_meetings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_meeting public.client_meetings;
  v_project public.projects;
  v_bank public.paid_hours;
  v_ended_at timestamptz;
  v_duration_minutes integer;
  v_billable numeric(10,2);
BEGIN
  IF NOT private.is_agency_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;

  SELECT * INTO v_meeting FROM public.client_meetings WHERE id = p_meeting_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Meeting not found'; END IF;

  -- The unique ledger row makes retries safe and prevents a second bank deduction.
  IF EXISTS (SELECT 1 FROM public.meeting_time_charges WHERE meeting_id = p_meeting_id) THEN
    RETURN v_meeting;
  END IF;

  v_ended_at := COALESCE(v_meeting.ended_at, now());
  v_duration_minutes := GREATEST(0, ROUND(EXTRACT(EPOCH FROM (v_ended_at - v_meeting.started_at)) / 60)::integer);
  v_billable := COALESCE(p_billable_hours, CEIL(v_duration_minutes / 15.0) * 0.25);
  IF v_billable < 0 OR v_billable > 1000 THEN RAISE EXCEPTION 'Invalid billable hours'; END IF;

  IF p_paid_hours_id IS NOT NULL AND v_billable > 0 THEN
    SELECT * INTO v_project FROM public.projects WHERE id = v_meeting.project_id;
    SELECT * INTO v_bank FROM public.paid_hours WHERE id = p_paid_hours_id FOR UPDATE;
    IF NOT FOUND OR v_bank.client_id <> v_project.client_id
       OR (v_bank.project_id IS NOT NULL AND v_bank.project_id <> v_meeting.project_id) THEN
      RAISE EXCEPTION 'Hour bank does not belong to this project client';
    END IF;
    IF v_bank.hours_remaining < v_billable THEN RAISE EXCEPTION 'Not enough hours remain in the selected bank'; END IF;

    UPDATE public.paid_hours
      SET hours_used = hours_used + v_billable,
          hours_remaining = hours_remaining - v_billable,
          updated_at = now()
      WHERE id = v_bank.id;
  END IF;

  INSERT INTO public.meeting_time_charges (
    meeting_id, project_id, actual_minutes, billable_hours, paid_hours_id, deducted_at
  ) VALUES (
    p_meeting_id, v_meeting.project_id, v_duration_minutes, v_billable, p_paid_hours_id,
    CASE WHEN p_paid_hours_id IS NOT NULL AND v_billable > 0 THEN now() ELSE NULL END
  );

  UPDATE public.client_meetings
    SET status = 'completed', ended_at = v_ended_at, duration_minutes = v_duration_minutes, updated_at = now()
    WHERE id = p_meeting_id
    RETURNING * INTO v_meeting;

  RETURN v_meeting;
END;
$$;

REVOKE ALL ON FUNCTION public.finish_client_meeting(uuid, numeric, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finish_client_meeting(uuid, numeric, uuid) TO authenticated;
