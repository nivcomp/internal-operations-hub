-- Require an explicit payment decision before an agency admin promotes a lead.
-- The existing two-argument function remains the transaction-safe implementation,
-- but authenticated callers must use this guarded wrapper.

CREATE OR REPLACE FUNCTION public.promote_client_onboarding(
  _profile_id uuid,
  _project_name text,
  _payment_decision text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_id uuid;
  v_existing_project_id uuid;
  v_client_id uuid;
  v_paid boolean;
BEGIN
  IF NOT private.is_agency_admin() THEN
    RAISE EXCEPTION 'Only an agency admin can promote a lead';
  END IF;

  IF _payment_decision NOT IN ('paid', 'override_unpaid') THEN
    RAISE EXCEPTION 'An explicit payment decision is required';
  END IF;

  -- Preserve the retry-safe contract of the original promotion function. If a
  -- response was lost after a successful promotion, a retry must return the
  -- same project without changing its payment decision or duplicating logs.
  SELECT thread.client_id, thread.project_id
  INTO v_client_id, v_existing_project_id
  FROM public.lead_conversations thread
  WHERE thread.profile_id = _profile_id
  FOR UPDATE;

  IF v_existing_project_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.projects project
    WHERE project.id = v_existing_project_id
      AND project.client_id = v_client_id
  ) THEN
    RETURN v_existing_project_id;
  END IF;

  v_project_id := public.promote_client_onboarding(_profile_id, _project_name);
  v_paid := _payment_decision = 'paid';

  UPDATE public.projects
  SET payment_gate_status = CASE WHEN v_paid THEN 'paid' ELSE 'blocked' END
  WHERE id = v_project_id;

  INSERT INTO public.decision_logs (
    project_id, decision, made_by_role, impact
  ) VALUES (
    v_project_id,
    CASE WHEN v_paid
      THEN 'Payment confirmed before project opening'
      ELSE 'Project opened with unpaid override'
    END,
    'agency_admin',
    CASE WHEN v_paid
      THEN 'The agency confirmed that payment was received when the lead became a project.'
      ELSE 'The agency explicitly opened the project without payment. Work remains blocked by the payment gate.'
    END
  );

  INSERT INTO public.activity_logs (label, detail)
  VALUES (
    CASE WHEN v_paid THEN 'Project opened after payment' ELSE 'Project opened without payment' END,
    CASE WHEN v_paid
      THEN 'Payment was confirmed during lead promotion.'
      ELSE 'Agency admin used the explicit unpaid override; the project payment gate remains blocked.'
    END
  );

  RETURN v_project_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.promote_client_onboarding(uuid, text) FROM authenticated;
REVOKE ALL ON FUNCTION public.promote_client_onboarding(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.promote_client_onboarding(uuid, text, text) TO authenticated;
