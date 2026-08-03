import { supabase } from "../integrations/supabase/client";
import type {
  EstimateAdjustment,
  EstimateBundle,
  EstimateItem,
  EstimateRoleAllocation,
  EstimateScenario,
  EstimateSupplierReview,
  ProjectEstimate,
} from "../types/estimation";

const db = supabase as any;

function fail(context: string, error: { message?: string } | null): never {
  const message = error?.message ?? "Unknown database error";
  console.error(`[estimation] ${context} failed`, error);
  throw new Error(`${context}: ${message}`);
}

async function select<T>(table: string, apply: (q: any) => any): Promise<T[]> {
  const { data, error } = await apply(db.from(table).select("*"));
  if (error) fail(`Load ${table}`, error);
  return (data ?? []) as T[];
}

export async function fetchProjectEstimation(projectId: string): Promise<EstimateBundle> {
  const estimates = await select<ProjectEstimate>("project_estimates", (q) =>
    q.eq("project_id", projectId).order("version", { ascending: false }),
  );
  const ids = estimates.map((e) => e.id);
  if (!ids.length) return { estimates, items: [], allocations: [], reviews: [], adjustments: [], scenarios: [] };
  const [items, allocations, reviews, adjustments, scenarios] = await Promise.all([
    select<EstimateItem>("estimate_items", (q) => q.in("estimate_id", ids).order("sort_order")),
    select<EstimateRoleAllocation>("estimate_role_allocations", (q) => q.in("estimate_id", ids)),
    select<EstimateSupplierReview>("estimate_supplier_reviews", (q) => q.in("estimate_id", ids)),
    select<EstimateAdjustment>("estimate_adjustments", (q) => q.in("estimate_id", ids)),
    select<EstimateScenario>("estimate_scenarios", (q) => q.eq("project_id", projectId).order("created_at")),
  ]);
  return { estimates, items, allocations, reviews, adjustments, scenarios };
}

export async function fetchSupplierEstimateWork(supplierId: string) {
  const items = await select<EstimateItem>("estimate_items", (q) =>
    q.eq("supplier_id", supplierId).order("sort_order"),
  );
  const reviews = await select<EstimateSupplierReview>("estimate_supplier_reviews", (q) =>
    q.eq("supplier_id", supplierId),
  );
  return { items, reviews };
}

export async function createEstimate(projectId: string, patch: Partial<ProjectEstimate>, version: number) {
  const { data, error } = await db
    .from("project_estimates")
    .insert({ project_id: projectId, version, ...patch })
    .select("*")
    .single();
  if (error) fail("Create estimate", error);
  return data as ProjectEstimate;
}

export async function updateEstimate(id: string, patch: Partial<ProjectEstimate>) {
  const { data, error } = await db.from("project_estimates").update(patch).eq("id", id).select("*").single();
  if (error) fail("Update estimate", error);
  return data as ProjectEstimate;
}

export async function createEstimateItem(estimateId: string, patch: Partial<EstimateItem>) {
  const { data, error } = await db
    .from("estimate_items")
    .insert({ estimate_id: estimateId, ...patch })
    .select("*")
    .single();
  if (error) fail("Create estimate item", error);
  return data as EstimateItem;
}

export async function updateEstimateItem(id: string, patch: Partial<EstimateItem>) {
  const { data, error } = await db.from("estimate_items").update(patch).eq("id", id).select("*").single();
  if (error) fail("Update estimate item", error);
  return data as EstimateItem;
}

export async function deleteEstimateItem(id: string) {
  const { error } = await db.from("estimate_items").delete().eq("id", id);
  if (error) fail("Delete estimate item", error);
}

export async function replaceRoleAllocations(estimateId: string, rows: Partial<EstimateRoleAllocation>[]) {
  const { error: delError } = await db.from("estimate_role_allocations").delete().eq("estimate_id", estimateId);
  if (delError) fail("Reset role allocations", delError);
  if (!rows.length) return [];
  const { data, error } = await db
    .from("estimate_role_allocations")
    .insert(rows.map((row) => ({ estimate_id: estimateId, ...row })))
    .select("*");
  if (error) fail("Save role allocations", error);
  return (data ?? []) as EstimateRoleAllocation[];
}

export async function requestSupplierReviews(estimateId: string, items: EstimateItem[]) {
  const rows = items
    .filter((item) => item.supplier_id)
    .map((item) => ({
      estimate_id: estimateId,
      item_id: item.id,
      supplier_id: item.supplier_id as string,
      status: "waiting_for_supplier",
    }));
  if (!rows.length) return [];
  const { data, error } = await db
    .from("estimate_supplier_reviews")
    .upsert(rows, { onConflict: "item_id,supplier_id" })
    .select("*");
  if (error) fail("Request supplier review", error);
  return (data ?? []) as EstimateSupplierReview[];
}

export async function saveSupplierReview(row: Partial<EstimateSupplierReview> & { estimate_id: string; item_id: string; supplier_id: string }) {
  const { data, error } = await db
    .from("estimate_supplier_reviews")
    .upsert(row, { onConflict: "item_id,supplier_id" })
    .select("*")
    .single();
  if (error) fail("Save supplier review", error);
  return data as EstimateSupplierReview;
}

export async function updateSupplierReview(id: string, patch: Partial<EstimateSupplierReview>) {
  const { data, error } = await db.from("estimate_supplier_reviews").update(patch).eq("id", id).select("*").single();
  if (error) fail("Update supplier review", error);
  return data as EstimateSupplierReview;
}

export async function saveScenario(row: Partial<EstimateScenario> & { estimate_id: string; project_id: string; name: string }) {
  const { data, error } = await db.from("estimate_scenarios").insert(row).select("*").single();
  if (error) fail("Save scenario", error);
  return data as EstimateScenario;
}

export async function deleteScenario(id: string) {
  const { error } = await db.from("estimate_scenarios").delete().eq("id", id);
  if (error) fail("Delete scenario", error);
}

export async function markScenarioPromoted(id: string) {
  const { data, error } = await db.from("estimate_scenarios").update({ is_promoted: true }).eq("id", id).select("*").single();
  if (error) fail("Promote scenario", error);
  return data as EstimateScenario;
}

export async function snapshotEstimateVersion(estimate: ProjectEstimate, items: EstimateItem[], note: string) {
  const { error } = await db.from("estimate_versions").insert({
    estimate_id: estimate.id,
    project_id: estimate.project_id,
    version: estimate.version,
    snapshot: { estimate, items },
    note,
  });
  if (error) fail("Snapshot estimate version", error);
}

export async function createAdjustment(estimateId: string, patch: Partial<EstimateAdjustment>) {
  const { data, error } = await db.from("estimate_adjustments").insert({ estimate_id: estimateId, ...patch }).select("*").single();
  if (error) fail("Create adjustment", error);
  return data as EstimateAdjustment;
}