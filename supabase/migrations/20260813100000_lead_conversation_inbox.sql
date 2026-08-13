-- A client onboarding conversation is a lead until the agency explicitly
-- promotes it. The lead has its own inbox, visible manager messages and private
-- notes; no project, scope or MVP is created by the client.

CREATE TABLE public.lead_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  invitation_id uuid REFERENCES public.onboarding_invitations(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'invited'
    CHECK (status IN ('invited','active','awaiting_review','paused','disqualified','promoted')),
  first_opened_at timestamptz,
  submitted_at timestamptz,
  promoted_at timestamptz,
  promoted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  last_client_message_at timestamptz,
  last_agency_message_at timestamptz,
  last_agency_read_at timestamptz,
  pause_message text NOT NULL DEFAULT '',
  disqualification_reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX lead_conversations_status_activity_idx
  ON public.lead_conversations(status, updated_at DESC);
CREATE INDEX lead_conversations_client_idx
  ON public.lead_conversations(client_id, created_at DESC);

CREATE TABLE public.lead_conversation_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.lead_conversations(id) ON DELETE CASCADE,
  sender_type text NOT NULL CHECK (sender_type IN ('client','agency_admin','ai_agent','system')),
  sender_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  body text NOT NULL CHECK (length(trim(body)) > 0),
  visibility text NOT NULL DEFAULT 'client_agency'
    CHECK (visibility IN ('client_agency','agency_only')),
  source_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX lead_conversation_messages_thread_idx
  ON public.lead_conversation_messages(conversation_id, created_at);
CREATE UNIQUE INDEX lead_conversation_messages_source_unique
  ON public.lead_conversation_messages(conversation_id, source_key)
  WHERE source_key IS NOT NULL;

CREATE TRIGGER set_updated_at_lead_conversations
  BEFORE UPDATE ON public.lead_conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at_lead_conversation_messages
  BEFORE UPDATE ON public.lead_conversation_messages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT ON public.lead_conversations, public.lead_conversation_messages TO authenticated;
GRANT ALL ON public.lead_conversations, public.lead_conversation_messages TO service_role;

ALTER TABLE public.lead_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_conversation_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lead conversations admin all" ON public.lead_conversations
  FOR ALL TO authenticated
  USING (private.is_agency_admin()) WITH CHECK (private.is_agency_admin());
CREATE POLICY "lead conversations client read own" ON public.lead_conversations
  FOR SELECT TO authenticated USING (profile_id = auth.uid());

CREATE POLICY "lead messages admin all" ON public.lead_conversation_messages
  FOR ALL TO authenticated
  USING (private.is_agency_admin()) WITH CHECK (private.is_agency_admin());
CREATE POLICY "lead messages client read visible" ON public.lead_conversation_messages
  FOR SELECT TO authenticated USING (
    visibility = 'client_agency'
    AND EXISTS (
      SELECT 1 FROM public.lead_conversations thread
      WHERE thread.id = conversation_id AND thread.profile_id = auth.uid()
    )
  );

-- Existing onboarding conversations that still have no project become lead
-- threads immediately. Project-continuation accounts are deliberately excluded.
INSERT INTO public.lead_conversations (
  profile_id, client_id, status, first_opened_at, last_client_message_at, created_at
)
SELECT
  profile.id,
  profile.client_id,
  CASE
    WHEN jsonb_array_length(CASE WHEN jsonb_typeof(state.answers->'_transcript') = 'array'
      THEN state.answers->'_transcript' ELSE '[]'::jsonb END) > 0 THEN 'active'
    ELSE 'invited'
  END,
  CASE WHEN jsonb_array_length(CASE WHEN jsonb_typeof(state.answers->'_transcript') = 'array'
    THEN state.answers->'_transcript' ELSE '[]'::jsonb END) > 0 THEN state.onboarding_started_at END,
  CASE WHEN jsonb_array_length(CASE WHEN jsonb_typeof(state.answers->'_transcript') = 'array'
    THEN state.answers->'_transcript' ELSE '[]'::jsonb END) > 0 THEN state.updated_at END,
  state.onboarding_started_at
FROM public.profiles profile
JOIN public.onboarding_state state ON state.profile_id = profile.id
WHERE profile.role = 'client'::public.app_role
  AND profile.client_id IS NOT NULL
  AND state.onboarding_completed_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.projects project WHERE project.client_id = profile.client_id
  )
