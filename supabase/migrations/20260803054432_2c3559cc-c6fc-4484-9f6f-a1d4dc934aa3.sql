
CREATE TABLE public.onboarding_state (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  current_step integer NOT NULL DEFAULT 0,
  skipped_steps text[] NOT NULL DEFAULT '{}',
  completion_percentage integer NOT NULL DEFAULT 0,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  onboarding_started_at timestamptz NOT NULL DEFAULT now(),
  onboarding_completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.onboarding_state TO authenticated;
GRANT ALL ON public.onboarding_state TO service_role;

ALTER TABLE public.onboarding_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY onboarding_state_own_select ON public.onboarding_state
  FOR SELECT TO authenticated
  USING (profile_id = auth.uid() OR private.is_agency_admin());

CREATE POLICY onboarding_state_own_insert ON public.onboarding_state
  FOR INSERT TO authenticated
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY onboarding_state_own_update ON public.onboarding_state
  FOR UPDATE TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

CREATE TRIGGER onboarding_state_set_updated_at
  BEFORE UPDATE ON public.onboarding_state
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.submit_client_onboarding(_answers jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_role public.app_role;
  v_project_id uuid;
  v_name text;
  v_date date;
BEGIN
  SELECT client_id, role INTO v_client_id, v_role
  FROM public.profiles WHERE id = auth.uid();

  IF v_role IS DISTINCT FROM 'client'::public.app_role OR v_client_id IS NULL THEN
    RAISE EXCEPTION 'Only a linked client account can submit onboarding';
  END IF;

  v_name := NULLIF(trim(coalesce(_answers->>'project_name', '')), '');
  IF v_name IS NULL THEN
    v_name := left(coalesce(NULLIF(trim(_answers->>'goal'), ''), 'New project'), 80);
  END IF;

  INSERT INTO public.projects (client_id, name, status, summary, budget_signal)
  VALUES (
    v_client_id,
    v_name,
    'lead_started',
    left(coalesce(_answers->>'goal', ''), 2000),
    left(coalesce(_answers->>'budget_range', ''), 200)
  )
  RETURNING id INTO v_project_id;

  INSERT INTO public.project_briefs (project_id, problem_statement, goals, constraints, discovery_notes)
  VALUES (
    v_project_id,
    left(coalesce(_answers->>'current_process', ''), 4000),
    ARRAY[left(coalesce(_answers->>'goal', ''), 1000)],
    ARRAY[left(coalesce(_answers->>'existing_systems', ''), 1000)],
    left(concat_ws(E'\n',
      'Users: ' || coalesce(_answers->>'users', ''),
      'Needed capabilities: ' || coalesce(_answers->>'capabilities', ''),
      'Pain points: ' || coalesce(_answers->>'pain_points', ''),
      'Budget preference: ' || coalesce(_answers->>'budget_range', ''),
      'Links / examples: ' || coalesce(_answers->>'links', '')
    ), 6000)
  );

  BEGIN
    v_date := NULLIF(_answers->>'requested_date', '')::date;
  EXCEPTION WHEN others THEN
    v_date := NULL;
  END;

  INSERT INTO public.project_schedule (project_id, requested_completion_date, date_priority, date_reason, target_date_status)
  VALUES (
    v_project_id,
    v_date,
    coalesce(NULLIF(_answers->>'date_priority', ''), 'flexible'),
    left(coalesce(_answers->>'date_reason', ''), 1000),
    CASE WHEN v_date IS NULL THEN 'no_date_requested' ELSE 'under_review' END
  );

  UPDATE public.onboarding_state
  SET answers = _answers,
      completion_percentage = 100,
      onboarding_completed_at = now()
  WHERE profile_id = auth.uid();

  RETURN v_project_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_client_onboarding(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_client_onboarding(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_supplier_onboarding(_answers jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supplier_id uuid;
  v_role public.app_role;
BEGIN
  SELECT supplier_id, role INTO v_supplier_id, v_role
  FROM public.profiles WHERE id = auth.uid();

  IF v_role IS DISTINCT FROM 'supplier'::public.app_role OR v_supplier_id IS NULL THEN
    RAISE EXCEPTION 'Only a linked supplier account can submit onboarding';
  END IF;

  UPDATE public.suppliers SET
    name = coalesce(NULLIF(trim(_answers->>'name'), ''), name),
    email = coalesce(NULLIF(trim(_answers->>'email'), ''), email),
    phone = coalesce(NULLIF(trim(_answers->>'phone'), ''), phone),
    country = coalesce(NULLIF(trim(_answers->>'country'), ''), country),
    timezone = coalesce(NULLIF(trim(_answers->>'timezone'), ''), timezone),
    status = CASE WHEN status = 'approved' THEN status ELSE 'pending_review' END,
    updated_at = now()
  WHERE id = v_supplier_id;

  INSERT INTO public.supplier_profiles (
    supplier_id, main_skills, tools, hourly_rate, currency, weekly_availability_hours, portfolio_links, notes
  ) VALUES (
    v_supplier_id,
    coalesce(ARRAY(SELECT jsonb_array_elements_text(coalesce(_answers->'skills', '[]'::jsonb))), '{}'),
    coalesce(ARRAY(SELECT jsonb_array_elements_text(coalesce(_answers->'tools', '[]'::jsonb))), '{}'),
    coalesce(NULLIF(_answers->>'hourly_rate', '')::numeric, 0),
    coalesce(NULLIF(_answers->>'currency', ''), 'GBP'),
    coalesce(NULLIF(_answers->>'weekly_availability', '')::numeric, 0),
    coalesce(ARRAY(SELECT jsonb_array_elements_text(coalesce(_answers->'portfolio_links', '[]'::jsonb))), '{}'),
    left(concat_ws(E'\n',
      'Preferred project types: ' || coalesce(_answers->>'project_types', ''),
      'Preferred working days: ' || coalesce(_answers->>'working_days', ''),
      'Earliest start: ' || coalesce(_answers->>'earliest_start', ''),
      'Fixed price available: ' || coalesce(_answers->>'fixed_price', ''),
      'Minimum engagement: ' || coalesce(_answers->>'minimum_engagement', ''),
      'Preferred communication: ' || coalesce(_answers->>'communication', ''),
      'Typical response time: ' || coalesce(_answers->>'response_time', '')
    ), 6000)
  )
  ON CONFLICT (supplier_id) DO UPDATE SET
    main_skills = EXCLUDED.main_skills,
    tools = EXCLUDED.tools,
    hourly_rate = EXCLUDED.hourly_rate,
    currency = EXCLUDED.currency,
    weekly_availability_hours = EXCLUDED.weekly_availability_hours,
    portfolio_links = EXCLUDED.portfolio_links,
    notes = EXCLUDED.notes,
    updated_at = now();

  UPDATE public.onboarding_state
  SET answers = _answers,
      completion_percentage = 100,
      onboarding_completed_at = now()
  WHERE profile_id = auth.uid();

  RETURN v_supplier_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_supplier_onboarding(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_supplier_onboarding(jsonb) TO authenticated;
