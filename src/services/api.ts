import { supabase } from "../integrations/supabase/client";
import type {
  Approval,
  ChangeRequest,
  Client,
  ClientPayment,
  DecisionLog,
  FileLink,
  HourBank,
  PhasePricing,
  Project,
  ProjectBrief,
  ProjectMessage,
  ProjectPricing,
  ProjectStatus,
  Scope,
  ScopeItem,
  Supplier,
  SupplierPayment,
  SupplierProfile,
  SupplierSkillSuggestion,
  TimeEntry,
  UserRole,
  Visibility,
} from "../types/domain";

// ----- helpers ---------------------------------------------------------------
type Row = Record<string, any>;
const dateOnly = (v: unknown): string | undefined => {
  if (!v) return undefined;
  const s = String(v);
  return s.length >= 10 ? s.slice(0, 10) : s;
};
const asString = (v: unknown, fallback = ""): string => (v == null ? fallback : String(v));

// ----- mappers (row -> domain) ----------------------------------------------
export function mapClient(r: Row): Client {
  return {
    id: r.id,
    name: r.name,
    company: r.company,
    email: r.email,
    phone: r.phone ?? undefined,
    notes: r.notes ?? "",
    status: r.status as Client["status"],
  };
}
export function mapSupplier(r: Row): Supplier {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    phone: r.phone ?? undefined,
    country: r.country ?? "",
    timezone: r.timezone ?? "",
    status: r.status as Supplier["status"],
  };
}
export function mapSupplierProfile(r: Row): SupplierProfile {
  return {
    supplierId: r.supplier_id,
    languages: r.languages ?? [],
    mainSkills: r.main_skills ?? [],
    tools: r.tools ?? [],
    yearsOfExperience: Number(r.years_of_experience ?? 0),
    hourlyRate: Number(r.hourly_rate ?? 0),
    weeklyAvailabilityHours: Number(r.weekly_availability_hours ?? 0),
    portfolioLinks: r.portfolio_links ?? [],
    notes: r.notes ?? "",
  };
}
export function mapProject(r: Row, assignedSupplierIds: string[] = []): Project {
  return {
    id: r.id,
    clientId: r.client_id,
    name: r.name,
    status: r.status as ProjectStatus,
    summary: r.summary ?? "",
    budgetSignal: r.budget_signal ?? "",
    paymentGateStatus: r.payment_gate_status as Project["paymentGateStatus"],
    assignedSupplierIds,
    createdDate: dateOnly(r.created_at) ?? "",
    updatedDate: dateOnly(r.updated_at) ?? "",
  };
}
export function mapProjectBrief(r: Row): ProjectBrief {
  return {
    id: r.id,
    projectId: r.project_id,
    problemStatement: r.problem_statement ?? "",
    goals: r.goals ?? [],
    assumptions: r.assumptions ?? [],
    constraints: r.constraints ?? [],
    exclusions: r.exclusions ?? [],
    discoveryNotes: r.discovery_notes ?? "",
    aiDraftNotes: r.ai_draft_notes ?? "",
    finalAgencyNotes: r.final_agency_notes ?? "",
  };
}
export function mapScope(r: Row): Scope {
  return {
    id: r.id,
    projectId: r.project_id,
    version: Number(r.version ?? 1),
    status: r.status as Scope["status"],
    clientFacingSummary: r.client_facing_summary ?? "",
    internalDeliveryNotes: r.internal_delivery_notes ?? "",
    approvedDate: dateOnly(r.approved_date),
  };
}
export function mapScopeItem(r: Row): ScopeItem {
  return {
    id: r.id,
    scopeId: r.scope_id,
    title: r.title,
    description: r.description ?? "",
    phase: r.phase ?? "",
    clientVisible: !!r.client_visible,
    supplierVisible: !!r.supplier_visible,
    acceptanceNotes: r.acceptance_notes ?? "",
  };
}
export function mapProjectPricing(r: Row): ProjectPricing {
  return {
    id: r.id,
    projectId: r.project_id,
    currency: r.currency ?? "GBP",
    clientPrice: Number(r.client_price ?? 0),
    supplierCostEstimate: Number(r.supplier_cost_estimate ?? 0),
    targetMarginPercent: Number(r.target_margin_percent ?? 0),
    actualMarginPercent: Number(r.actual_margin_percent ?? 0),
    pricingNotes: r.pricing_notes ?? "",
  };
}
export function mapPhasePricing(r: Row): PhasePricing {
  return {
    id: r.id,
    pricingId: r.pricing_id,
    phaseName: r.phase_name,
    clientPrice: Number(r.client_price ?? 0),
    supplierCost: Number(r.supplier_cost ?? 0),
    notes: r.notes ?? "",
  };
}
export function mapApproval(r: Row): Approval {
  return {
    id: r.id,
    projectId: r.project_id,
    scopeId: r.scope_id,
    approverRole: r.approver_role as UserRole,
    status: r.status as Approval["status"],
    approvedDate: dateOnly(r.approved_date),
    notes: r.notes ?? "",
  };
}
export function mapChangeRequest(r: Row): ChangeRequest {
  return {
    id: r.id,
    projectId: r.project_id,
    requestedByClientId: r.requested_by_client_id,
    title: r.title,
    description: r.description ?? "",
    status: r.status as ChangeRequest["status"],
    agencyPrice: r.agency_price == null ? undefined : Number(r.agency_price),
    supplierCost: r.supplier_cost == null ? undefined : Number(r.supplier_cost),
    approvedDate: dateOnly(r.approved_date),
  };
}
export function mapTimeEntry(r: Row): TimeEntry {
  return {
    id: r.id,
    projectId: r.project_id,
    supplierId: r.supplier_id,
    date: dateOnly(r.entry_date) ?? "",
    hours: Number(r.hours ?? 0),
    description: r.description ?? "",
    status: r.status as TimeEntry["status"],
    approvedBy: r.approved_by ?? undefined,
  };
}
export function mapClientPayment(r: Row): ClientPayment {
  return {
    id: r.id,
    projectId: r.project_id,
    amount: Number(r.amount ?? 0),
    currency: r.currency ?? "GBP",
    status: r.status as ClientPayment["status"],
    dueDate: dateOnly(r.due_date),
    receivedDate: dateOnly(r.received_date),
    notes: r.notes ?? "",
  };
}
export function mapSupplierPayment(r: Row): SupplierPayment {
  return {
    id: r.id,
    supplierId: r.supplier_id,
    projectId: r.project_id,
    amountOwed: Number(r.amount_owed ?? 0),
    amountPaid: Number(r.amount_paid ?? 0),
    currency: r.currency ?? "GBP",
    status: r.status as SupplierPayment["status"],
  };
}
export function mapHourBank(r: Row): HourBank {
  return {
    id: r.id,
    clientId: r.client_id,
    projectId: r.project_id ?? undefined,
    hoursPurchased: Number(r.hours_purchased ?? 0),
    hoursUsed: Number(r.hours_used ?? 0),
    hoursRemaining: Number(r.hours_remaining ?? 0),
    expiryDate: dateOnly(r.expiry_date),
  };
}
export function mapProjectMessage(r: Row): ProjectMessage {
  return {
    id: r.id,
    projectId: r.project_id,
    authorRole: r.author_role as UserRole,
    body: r.body ?? "",
    visibility: r.visibility as Visibility,
    createdDate: dateOnly(r.created_at) ?? "",
  };
}
export function mapDecisionLog(r: Row): DecisionLog {
  return {
    id: r.id,
    projectId: r.project_id,
    decision: r.decision,
    madeByRole: r.made_by_role as UserRole,
    impact: r.impact ?? "",
    createdDate: dateOnly(r.created_at) ?? "",
  };
}
export function mapFileLink(r: Row): FileLink {
  return {
    id: r.id,
    projectId: r.project_id,
    title: r.title,
    url: r.url,
    fileType: r.file_type as FileLink["fileType"],
    visibility: r.visibility as Visibility,
    addedBy: r.added_by as UserRole,
  };
}
export function mapSkillSuggestion(r: Row): SupplierSkillSuggestion {
  return {
    id: r.id,
    supplierId: r.supplier_id,
    suggestedSkill: r.suggested_skill,
    sourceText: r.source_text ?? "",
    status: r.status as SupplierSkillSuggestion["status"],
    reviewedBy: r.reviewed_by ?? undefined,
  };
}

