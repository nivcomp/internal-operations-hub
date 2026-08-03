ALTER TABLE public.public_registrations
  ADD COLUMN IF NOT EXISTS preferred_language text NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS consent_at timestamptz;