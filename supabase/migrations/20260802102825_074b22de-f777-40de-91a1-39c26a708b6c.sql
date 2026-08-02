ALTER TABLE public.supplier_profiles
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'GBP';