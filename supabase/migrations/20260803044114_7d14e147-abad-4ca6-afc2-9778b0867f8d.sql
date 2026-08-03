ALTER TABLE public.ai_generated_drafts
  ADD COLUMN IF NOT EXISTS estimate_id uuid REFERENCES public.project_estimates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS estimate_version integer,
  ADD COLUMN IF NOT EXISTS agent_type text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS action_kind text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS confirm_role text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS preview jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS applied_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS applied_at timestamptz;

ALTER TABLE public.ai_generated_drafts DROP CONSTRAINT IF EXISTS ai_generated_drafts_status_check;
ALTER TABLE public.ai_generated_drafts ADD CONSTRAINT ai_generated_drafts_status_check
  CHECK (status = ANY (ARRAY['awaiting_agency_review','accepted','rejected','superseded','applied','cancelled']));

ALTER TABLE public.estimate_items
  ADD COLUMN IF NOT EXISTS ai_generated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS source_message_id uuid REFERENCES public.chat_messages(id) ON DELETE SET NULL;

ALTER TABLE public.project_estimates
  ADD COLUMN IF NOT EXISTS source_conversation_id uuid REFERENCES public.project_conversations(id) ON DELETE SET NULL;

ALTER TABLE public.estimate_scenarios
  ADD COLUMN IF NOT EXISTS source_message_id uuid REFERENCES public.chat_messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by_agent text NOT NULL DEFAULT '';

ALTER TABLE public.estimate_supplier_reviews
  ADD COLUMN IF NOT EXISTS source_message_id uuid REFERENCES public.chat_messages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ai_generated_drafts_pending_idx
  ON public.ai_generated_drafts (project_id, status, action_kind);