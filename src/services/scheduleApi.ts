import { supabase } from "../integrations/supabase/client";
import { emptySchedule, type DatePriority, type ProjectSchedule, type TargetDateStatus } from "../lib/scheduling";

const db = supabase as any;

type Row = Record<string, any>;

function fail(context: string, error: { message?: string } | null): never {
  const message = error?.message ?? "Unknown database error";
  console.error(`[schedule] ${context} failed`, error);
  throw new Error(`${context}: ${message}`);
}

export function mapSchedule(row: Row): ProjectSchedule {
  return {
    id: row.id,
    projectId: row.project_id,
    requestedCompletionDate: row.requested_completion_date ?? null,
    datePriority: (row.date_priority ?? "flexible") as DatePriority,
    dateReason: row.date_reason ?? "",
    partialDeliveryOk: !!row.partial_delivery_ok,
    phaseOneDate: row.phase_one_date ?? null,
    targetDateStatus: (row.target_date_status ?? "no_date_requested") as TargetDateStatus,
    statusReason: row.status_reason ?? "",
    earliestStartDate: row.earliest_start_date ?? null,
    weeklyCapacityHours: Number(row.weekly_capacity_hours ?? 0),
    clientResponseDelayDays: Number(row.client_response_delay_days ?? 3),
    externalApprovalDelayDays: Number(row.external_approval_delay_days ?? 0),
    recommendedDeliveryStart: row.recommended_delivery_start ?? null,
    recommendedDeliveryEnd: row.recommended_delivery_end ?? null,
    approvedDeliveryDate: row.approved_delivery_date ?? null,
    supplierAvailabilityConfirmed: !!row.supplier_availability_confirmed,
    scopeChangedAfterDateApproval: !!row.scope_changed_after_date_approval,
    deliveryNotes: row.delivery_notes ?? "",
  };
}

function toRow(patch: Partial<ProjectSchedule>): Row {
  const row: Row = {};
  const set = (key: string, value: unknown) => { if (value !== undefined) row[key] = value; };
  set("requested_completion_date", patch.requestedCompletionDate === undefined ? undefined : patch.requestedCompletionDate || null);
  set("date_priority", patch.datePriority);
  set("date_reason", patch.dateReason);
  set("partial_delivery_ok", patch.partialDeliveryOk);
  set("phase_one_date", patch.phaseOneDate === undefined ? undefined : patch.phaseOneDate || null);
  set("target_date_status", patch.targetDateStatus);
  set("status_reason", patch.statusReason);
  set("earliest_start_date", patch.earliestStartDate === undefined ? undefined : patch.earliestStartDate || null);
  set("weekly_capacity_hours", patch.weeklyCapacityHours);
  set("client_response_delay_days", patch.clientResponseDelayDays);
  set("external_approval_delay_days", patch.externalApprovalDelayDays);
  set("recommended_delivery_start", patch.recommendedDeliveryStart === undefined ? undefined : patch.recommendedDeliveryStart || null);
  set("recommended_delivery_end", patch.recommendedDeliveryEnd === undefined ? undefined : patch.recommendedDeliveryEnd || null);
  set("approved_delivery_date", patch.approvedDeliveryDate === undefined ? undefined : patch.approvedDeliveryDate || null);
  set("supplier_availability_confirmed", patch.supplierAvailabilityConfirmed);
  set("scope_changed_after_date_approval", patch.scopeChangedAfterDateApproval);
  set("delivery_notes", patch.deliveryNotes);
  return row;
}

export async function fetchProjectSchedules(): Promise<ProjectSchedule[]> {
  const { data, error } = await db.from("project_schedule").select("*");
  if (error) fail("Load project schedules", error);
  return (data ?? []).map(mapSchedule);
}

/**
 * Creates the schedule row on first write and patches it afterwards. The database
 * trigger keeps agency-only columns untouched when a client saves.
 */
export async function saveProjectScheduleRow(projectId: string, patch: Partial<ProjectSchedule>): Promise<ProjectSchedule> {
  const { data: existing, error: readError } = await db
    .from("project_schedule").select("*").eq("project_id", projectId).maybeSingle();
  if (readError) fail("Load project schedule", readError);

  if (!existing) {
    const base = { ...emptySchedule(projectId), ...patch };
    const { data, error } = await db
      .from("project_schedule")
      .insert({ project_id: projectId, ...toRow(base) })
      .select("*")
      .single();
    if (error) fail("Create project schedule", error);
    return mapSchedule(data);
  }

  const row = toRow(patch);
  if (!Object.keys(row).length) return mapSchedule(existing);
  const { data, error } = await db
    .from("project_schedule").update(row).eq("project_id", projectId).select("*").single();
  if (error) fail("Save project schedule", error);
  return mapSchedule(data);
}

/** Minimal commercial rollup per project, used by dashboards and portals. */
export interface EstimateSummary {
  projectId: string;
  estimateId: string;
  version: number;
  status: string;
  currency: string;
  clientCalculationRate: number;
  showRateToClient: boolean;
  minimumBillingUnit: number;
  estimatedHoursMin: number;
  estimatedHoursMax: number;
  estimatedBudgetMin: number;
  estimatedBudgetMax: number;
  finalFixedPrice: number | null;
  targetMarginPercent: number;
  internalCost: number;
  clientVisible: boolean;
  approvedByYaniv: boolean;
}

export async function fetchEstimateSummaries(): Promise<EstimateSummary[]> {
  const { data, error } = await db
    .from("project_estimates")
    .select("id,project_id,version,status,currency,client_calculation_rate,show_hourly_rate_to_client,minimum_billing_unit,estimated_hours_min,estimated_hours_max,estimated_budget_min,estimated_budget_max,internal_cost,final_fixed_price,target_margin_percent,client_visible,approved_by_yaniv")
    .order("version", { ascending: false });
  if (error) fail("Load estimate summaries", error);
  const seen = new Set<string>();
  const out: EstimateSummary[] = [];
  for (const row of data ?? []) {
    if (row.status === "superseded" || seen.has(row.project_id)) continue;
    seen.add(row.project_id);
    out.push({
      projectId: row.project_id,
      estimateId: row.id,
      version: Number(row.version ?? 1),
      status: row.status,
      currency: row.currency ?? "GBP",
      clientCalculationRate: Number(row.client_calculation_rate ?? 0),
      showRateToClient: !!row.show_hourly_rate_to_client,
      minimumBillingUnit: Number(row.minimum_billing_unit ?? 0),
      estimatedHoursMin: Number(row.estimated_hours_min ?? 0),
      estimatedHoursMax: Number(row.estimated_hours_max ?? 0),
      estimatedBudgetMin: Number(row.estimated_budget_min ?? 0),
      estimatedBudgetMax: Number(row.estimated_budget_max ?? 0),
      finalFixedPrice: row.final_fixed_price == null ? null : Number(row.final_fixed_price),
      targetMarginPercent: Number(row.target_margin_percent ?? 0),
      internalCost: Number(row.internal_cost ?? 0),
      clientVisible: !!row.client_visible,
      approvedByYaniv: !!row.approved_by_yaniv,
    });
  }
  return out;
}
