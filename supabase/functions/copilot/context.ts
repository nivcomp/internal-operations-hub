/**
 * Server-side, role-filtered context for the copilot.
 * The browser may only say WHERE the user is. Everything the model is told about
 * an entity is re-read here and filtered by the caller's role.
 */

export type Role = "agency_admin" | "client" | "supplier";

export type ScreenHint = {
  page?: string;
  entityType?: "project" | "client" | "supplier" | "estimate" | "form" | "none";
  entityId?: string | null;
  projectId?: string | null;
  clientId?: string | null;
  supplierId?: string | null;
  label?: string;
  formSection?: string;
  fields?: { name: string; label?: string; filled?: boolean; required?: boolean; value?: string }[];
  errors?: string[];
  missing?: string[];
  visibleActions?: string[];
  notes?: string[];
};

export type Access = {
  projectId: string | null;
  project: any | null;
  clientId: string | null;
  client: any | null;
  supplierId: string | null;
  supplier: any | null;
  scopeKey: string;
};

const str = (v: unknown, max = 200) => String(v ?? "").slice(0, max);

function isUuid(v: unknown): v is string {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

/** Resolves and AUTHORIZES the entities the browser claims to be showing. */
export async function resolveAccess(admin: any, profile: any, hint: ScreenHint): Promise<Access> {
  const role: Role = profile.role;
  let project: any = null;
  let client: any = null;
  let supplier: any = null;

  const wantProject = isUuid(hint.projectId) ? hint.projectId
    : hint.entityType === "project" && isUuid(hint.entityId) ? hint.entityId : null;
  const wantClient = isUuid(hint.clientId) ? hint.clientId
    : hint.entityType === "client" && isUuid(hint.entityId) ? hint.entityId : null;
  const wantSupplier = isUuid(hint.supplierId) ? hint.supplierId
    : hint.entityType === "supplier" && isUuid(hint.entityId) ? hint.entityId : null;

  if (wantProject) {
    const { data } = await admin.from("projects").select("*").eq("id", wantProject).maybeSingle();
    if (data) {
      if (role === "agency_admin") project = data;
      else if (role === "client" && data.client_id === profile.client_id) project = data;
      else if (role === "supplier" && profile.supplier_id) {
        const { data: link } = await admin.from("project_supplier_assignments")
          .select("id").eq("project_id", data.id).eq("supplier_id", profile.supplier_id).maybeSingle();
        if (link) project = data;
      }
    }
  }

  const clientId = wantClient ?? project?.client_id ?? null;
  if (clientId && role !== "supplier") {
    if (role === "agency_admin" || clientId === profile.client_id) {
      const { data } = await admin.from("clients").select("*").eq("id", clientId).maybeSingle();
      client = data ?? null;
    }
  }

  const supplierId = wantSupplier ?? (role === "supplier" ? profile.supplier_id : null);
  if (supplierId && role !== "client") {
    if (role === "agency_admin" || supplierId === profile.supplier_id) {
      const { data } = await admin.from("suppliers").select("*").eq("id", supplierId).maybeSingle();
      supplier = data ?? null;
    }
  }

  const scopeKey = project ? `project:${project.id}`
    : client ? `client:${client.id}`
    : supplier ? `supplier:${supplier.id}`
    : `page:${str(hint.page ?? "global", 40)}`;

  return {
    projectId: project?.id ?? null, project,
    clientId: client?.id ?? null, client,
    supplierId: supplier?.id ?? null, supplier,
    scopeKey,
  };
}

/** Short label shown in the copilot header ("Helping with …"). */
export function contextLabel(access: Access, hint: ScreenHint): string {
  if (access.project) return `Helping with ${access.project.name}`;
  if (access.client) return `Helping with ${access.client.company || access.client.name}`;
  if (access.supplier) return `Helping with ${access.supplier.name}`;
  if (hint.formSection) return `Helping you complete ${hint.formSection}`;
  return hint.label ? `Helping with ${hint.label}` : "Helping you in the workspace";
}

async function projectLines(admin: any, role: Role, project: any, supplierId: string | null) {
  const lines: string[] = [];
  lines.push(`Project: ${project.name} (status: ${project.status})`);
  if (project.summary) lines.push(`Summary: ${str(project.summary, 800)}`);
  lines.push(`Payment gate: ${project.payment_gate_status ?? "unknown"}`);

  const [{ data: schedule }, { data: assignments }, { data: changes }] = await Promise.all([
    admin.from("project_schedule").select("*").eq("project_id", project.id).maybeSingle(),
    admin.from("project_supplier_assignments").select("supplier_id, status").eq("project_id", project.id),
    admin.from("change_requests").select("title, status").eq("project_id", project.id).limit(10),
  ]);

  if (schedule) {
    lines.push(`Requested completion date: ${schedule.requested_completion_date ?? "none requested"} (priority ${schedule.date_priority ?? "flexible"}, status ${schedule.target_date_status ?? "unknown"})`);
    if (role === "agency_admin") {
      lines.push(`Delivery planning: earliest start ${schedule.earliest_start_date ?? "not set"}, weekly capacity ${schedule.weekly_capacity_hours ?? "not set"}h, recommended window ${schedule.recommended_delivery_start ?? "?"} → ${schedule.recommended_delivery_end ?? "?"}, approved date ${schedule.approved_delivery_date ?? "not approved"}`);
    } else if (schedule.approved_delivery_date) {
      lines.push(`Approved delivery date: ${schedule.approved_delivery_date}`);
    }
  } else {
    lines.push("Delivery schedule: no schedule record yet.");
  }

  for (const c of changes ?? []) lines.push(`Change request: ${str(c.title)} (${c.status})`);

  const { data: estimates } = await admin.from("project_estimates").select("*")
    .eq("project_id", project.id).order("version", { ascending: false }).limit(1);
  const est = (estimates ?? [])[0];
  if (!est) {
    lines.push("Estimate: none yet.");
  } else if (role === "agency_admin") {
    lines.push(`Estimate v${est.version} (${est.status}): total estimated effort ${est.estimated_hours_min ?? 0}–${est.estimated_hours_max ?? 0} hours, client rate ${est.client_calculation_rate ?? "NOT SET"} ${est.currency ?? ""}, target margin ${est.target_margin_percent ?? "not set"}%, internal cost rate ${est.yaniv_internal_hourly_cost ?? "not set"}, client visible: ${est.client_visible ? "yes" : "no"}, fixed price ${est.final_fixed_price ?? "none"}`);
    if (!est.client_calculation_rate) lines.push("WARNING: this project has no client calculation rate yet.");
  } else if (role === "client") {
    lines.push(est.client_visible
      ? `Estimate: ${est.estimated_hours_min ?? 0}–${est.estimated_hours_max ?? 0} hours have been published to you (${est.status})${est.final_fixed_price != null && est.approved_by_yaniv ? `; approved fixed price ${est.currency ?? ""} ${est.final_fixed_price}` : ""}.`
      : "Estimate: the agency is still preparing it; no numbers may be shared.");
  } else {
    lines.push("Estimate: only your assigned items and your own rate are visible to you.");
  }

  if (est) {
    const { data: estimateItems } = await admin.from("estimate_items")
      .select("title,client_visible_label,project_phase,estimated_hours_min,estimated_hours_max,client_visible,client_optional,selected_by_client")
      .eq("estimate_id", est.id).order("sort_order").limit(80);
    const selected = (estimateItems ?? []).filter((item: any) => !item.client_optional || item.selected_by_client);
    const min = selected.reduce((sum: number, item: any) => sum + Number(item.estimated_hours_min || 0), 0);
    const max = selected.reduce((sum: number, item: any) => sum + Number(item.estimated_hours_max || 0), 0);
    lines.push(`Estimate item total from selected/included work: ${min}–${max} hours across ${selected.length} items.`);
    for (const item of selected) {
      if (role === "client" && !item.client_visible) continue;
      lines.push(`Estimate item [${item.project_phase}]: ${str(role === "client" ? item.client_visible_label || item.title : item.title)} — ${item.estimated_hours_min}–${item.estimated_hours_max} hours${item.client_optional ? " (optional, selected)" : ""}.`);
    }
  }

  let prototypeQuery = admin.from("prototype_versions")
    .select("id,version,status,audience,title,summary,content,created_at,project_prototypes(title,prototype_kind)")
    .eq("project_id", project.id).order("version", { ascending: false }).limit(1);
  if (role === "client") prototypeQuery = prototypeQuery.eq("audience", "client").in("status", ["shared", "approved"]);
  if (role === "supplier") prototypeQuery = prototypeQuery.eq("audience", "supplier").in("status", ["shared", "approved"]);
  const { data: prototypeVersions } = await prototypeQuery;
  const prototypeVersion = (prototypeVersions ?? [])[0] as any;
  if (!prototypeVersion) {
    lines.push("MVP: no version visible to this role for this project.");
  } else {
    const screens = Array.isArray(prototypeVersion.content?.screens) ? prototypeVersion.content.screens : [];
    const entities = Array.isArray(prototypeVersion.content?.dataModel) ? prototypeVersion.content.dataModel : [];
    const automations = Array.isArray(prototypeVersion.content?.automations) ? prototypeVersion.content.automations : [];
    lines.push(`MVP EXISTS: v${prototypeVersion.version} (${prototypeVersion.status}, audience ${prototypeVersion.audience}), type ${(prototypeVersion.project_prototypes as any)?.prototype_kind ?? "unknown"}, title "${str(prototypeVersion.title, 160)}", summary: ${str(prototypeVersion.summary, 1000)}.`);
    lines.push(`MVP structure: ${screens.length} screens [${screens.map((screen: any) => str(screen.title, 80)).join("; ")}], ${entities.length} data entities, ${automations.length} automations.`);
    for (const screen of screens.slice(0, 20)) {
      const blocks = Array.isArray(screen.blocks) ? screen.blocks : [];
      const actions = Array.isArray(screen.actions) ? screen.actions : [];
      lines.push(`MVP screen: ${str(screen.title, 120)} — blocks [${blocks.slice(0, 16).map((block: any) => `${str(block.type, 30)}:${str(block.label, 80)}`).join("; ")}], actions [${actions.slice(0, 10).map((action: any) => str(action.label, 80)).join("; ")}].`);
    }
  }

  const { data: meetingCharges } = await admin.from("meeting_time_charges")
    .select("billable_hours,actual_minutes").eq("project_id", project.id).limit(100);
  const discoveryHours = (meetingCharges ?? []).reduce((sum: number, charge: any) => sum + Number(charge.billable_hours || 0), 0);
  const discoveryActualHours = (meetingCharges ?? []).reduce((sum: number, charge: any) => sum + Number(charge.actual_minutes || 0), 0) / 60;
  if (role === "agency_admin") lines.push(`Discovery time recorded so far: ${discoveryHours} billable hours (${Math.round(discoveryActualHours * 100) / 100} actual hours) across ${(meetingCharges ?? []).length} meetings.`);

  if (role === "agency_admin") {
    const { data: spentEntries } = await admin.from("supplier_time_entries")
      .select("hours,status").eq("project_id", project.id).limit(500);
    const spent = (spentEntries ?? []).reduce((sum: number, entry: any) => sum + Number(entry.hours || 0), 0);
    const approvedSpent = (spentEntries ?? []).filter((entry: any) => entry.status === "approved")
      .reduce((sum: number, entry: any) => sum + Number(entry.hours || 0), 0);
    lines.push(`Supplier work logged so far: ${spent} total hours, ${approvedSpent} approved hours.`);
  }

  if (role === "agency_admin") {
    lines.push(`Assigned suppliers: ${(assignments ?? []).length}`);
    const { data: payments } = await admin.from("client_payments")
      .select("amount, currency, status").eq("project_id", project.id).limit(10);
    for (const p of payments ?? []) lines.push(`Client payment: ${p.currency ?? ""} ${p.amount} (${p.status})`);
  }

  if (role === "supplier" && supplierId) {
    const { data: entries } = await admin.from("supplier_time_entries")
      .select("entry_date, hours, status").eq("project_id", project.id).eq("supplier_id", supplierId).limit(15);
    for (const e of entries ?? []) lines.push(`Your time entry ${e.entry_date}: ${e.hours}h (${e.status})`);
    lines.push("Client price, client budget and agency margin are deliberately excluded and must never be stated.");
  }

  if (role === "client") {
    lines.push("Supplier cost, supplier rates, agency margin and internal notes are deliberately excluded and must never be stated.");
  }
  return lines;
}

/** Builds the full role-filtered context block sent to the model. */
export async function buildCopilotContext(
  admin: any, profile: any, access: Access, hint: ScreenHint,
): Promise<string> {
  const role: Role = profile.role;
  const lines: string[] = [];

  lines.push("--- WHO ---");
  lines.push(`User: ${str(profile.full_name || profile.email || "user", 80)} | role: ${role}`);

  lines.push("--- CURRENT SCREEN ---");
  lines.push(`Page: ${str(hint.page ?? "unknown", 60)}`);
  if (hint.label) lines.push(`Screen label: ${str(hint.label, 120)}`);
  if (hint.formSection) lines.push(`Open form section: ${str(hint.formSection, 120)}`);
  for (const n of (hint.notes ?? []).slice(0, 12)) lines.push(`Screen note: ${str(n, 300)}`);
  if (hint.visibleActions?.length) lines.push(`Actions visible on screen: ${hint.visibleActions.slice(0, 12).map((a) => str(a, 40)).join(", ")}`);
  if (hint.missing?.length) lines.push(`Missing on screen: ${hint.missing.slice(0, 12).map((m) => str(m, 80)).join("; ")}`);
  if (hint.errors?.length) lines.push(`Validation errors on screen: ${hint.errors.slice(0, 12).map((m) => str(m, 120)).join("; ")}`);
  for (const f of (hint.fields ?? []).slice(0, 25)) {
    lines.push(`Form field "${str(f.name, 60)}"${f.label ? ` (${str(f.label, 60)})` : ""}: ${f.filled ? `filled = ${str(f.value, 120)}` : "empty"}${f.required ? " [required]" : ""}`);
  }

  if (access.client) {
    lines.push("--- CLIENT ---");
    lines.push(`Client: ${str(access.client.company || access.client.name)} (status ${access.client.status ?? "unknown"})`);
    if (role === "agency_admin" && access.client.notes) lines.push(`Internal client notes: ${str(access.client.notes, 600)}`);
    const { data: projects } = await admin.from("projects")
      .select("id, name, status").eq("client_id", access.client.id).limit(20);
    for (const p of projects ?? []) lines.push(`Client project: ${p.name} (${p.status}) [id ${p.id}]`);
    if (role === "agency_admin" && !access.project && (projects ?? []).length <= 3) {
      for (const projectRef of projects ?? []) {
        const { data: fullProject } = await admin.from("projects").select("*").eq("id", projectRef.id).maybeSingle();
        if (!fullProject) continue;
        lines.push(`--- CLIENT PROJECT DETAILS: ${fullProject.name} ---`);
        lines.push(...await projectLines(admin, role, fullProject, null));
      }
    }
  }

  if (access.supplier) {
    lines.push("--- SUPPLIER ---");
    lines.push(`Supplier: ${str(access.supplier.name)} (status ${access.supplier.status ?? "unknown"}, country ${access.supplier.country ?? "?"})`);
    const { data: sp } = await admin.from("supplier_profiles")
      .select("main_skills, tools, hourly_rate, currency, weekly_availability_hours")
      .eq("supplier_id", access.supplier.id).maybeSingle();
    if (sp) {
      lines.push(`Supplier profile: skills ${(sp.main_skills ?? []).join(", ") || "none"}, rate ${sp.currency ?? ""} ${sp.hourly_rate ?? "not set"}, availability ${sp.weekly_availability_hours ?? "not set"}h/week`);
      if (!sp.weekly_availability_hours) lines.push("WARNING: supplier availability is missing.");
      if (!sp.hourly_rate) lines.push("WARNING: supplier hourly rate is missing.");
    } else {
      lines.push("Supplier profile: not completed yet.");
    }
  }

  if (access.project) {
    lines.push("--- PROJECT ---");
    lines.push(...await projectLines(admin, role, access.project, access.supplierId));
  }

  if (!access.project && role === "agency_admin") {
    lines.push("--- WORKLOAD ---");
    const [{ data: projects }, { data: crs }, { data: times }] = await Promise.all([
      admin.from("projects").select("id, name, status").order("updated_at", { ascending: false }).limit(15),
      admin.from("change_requests").select("title, status").eq("status", "submitted").limit(10),
      admin.from("supplier_time_entries").select("id").eq("status", "submitted").limit(50),
    ]);
    for (const p of projects ?? []) lines.push(`Project: ${p.name} (${p.status}) [id ${p.id}]`);
    for (const c of crs ?? []) lines.push(`Change request awaiting review: ${str(c.title)}`);
    lines.push(`Time entries awaiting approval: ${(times ?? []).length}`);
  }

  if (!access.project && role === "client" && profile.client_id) {
    const { data: projects } = await admin.from("projects")
      .select("id, name, status").eq("client_id", profile.client_id).limit(20);
    lines.push("--- YOUR PROJECTS ---");
    for (const p of projects ?? []) lines.push(`Project: ${p.name} (${p.status}) [id ${p.id}]`);
  }

  if (!access.project && role === "supplier" && profile.supplier_id) {
    const { data: links } = await admin.from("project_supplier_assignments")
      .select("project_id, status").eq("supplier_id", profile.supplier_id).limit(20);
    lines.push("--- YOUR ASSIGNED WORK ---");
    for (const l of links ?? []) {
      const { data: p } = await admin.from("projects").select("id, name, status").eq("id", l.project_id).maybeSingle();
      if (p) lines.push(`Assigned project: ${p.name} (${p.status}) [id ${p.id}] assignment ${l.status}`);
    }
  }

  return lines.join("\n");
}

/** Ids the copilot is allowed to reference in navigation chips. */
export async function allowedTargets(admin: any, profile: any) {
  const role: Role = profile.role;
  const projects = new Set<string>();
  const clients = new Set<string>();
  const suppliers = new Set<string>();

  if (role === "agency_admin") {
    const [{ data: p }, { data: c }, { data: s }] = await Promise.all([
      admin.from("projects").select("id").limit(500),
      admin.from("clients").select("id").limit(500),
      admin.from("suppliers").select("id").limit(500),
    ]);
    for (const r of p ?? []) projects.add(r.id);
    for (const r of c ?? []) clients.add(r.id);
    for (const r of s ?? []) suppliers.add(r.id);
  } else if (role === "client" && profile.client_id) {
    clients.add(profile.client_id);
    const { data: p } = await admin.from("projects").select("id").eq("client_id", profile.client_id);
    for (const r of p ?? []) projects.add(r.id);
  } else if (role === "supplier" && profile.supplier_id) {
    suppliers.add(profile.supplier_id);
    const { data: l } = await admin.from("project_supplier_assignments").select("project_id").eq("supplier_id", profile.supplier_id);
    for (const r of l ?? []) projects.add(r.project_id);
  }
  return { projects, clients, suppliers };
}
/**
 * System-wide snapshot for Operator Mode. Agency admins only — it deliberately
 * contains internal pricing and margin, which no other role may ever receive.
 */
export async function buildOperatorSnapshot(admin: any): Promise<string> {
  const lines: string[] = ["--- SYSTEM SNAPSHOT (agency-wide, internal) ---"];
  const [
    { data: projects }, { data: clients }, { data: suppliers }, { data: assignments },
    { data: payments }, { data: times }, { data: schedules }, { data: estimates },
    { data: changes }, { data: activity },
  ] = await Promise.all([
    admin.from("projects").select("id, name, status, client_id, payment_gate_status, archived_at, updated_at")
      .order("updated_at", { ascending: false }).limit(80),
    admin.from("clients").select("id, name, company, status, archived_at").limit(120),
    admin.from("suppliers").select("id, name, status, archived_at").limit(120),
    admin.from("project_supplier_assignments").select("project_id, supplier_id").limit(300),
    admin.from("payments").select("project_id, amount, currency, status, due_date").limit(200),
    admin.from("supplier_time_entries").select("id, project_id, supplier_id, hours, status").eq("status", "submitted").limit(200),
    admin.from("project_schedule").select("project_id, requested_completion_date, approved_delivery_date, target_date_status").limit(200),
    admin.from("project_estimates").select("project_id, version, client_calculation_rate, target_margin_percent, estimated_budget_min, estimated_budget_max, internal_cost, status, final_fixed_price").limit(200),
    admin.from("change_requests").select("project_id, title, status").limit(100),
    admin.from("activity_logs").select("label, detail, created_at").order("created_at", { ascending: false }).limit(15),
  ]);

  const clientById = new Map((clients ?? []).map((c: any) => [c.id, c]));
  const supplierById = new Map((suppliers ?? []).map((s: any) => [s.id, s]));
  const assignedByProject = new Map<string, string[]>();
  for (const a of assignments ?? []) {
    const list = assignedByProject.get(a.project_id) ?? [];
    list.push(str(supplierById.get(a.supplier_id)?.name ?? "unknown", 60));
    assignedByProject.set(a.project_id, list);
  }
  const scheduleByProject = new Map((schedules ?? []).map((s: any) => [s.project_id, s]));
  const estimateByProject = new Map<string, any>();
  for (const e of estimates ?? []) {
    const current = estimateByProject.get(e.project_id);
    if (!current || Number(e.version) > Number(current.version)) estimateByProject.set(e.project_id, e);
  }

  lines.push(`Clients: ${(clients ?? []).length} | Suppliers: ${(suppliers ?? []).length} | Projects: ${(projects ?? []).length}`);
  for (const p of projects ?? []) {
    const client = clientById.get(p.client_id);
    const sch = scheduleByProject.get(p.id);
    const est = estimateByProject.get(p.id);
    const pays = (payments ?? []).filter((x: any) => x.project_id === p.id);
    const parts = [
      `Project "${str(p.name)}" [id ${p.id}]`,
      `client ${str(client?.company || client?.name || "unknown", 60)}${client ? ` [id ${client.id}]` : ""}`,
      `status ${p.status}`,
      `payment gate ${p.payment_gate_status}`,
      `suppliers ${(assignedByProject.get(p.id) ?? []).join(", ") || "NONE"}`,
    ];
    if (p.archived_at) parts.push("ARCHIVED");
    if (sch?.requested_completion_date) parts.push(`requested ${sch.requested_completion_date} (${sch.target_date_status})`);
    if (sch?.approved_delivery_date) parts.push(`approved delivery ${sch.approved_delivery_date}`);
    if (est) {
      parts.push(`estimate v${est.version} rate ${est.client_calculation_rate ?? "NOT SET"} margin target ${est.target_margin_percent ?? "?"}% budget ${est.estimated_budget_min ?? "?"}-${est.estimated_budget_max ?? "?"} internal cost ${est.internal_cost ?? "?"}${est.final_fixed_price ? " FIXED PRICE APPROVED" : ""}`);
    } else parts.push("no estimate yet");
    if (pays.length) parts.push(`payments ${pays.map((x: any) => `${x.currency ?? ""}${x.amount}:${x.status}`).join(", ")}`);
    else parts.push("no payment record");
    lines.push(parts.join(" | "));
  }
  for (const c of clients ?? []) {
    lines.push(`Client "${str(c.company || c.name)}" [id ${c.id}] status ${c.status}${c.archived_at ? " ARCHIVED" : ""}`);
  }
  for (const s of suppliers ?? []) {
    lines.push(`Supplier "${str(s.name)}" [id ${s.id}] status ${s.status}${s.archived_at ? " ARCHIVED" : ""}`);
  }
  const submittedHours = (times ?? []).reduce((sum: number, t: any) => sum + Number(t.hours ?? 0), 0);
  lines.push(`Time awaiting approval: ${(times ?? []).length} entries, ${submittedHours}h`);
  for (const cr of changes ?? []) lines.push(`Change request "${str(cr.title)}" (${cr.status}) on project ${cr.project_id}`);
  lines.push("--- RECENT ACTIVITY ---");
  for (const a of activity ?? []) lines.push(`${str(a.created_at, 30)}: ${str(a.label, 80)} — ${str(a.detail, 200)}`);
  return lines.join("\n");
}
