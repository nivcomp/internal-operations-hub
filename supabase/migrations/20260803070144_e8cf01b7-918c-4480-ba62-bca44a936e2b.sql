CREATE TABLE public.copilot_slot_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  scope_key text NOT NULL,
  intent text NOT NULL,
  action_type text NOT NULL,
  target_type text NOT NULL DEFAULT 'none',
  target_id uuid,
  target_label text NOT NULL DEFAULT '',
  confirmed_parameters jsonb NOT NULL DEFAULT '{}'::jsonb,
  missing_parameters jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_language text NOT NULL DEFAULT 'en',
  confidence numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'collecting',
  last_correction text NOT NULL DEFAULT '',
  operator_action_id uuid REFERENCES public.copilot_operator_actions(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '2 hours',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, scope_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.copilot_slot_memory TO authenticated;
GRANT ALL ON public.copilot_slot_memory TO service_role;
ALTER TABLE public.copilot_slot_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their copilot slot memory"
ON public.copilot_slot_memory FOR ALL TO authenticated
USING (profile_id = auth.uid())
WITH CHECK (profile_id = auth.uid());

CREATE TRIGGER copilot_slot_memory_updated_at
BEFORE UPDATE ON public.copilot_slot_memory
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.copilot_entity_facts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  label text NOT NULL DEFAULT '',
  facts jsonb NOT NULL DEFAULT '{}'::jsonb,
  refreshed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_id)
);

GRANT SELECT ON public.copilot_entity_facts TO authenticated;
GRANT ALL ON public.copilot_entity_facts TO service_role;
ALTER TABLE public.copilot_entity_facts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agency admins read copilot entity facts"
ON public.copilot_entity_facts FOR SELECT TO authenticated
USING (private.is_agency_admin());

CREATE TRIGGER copilot_entity_facts_updated_at
BEFORE UPDATE ON public.copilot_entity_facts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();