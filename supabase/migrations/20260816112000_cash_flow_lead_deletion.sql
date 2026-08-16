-- Allow authenticated agency admins to delete Amir cash-flow leads.
-- Anonymous visitors remain insert-only and can never read, edit or delete leads.

GRANT DELETE ON public.cash_flow_leads TO authenticated;

CREATE POLICY "agency admins delete cash-flow leads"
  ON public.cash_flow_leads
  FOR DELETE
  TO authenticated
  USING (private.is_agency_admin());
