ALTER TABLE public.onboarding_invitations
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS used_at timestamptz;

CREATE INDEX IF NOT EXISTS onboarding_invitations_project_idx ON public.onboarding_invitations(project_id);
CREATE INDEX IF NOT EXISTS onboarding_invitations_token_idx ON public.onboarding_invitations(token);