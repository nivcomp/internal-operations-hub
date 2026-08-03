export type EstimateStatus =
  | "draft"
  | "ai_estimate"
  | "waiting_for_supplier_review"
  | "supplier_reviewed"
  | "waiting_for_yaniv_review"
  | "client_estimate_visible"
  | "fixed_price_approved"
  | "superseded";

export const estimateStatusLabels: Record<EstimateStatus, string> = {
  draft: "Draft",
  ai_estimate: "Draft estimate",
  waiting_for_supplier_review: "Waiting for supplier review",
  supplier_reviewed: "Supplier reviewed",
  waiting_for_yaniv_review: "Waiting for agency review",
  client_estimate_visible: "Estimate shared with client",
  fixed_price_approved: "Fixed price approved",
  superseded: "Superseded",
};

export const responsibleRoles = [
  "yaniv_discovery",
  "yaniv_project_management",
  "architecture",
  "design",
  "development",
  "automation",
  "integration",
  "testing",
  "deployment",
  "training",
  "supplier_work",
] as const;
export type ResponsibleRole = (typeof responsibleRoles)[number];

export const roleLabels: Record<string, string> = {
  yaniv_discovery: "Yaniv · discovery",
  yaniv_project_management: "Yaniv · project management",
  architecture: "Architecture",
  design: "Design",
  development: "Development",
  automation: "Automation",
  integration: "Integration",
  testing: "Testing",
  deployment: "Deployment",
  training: "Training",
  supplier_work: "Supplier work",
};

export const complexityLevels = ["simple", "standard", "complex", "very_complex"] as const;
export const complexityMultipliers: Record<string, number> = {
  simple: 0.8,
  standard: 1,
  complex: 1.4,
  very_complex: 1.9,
};

export type SupplierReviewStatus =
  | "not_sent"
  | "waiting_for_supplier"
  | "supplier_reviewed"
  | "supplier_changes_requested"
  | "accepted_by_yaniv"
  | "rejected_by_yaniv";

export interface ProjectEstimate {
  id: string;
  project_id: string;
  version: number;
  status: EstimateStatus;
  currency: string;
  client_calculation_rate: number;
  show_hourly_rate_to_client: boolean;
  minimum_billing_unit: number;
  estimate_rounding_increment: number;
  estimated_hours_min: number;
  estimated_hours_max: number;
  estimated_budget_min: number;
  estimated_budget_max: number;
  internal_cost: number;
  recommended_fixed_price: number;
  final_fixed_price: number | null;
  risk_buffer_percent: number;
  management_buffer_percent: number;
  testing_buffer_percent: number;
  contingency_percent: number;
  target_margin_percent: number;
  yaniv_internal_hourly_cost: number;
  external_costs: number;
  client_visible: boolean;
  approved_by_yaniv: boolean;
  fixed_price_scope: string;
  fixed_price_exclusions: string;
  payment_milestones: string;
  change_request_rule: string;
  validity_date: string | null;
  delivery_start_date: string | null;
  delivery_end_date: string | null;
  delivery_range_label: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface EstimateItem {
  id: string;
  estimate_id: string;
  project_phase: string;
  title: string;
  description: string;
  quantity: number;
  complexity_level: string;
  complexity_multiplier: number;
  uncertainty_multiplier: number;
  integration_multiplier: number;
  base_hours: number;
  estimated_hours_min: number;
  estimated_hours_max: number;
  responsible_role: string;
  supplier_id: string | null;
  client_visible: boolean;
  client_visible_label: string;
  client_visible_description: string;
  client_optional: boolean;
  selected_by_client: boolean;
  option_group: string;
  option_tier: string;
  max_quantity: number;
  dependency_notes: string;
  risk_notes: string;
  acceptance_criteria: string;
  sort_order: number;
  /** Created from an AI proposal that the agency confirmed. */
  ai_generated?: boolean;
}

export interface EstimateRoleAllocation {
  id: string;
  estimate_id: string;
  role: string;
  supplier_id: string | null;
  estimated_hours_min: number;
  estimated_hours_max: number;
  internal_hourly_cost: number;
  fixed_internal_cost: number | null;
  calculated_internal_cost_min: number;
  calculated_internal_cost_max: number;
  notes: string;
}

export interface EstimateSupplierReview {
  id: string;
  estimate_id: string;
  item_id: string;
  supplier_id: string;
  status: SupplierReviewStatus;
  supplier_decision: string;
  suggested_hours_min: number | null;
  suggested_hours_max: number | null;
  fixed_quote: number | null;
  assumptions: string;
  dependencies: string;
  missing_information: string;
  delivery_risk: string;
  proposed_duration_days: number | null;
  weekly_availability_hours: number | null;
  agency_notes: string;
}

export interface EstimateAdjustment {
  id: string;
  estimate_id: string;
  label: string;
  kind: string;
  amount: number;
  client_visible: boolean;
  notes: string;
}

export interface ScenarioSelection {
  itemId: string;
  selected: boolean;
  quantity: number;
}

export interface EstimateScenario {
  id: string;
  estimate_id: string;
  project_id: string;
  name: string;
  client_notes: string;
  selections: ScenarioSelection[];
  estimated_hours_min: number;
  estimated_hours_max: number;
  estimated_budget_min: number;
  estimated_budget_max: number;
  is_promoted: boolean;
  created_at: string;
}

export interface EstimateBundle {
  estimates: ProjectEstimate[];
  items: EstimateItem[];
  allocations: EstimateRoleAllocation[];
  reviews: EstimateSupplierReview[];
  adjustments: EstimateAdjustment[];
  scenarios: EstimateScenario[];
}