CREATE TABLE public.onboarding_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.app_role NOT NULL,
  contact_name text NOT NULL DEFAULT '',
  company text NOT NULL DEFAULT '',
  email text NOT NULL,
  phone text NOT NULL DEFAULT '',
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  invited_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  invite_link text NOT NULL DEFAULT '',
  emailed boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending',
  accepted_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_invitations TO authenticated;
GRANT ALL ON public.onboarding_invitations TO service_role;

ALTER TABLE public.onboarding_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agency admins manage invitations"
ON public.onboarding_invitations FOR ALL TO authenticated
USING (private.is_agency_admin())
WITH CHECK (private.is_agency_admin());

CREATE TRIGGER set_onboarding_invitations_updated_at
BEFORE UPDATE ON public.onboarding_invitations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();