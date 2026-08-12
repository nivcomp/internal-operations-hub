-- Preserve a new client's complete onboarding conversation and structured draft
-- inside the exact project created for that authenticated client account.

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
  v_existing_project_id uuid;
  v_existing_answers jsonb := '{}'::jsonb;
  v_completed_at timestamptz;
  v_name text;
  v_date date;
  v_document jsonb;
  v_flow jsonb;
  v_flow_edges jsonb;
  v_transcript jsonb;
  v_conversation_id uuid;
  v_turn jsonb;
  v_turn_at timestamptz;
  v_turn_index integer := 0;
  v_body text;
  v_section record;
  v_content text;
  v_flow_nodes jsonb := '[]'::jsonb;
  v_goals text[] := '{}'::text[];
  v_assumptions text[] := '{}'::text[];
  v_constraints text[] := '{}'::text[];
  v_exclusions text[] := '{}'::text[];
BEGIN
  SELECT client_id, role INTO v_client_id, v_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_role IS DISTINCT FROM 'client'::public.app_role OR v_client_id IS NULL THEN
    RAISE EXCEPTION 'Only a linked client account can submit onboarding';
  END IF;

  SELECT answers, onboarding_completed_at
  INTO v_existing_answers, v_completed_at
  FROM public.onboarding_state
  WHERE profile_id = auth.uid()
  FOR UPDATE;

  -- A network retry must return the same project instead of creating a duplicate.
  IF v_completed_at IS NOT NULL
     AND coalesce(v_existing_answers->>'_projectId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    v_existing_project_id := (v_existing_answers->>'_projectId')::uuid;
    SELECT id INTO v_project_id
    FROM public.projects
    WHERE id = v_existing_project_id AND client_id = v_client_id;
    IF v_project_id IS NOT NULL THEN
      RETURN v_project_id;
    END IF;
  END IF;

  v_document := CASE
    WHEN jsonb_typeof(_answers->'_document') = 'object' THEN _answers->'_document'
    ELSE '{}'::jsonb
  END;
  v_flow := CASE
    WHEN jsonb_typeof(_answers->'_flow') = 'object' THEN _answers->'_flow'
    ELSE '{}'::jsonb
  END;
  v_flow_edges := CASE
    WHEN jsonb_typeof(v_flow->'edges') = 'array' THEN v_flow->'edges'
    ELSE '[]'::jsonb
  END;
  v_transcript := CASE
    WHEN jsonb_typeof(_answers->'_transcript') = 'array' THEN _answers->'_transcript'
    ELSE '[]'::jsonb
  END;

  v_name := NULLIF(trim(coalesce(_answers->>'project_name', '')), '');
  IF v_name IS NULL THEN
    v_name := left(coalesce(
      NULLIF(trim(v_document->>'summary'), ''),
      NULLIF(trim(_answers->>'goal'), ''),
      'New project'
    ), 80);
  END IF;

  INSERT INTO public.projects (client_id, name, status, summary, budget_signal)
  VALUES (
    v_client_id,
    left(v_name, 120),
    'lead_started',
    left(coalesce(NULLIF(v_document->>'summary', ''), _answers->>'goal', ''), 2000),
    left(coalesce(_answers->>'budget_range', ''), 200)
  )
  RETURNING id INTO v_project_id;

  SELECT coalesce(array_agg(value), '{}'::text[]) INTO v_goals
  FROM unnest(ARRAY[
    NULLIF(trim(v_document->>'businessGoal'), ''),
    NULLIF(trim(v_document->>'desiredOutcome'), ''),
    NULLIF(trim(_answers->>'goal'), '')
  ]) value
  WHERE value IS NOT NULL;

  IF jsonb_typeof(v_document->'assumptions') = 'array' THEN
    SELECT coalesce(array_agg(left(value, 1000)), '{}'::text[]) INTO v_assumptions
    FROM jsonb_array_elements_text(v_document->'assumptions') item(value)
    WHERE trim(value) <> '';
  END IF;
  IF jsonb_typeof(v_document->'integrations') = 'array' THEN
    SELECT coalesce(array_agg(left(value, 1000)), '{}'::text[]) INTO v_constraints
    FROM jsonb_array_elements_text(v_document->'integrations') item(value)
    WHERE trim(value) <> '';
  END IF;
  IF NULLIF(trim(_answers->>'existing_systems'), '') IS NOT NULL THEN
    v_constraints := array_append(v_constraints, left(trim(_answers->>'existing_systems'), 1000));
  END IF;
  IF jsonb_typeof(v_document->'exclusions') = 'array' THEN
    SELECT coalesce(array_agg(left(value, 1000)), '{}'::text[]) INTO v_exclusions
    FROM jsonb_array_elements_text(v_document->'exclusions') item(value)
    WHERE trim(value) <> '';
  END IF;

  INSERT INTO public.project_briefs (
    project_id, problem_statement, goals, assumptions, constraints, exclusions,
    discovery_notes, ai_draft_notes
  )
  VALUES (
    v_project_id,
    left(coalesce(NULLIF(v_document->>'currentSituation', ''), _answers->>'current_process', ''), 4000),
    v_goals,
    v_assumptions,
    v_constraints,
    v_exclusions,
    left(concat_ws(E'\n',
      'Users: ' || coalesce(_answers->>'users', ''),
      'Needed capabilities: ' || coalesce(_answers->>'capabilities', ''),
      'Pain points: ' || coalesce(_answers->>'pain_points', ''),
      'Budget preference: ' || coalesce(_answers->>'budget_range', ''),
      'Links / examples: ' || coalesce(_answers->>'links', '')
    ), 6000),
    left(jsonb_build_object('document', v_document, 'flow', v_flow)::text, 12000)
  );

  BEGIN
    v_date := NULLIF(_answers->>'requested_date', '')::date;
  EXCEPTION WHEN others THEN
    v_date := NULL;
  END;

  INSERT INTO public.project_schedule (
    project_id, requested_completion_date, date_priority, date_reason, target_date_status
  )
  VALUES (
    v_project_id,
    v_date,
    coalesce(NULLIF(_answers->>'date_priority', ''), 'flexible'),
    left(coalesce(_answers->>'date_reason', ''), 1000),
    CASE WHEN v_date IS NULL THEN 'no_date_requested' ELSE 'under_review' END
  );

  -- Create the exact project conversation first, then copy the account-bound
  -- onboarding transcript into it so later briefs and MVP revisions use it.
  INSERT INTO public.project_conversations (project_id, kind, title)
  VALUES (v_project_id, 'client_agency', left(v_name || ' — client conversation', 200))
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_conversation_id;

  IF v_conversation_id IS NULL THEN
    SELECT id INTO v_conversation_id
    FROM public.project_conversations
    WHERE project_id = v_project_id AND kind = 'client_agency';
  END IF;

  INSERT INTO public.conversation_participants (conversation_id, profile_id, participant_role)
  VALUES (v_conversation_id, auth.uid(), 'client')
  ON CONFLICT (conversation_id, profile_id, participant_role) DO NOTHING;

  FOR v_turn IN
    SELECT value
    FROM jsonb_array_elements(v_transcript)
    LIMIT 200
  LOOP
    v_body := left(trim(coalesce(v_turn->>'body', '')), 10000);
    IF v_body <> '' AND (v_turn->>'role') IN ('user', 'assistant') THEN
      v_turn_at := now() + (v_turn_index * interval '1 millisecond');
      BEGIN
        IF NULLIF(v_turn->>'at', '') IS NOT NULL THEN
          v_turn_at := (v_turn->>'at')::timestamptz;
        END IF;
      EXCEPTION WHEN others THEN
        v_turn_at := now() + (v_turn_index * interval '1 millisecond');
      END;

      INSERT INTO public.chat_messages (
        conversation_id, project_id, sender_type, sender_profile_id, agent_type,
        body, structured_payload, visibility, status, created_at
      )
      VALUES (
        v_conversation_id,
        v_project_id,
        CASE WHEN v_turn->>'role' = 'user' THEN 'client' ELSE 'ai_agent' END,
        CASE WHEN v_turn->>'role' = 'user' THEN auth.uid() ELSE NULL END,
        CASE WHEN v_turn->>'role' = 'assistant' THEN 'project_guide' ELSE NULL END,
        v_body,
        '{}'::jsonb,
        'client_agency',
        'sent',
        v_turn_at
      );
      v_turn_index := v_turn_index + 1;
    END IF;
  END LOOP;

  IF jsonb_typeof(v_flow->'nodes') = 'array' AND jsonb_array_length(v_flow->'nodes') > 0 THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', left(node->>'id', 80),
      'label', left(node->>'label', 160),
      'detail', left(coalesce(node->>'kind', ''), 160),
      'next', coalesce((
        SELECT jsonb_agg(destination)
        FROM (
          SELECT left(edge->>'to', 80) AS destination
          FROM jsonb_array_elements(v_flow_edges) edge
          WHERE edge->>'from' = node->>'id' AND coalesce(edge->>'to', '') <> ''
          LIMIT 8
        ) linked
      ), '[]'::jsonb)
    )), '[]'::jsonb)
    INTO v_flow_nodes
    FROM (
      SELECT value AS node
      FROM jsonb_array_elements(v_flow->'nodes')
      WHERE coalesce(value->>'id', '') <> '' AND coalesce(value->>'label', '') <> ''
      LIMIT 24
    ) bounded_nodes;

    INSERT INTO public.chat_messages (
      conversation_id, project_id, sender_type, agent_type, body,
      structured_payload, visibility, status
    )
    VALUES (
      v_conversation_id,
      v_project_id,
      'ai_agent',
      'project_guide',
      'טיוטת תרשים התהליך שנבנתה מתוך שיחת ההיכרות נשמרה בפרויקט.',
      jsonb_build_object(
        'ai_draft', true,
        'artifacts', jsonb_build_array(jsonb_build_object(
          'type', 'flow',
          'title', 'תרשים התהליך הראשוני',
          'description', 'טיוטה שנבנתה משיחת הלקוח וממתינה לבדיקת הסוכנות.',
          'nodes', v_flow_nodes
        ))
      ),
      'client_agency',
      'sent'
    );
  END IF;

  -- Structured onboarding output remains a reviewable draft. It is never an
  -- automatically approved specification or an automatically published MVP.
  INSERT INTO public.ai_generated_drafts (
    project_id, conversation_id, draft_type, payload, status, visibility,
    agent_type, created_by_profile_id
  )
  VALUES (
    v_project_id,
    v_conversation_id,
    'project_brief',
    jsonb_build_object(
      'source', 'client_onboarding',
      'document', v_document,
      'flow', v_flow,
      'answers', _answers - '_transcript' - '_document' - '_flow'
    ),
    'awaiting_agency_review',
    'client_agency',
    'project_guide',
    auth.uid()
  );

  -- Create editable AI-draft specification sections. Agency review is still
  -- required before these sections can become approved scope or feed documents.
  FOR v_section IN
    SELECT * FROM (VALUES
      ('summary', 'סיכום הפרויקט', v_document->'summary', 10),
      ('business_goal', 'המטרה העסקית', v_document->'businessGoal', 20),
      ('current_situation', 'המצב הקיים', v_document->'currentSituation', 30),
      ('desired_outcome', 'התוצאה הרצויה', v_document->'desiredOutcome', 40),
      ('requirements', 'דרישות מרכזיות', v_document->'requirements', 50),
      ('integrations', 'מערכות ואינטגרציות', v_document->'integrations', 60),
      ('workflow', 'תהליך העבודה', v_document->'workflow', 70),
      ('phases', 'שלבי הפרויקט', v_document->'phases', 80),
      ('open_questions', 'שאלות פתוחות', v_document->'openQuestions', 90),
      ('assumptions', 'הנחות', v_document->'assumptions', 100),
      ('risks', 'סיכונים ונקודות לבדיקה', v_document->'risks', 110),
      ('exclusions', 'מחוץ להיקף כרגע', v_document->'exclusions', 120),
      ('timeline', 'לוח זמנים מבוקש', v_document->'timeline', 130)
    ) AS sections(section_key, title, value, sort_order)
  LOOP
    v_content := '';
    IF v_section.value IS NULL OR v_section.value = 'null'::jsonb THEN
      CONTINUE;
    ELSIF jsonb_typeof(v_section.value) = 'array' THEN
      SELECT coalesce(string_agg('• ' || left(value, 2000), E'\n'), '') INTO v_content
      FROM jsonb_array_elements_text(v_section.value) item(value)
      WHERE trim(value) <> '';
    ELSE
      v_content := left(coalesce(v_section.value #>> '{}', ''), 12000);
    END IF;

    IF trim(v_content) <> '' THEN
      INSERT INTO public.specification_sections (
        project_id, section_key, title, content, status, client_visible, sort_order
      )
      VALUES (
        v_project_id, v_section.section_key, v_section.title, v_content,
        'ai_draft', true, v_section.sort_order
      )
      ON CONFLICT (project_id, section_key) DO UPDATE
      SET title = EXCLUDED.title,
          content = EXCLUDED.content,
          status = 'ai_draft',
          client_visible = true,
          sort_order = EXCLUDED.sort_order;
    END IF;
  END LOOP;

  UPDATE public.onboarding_state
  SET answers = coalesce(_answers, '{}'::jsonb) || jsonb_build_object(
        '_projectId', v_project_id,
        '_document', v_document,
        '_flow', v_flow,
        '_transcript', v_transcript
      ),
      completion_percentage = 100,
      onboarding_completed_at = now()
  WHERE profile_id = auth.uid();

  RETURN v_project_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_client_onboarding(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_client_onboarding(jsonb) TO authenticated;
