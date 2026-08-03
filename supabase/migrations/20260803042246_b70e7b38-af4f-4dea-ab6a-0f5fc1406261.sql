
CREATE TABLE public.project_estimates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft',
  currency text NOT NULL DEFAULT 'GBP',
  client_calculation_rate numeric NOT NULL DEFAULT 0,
  show_hourly_rate_to_client boolean NOT NULL DEFAULT false,
  minimum_billing_unit numeric NOT NULL DEFAULT 0.5,
  estimate_rounding_increment numeric NOT NULL DEFAULT 100,
  estimated_hours_min numeric NOT NULL DEFAULT 0,
  estimated_hours_max numeric NOT NULL DEFAULT 0,
  estimated_budget_min numeric NOT NULL DEFAULT 0,
  estimated_budget_max numeric NOT NULL DEFAULT 0,
  internal_cost numeric NOT NULL DEFAULT 0,
  recommended_fixed_price numeric NOT NULL DEFAULT 0,
  final_fixed_price numeric,
  risk_buffer_percent numeric NOT NULL DEFAULT 10,
  management_buffer_percent numeric NOT NULL DEFAULT 10,
  testing_buffer_percent numeric NOT NULL DEFAULT 10,
  contingency_percent numeric NOT NULL DEFAULT 10,
  target_margin_percent numeric NOT NULL DEFAULT 35,
  yaniv_internal_hourly_cost numeric NOT NULL DEFAULT 0,
  external_costs numeric NOT NULL DEFAULT 0,
  client_visible boolean NOT NULL DEFAULT false,
  approved_by_yaniv boolean NOT NULL DEFAULT false,
  fixed_price_scope text NOT NULL DEFAULT '',
  fixed_price_exclusions text NOT NULL DEFAULT '',
  payment_milestones text NOT NULL DEFAULT '',
  change_request_rule text NOT NULL DEFAULT '',
  validity_date date,
  delivery_start_date date,
  delivery_end_date date,
  delivery_range_label text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, version)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_estimates TO authenticated;
GRANT ALL ON public.project_estimates TO service_role;
ALTER TABLE public.project_estimates ENABLE ROW LEVEL SECURITY;
CREATE POLICY estimates_admin_all ON public.project_estimates FOR ALL TO authenticated USING (private.is_agency_admin()) WITH CHECK (private.is_agency_admin());
CREATE POLICY estimates_client_read ON public.project_estimates FOR SELECT TO authenticated USING (client_visible = true AND private.client_owns_project(project_id));

CREATE TABLE public.estimate_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id uuid NOT NULL REFERENCES public.project_estimates(id) ON DELETE CASCADE,
  project_phase text NOT NULL DEFAULT 'delivery',
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  quantity numeric NOT NULL DEFAULT 1,
  complexity_level text NOT NULL DEFAULT 'standard',
  complexity_multiplier numeric NOT NULL DEFAULT 1,
  uncertainty_multiplier numeric NOT NULL DEFAULT 1.2,
  integration_multiplier numeric NOT NULL DEFAULT 1,
  base_hours numeric NOT NULL DEFAULT 0,
  estimated_hours_min numeric NOT NULL DEFAULT 0,
  estimated_hours_max numeric NOT NULL DEFAULT 0,
  responsible_role text NOT NULL DEFAULT 'development',
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  client_visible boolean NOT NULL DEFAULT true,
  client_visible_label text NOT NULL DEFAULT '',
  client_visible_description text NOT NULL DEFAULT '',
  client_optional boolean NOT NULL DEFAULT false,
  selected_by_client boolean NOT NULL DEFAULT true,
  option_group text NOT NULL DEFAULT '',
  option_tier text NOT NULL DEFAULT 'standard',
  max_quantity numeric NOT NULL DEFAULT 1,
  dependency_notes text NOT NULL DEFAULT '',
  risk_notes text NOT NULL DEFAULT '',
  acceptance_criteria text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.estimate_items TO authenticated;
GRANT ALL ON public.estimate_items TO service_role;
ALTER TABLE public.estimate_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY estimate_items_admin_all ON public.estimate_items FOR ALL TO authenticated USING (private.is_agency_admin()) WITH CHECK (private.is_agency_admin());
CREATE POLICY estimate_items_client_read ON public.estimate_items FOR SELECT TO authenticated USING (
  client_visible = true AND EXISTS (
    SELECT 1 FROM public.project_estimates e
    WHERE e.id = estimate_items.estimate_id AND e.client_visible = true AND private.client_owns_project(e.project_id)
  )
);
CREATE POLICY estimate_items_supplier_read ON public.estimate_items FOR SELECT TO authenticated USING (
  supplier_id IS NOT NULL AND supplier_id = private.current_supplier_id()
);

CREATE TABLE public.estimate_role_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id uuid NOT NULL REFERENCES public.project_estimates(id) ON DELETE CASCADE,
  role text NOT NULL,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  estimated_hours_min numeric NOT NULL DEFAULT 0,
  estimated_hours_max numeric NOT NULL DEFAULT 0,
  internal_hourly_cost numeric NOT NULL DEFAULT 0,
  fixed_internal_cost numeric,
  calculated_internal_cost_min numeric NOT NULL DEFAULT 0,
  calculated_internal_cost_max numeric NOT NULL DEFAULT 0,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.estimate_role_allocations TO authenticated;
GRANT ALL ON public.estimate_role_allocations TO service_role;
ALTER TABLE public.estimate_role_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY role_alloc_admin_all ON public.estimate_role_allocations FOR ALL TO authenticated USING (private.is_agency_admin()) WITH CHECK (private.is_agency_admin());

