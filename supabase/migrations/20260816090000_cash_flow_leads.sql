-- Public lead intake for the Amir cash-flow campaign.
-- Anonymous visitors may only insert fixed-source, new leads. Reading and
-- managing the pipeline remains restricted to authenticated agency admins.

CREATE TABLE public.cash_flow_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  company_name text NOT NULL,
  phone text,
  mobile_phone text NOT NULL,
  email text NOT NULL,
  physical_address text,
  reason_for_cash_flow_software text NOT NULL,
  accounting_system text NOT NULL,
  accounting_system_other text,
  notes text,
  source text NOT NULL DEFAULT 'amir_cashflow_form',
  status text NOT NULL DEFAULT 'new',
  CONSTRAINT cash_flow_leads_status_check
    CHECK (status IN ('new', 'contacted', 'qualified', 'not_relevant', 'converted')),
  CONSTRAINT cash_flow_leads_source_check
    CHECK (source = 'amir_cashflow_form'),
  CONSTRAINT cash_flow_leads_required_text_check
    CHECK (
      btrim(first_name) <> ''
      AND btrim(last_name) <> ''
      AND btrim(company_name) <> ''
      AND btrim(mobile_phone) <> ''
      AND btrim(email) <> ''
      AND btrim(reason_for_cash_flow_software) <> ''
      AND btrim(accounting_system) <> ''
    ),
  CONSTRAINT cash_flow_leads_other_system_check
    CHECK (accounting_system <> 'אחר' OR nullif(btrim(accounting_system_other), '') IS NOT NULL)
);

CREATE INDEX cash_flow_leads_created_at_idx
  ON public.cash_flow_leads (created_at DESC);
CREATE INDEX cash_flow_leads_status_idx
  ON public.cash_flow_leads (status, created_at DESC);

ALTER TABLE public.cash_flow_leads ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.cash_flow_leads FROM PUBLIC, anon, authenticated;
GRANT INSERT (
  first_name,
  last_name,
  company_name,
  phone,
  mobile_phone,
  email,
  physical_address,
  reason_for_cash_flow_software,
  accounting_system,
  accounting_system_other,
  notes,
  source,
  status
) ON public.cash_flow_leads TO anon, authenticated;
GRANT SELECT, UPDATE ON public.cash_flow_leads TO authenticated;
GRANT ALL ON public.cash_flow_leads TO service_role;

CREATE POLICY "public submits amir cash-flow leads"
  ON public.cash_flow_leads
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    source = 'amir_cashflow_form'
    AND status = 'new'
  );

CREATE POLICY "agency admins read cash-flow leads"
  ON public.cash_flow_leads
  FOR SELECT
  TO authenticated
  USING (private.is_agency_admin());

CREATE POLICY "agency admins update cash-flow leads"
  ON public.cash_flow_leads
  FOR UPDATE
  TO authenticated
  USING (private.is_agency_admin())
  WITH CHECK (private.is_agency_admin());
