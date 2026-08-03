/**
 * Structured entity memory.
 *
 * A small, server-computed fact sheet per project (rate, currency, margin,
 * dates, suppliers, approvals) that is cached in `copilot_entity_facts` and
 * given to the model instead of replaying the whole chat history.
 * Facts always come from the database, never from the model.
 */

export type ProjectFacts = Record<string, unknown>;

export async function buildProjectFacts(admin: any, projectId: string): Promise<{ label: string; facts: ProjectFacts } | null> {
  const { data: project } = await admin.from("projects").select("*").eq("id", projectId).maybeSingle();
  if (!project) return null;

  const [{ data: estimate }, { data: schedule }, { data: assignments }, { data: payments }, { data: approvals }, { data: decisions }] =
    await Promise.all([
      admin.from("project_estimates").select("*").eq("project_id", projectId)
        .order("version", { ascending: false }).limit(1).maybeSingle(),
      admin.from("project_schedule").select("*").eq("project_id", projectId).maybeSingle(),
      admin.from("project_supplier_assignments").select("supplier_id, status").eq("project_id", projectId).limit(20),
      admin.from("payments").select("amount, currency, status, due_date").eq("project_id", projectId).limit(20),
      admin.from("approvals").select("type, status").eq("project_id", projectId).limit(20),
      admin.from("decision_logs").select("decision, created_at").eq("project_id", projectId)
        .order("created_at", { ascending: false }).limit(5),
    ]);

  let supplierNames: string[] = [];
  if (assignments?.length) {
    const { data: suppliers } = await admin.from("suppliers").select("id, name")
      .in("id", assignments.map((a: any) => a.supplier_id));
    supplierNames = (suppliers ?? []).map((s: any) => s.name);
  }

  const facts: ProjectFacts = {
    project_id: project.id,
    name: project.name,
    status: project.status,
    payment_gate_status: project.payment_gate_status,
    calculation_rate: estimate?.client_calculation_rate ?? null,
    currency: estimate?.currency ?? null,
    billing_unit: "hour",
    target_margin_percent: estimate?.target_margin_percent ?? null,
    estimate_version: estimate?.version ?? null,
    estimate_status: estimate?.status ?? null,
    fixed_price_approved: Boolean(estimate?.final_fixed_price),
    budget_range: estimate ? [estimate.estimated_budget_min, estimate.estimated_budget_max] : null,
    requested_completion_date: schedule?.requested_completion_date ?? null,
    approved_delivery_date: schedule?.approved_delivery_date ?? null,
    target_date_status: schedule?.target_date_status ?? null,
    assigned_suppliers: supplierNames,
    pending_approvals: (approvals ?? []).filter((a: any) => a.status !== "approved").map((a: any) => a.type),
    payments: (payments ?? []).map((p: any) => `${p.currency ?? ""}${p.amount}:${p.status}`),
    recent_decisions: (decisions ?? []).map((d: any) => d.decision),
  };

  return { label: project.name, facts };
}

/** Refreshes the cached fact sheet and returns a compact text block for the prompt. */
export async function refreshProjectFacts(admin: any, projectId: string): Promise<string> {
  const built = await buildProjectFacts(admin, projectId);
  if (!built) return "";
  await admin.from("copilot_entity_facts").upsert({
    entity_type: "project",
    entity_id: projectId,
    label: built.label,
    facts: built.facts,
    refreshed_at: new Date().toISOString(),
  }, { onConflict: "entity_type,entity_id" });
  return `--- PROJECT FACT SHEET (authoritative, from the database) ---\n${JSON.stringify(built.facts)}`;
}