CREATE TABLE public.estimate_supplier_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id uuid NOT NULL REFERENCES public.project_estimates(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.estimate_items(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'waiting_for_supplier',
  supplier_decision text NOT NULL DEFAULT 'pending',
  suggested_hours_min numeric,
  suggested_hours_max numeric,
  fixed_quote numeric,
  assumptions text NOT NULL DEFAULT '',
  dependencies text NOT NULL DEFAULT '',
  missing_information text NOT NULL DEFAULT '',
  delivery_risk text NOT NULL DEFAULT '',
  proposed_duration_days numeric,
  weekly_availability_hours numeric,
  agency_notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (item_id, supplier_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.estimate_supplier_reviews TO authenticated;
GRANT ALL ON public.estimate_supplier_reviews TO service_role;
ALTER TABLE public.estimate_supplier_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY supplier_reviews_admin_all ON public.estimate_supplier_reviews FOR ALL TO authenticated USING (private.is_agency_admin()) WITH CHECK (private.is_agency_admin());
CREATE POLICY supplier_reviews_own_read ON public.estimate_supplier_reviews FOR SELECT TO authenticated USING (supplier_id = private.current_supplier_id());
CREATE POLICY supplier_reviews_own_insert ON public.estimate_supplier_reviews FOR INSERT TO authenticated WITH CHECK (supplier_id = private.current_supplier_id());
CREATE POLICY supplier_reviews_own_update ON public.estimate_supplier_reviews FOR UPDATE TO authenticated USING (supplier_id = private.current_supplier_id()) WITH CHECK (supplier_id = private.current_supplier_id());

CREATE TABLE public.estimate_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id uuid NOT NULL REFERENCES public.project_estimates(id) ON DELETE CASCADE,
  label text NOT NULL,
  kind text NOT NULL DEFAULT 'amount',
  amount numeric NOT NULL DEFAULT 0,
  client_visible boolean NOT NULL DEFAULT false,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.estimate_adjustments TO authenticated;
GRANT ALL ON public.estimate_adjustments TO service_role;
ALTER TABLE public.estimate_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY adjustments_admin_all ON public.estimate_adjustments FOR ALL TO authenticated USING (private.is_agency_admin()) WITH CHECK (private.is_agency_admin());
CREATE POLICY adjustments_client_read ON public.estimate_adjustments FOR SELECT TO authenticated USING (
  client_visible = true AND EXISTS (
    SELECT 1 FROM public.project_estimates e
    WHERE e.id = estimate_adjustments.estimate_id AND e.client_visible = true AND private.client_owns_project(e.project_id)
  )
);

CREATE TABLE public.estimate_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id uuid NOT NULL REFERENCES public.project_estimates(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  client_notes text NOT NULL DEFAULT '',
  selections jsonb NOT NULL DEFAULT '[]'::jsonb,
  estimated_hours_min numeric NOT NULL DEFAULT 0,
  estimated_hours_max numeric NOT NULL DEFAULT 0,
  estimated_budget_min numeric NOT NULL DEFAULT 0,
  estimated_budget_max numeric NOT NULL DEFAULT 0,
  is_promoted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.estimate_scenarios TO authenticated;
GRANT ALL ON public.estimate_scenarios TO service_role;
ALTER TABLE public.estimate_scenarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY scenarios_admin_all ON public.estimate_scenarios FOR ALL TO authenticated USING (private.is_agency_admin()) WITH CHECK (private.is_agency_admin());
CREATE POLICY scenarios_client_read ON public.estimate_scenarios FOR SELECT TO authenticated USING (private.client_owns_project(project_id));
CREATE POLICY scenarios_client_insert ON public.estimate_scenarios FOR INSERT TO authenticated WITH CHECK (private.client_owns_project(project_id) AND is_promoted = false);
CREATE POLICY scenarios_client_update ON public.estimate_scenarios FOR UPDATE TO authenticated USING (private.client_owns_project(project_id)) WITH CHECK (private.client_owns_project(project_id) AND is_promoted = false);
CREATE POLICY scenarios_client_delete ON public.estimate_scenarios FOR DELETE TO authenticated USING (private.client_owns_project(project_id));

CREATE TABLE public.estimate_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id uuid NOT NULL REFERENCES public.project_estimates(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  version integer NOT NULL,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.estimate_versions TO authenticated;
GRANT ALL ON public.estimate_versions TO service_role;
ALTER TABLE public.estimate_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY versions_admin_all ON public.estimate_versions FOR ALL TO authenticated USING (private.is_agency_admin()) WITH CHECK (private.is_agency_admin());

CREATE TRIGGER set_updated_at_project_estimates BEFORE UPDATE ON public.project_estimates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at_estimate_items BEFORE UPDATE ON public.estimate_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at_estimate_role_allocations BEFORE UPDATE ON public.estimate_role_allocations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at_estimate_supplier_reviews BEFORE UPDATE ON public.estimate_supplier_reviews FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at_estimate_adjustments BEFORE UPDATE ON public.estimate_adjustments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at_estimate_scenarios BEFORE UPDATE ON public.estimate_scenarios FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at_estimate_versions BEFORE UPDATE ON public.estimate_versions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_estimate_items_estimate ON public.estimate_items(estimate_id);
CREATE INDEX idx_estimate_items_supplier ON public.estimate_items(supplier_id);
CREATE INDEX idx_estimates_project ON public.project_estimates(project_id);
CREATE INDEX idx_reviews_estimate ON public.estimate_supplier_reviews(estimate_id);
CREATE INDEX idx_scenarios_project ON public.estimate_scenarios(project_id);
