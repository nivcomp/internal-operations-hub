-- 1. project_conversations
CREATE TABLE public.project_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('client_agency','supplier_agency','agency_internal')),
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX project_conversations_client_unique
  ON public.project_conversations(project_id) WHERE kind = 'client_agency';
CREATE UNIQUE INDEX project_conversations_supplier_unique
  ON public.project_conversations(project_id, supplier_id) WHERE kind = 'supplier_agency';
CREATE INDEX project_conversations_project_idx ON public.project_conversations(project_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_conversations TO authenticated;
GRANT ALL ON public.project_conversations TO service_role;
ALTER TABLE public.project_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conversations_admin_all" ON public.project_conversations
  FOR ALL TO authenticated USING (private.is_agency_admin()) WITH CHECK (private.is_agency_admin());
CREATE POLICY "conversations_client_select" ON public.project_conversations
  FOR SELECT TO authenticated
  USING (kind = 'client_agency' AND private.client_owns_project(project_id));
CREATE POLICY "conversations_supplier_select" ON public.project_conversations
  FOR SELECT TO authenticated
  USING (kind = 'supplier_agency' AND supplier_id = private.current_supplier_id()
         AND private.supplier_has_project(project_id));

-- 2. conversation_participants
CREATE TABLE public.conversation_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.project_conversations(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  participant_role text NOT NULL CHECK (participant_role IN ('client','agency_admin','supplier','ai_agent')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, profile_id, participant_role)
);
CREATE INDEX conversation_participants_conv_idx ON public.conversation_participants(conversation_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_participants TO authenticated;
GRANT ALL ON public.conversation_participants TO service_role;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "participants_admin_all" ON public.conversation_participants
  FOR ALL TO authenticated USING (private.is_agency_admin()) WITH CHECK (private.is_agency_admin());
CREATE POLICY "participants_member_select" ON public.conversation_participants
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.project_conversations c
                 WHERE c.id = conversation_id
                   AND ((c.kind = 'client_agency' AND private.client_owns_project(c.project_id))
                     OR (c.kind = 'supplier_agency' AND c.supplier_id = private.current_supplier_id()))));

