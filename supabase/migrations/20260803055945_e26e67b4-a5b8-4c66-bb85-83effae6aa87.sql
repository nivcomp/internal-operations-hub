CREATE TABLE public.copilot_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  scope_key text NOT NULL DEFAULT 'global',
  entity_type text NOT NULL DEFAULT 'none',
  entity_id uuid,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  sender text NOT NULL CHECK (sender IN ('user','assistant')),
  body text NOT NULL DEFAULT '',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX copilot_messages_scope_idx ON public.copilot_messages (profile_id, scope_key, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.copilot_messages TO authenticated;
GRANT ALL ON public.copilot_messages TO service_role;
ALTER TABLE public.copilot_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY copilot_messages_own ON public.copilot_messages FOR ALL TO authenticated
  USING (profile_id = auth.uid()) WITH CHECK (profile_id = auth.uid());

CREATE TABLE public.copilot_state (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.copilot_state TO authenticated;
GRANT ALL ON public.copilot_state TO service_role;
ALTER TABLE public.copilot_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY copilot_state_own ON public.copilot_state FOR ALL TO authenticated
  USING (profile_id = auth.uid()) WITH CHECK (profile_id = auth.uid());

CREATE TRIGGER copilot_state_touch BEFORE UPDATE ON public.copilot_state
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();