// ----- fetchers --------------------------------------------------------------
async function selectAll(table: string): Promise<Row[]> {
  const { data, error } = await (supabase as any).from(table).select("*");
  if (error) {
    console.error(`[api] select ${table} failed`, error);
    return [];
  }
  return (data as Row[]) ?? [];
}

export async function fetchClients(): Promise<Client[]> {
  return (await selectAll("clients")).map(mapClient);
}
export async function fetchSuppliers(): Promise<Supplier[]> {
  return (await selectAll("suppliers")).map(mapSupplier);
}
export async function fetchSupplierProfiles(): Promise<SupplierProfile[]> {
  return (await selectAll("supplier_profiles")).map(mapSupplierProfile);
}
export async function fetchProjects(): Promise<Project[]> {
  const [rows, assignments] = await Promise.all([
    selectAll("projects"),
    selectAll("project_supplier_assignments"),
  ]);
  const byProject = new Map<string, string[]>();
  for (const a of assignments) {
    const list = byProject.get(a.project_id) ?? [];
    list.push(a.supplier_id);
    byProject.set(a.project_id, list);
  }
  return rows.map((r) => mapProject(r, byProject.get(r.id) ?? []));
}
export async function fetchProjectBriefs(): Promise<ProjectBrief[]> {
  return (await selectAll("project_briefs")).map(mapProjectBrief);
}
export async function fetchScopes(): Promise<Scope[]> {
  return (await selectAll("scopes")).map(mapScope);
}
export async function fetchScopeItems(): Promise<ScopeItem[]> {
  return (await selectAll("scope_items")).map(mapScopeItem);
}
export async function fetchProjectPricing(): Promise<ProjectPricing[]> {
  return (await selectAll("project_pricing")).map(mapProjectPricing);
}
export async function fetchPhasePricing(): Promise<PhasePricing[]> {
  return (await selectAll("phase_pricing")).map(mapPhasePricing);
}
export async function fetchApprovals(): Promise<Approval[]> {
  return (await selectAll("approvals")).map(mapApproval);
}
export async function fetchChangeRequests(): Promise<ChangeRequest[]> {
  return (await selectAll("change_requests")).map(mapChangeRequest);
}
export async function fetchTimeEntries(): Promise<TimeEntry[]> {
  return (await selectAll("supplier_time_entries")).map(mapTimeEntry);
}
export async function fetchClientPayments(): Promise<ClientPayment[]> {
  return (await selectAll("payments")).map(mapClientPayment);
}
export async function fetchSupplierPayments(): Promise<SupplierPayment[]> {
  return (await selectAll("supplier_payments")).map(mapSupplierPayment);
}
export async function fetchHourBanks(): Promise<HourBank[]> {
  return (await selectAll("paid_hours")).map(mapHourBank);
}
export async function fetchProjectMessages(): Promise<ProjectMessage[]> {
  return (await selectAll("project_messages")).map(mapProjectMessage);
}
export async function fetchDecisionLogs(): Promise<DecisionLog[]> {
  return (await selectAll("decision_logs")).map(mapDecisionLog);
}
export async function fetchFileLinks(): Promise<FileLink[]> {
  return (await selectAll("files")).map(mapFileLink);
}
export async function fetchSkillSuggestions(): Promise<SupplierSkillSuggestion[]> {
  return (await selectAll("supplier_skill_suggestions")).map(mapSkillSuggestion);
}

