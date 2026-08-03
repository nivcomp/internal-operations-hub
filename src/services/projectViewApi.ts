import { supabase } from "../integrations/supabase/client";
import type {
  EstimateAdjustment, EstimateItem, EstimateRoleAllocation, EstimateScenario,
  EstimateSupplierReview, ProjectEstimate,
} from "../types/estimation";

const db = supabase as any;

export type ViewRole = "agency_admin" | "client" | "supplier";

export type ProjectViewProject = {
  id: string;
  name: string;
  status: string;
  summary: string;
  payment_gate_status: string;
  client_id: string;
};

export type ProjectView = {
  role: ViewRole;
  supplierId: string | null;
  generatedAt: string;
  project: ProjectViewProject;
  clientName: string;
  clientCompany: string;
  estimate: ProjectEstimate | null;
  items: EstimateItem[];
  allocations: EstimateRoleAllocation[];
  adjustments: EstimateAdjustment[];
  reviews: EstimateSupplierReview[];
  scenarios: EstimateScenario[];
  scopes: any[];
  scopeItems: any[];
  approvals: any[];
  changeRequests: any[];
  payments: any[];
  paidHours: any[];
  suppliers: { id: string; name: string }[];
  requirements: any[];
  questions: any[];
  assumptions: any[];
  files: any[];
  pricing: any[];
};

async function rows<T>(table: string, apply: (q: any) => any): Promise<T[]> {
  const { data, error } = await apply(db.from(table).select("*"));
  if (error) {
    // RLS may legitimately hide a table from this role; that is not a failure.
    console.warn(`[projectView] ${table}: ${error.message}`);
    return [];
  }
  return (data ?? []) as T[];
}

/**
 * Loads everything the diagram and the printable report need.
 * RLS is the real barrier; this function additionally strips anything the
 * viewing role must never see, so hidden data never reaches the browser.
 */
export async function fetchProjectView(
  projectId: string,
  role: ViewRole,
  supplierId: string | null = null,
): Promise<ProjectView> {
  const { data: project, error } = await db
    .from("projects").select("*").eq("id", projectId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!project) throw new Error("Project not found or not visible to you.");

  const { data: client } = await db
    .from("clients").select("name, company").eq("id", project.client_id).maybeSingle();

  const estimates = await rows<ProjectEstimate>("project_estimates", (q) =>
    q.eq("project_id", projectId).order("version", { ascending: false }));
  const visibleEstimates = role === "agency_admin" ? estimates : estimates.filter((e) => e.client_visible || role === "supplier");
  const estimate = visibleEstimates[0] ?? null;
  const estimateIds = estimate ? [estimate.id] : [];

  const [items, allocations, adjustments, reviews, scenarios] = estimateIds.length
    ? await Promise.all([
        rows<EstimateItem>("estimate_items", (q) => q.in("estimate_id", estimateIds).order("sort_order")),
        rows<EstimateRoleAllocation>("estimate_role_allocations", (q) => q.in("estimate_id", estimateIds)),
        rows<EstimateAdjustment>("estimate_adjustments", (q) => q.in("estimate_id", estimateIds)),
        rows<EstimateSupplierReview>("estimate_supplier_reviews", (q) => q.in("estimate_id", estimateIds)),
        rows<EstimateScenario>("estimate_scenarios", (q) => q.eq("project_id", projectId)),
      ])
    : [[], [], [], [], []] as any;

  const scopes = await rows<any>("scopes", (q) => q.eq("project_id", projectId).order("version"));
  const scopeIds = scopes.map((s) => s.id);
  const scopeItems = scopeIds.length
    ? await rows<any>("scope_items", (q) => q.in("scope_id", scopeIds))
    : [];

  const [approvals, changeRequests, payments, paidHours, assignments, requirements, questions, assumptions, files, pricing] =
    await Promise.all([
      rows<any>("approvals", (q) => q.eq("project_id", projectId)),
      rows<any>("change_requests", (q) => q.eq("project_id", projectId).order("created_at")),
      rows<any>("payments", (q) => q.eq("project_id", projectId).order("created_at")),
      rows<any>("paid_hours", (q) => q.eq("project_id", projectId)),
      rows<any>("project_supplier_assignments", (q) => q.eq("project_id", projectId)),
      rows<any>("project_requirements", (q) => q.eq("project_id", projectId)),
      rows<any>("project_questions", (q) => q.eq("project_id", projectId)),
      rows<any>("project_assumptions", (q) => q.eq("project_id", projectId)),
      rows<any>("files", (q) => q.eq("project_id", projectId)),
      role === "agency_admin" ? rows<any>("project_pricing", (q) => q.eq("project_id", projectId)) : Promise.resolve([]),
    ]);

  const supplierIds = Array.from(new Set(assignments.map((a: any) => a.supplier_id)));
  const suppliers = supplierIds.length
    ? (await rows<any>("suppliers", (q) => q.in("id", supplierIds))).map((s: any) => ({ id: s.id, name: s.name }))
    : [];

  const view: ProjectView = {
    role,
    supplierId,
    generatedAt: new Date().toISOString(),
    project: project as ProjectViewProject,
    clientName: client?.name ?? "",
    clientCompany: client?.company ?? "",
    estimate,
    items, allocations, adjustments, reviews, scenarios,
    scopes, scopeItems, approvals, changeRequests, payments, paidHours,
    suppliers, requirements, questions, assumptions, files, pricing,
  };

  return applyRoleFilter(view);
}