-- 3. chat_messages
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.project_conversations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  sender_type text NOT NULL CHECK (sender_type IN ('client','agency_admin','supplier','ai_agent','system')),
  sender_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  agent_type text CHECK (agent_type IN ('project_guide','agency_control','work_assistant')),
  body text NOT NULL DEFAULT '',
  structured_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  visibility text NOT NULL CHECK (visibility IN ('client_agency','supplier_agency','agency_only','shared_all')),
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('pending','sent','failed','stopped','deleted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX chat_messages_conversation_idx ON public.chat_messages(conversation_id, created_at);
CREATE INDEX chat_messages_project_idx ON public.chat_messages(project_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "messages_admin_all" ON public.chat_messages
  FOR ALL TO authenticated USING (private.is_agency_admin()) WITH CHECK (private.is_agency_admin());
CREATE POLICY "messages_client_select" ON public.chat_messages
  FOR SELECT TO authenticated
  USING (visibility IN ('client_agency','shared_all') AND private.client_owns_project(project_id));
CREATE POLICY "messages_supplier_select" ON public.chat_messages
  FOR SELECT TO authenticated
  USING (visibility IN ('supplier_agency','shared_all') AND private.supplier_has_project(project_id));
CREATE POLICY "messages_client_insert" ON public.chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (sender_type = 'client' AND sender_profile_id = auth.uid()
              AND visibility = 'client_agency' AND private.client_owns_project(project_id));
CREATE POLICY "messages_supplier_insert" ON public.chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (sender_type = 'supplier' AND sender_profile_id = auth.uid()
              AND visibility = 'supplier_agency' AND private.supplier_has_project(project_id));

-- 4. ai_runs
CREATE TABLE public.ai_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.project_conversations(id) ON DELETE CASCADE,
  agent_type text NOT NULL CHECK (agent_type IN ('project_guide','agency_control','work_assistant')),
  requested_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  model text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'thinking' CHECK (status IN ('thinking','generating','succeeded','failed','stopped')),
  error text NOT NULL DEFAULT '',
  latency_ms integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_runs_project_idx ON public.ai_runs(project_id, created_at);
CREATE INDEX ai_runs_requester_idx ON public.ai_runs(requested_by_profile_id, created_at);

GRANT SELECT ON public.ai_runs TO authenticated;
GRANT ALL ON public.ai_runs TO service_role;
ALTER TABLE public.ai_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_runs_admin_select" ON public.ai_runs
  FOR SELECT TO authenticated USING (private.is_agency_admin());
CREATE POLICY "ai_runs_own_select" ON public.ai_runs
  FOR SELECT TO authenticated USING (requested_by_profile_id = auth.uid());

-- 5. ai_generated_drafts
CREATE TABLE public.ai_generated_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.project_conversations(id) ON DELETE SET NULL,
  message_id uuid REFERENCES public.chat_messages(id) ON DELETE SET NULL,
  draft_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'awaiting_agency_review'
    CHECK (status IN ('awaiting_agency_review','accepted','rejected','superseded')),
  visibility text NOT NULL DEFAULT 'agency_only'
    CHECK (visibility IN ('client_agency','supplier_agency','agency_only','shared_all')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_generated_drafts_project_idx ON public.ai_generated_drafts(project_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_generated_drafts TO authenticated;
GRANT ALL ON public.ai_generated_drafts TO service_role;
ALTER TABLE public.ai_generated_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "drafts_admin_all" ON public.ai_generated_drafts
  FOR ALL TO authenticated USING (private.is_agency_admin()) WITH CHECK (private.is_agency_admin());
CREATE POLICY "drafts_client_select" ON public.ai_generated_drafts
  FOR SELECT TO authenticated
  USING (visibility IN ('client_agency','shared_all') AND private.client_owns_project(project_id));
CREATE POLICY "drafts_supplier_select" ON public.ai_generated_drafts
  FOR SELECT TO authenticated
  USING (visibility IN ('supplier_agency','shared_all') AND private.supplier_has_project(project_id));

-- 6. project_requirements
CREATE TABLE public.project_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  detail text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'functional',
  source_message_id uuid REFERENCES public.chat_messages(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'ai_draft' CHECK (status IN ('ai_draft','confirmed','rejected')),
  client_visible boolean NOT NULL DEFAULT true,
  supplier_visible boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX project_requirements_project_idx ON public.project_requirements(project_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_requirements TO authenticated;
GRANT ALL ON public.project_requirements TO service_role;
ALTER TABLE public.project_requirements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "requirements_admin_all" ON public.project_requirements
  FOR ALL TO authenticated USING (private.is_agency_admin()) WITH CHECK (private.is_agency_admin());
CREATE POLICY "requirements_client_select" ON public.project_requirements
  FOR SELECT TO authenticated USING (client_visible AND private.client_owns_project(project_id));
CREATE POLICY "requirements_supplier_select" ON public.project_requirements
  FOR SELECT TO authenticated USING (supplier_visible AND private.supplier_has_project(project_id));

-- 7. project_assumptions
CREATE TABLE public.project_assumptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  body text NOT NULL,
  kind text NOT NULL DEFAULT 'assumption' CHECK (kind IN ('assumption','exclusion','risk','constraint')),
  source_message_id uuid REFERENCES public.chat_messages(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'ai_draft' CHECK (status IN ('ai_draft','confirmed','rejected')),
  client_visible boolean NOT NULL DEFAULT true,
  supplier_visible boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX project_assumptions_project_idx ON public.project_assumptions(project_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_assumptions TO authenticated;
GRANT ALL ON public.project_assumptions TO service_role;
ALTER TABLE public.project_assumptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assumptions_admin_all" ON public.project_assumptions
  FOR ALL TO authenticated USING (private.is_agency_admin()) WITH CHECK (private.is_agency_admin());
CREATE POLICY "assumptions_client_select" ON public.project_assumptions
  FOR SELECT TO authenticated USING (client_visible AND private.client_owns_project(project_id));
CREATE POLICY "assumptions_supplier_select" ON public.project_assumptions
  FOR SELECT TO authenticated USING (supplier_visible AND private.supplier_has_project(project_id));

-- 8. project_questions
CREATE TABLE public.project_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  question text NOT NULL,
  asked_by_role text NOT NULL CHECK (asked_by_role IN ('client','agency_admin','supplier','ai_agent')),
  target_role text NOT NULL CHECK (target_role IN ('client','agency_admin','supplier')),
  answer text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','answered','dismissed')),
  source_message_id uuid REFERENCES public.chat_messages(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX project_questions_project_idx ON public.project_questions(project_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_questions TO authenticated;
GRANT ALL ON public.project_questions TO service_role;
ALTER TABLE public.project_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "questions_admin_all" ON public.project_questions
  FOR ALL TO authenticated USING (private.is_agency_admin()) WITH CHECK (private.is_agency_admin());
CREATE POLICY "questions_client_select" ON public.project_questions
  FOR SELECT TO authenticated USING (target_role = 'client' AND private.client_owns_project(project_id));
CREATE POLICY "questions_supplier_select" ON public.project_questions
  FOR SELECT TO authenticated USING (target_role = 'supplier' AND private.supplier_has_project(project_id));

-- 9. project_progress_updates
CREATE TABLE public.project_progress_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  body text NOT NULL,
  update_type text NOT NULL DEFAULT 'progress' CHECK (update_type IN ('progress','blocker','question','completion')),
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','acknowledged','resolved')),
  source_message_id uuid REFERENCES public.chat_messages(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX project_progress_updates_project_idx ON public.project_progress_updates(project_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_progress_updates TO authenticated;
GRANT ALL ON public.project_progress_updates TO service_role;
ALTER TABLE public.project_progress_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "progress_admin_all" ON public.project_progress_updates
  FOR ALL TO authenticated USING (private.is_agency_admin()) WITH CHECK (private.is_agency_admin());
CREATE POLICY "progress_supplier_select" ON public.project_progress_updates
  FOR SELECT TO authenticated
  USING (supplier_id = private.current_supplier_id() AND private.supplier_has_project(project_id));
CREATE POLICY "progress_supplier_insert" ON public.project_progress_updates
  FOR INSERT TO authenticated
  WITH CHECK (supplier_id = private.current_supplier_id() AND private.supplier_has_project(project_id));

-- updated_at triggers
CREATE TRIGGER set_updated_at_project_conversations BEFORE UPDATE ON public.project_conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at_conversation_participants BEFORE UPDATE ON public.conversation_participants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at_chat_messages BEFORE UPDATE ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at_ai_runs BEFORE UPDATE ON public.ai_runs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at_ai_generated_drafts BEFORE UPDATE ON public.ai_generated_drafts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at_project_requirements BEFORE UPDATE ON public.project_requirements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at_project_assumptions BEFORE UPDATE ON public.project_assumptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at_project_questions BEFORE UPDATE ON public.project_questions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at_project_progress_updates BEFORE UPDATE ON public.project_progress_updates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();