export type ActivityLogRow = {
  id: string;
  createdAt: string;
  label: string;
  detail: string;
};
function mapActivityLog(r: Row): ActivityLogRow {
  return {
    id: r.id,
    createdAt: new Date(r.created_at).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" }),
    label: r.label,
    detail: r.detail,
  };
}
export async function fetchActivityLogs(limit = 20): Promise<ActivityLogRow[]> {
  const { data, error } = await (supabase as any)
    .from("activity_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) { console.error("[api] fetchActivityLogs", error); throw error; }
  return ((data as Row[]) ?? []).map(mapActivityLog);
}

// ----- mutations -------------------------------------------------------------
const client = supabase as any;

function fail(op: string, error: unknown): never {
  console.error(`[api] ${op} failed`, error);
  const msg =
    (error && typeof error === "object" && "message" in error && (error as { message?: string }).message) ||
    `Database error during ${op}.`;
  throw new Error(String(msg));
}

export async function createClientRow(input: Omit<Client, "id">): Promise<Client> {
  const { data, error } = await client
    .from("clients")
    .insert({
      name: input.name,
      company: input.company,
      email: input.email,
      phone: input.phone ?? null,
      notes: input.notes ?? "",
      status: input.status,
    })
    .select("*")
    .single();
  if (error || !data) fail("createClient", error);
  return mapClient(data);
}

export async function createProjectRow(input: {
  clientId: string;
  name: string;
  summary: string;
  budgetSignal: string;
}): Promise<Project> {
  const { data, error } = await client
    .from("projects")
    .insert({
      client_id: input.clientId,
      name: input.name,
      summary: input.summary,
      budget_signal: input.budgetSignal,
      status: "discovery_in_progress",
      payment_gate_status: "blocked",
    })
    .select("*")
    .single();
  if (error || !data) fail("createProject", error);
  return mapProject(data);
}

export async function updateProjectRow(id: string, patch: Partial<{ status: ProjectStatus; paymentGateStatus: Project["paymentGateStatus"] }>): Promise<void> {
  const dbPatch: Row = {};
  if (patch.status !== undefined) dbPatch.status = patch.status;
  if (patch.paymentGateStatus !== undefined) dbPatch.payment_gate_status = patch.paymentGateStatus;
  const { error } = await client.from("projects").update(dbPatch).eq("id", id);
  if (error) fail("updateProject", error);
}

export async function createChangeRequestRow(input: {
  projectId: string;
  clientId: string;
  title: string;
  description: string;
  agencyPrice?: number;
  supplierCost?: number;
}): Promise<ChangeRequest> {
  const { data, error } = await client
    .from("change_requests")
    .insert({
      project_id: input.projectId,
      requested_by_client_id: input.clientId,
      title: input.title,
      description: input.description,
      status: "agency_review",
      agency_price: input.agencyPrice ?? null,
      supplier_cost: input.supplierCost ?? null,
    })
    .select("*")
    .single();
  if (error || !data) fail("createChangeRequest", error);
  return mapChangeRequest(data);
}

export async function updateChangeRequestStatusRow(
  id: string,
  status: "priced" | "client_approved" | "declined",
): Promise<void> {
  const patch: Row = { status };
  if (status === "client_approved") patch.approved_date = new Date().toISOString().slice(0, 10);
  const { error } = await client.from("change_requests").update(patch).eq("id", id);
  if (error) fail("updateChangeRequestStatus", error);
}

export async function createTimeEntryRow(input: {
  projectId: string;
  supplierId: string;
  date: string;
  hours: number;
  description: string;
}): Promise<TimeEntry> {
  const { data, error } = await client
    .from("supplier_time_entries")
    .insert({
      project_id: input.projectId,
      supplier_id: input.supplierId,
      entry_date: input.date,
      hours: input.hours,
      description: input.description,
      status: "submitted",
    })
    .select("*")
    .single();
  if (error || !data) fail("createTimeEntry", error);
  return mapTimeEntry(data);
}

export async function updateTimeEntryStatusRow(id: string, status: "approved" | "rejected"): Promise<void> {
  const { error } = await client
    .from("supplier_time_entries")
    .update({
      status,
      approved_by: status === "approved" ? "user-yaniv" : null,
    })
    .eq("id", id);
  if (error) fail("updateTimeEntryStatus", error);
}

export async function createClientPaymentRow(input: {
  projectId: string;
  amount: number;
  dueDate?: string;
  notes: string;
}): Promise<ClientPayment> {
  const { data, error } = await client
    .from("payments")
    .insert({
      project_id: input.projectId,
      amount: input.amount,
      currency: "GBP",
      status: "requested",
      due_date: input.dueDate || null,
      notes: input.notes,
    })
    .select("*")
    .single();
  if (error || !data) fail("createClientPayment", error);
  return mapClientPayment(data);
}

export async function markClientPaymentReceivedRow(id: string): Promise<string> {
  const receivedDate = new Date().toISOString().slice(0, 10);
  const { error } = await client
    .from("payments")
    .update({ status: "received", received_date: receivedDate })
    .eq("id", id)
    .select("*")
    .single();
  if (error) fail("markPaymentReceived", error);
  return receivedDate;
}

export async function setProjectSupplierAssignmentRow(projectId: string, supplierId: string, assigned: boolean): Promise<void> {
  if (assigned) {
    const { error } = await client
      .from("project_supplier_assignments")
      .upsert({ project_id: projectId, supplier_id: supplierId }, { onConflict: "project_id,supplier_id" });
    if (error) fail("assignSupplier", error);
  } else {
    const { error } = await client
      .from("project_supplier_assignments")
      .delete()
      .eq("project_id", projectId)
      .eq("supplier_id", supplierId);
    if (error) fail("unassignSupplier", error);
  }
}

export async function recordActivityRow(label: string, detail: string): Promise<ActivityLogRow> {
  const { data, error } = await client
    .from("activity_logs")
    .insert({ label, detail })
    .select("*")
    .single();
  if (error || !data) fail("recordActivity", error);
  return mapActivityLog(data);
}

// unused fallback to satisfy asString import lint
void asString;