/** Removes every field the viewing role is not allowed to see. */
function applyRoleFilter(view: ProjectView): ProjectView {
  if (view.role === "agency_admin") return view;

  if (view.role === "client") {
    return {
      ...view,
      items: view.items
        .filter((i) => i.client_visible)
        .map((i) => ({
          ...i,
          supplier_id: null,
          risk_notes: "",
          description: i.client_visible_description || i.description,
          title: i.client_visible_label || i.title,
        })),
      allocations: [],
      adjustments: view.adjustments.filter((a) => a.client_visible),
      reviews: [],
      suppliers: [],
      pricing: [],
      requirements: view.requirements.filter((r) => r.client_visible),
      assumptions: view.assumptions.filter((a) => a.client_visible),
      scopeItems: view.scopeItems.filter((s) => s.client_visible),
      scopes: view.scopes.map((s) => ({ ...s, internal_delivery_notes: "" })),
      files: view.files.filter((f) => f.visibility === "client" || f.visibility === "shared"),
      questions: view.questions.filter((q) => q.target_role === "client" || q.asked_by_role === "client"),
      changeRequests: view.changeRequests.map((c) => ({ ...c, supplier_cost: null })),
      estimate: view.estimate
        ? ({
            ...view.estimate,
            yaniv_internal_hourly_cost: 0,
            internal_cost: 0,
            target_margin_percent: 0,
            external_costs: 0,
            recommended_fixed_price: 0,
            notes: "",
          } as ProjectEstimate)
        : null,
    };
  }

  // supplier
  const mine = view.items.filter((i) => i.supplier_id === view.supplierId);
  return {
    ...view,
    items: mine.map((i) => ({ ...i, client_visible_label: "", client_visible_description: "" })),
    allocations: view.allocations.filter((a) => a.supplier_id === view.supplierId),
    adjustments: [],
    reviews: view.reviews.filter((r) => r.supplier_id === view.supplierId),
    scenarios: [],
    pricing: [],
    payments: [],
    paidHours: [],
    changeRequests: [],
    suppliers: view.suppliers.filter((s) => s.id === view.supplierId),
    scopeItems: view.scopeItems.filter((s) => s.supplier_visible),
    scopes: view.scopes.map((s) => ({ ...s, client_facing_summary: "" })),
    requirements: view.requirements.filter((r) => r.supplier_visible),
    assumptions: view.assumptions.filter((a) => a.supplier_visible),
    files: view.files.filter((f) => f.visibility === "supplier" || f.visibility === "shared"),
    questions: view.questions.filter((q) => q.target_role === "supplier"),
    estimate: view.estimate
      ? ({
          ...view.estimate,
          client_calculation_rate: 0,
          estimated_budget_min: 0,
          estimated_budget_max: 0,
          recommended_fixed_price: 0,
          final_fixed_price: null,
          internal_cost: 0,
          target_margin_percent: 0,
          yaniv_internal_hourly_cost: 0,
          external_costs: 0,
          notes: "",
          fixed_price_scope: "",
          fixed_price_exclusions: "",
          payment_milestones: "",
        } as ProjectEstimate)
      : null,
  };
}
