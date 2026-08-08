CREATE UNIQUE INDEX IF NOT EXISTS crm_leads_active_phone_unique
  ON public.crm_leads (phone_normalized)
  WHERE phone_normalized IS NOT NULL AND phone_normalized <> '' AND archived_at IS NULL;