ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE TABLE public.copilot_operator_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_id uuid,
  plan_title text,
  plan_step integer NOT NULL DEFAULT 1,
  action_type text NOT NULL,
  action_label text NOT NULL DEFAULT '',
  target_type text NOT NULL DEFAULT 'none',
  target_id uuid,
  target_label text NOT NULL DEFAULT '',
  source_command text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT 'text',
  risk_level text NOT NULL DEFAULT 'medium',
  requires_confirmation boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'awaiting_confirmation',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  preview jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb,
  failure_reason text,
  confirmed_at timestamptz,
  executed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.copilot_operator_actions TO authenticated;
GRANT ALL ON public.copilot_operator_actions TO service_role;
ALTER TABLE public.copilot_operator_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agency admins read operator actions"
  ON public.copilot_operator_actions FOR SELECT TO authenticated
  USING (private.is_agency_admin());

CREATE INDEX copilot_operator_actions_profile_idx ON public.copilot_operator_actions (profile_id, created_at DESC);
CREATE INDEX copilot_operator_actions_plan_idx ON public.copilot_operator_actions (plan_id, plan_step);

CREATE TRIGGER copilot_operator_actions_updated_at
  BEFORE UPDATE ON public.copilot_operator_actions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.copilot_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_role text NOT NULL DEFAULT 'agency_admin',
  operator_action_id uuid REFERENCES public.copilot_operator_actions(id) ON DELETE SET NULL,
  command text NOT NULL DEFAULT '',
  interpreted_intent text NOT NULL DEFAULT '',
  action_type text NOT NULL,
  target_type text NOT NULL DEFAULT 'none',
  target_id uuid,
  target_label text NOT NULL DEFAULT '',
  previous_value jsonb,
  new_value jsonb,
  confirmed boolean NOT NULL DEFAULT false,
  execution_result text NOT NULL DEFAULT 'completed',
  failure_reason text,
  source text NOT NULL DEFAULT 'text',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.copilot_audit_log TO authenticated;
GRANT ALL ON public.copilot_audit_log TO service_role;
ALTER TABLE public.copilot_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agency admins read copilot audit log"
  ON public.copilot_audit_log FOR SELECT TO authenticated
  USING (private.is_agency_admin());

CREATE INDEX copilot_audit_log_created_idx ON public.copilot_audit_log (created_at DESC);