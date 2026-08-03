-- 1. Registration settings (one row per public role link)
CREATE TABLE public.registration_settings (
  role text PRIMARY KEY CHECK (role IN ('client','supplier')),
  enabled boolean NOT NULL DEFAULT false,
  path_code text NOT NULL DEFAULT encode(gen_random_bytes(6), 'hex'),
  daily_limit integer NOT NULL DEFAULT 25,
  intro_text text NOT NULL DEFAULT '',
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.registration_settings TO authenticated;
GRANT ALL ON public.registration_settings TO service_role;
ALTER TABLE public.registration_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY registration_settings_admin_all ON public.registration_settings
  FOR ALL TO authenticated
  USING (private.is_agency_admin()) WITH CHECK (private.is_agency_admin());

CREATE TRIGGER registration_settings_set_updated_at
  BEFORE UPDATE ON public.registration_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.registration_settings (role, enabled) VALUES ('client', false), ('supplier', false);

-- 2. Public registrations (isolated intake, never operational data)
CREATE TABLE public.public_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL CHECK (role IN ('client','supplier')),
  company text NOT NULL DEFAULT '',
  contact_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL DEFAULT '',
  message text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'awaiting_confirmation'
    CHECK (status IN ('awaiting_confirmation','confirmed','converted','rejected','blocked')),
  source text NOT NULL DEFAULT 'public_link',
  ip_hash text NOT NULL DEFAULT '',
  user_agent text NOT NULL DEFAULT '',
  seen_by_admin boolean NOT NULL DEFAULT false,
  confirmed_at timestamptz,
  converted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  review_notes text NOT NULL DEFAULT '',
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX public_registrations_status_idx ON public.public_registrations (status, created_at DESC);
CREATE INDEX public_registrations_email_idx ON public.public_registrations (lower(email));

GRANT SELECT, UPDATE ON public.public_registrations TO authenticated;
GRANT ALL ON public.public_registrations TO service_role;
ALTER TABLE public.public_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY public_registrations_admin_read ON public.public_registrations
  FOR SELECT TO authenticated USING (private.is_agency_admin());
CREATE POLICY public_registrations_admin_update ON public.public_registrations
  FOR UPDATE TO authenticated
  USING (private.is_agency_admin()) WITH CHECK (private.is_agency_admin());

CREATE TRIGGER public_registrations_set_updated_at
  BEFORE UPDATE ON public.public_registrations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Registration audit log
CREATE TABLE public.registration_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event text NOT NULL,
  role text,
  email text NOT NULL DEFAULT '',
  registration_id uuid REFERENCES public.public_registrations(id) ON DELETE SET NULL,
  actor_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ip_hash text NOT NULL DEFAULT '',
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX registration_audit_log_created_idx ON public.registration_audit_log (created_at DESC);

GRANT SELECT ON public.registration_audit_log TO authenticated;
GRANT ALL ON public.registration_audit_log TO service_role;
ALTER TABLE public.registration_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY registration_audit_admin_read ON public.registration_audit_log
  FOR SELECT TO authenticated USING (private.is_agency_admin());