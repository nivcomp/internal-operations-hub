
-- =========================================================================
-- Client-to-Scope AI :: initial schema
-- =========================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ---------- clients ----------
CREATE TABLE public.clients (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  company       text NOT NULL,
  email         text NOT NULL,
  phone         text,
  notes         text NOT NULL DEFAULT '',
  status        text NOT NULL DEFAULT 'lead',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO anon, authenticated;
GRANT ALL ON public.clients TO service_role;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev_all_clients" ON public.clients FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- suppliers ----------
CREATE TABLE public.suppliers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  email         text NOT NULL,
  phone         text,
  country       text NOT NULL DEFAULT '',
  timezone      text NOT NULL DEFAULT '',
  status        text NOT NULL DEFAULT 'pending_review',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO anon, authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev_all_suppliers" ON public.suppliers FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_suppliers_updated_at BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- supplier_profiles ----------
CREATE TABLE public.supplier_profiles (
  supplier_id                uuid PRIMARY KEY REFERENCES public.suppliers(id) ON DELETE CASCADE,
  languages                  text[] NOT NULL DEFAULT '{}',
  main_skills                text[] NOT NULL DEFAULT '{}',
  tools                      text[] NOT NULL DEFAULT '{}',
  years_of_experience        integer NOT NULL DEFAULT 0,
  hourly_rate                numeric NOT NULL DEFAULT 0,
  weekly_availability_hours  numeric NOT NULL DEFAULT 0,
  portfolio_links            text[] NOT NULL DEFAULT '{}',
  notes                      text NOT NULL DEFAULT '',
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_profiles TO anon, authenticated;
GRANT ALL ON public.supplier_profiles TO service_role;
ALTER TABLE public.supplier_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev_all_supplier_profiles" ON public.supplier_profiles FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_supplier_profiles_updated_at BEFORE UPDATE ON public.supplier_profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- projects ----------
CREATE TABLE public.projects (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id            uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name                 text NOT NULL,
  status               text NOT NULL DEFAULT 'lead_started',
  summary              text NOT NULL DEFAULT '',
  budget_signal        text NOT NULL DEFAULT '',
  payment_gate_status  text NOT NULL DEFAULT 'blocked',
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO anon, authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev_all_projects" ON public.projects FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- project_briefs ----------
CREATE TABLE public.project_briefs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  problem_statement   text NOT NULL DEFAULT '',
  goals               text[] NOT NULL DEFAULT '{}',
  assumptions         text[] NOT NULL DEFAULT '{}',
  constraints         text[] NOT NULL DEFAULT '{}',
  exclusions          text[] NOT NULL DEFAULT '{}',
  discovery_notes     text NOT NULL DEFAULT '',
  ai_draft_notes      text NOT NULL DEFAULT '',
  final_agency_notes  text NOT NULL DEFAULT '',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_briefs TO anon, authenticated;
GRANT ALL ON public.project_briefs TO service_role;
ALTER TABLE public.project_briefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev_all_project_briefs" ON public.project_briefs FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_project_briefs_updated_at BEFORE UPDATE ON public.project_briefs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- scopes ----------
CREATE TABLE public.scopes (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id              uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  version                 integer NOT NULL DEFAULT 1,
  status                  text NOT NULL DEFAULT 'draft',
  client_facing_summary   text NOT NULL DEFAULT '',
  internal_delivery_notes text NOT NULL DEFAULT '',
  approved_date           date,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scopes TO anon, authenticated;
GRANT ALL ON public.scopes TO service_role;
ALTER TABLE public.scopes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev_all_scopes" ON public.scopes FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_scopes_updated_at BEFORE UPDATE ON public.scopes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- scope_items ----------
CREATE TABLE public.scope_items (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_id          uuid NOT NULL REFERENCES public.scopes(id) ON DELETE CASCADE,
  title             text NOT NULL,
  description       text NOT NULL DEFAULT '',
  phase             text NOT NULL DEFAULT '',
  client_visible    boolean NOT NULL DEFAULT true,
  supplier_visible  boolean NOT NULL DEFAULT true,
  acceptance_notes  text NOT NULL DEFAULT '',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scope_items TO anon, authenticated;
GRANT ALL ON public.scope_items TO service_role;
ALTER TABLE public.scope_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev_all_scope_items" ON public.scope_items FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_scope_items_updated_at BEFORE UPDATE ON public.scope_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- project_supplier_assignments ----------
CREATE TABLE public.project_supplier_assignments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  supplier_id  uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, supplier_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_supplier_assignments TO anon, authenticated;
GRANT ALL ON public.project_supplier_assignments TO service_role;
ALTER TABLE public.project_supplier_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev_all_psa" ON public.project_supplier_assignments FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_psa_updated_at BEFORE UPDATE ON public.project_supplier_assignments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- project_pricing ----------
CREATE TABLE public.project_pricing (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id              uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  currency                text NOT NULL DEFAULT 'GBP',
  client_price            numeric NOT NULL DEFAULT 0,
  supplier_cost_estimate  numeric NOT NULL DEFAULT 0,
  target_margin_percent   numeric NOT NULL DEFAULT 0,
  actual_margin_percent   numeric NOT NULL DEFAULT 0,
  pricing_notes           text NOT NULL DEFAULT '',
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_pricing TO anon, authenticated;
GRANT ALL ON public.project_pricing TO service_role;
ALTER TABLE public.project_pricing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev_all_project_pricing" ON public.project_pricing FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_project_pricing_updated_at BEFORE UPDATE ON public.project_pricing FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- phase_pricing ----------
CREATE TABLE public.phase_pricing (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pricing_id     uuid NOT NULL REFERENCES public.project_pricing(id) ON DELETE CASCADE,
  phase_name     text NOT NULL,
  client_price   numeric NOT NULL DEFAULT 0,
  supplier_cost  numeric NOT NULL DEFAULT 0,
  notes          text NOT NULL DEFAULT '',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.phase_pricing TO anon, authenticated;
GRANT ALL ON public.phase_pricing TO service_role;
ALTER TABLE public.phase_pricing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev_all_phase_pricing" ON public.phase_pricing FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_phase_pricing_updated_at BEFORE UPDATE ON public.phase_pricing FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- approvals ----------
CREATE TABLE public.approvals (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  scope_id       uuid NOT NULL REFERENCES public.scopes(id) ON DELETE CASCADE,
  approver_role  text NOT NULL,
  status         text NOT NULL DEFAULT 'pending',
  approved_date  date,
  notes          text NOT NULL DEFAULT '',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.approvals TO anon, authenticated;
GRANT ALL ON public.approvals TO service_role;
ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev_all_approvals" ON public.approvals FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_approvals_updated_at BEFORE UPDATE ON public.approvals FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- payments (client payments) ----------
CREATE TABLE public.payments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  amount         numeric NOT NULL DEFAULT 0,
  currency       text NOT NULL DEFAULT 'GBP',
  status         text NOT NULL DEFAULT 'requested',
  due_date       date,
  received_date  date,
  notes          text NOT NULL DEFAULT '',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO anon, authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev_all_payments" ON public.payments FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_payments_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- supplier_payments ----------
CREATE TABLE public.supplier_payments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id   uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  project_id    uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  amount_owed   numeric NOT NULL DEFAULT 0,
  amount_paid   numeric NOT NULL DEFAULT 0,
  currency      text NOT NULL DEFAULT 'GBP',
  status        text NOT NULL DEFAULT 'not_ready',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_payments TO anon, authenticated;
GRANT ALL ON public.supplier_payments TO service_role;
ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev_all_supplier_payments" ON public.supplier_payments FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_supplier_payments_updated_at BEFORE UPDATE ON public.supplier_payments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- paid_hours (hour banks) ----------
CREATE TABLE public.paid_hours (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id         uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  project_id        uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  hours_purchased   numeric NOT NULL DEFAULT 0,
  hours_used        numeric NOT NULL DEFAULT 0,
  hours_remaining   numeric NOT NULL DEFAULT 0,
  expiry_date       date,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.paid_hours TO anon, authenticated;
GRANT ALL ON public.paid_hours TO service_role;
ALTER TABLE public.paid_hours ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev_all_paid_hours" ON public.paid_hours FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_paid_hours_updated_at BEFORE UPDATE ON public.paid_hours FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- supplier_time_entries ----------
CREATE TABLE public.supplier_time_entries (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  supplier_id  uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  entry_date   date NOT NULL,
  hours        numeric NOT NULL,
  description  text NOT NULL DEFAULT '',
  status       text NOT NULL DEFAULT 'submitted',
  approved_by  text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_time_entries TO anon, authenticated;
GRANT ALL ON public.supplier_time_entries TO service_role;
ALTER TABLE public.supplier_time_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev_all_supplier_time_entries" ON public.supplier_time_entries FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_supplier_time_entries_updated_at BEFORE UPDATE ON public.supplier_time_entries FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- change_requests ----------
CREATE TABLE public.change_requests (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id              uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  requested_by_client_id  uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  title                   text NOT NULL,
  description             text NOT NULL DEFAULT '',
  status                  text NOT NULL DEFAULT 'submitted',
  agency_price            numeric,
  supplier_cost           numeric,
  approved_date           date,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.change_requests TO anon, authenticated;
GRANT ALL ON public.change_requests TO service_role;
ALTER TABLE public.change_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev_all_change_requests" ON public.change_requests FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_change_requests_updated_at BEFORE UPDATE ON public.change_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- project_messages ----------
CREATE TABLE public.project_messages (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  author_role  text NOT NULL,
  body         text NOT NULL DEFAULT '',
  visibility   text NOT NULL DEFAULT 'agency_only',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_messages TO anon, authenticated;
GRANT ALL ON public.project_messages TO service_role;
ALTER TABLE public.project_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev_all_project_messages" ON public.project_messages FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_project_messages_updated_at BEFORE UPDATE ON public.project_messages FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- decision_logs ----------
CREATE TABLE public.decision_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  decision     text NOT NULL,
  made_by_role text NOT NULL,
  impact       text NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.decision_logs TO anon, authenticated;
GRANT ALL ON public.decision_logs TO service_role;
ALTER TABLE public.decision_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev_all_decision_logs" ON public.decision_logs FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_decision_logs_updated_at BEFORE UPDATE ON public.decision_logs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- files ----------
CREATE TABLE public.files (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title       text NOT NULL,
  url         text NOT NULL,
  file_type   text NOT NULL DEFAULT 'link',
  visibility  text NOT NULL DEFAULT 'agency_only',
  added_by    text NOT NULL DEFAULT 'agency_admin',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.files TO anon, authenticated;
GRANT ALL ON public.files TO service_role;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev_all_files" ON public.files FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_files_updated_at BEFORE UPDATE ON public.files FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- activity_logs ----------
CREATE TABLE public.activity_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label       text NOT NULL,
  detail      text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_logs TO anon, authenticated;
GRANT ALL ON public.activity_logs TO service_role;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev_all_activity_logs" ON public.activity_logs FOR ALL USING (true) WITH CHECK (true);

-- ---------- ai_sessions ----------
CREATE TABLE public.ai_sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  kind         text NOT NULL DEFAULT 'brief_draft',
  prompt       text NOT NULL DEFAULT '',
  output       text NOT NULL DEFAULT '',
  metadata     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_sessions TO anon, authenticated;
GRANT ALL ON public.ai_sessions TO service_role;
ALTER TABLE public.ai_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev_all_ai_sessions" ON public.ai_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_ai_sessions_updated_at BEFORE UPDATE ON public.ai_sessions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- supplier_skill_suggestions ----------
CREATE TABLE public.supplier_skill_suggestions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id       uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  suggested_skill   text NOT NULL,
  source_text       text NOT NULL DEFAULT '',
  status            text NOT NULL DEFAULT 'needs_agency_approval',
  reviewed_by       text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_skill_suggestions TO anon, authenticated;
GRANT ALL ON public.supplier_skill_suggestions TO service_role;
ALTER TABLE public.supplier_skill_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev_all_supplier_skill_suggestions" ON public.supplier_skill_suggestions FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_supplier_skill_suggestions_updated_at BEFORE UPDATE ON public.supplier_skill_suggestions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
