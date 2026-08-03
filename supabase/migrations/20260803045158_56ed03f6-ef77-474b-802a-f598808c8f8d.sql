-- ========== ai_usage_limits ==========
CREATE TABLE public.ai_usage_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type text NOT NULL CHECK (scope_type IN ('global','profile','client','supplier','project')),
  scope_id uuid,
  daily_message_limit integer NOT NULL DEFAULT 40,
  monthly_message_limit integer NOT NULL DEFAULT 600,
  daily_token_limit integer NOT NULL DEFAULT 200000,
  monthly_token_limit integer NOT NULL DEFAULT 3000000,
  maximum_message_length integer NOT NULL DEFAULT 4000,
  maximum_context_size integer NOT NULL DEFAULT 24000,
  maximum_output_tokens integer NOT NULL DEFAULT 2000,
  cooldown_seconds integer NOT NULL DEFAULT 3,
  warning_threshold_percent integer NOT NULL DEFAULT 70,
  hard_stop_threshold_percent integer NOT NULL DEFAULT 100,
  is_paused boolean NOT NULL DEFAULT false,
  paused_reason text NOT NULL DEFAULT '',
  paused_until timestamptz,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ai_usage_limits_scope_key ON public.ai_usage_limits (scope_type, COALESCE(scope_id, '00000000-0000-0000-0000-000000000000'::uuid));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_usage_limits TO authenticated;
GRANT ALL ON public.ai_usage_limits TO service_role;
ALTER TABLE public.ai_usage_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "limits_admin_all" ON public.ai_usage_limits FOR ALL TO authenticated
  USING (private.is_agency_admin()) WITH CHECK (private.is_agency_admin());
CREATE TRIGGER ai_usage_limits_updated BEFORE UPDATE ON public.ai_usage_limits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.ai_usage_limits (scope_type, scope_id, note)
VALUES ('global', NULL, 'Default conservative limits for every AI user.');

-- ========== ai_usage_events ==========
CREATE TABLE public.ai_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.project_conversations(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  actor_role text NOT NULL DEFAULT '',
  agent_type text NOT NULL DEFAULT '',
  classification text NOT NULL DEFAULT 'project_relevant',
  model text NOT NULL DEFAULT '',
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  total_tokens integer NOT NULL DEFAULT 0,
  estimated_cost numeric NOT NULL DEFAULT 0,
  duration_ms integer NOT NULL DEFAULT 0,
  outcome text NOT NULL DEFAULT 'success' CHECK (outcome IN ('success','rejected','blocked','failed','cached')),
  rejection_reason text NOT NULL DEFAULT '',
  message_hash text NOT NULL DEFAULT '',
  message_length integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_usage_events_profile_time ON public.ai_usage_events (profile_id, created_at DESC);
CREATE INDEX ai_usage_events_project_time ON public.ai_usage_events (project_id, created_at DESC);

GRANT SELECT ON public.ai_usage_events TO authenticated;
GRANT ALL ON public.ai_usage_events TO service_role;
ALTER TABLE public.ai_usage_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usage_events_admin_read" ON public.ai_usage_events FOR SELECT TO authenticated
  USING (private.is_agency_admin());
CREATE POLICY "usage_events_self_read" ON public.ai_usage_events FOR SELECT TO authenticated
  USING (profile_id = auth.uid());

-- ========== ai_usage_alerts ==========
CREATE TABLE public.ai_usage_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text NOT NULL,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','critical')),
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  detail text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  acknowledged boolean NOT NULL DEFAULT false,
  acknowledged_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  acknowledged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_usage_alerts_open ON public.ai_usage_alerts (acknowledged, created_at DESC);

GRANT SELECT, UPDATE ON public.ai_usage_alerts TO authenticated;
GRANT ALL ON public.ai_usage_alerts TO service_role;
ALTER TABLE public.ai_usage_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usage_alerts_admin_read" ON public.ai_usage_alerts FOR SELECT TO authenticated
  USING (private.is_agency_admin());
CREATE POLICY "usage_alerts_admin_update" ON public.ai_usage_alerts FOR UPDATE TO authenticated
  USING (private.is_agency_admin()) WITH CHECK (private.is_agency_admin());
CREATE TRIGGER ai_usage_alerts_updated BEFORE UPDATE ON public.ai_usage_alerts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ========== ai_request_classifications ==========
CREATE TABLE public.ai_request_classifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.project_conversations(id) ON DELETE SET NULL,
  agent_type text NOT NULL DEFAULT '',
  classification text NOT NULL CHECK (classification IN ('project_relevant','unclear','unrelated','abusive','repeated_spam')),
  confidence numeric NOT NULL DEFAULT 0,
  reason text NOT NULL DEFAULT '',
  message_excerpt text NOT NULL DEFAULT '',
  message_hash text NOT NULL DEFAULT '',
  classifier_model text NOT NULL DEFAULT '',
  classifier_tokens integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_request_classifications_profile ON public.ai_request_classifications (profile_id, created_at DESC);

GRANT SELECT ON public.ai_request_classifications TO authenticated;
GRANT ALL ON public.ai_request_classifications TO service_role;
ALTER TABLE public.ai_request_classifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "classifications_admin_read" ON public.ai_request_classifications FOR SELECT TO authenticated
  USING (private.is_agency_admin());

-- ========== ai_project_summaries ==========
CREATE TABLE public.ai_project_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.project_conversations(id) ON DELETE CASCADE,
  audience_role text NOT NULL DEFAULT 'agency_admin',
  summary text NOT NULL DEFAULT '',
  covered_message_count integer NOT NULL DEFAULT 0,
  last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ai_project_summaries_key ON public.ai_project_summaries
  (project_id, COALESCE(conversation_id, '00000000-0000-0000-0000-000000000000'::uuid), audience_role);

GRANT SELECT ON public.ai_project_summaries TO authenticated;
GRANT ALL ON public.ai_project_summaries TO service_role;
ALTER TABLE public.ai_project_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "project_summaries_admin_read" ON public.ai_project_summaries FOR SELECT TO authenticated
  USING (private.is_agency_admin());
CREATE TRIGGER ai_project_summaries_updated BEFORE UPDATE ON public.ai_project_summaries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ========== ai_response_cache ==========
CREATE TABLE public.ai_response_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text NOT NULL,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  agent_type text NOT NULL DEFAULT '',
  audience_role text NOT NULL DEFAULT '',
  response_body text NOT NULL DEFAULT '',
  hit_count integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 minutes'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ai_response_cache_key ON public.ai_response_cache (cache_key);

GRANT SELECT ON public.ai_response_cache TO authenticated;
GRANT ALL ON public.ai_response_cache TO service_role;
ALTER TABLE public.ai_response_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "response_cache_admin_read" ON public.ai_response_cache FOR SELECT TO authenticated
  USING (private.is_agency_admin());
CREATE TRIGGER ai_response_cache_updated BEFORE UPDATE ON public.ai_response_cache
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();