ON CONFLICT (profile_id) DO NOTHING;

-- Preserve transcripts collected before this migration in the new inbox.
INSERT INTO public.lead_conversation_messages (
  conversation_id, sender_type, sender_profile_id, body, visibility, source_key, created_at
)
SELECT
  thread.id,
  CASE WHEN turn.value->>'role' = 'user' THEN 'client' ELSE 'ai_agent' END,
  CASE WHEN turn.value->>'role' = 'user' THEN thread.profile_id ELSE NULL END,
  left(trim(turn.value->>'body'), 10000),
  'client_agency',
  'legacy:' || turn.ordinality,
  state.onboarding_started_at + (turn.ordinality * interval '1 millisecond')
FROM public.lead_conversations thread
JOIN public.onboarding_state state ON state.profile_id = thread.profile_id
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(state.answers->'_transcript') = 'array'
    THEN state.answers->'_transcript' ELSE '[]'::jsonb END
) WITH ORDINALITY AS turn(value, ordinality)
WHERE turn.value->>'role' IN ('user','assistant')
  AND trim(coalesce(turn.value->>'body', '')) <> ''
ON CONFLICT DO NOTHING;

-- The old client RPC is retained for compatibility with cached clients, but it
-- now only submits the lead for agency review and can never create a project.
CREATE OR REPLACE FUNCTION public.submit_client_onboarding(_answers jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_role public.app_role;
  v_thread_id uuid;
  v_existing_project_id uuid;
BEGIN
  SELECT client_id, role INTO v_client_id, v_role
  FROM public.profiles WHERE id = auth.uid();

  IF v_role IS DISTINCT FROM 'client'::public.app_role OR v_client_id IS NULL THEN
    RAISE EXCEPTION 'Only a linked client account can submit onboarding';
  END IF;

  INSERT INTO public.lead_conversations (
    profile_id, client_id, status, first_opened_at, submitted_at
  ) VALUES (
    auth.uid(), v_client_id, 'awaiting_review', now(), now()
  )
  ON CONFLICT (profile_id) DO UPDATE SET
    status = CASE
      WHEN lead_conversations.status = 'promoted' THEN lead_conversations.status
      ELSE 'awaiting_review'
    END,
    submitted_at = CASE
      WHEN lead_conversations.status = 'promoted' THEN lead_conversations.submitted_at
      ELSE now()
    END
  RETURNING id, project_id INTO v_thread_id, v_existing_project_id;

  UPDATE public.onboarding_state
  SET answers = coalesce(answers, '{}'::jsonb) || coalesce(_answers, '{}'::jsonb),
      completion_percentage = greatest(completion_percentage, 95)
  WHERE profile_id = auth.uid();

  RETURN v_existing_project_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_client_onboarding(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_client_onboarding(jsonb) TO authenticated;

-- The only project-creation path for a pre-project lead. It is agency-only,
-- row-locked and retry-safe, and migrates all visible and private history.
CREATE OR REPLACE FUNCTION public.promote_client_onboarding(
  _profile_id uuid,
  _project_name text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_client_id uuid;
  v_project_id uuid;
  v_answers jsonb := '{}'::jsonb;
  v_name text;
  v_date date;
  v_document jsonb;
  v_flow jsonb;
  v_flow_edges jsonb;
  v_conversation_id uuid;
  v_message record;
  v_section record;
  v_content text;
  v_flow_nodes jsonb := '[]'::jsonb;
  v_goals text[] := '{}'::text[];
  v_assumptions text[] := '{}'::text[];
  v_constraints text[] := '{}'::text[];
  v_exclusions text[] := '{}'::text[];
BEGIN
  IF NOT private.is_agency_admin() THEN
    RAISE EXCEPTION 'Only an agency admin can promote a lead';
  END IF;

  SELECT thread.client_id, thread.project_id
  INTO v_client_id, v_project_id
  FROM public.lead_conversations thread
  WHERE thread.profile_id = _profile_id
  FOR UPDATE;

  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'Lead conversation not found';
  END IF;

  IF v_project_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.projects project
    WHERE project.id = v_project_id AND project.client_id = v_client_id
  ) THEN
    RETURN v_project_id;
  END IF;

  SELECT coalesce(state.answers, '{}'::jsonb)
  INTO v_answers
  FROM public.onboarding_state state
  WHERE state.profile_id = _profile_id
  FOR UPDATE;

  v_document := CASE
    WHEN jsonb_typeof(v_answers->'_document') = 'object' THEN v_answers->'_document'
    ELSE '{}'::jsonb
  END;
  v_flow := CASE
    WHEN jsonb_typeof(v_answers->'_flow') = 'object' THEN v_answers->'_flow'
    ELSE '{}'::jsonb
  END;
  v_flow_edges := CASE
    WHEN jsonb_typeof(v_flow->'edges') = 'array' THEN v_flow->'edges'
    ELSE '[]'::jsonb
  END;

  v_name := NULLIF(trim(coalesce(_project_name, '')), '');
  IF v_name IS NULL THEN
    v_name := NULLIF(trim(coalesce(v_answers->>'project_name', '')), '');
  END IF;
  IF v_name IS NULL THEN
    v_name := left(coalesce(
      NULLIF(trim(v_document->>'summary'), ''),
      NULLIF(trim(v_answers->>'goal'), ''),
      'New project'
    ), 80);
  END IF;

  INSERT INTO public.projects (client_id, name, status, summary, budget_signal)
  VALUES (
    v_client_id,
    left(v_name, 120),
    'lead_started',
    left(coalesce(NULLIF(v_document->>'summary', ''), v_answers->>'goal', ''), 2000),
    left(coalesce(v_answers->>'budget_range', ''), 200)
  )
  RETURNING id INTO v_project_id;

  SELECT coalesce(array_agg(value), '{}'::text[]) INTO v_goals
  FROM unnest(ARRAY[
    NULLIF(trim(v_document->>'businessGoal'), ''),
    NULLIF(trim(v_document->>'desiredOutcome'), ''),
    NULLIF(trim(v_answers->>'goal'), '')
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
  IF NULLIF(trim(v_answers->>'existing_systems'), '') IS NOT NULL THEN
    v_constraints := array_append(v_constraints, left(trim(v_answers->>'existing_systems'), 1000));
  END IF;
  IF jsonb_typeof(v_document->'exclusions') = 'array' THEN
    SELECT coalesce(array_agg(left(value, 1000)), '{}'::text[]) INTO v_exclusions
    FROM jsonb_array_elements_text(v_document->'exclusions') item(value)
    WHERE trim(value) <> '';
  END IF;

  INSERT INTO public.project_briefs (
    project_id, problem_statement, goals, assumptions, constraints, exclusions,
    discovery_notes, ai_draft_notes
  ) VALUES (
    v_project_id,
    left(coalesce(NULLIF(v_document->>'currentSituation', ''), v_answers->>'current_process', ''), 4000),
    v_goals,
    v_assumptions,
    v_constraints,
    v_exclusions,
    left(concat_ws(E'\n',
      'Users: ' || coalesce(v_answers->>'users', ''),
      'Needed capabilities: ' || coalesce(v_answers->>'capabilities', ''),
      'Pain points: ' || coalesce(v_answers->>'pain_points', ''),
      'Budget preference: ' || coalesce(v_answers->>'budget_range', ''),
      'Links / examples: ' || coalesce(v_answers->>'links', '')
    ), 6000),
    left(jsonb_build_object('document', v_document, 'flow', v_flow)::text, 12000)
  );

  BEGIN
    v_date := NULLIF(v_answers->>'requested_date', '')::date;
  EXCEPTION WHEN others THEN
    v_date := NULL;
  END;

  INSERT INTO public.project_schedule (
    project_id, requested_completion_date, date_priority, date_reason, target_date_status
  ) VALUES (
    v_project_id,
    v_date,
    coalesce(NULLIF(v_answers->>'date_priority', ''), 'flexible'),
    left(coalesce(v_answers->>'date_reason', ''), 1000),
    CASE WHEN v_date IS NULL THEN 'no_date_requested' ELSE 'under_review' END
  );

  INSERT INTO public.project_conversations (project_id, kind, title)
  VALUES (v_project_id, 'client_agency', left(v_name || ' — client conversation', 200))
  RETURNING id INTO v_conversation_id;

  INSERT INTO public.conversation_participants (conversation_id, profile_id, participant_role)
  VALUES
    (v_conversation_id, _profile_id, 'client'),
    (v_conversation_id, v_actor_id, 'agency_admin')
  ON CONFLICT (conversation_id, profile_id, participant_role) DO NOTHING;

  FOR v_message IN
    SELECT * FROM public.lead_conversation_messages
    WHERE conversation_id = (
      SELECT id FROM public.lead_conversations WHERE profile_id = _profile_id
    )
    ORDER BY created_at, id
  LOOP
    INSERT INTO public.chat_messages (
      conversation_id, project_id, sender_type, sender_profile_id, agent_type,
      body, structured_payload, visibility, status, created_at
    ) VALUES (
      v_conversation_id,
      v_project_id,
      v_message.sender_type,
      v_message.sender_profile_id,
      CASE WHEN v_message.sender_type = 'ai_agent' THEN 'project_guide' ELSE NULL END,
      left(v_message.body, 10000),
      jsonb_build_object('source', 'lead_conversation', 'lead_message_id', v_message.id),
      v_message.visibility,
      'sent',
      v_message.created_at
    );
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
    ) VALUES (
      v_conversation_id,
      v_project_id,
      'ai_agent',
      'project_guide',
      'טיוטת תרשים התהליך משיחת ההיכרות נשמרה בפרויקט.',
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

  INSERT INTO public.ai_generated_drafts (
    project_id, conversation_id, draft_type, payload, status, visibility,
    agent_type, created_by_profile_id
  ) VALUES (
    v_project_id,
    v_conversation_id,
    'project_brief',
    jsonb_build_object(
      'source', 'lead_conversation',
      'document', v_document,
      'flow', v_flow,
      'answers', v_answers - '_transcript' - '_document' - '_flow'
    ),
    'awaiting_agency_review',
    'agency_only',
    'project_guide',
    v_actor_id
  );

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
      ) VALUES (
        v_project_id, v_section.section_key, v_section.title, v_content,
        'ai_draft', true, v_section.sort_order
      )
      ON CONFLICT (project_id, section_key) DO UPDATE SET
        title = EXCLUDED.title,
        content = EXCLUDED.content,
        status = 'ai_draft',
        client_visible = true,
        sort_order = EXCLUDED.sort_order;
    END IF;
  END LOOP;

  UPDATE public.onboarding_state
  SET answers = coalesce(v_answers, '{}'::jsonb) || jsonb_build_object('_projectId', v_project_id),
      completion_percentage = 100,
      onboarding_completed_at = now()
  WHERE profile_id = _profile_id;

  UPDATE public.lead_conversations
  SET status = 'promoted', project_id = v_project_id, promoted_at = now(),
      promoted_by = v_actor_id, pause_message = ''
  WHERE profile_id = _profile_id;

  UPDATE public.clients SET status = 'active' WHERE id = v_client_id;

  RETURN v_project_id;
END;
$$;

REVOKE ALL ON FUNCTION public.promote_client_onboarding(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.promote_client_onboarding(uuid, text) TO authenticated;
