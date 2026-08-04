/**
 * Operator Mode action catalog (agency_admin only).
 *
 * The model may only name an action from this catalog and supply typed inputs.
 * Every action is resolved, validated, risk-classified and previewed here, then
 * executed by `runOperatorAction` — never by AI-authored SQL. Each execution
 * writes an audit record and an activity log entry.
 */

export type Risk = "low" | "medium" | "high";
export type TargetType = "client" | "project" | "supplier" | "payment" | "time_entry" | "none";

export interface OperatorCtx {
  admin: any;
  profile: any;
  authHeader: string;
  supabaseUrl: string;
  source: "text" | "voice" | "chip";
  command: string;
}

export interface Built {
  targetId: string | null;
  targetLabel: string;
  payload: Record<string, unknown>;
  summary: string;
  risk: Risk;
  preview: {
    fields: { label: string; current?: string; proposed?: string }[];
    impact?: string[];
    related?: string[];
    recommendation?: string;
  };
}

export type BuildResult = Built | { error: string; choices?: { id: string; label: string }[] };

interface Spec {
  label: string;
  risk: Risk;
  targetType: TargetType;
  build: (ctx: OperatorCtx, input: any) => Promise<BuildResult>;
  execute: (ctx: OperatorCtx, built: Built) => Promise<{ summary: string; previous?: unknown; next?: unknown }>;
}

const text = (v: unknown, max = 200) => String(v ?? "").trim().slice(0, max);
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : null);
const isUuid = (v: unknown): v is string =>
  typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const isDate = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const now = () => new Date().toISOString();

const PROJECT_STATUSES = [
  "lead_started", "discovery_in_progress", "waiting_for_agency_pricing", "pricing_set", "brief_ready",
  "scope_ready", "waiting_for_client_approval", "approved_by_client", "waiting_for_payment",
  "paid_ready_to_start", "assigned_to_supplier", "in_development", "change_requested",
  "change_priced", "change_approved", "completed",
];

const ESTIMATE_SETTING_RANGES: Record<string, [number, number]> = {
  client_calculation_rate: [0, 100000],
  yaniv_internal_hourly_cost: [0, 100000],
  external_costs: [0, 10000000],
  target_margin_percent: [0, 95],
  risk_buffer_percent: [0, 100],
  management_buffer_percent: [0, 100],
  testing_buffer_percent: [0, 100],
  contingency_percent: [0, 100],
};

// ------------------------------------------------------------------ resolvers

async function resolveOne(
  ctx: OperatorCtx, table: string, input: any, idKeys: string[], nameCols: string[],
  labelOf: (row: any) => string,
) {
  for (const key of idKeys) {
    if (isUuid(input?.[key])) {
      const { data } = await ctx.admin.from(table).select("*").eq("id", input[key]).maybeSingle();
      if (data) return { row: data } as const;
      return { error: "That record no longer exists." } as const;
    }
  }
  const needle = text(input?.name ?? input?.query ?? input?.target ?? "", 120);
  if (!needle) return { error: "Tell me which record this is about." } as const;
  const or = nameCols.map((c) => `${c}.ilike.%${needle}%`).join(",");
  const { data } = await ctx.admin.from(table).select("*").or(or).limit(6);
  const rows = data ?? [];
  if (rows.length === 0) return { error: `I could not find "${needle}".` } as const;
  if (rows.length > 1) {
    return {
      error: `More than one record matches "${needle}". Which one?`,
      choices: rows.map((r: any) => ({ id: r.id, label: labelOf(r) })),
    } as const;
  }
  return { row: rows[0] } as const;
}

const clientLabel = (c: any) => text(c?.company || c?.name || "client", 80);
const projectLabel = (p: any) => text(p?.name || "project", 80);
const supplierLabel = (s: any) => text(s?.name || "supplier", 80);

const resolveClient = (ctx: OperatorCtx, i: any) =>
  resolveOne(ctx, "clients", i, ["clientId", "id"], ["company", "name", "email"], clientLabel);
const resolveProject = (ctx: OperatorCtx, i: any) =>
  resolveOne(ctx, "projects", i, ["projectId", "id"], ["name"], projectLabel);
const resolveSupplier = (ctx: OperatorCtx, i: any) =>
  resolveOne(ctx, "suppliers", i, ["supplierId", "id"], ["name", "email"], supplierLabel);

/** Counts the history that would be lost by a permanent delete. */
async function dependencies(ctx: OperatorCtx, kind: "client" | "project" | "supplier", id: string) {
  const out: string[] = [];
  const count = async (table: string, column: string, label: string) => {
    const { count: c } = await ctx.admin.from(table).select("id", { count: "exact", head: true }).eq(column, id);
    if (c) out.push(`${c} ${label}`);
    return c ?? 0;
  };
  let total = 0;
  if (kind === "client") {
    total += await count("projects", "client_id", "projects");
    total += await count("paid_hours", "client_id", "paid-hour balances");
    total += await count("profiles", "client_id", "linked user accounts");
  } else if (kind === "supplier") {
    total += await count("project_supplier_assignments", "supplier_id", "project assignments");
    total += await count("supplier_time_entries", "supplier_id", "time entries");
    total += await count("supplier_payments", "supplier_id", "supplier payments");
    total += await count("profiles", "supplier_id", "linked user accounts");
  } else {
    total += await count("project_supplier_assignments", "project_id", "supplier assignments");
    total += await count("payments", "project_id", "payments");
    total += await count("supplier_time_entries", "project_id", "time entries");
    total += await count("chat_messages", "project_id", "chat messages");
    total += await count("project_estimates", "project_id", "estimates");
  }
  return { total, lines: out };
}

// ------------------------------------------------------------------ helpers

function built(partial: Partial<Built> & { summary: string; risk: Risk }): Built {
  return {
    targetId: partial.targetId ?? null,
    targetLabel: partial.targetLabel ?? "",
    payload: partial.payload ?? {},
    preview: partial.preview ?? { fields: [] },
    summary: partial.summary,
    risk: partial.risk,
  };
}

async function callFunction(ctx: OperatorCtx, name: string, body: unknown) {
  const res = await fetch(`${ctx.supabaseUrl}/functions/v1/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: ctx.authHeader },
    body: JSON.stringify(body),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok || payload?.error) {
    throw new Error(String(payload?.error ?? `Request failed [${res.status}]`).slice(0, 300));
  }
  return payload;
}

async function updateRow(ctx: OperatorCtx, table: string, id: string, patch: Record<string, unknown>) {
  const { data, error } = await ctx.admin.from(table).update(patch).eq("id", id).select("*").maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function insertRow(ctx: OperatorCtx, table: string, row: Record<string, unknown>) {
  const { data, error } = await ctx.admin.from(table).insert(row).select("*").maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/** Latest live estimate for a project. */
async function liveEstimate(ctx: OperatorCtx, projectId: string) {
  const { data } = await ctx.admin.from("project_estimates").select("*")
    .eq("project_id", projectId).order("version", { ascending: false }).limit(1).maybeSingle();
  return data ?? null;
}

// ------------------------------------------------------------------ catalog

export const OPERATOR_ACTIONS: Record<string, Spec> = {
  // ---------------------------------------------------------------- clients
  "client.create": {
    label: "Create client", risk: "medium", targetType: "client",
    async build(_ctx, input) {
      const name = text(input?.contactName ?? input?.name, 120);
      const company = text(input?.company ?? input?.name, 120);
      if (!company && !name) return { error: "I need at least a client or company name." };
      const email = text(input?.email, 160).toLowerCase();
      return built({
        summary: `Create client ${company || name}`, risk: "medium", targetLabel: company || name,
        payload: { name: name || company, company: company || name, email, phone: text(input?.phone, 40), notes: text(input?.notes, 1000) },
        preview: { fields: [
          { label: "Client / company", proposed: company || name },
          { label: "Contact", proposed: name || "—" },
          { label: "Email", proposed: email || "—" },
        ] },
      });
    },
    async execute(ctx, b) {
      const row = await insertRow(ctx, "clients", { ...b.payload, status: "lead" });
      return { summary: `Client "${clientLabel(row)}" created.`, next: row };
    },
  },

  "client.update": {
    label: "Edit client", risk: "medium", targetType: "client",
    async build(ctx, input) {
      const found = await resolveClient(ctx, input);
      if ("error" in found) return found;
      const patch: Record<string, unknown> = {};
      for (const key of ["name", "company", "email", "phone", "notes"]) {
        if (input?.[key] !== undefined && text(input[key], 1000) !== "") patch[key] = text(input[key], 1000);
      }
      if (input?.status && ["lead", "active", "paused"].includes(String(input.status))) patch.status = String(input.status);
      if (!Object.keys(patch).length) return { error: "Tell me what to change on this client." };
      return built({
        summary: `Update ${clientLabel(found.row)}`, risk: "medium",
        targetId: found.row.id, targetLabel: clientLabel(found.row), payload: patch,
        preview: { fields: Object.entries(patch).map(([k, v]) => ({ label: k, current: text(found.row[k], 80) || "—", proposed: text(v, 80) })) },
      });
    },
    async execute(ctx, b) {
      const previous = (await ctx.admin.from("clients").select("*").eq("id", b.targetId).maybeSingle()).data;
      const row = await updateRow(ctx, "clients", b.targetId!, b.payload);
      return { summary: `Client "${clientLabel(row)}" updated.`, previous, next: row };
    },
  },

  "client.archive": {
    label: "Archive client", risk: "high", targetType: "client",
    async build(ctx, input) {
      const found = await resolveClient(ctx, input);
      if ("error" in found) return found;
      const deps = await dependencies(ctx, "client", found.row.id);
      return built({
        summary: `Archive ${clientLabel(found.row)}`, risk: "high",
        targetId: found.row.id, targetLabel: clientLabel(found.row), payload: {},
        preview: {
          fields: [{ label: "Status", current: text(found.row.status), proposed: "paused (archived)" }],
          related: deps.lines,
          impact: ["History is kept. The client stays visible in reports and can be restored."],
        },
      });
    },
    async execute(ctx, b) {
      const row = await updateRow(ctx, "clients", b.targetId!, { archived_at: now(), status: "paused" });
      return { summary: `Client "${clientLabel(row)}" archived.`, next: row };
    },
  },

  "client.restore": {
    label: "Restore client", risk: "medium", targetType: "client",
    async build(ctx, input) {
      const found = await resolveClient(ctx, input);
      if ("error" in found) return found;
      return built({
        summary: `Restore ${clientLabel(found.row)}`, risk: "medium",
        targetId: found.row.id, targetLabel: clientLabel(found.row), payload: {},
        preview: { fields: [{ label: "Status", current: "archived", proposed: "active" }] },
      });
    },
    async execute(ctx, b) {
      const row = await updateRow(ctx, "clients", b.targetId!, { archived_at: null, status: "active" });
      return { summary: `Client "${clientLabel(row)}" restored.`, next: row };
    },
  },

  "client.delete": {
    label: "Permanently delete client", risk: "high", targetType: "client",
    async build(ctx, input) {
      const found = await resolveClient(ctx, input);
      if ("error" in found) return found;
      const deps = await dependencies(ctx, "client", found.row.id);
      if (deps.total > 0) {
        return {
          error: `${clientLabel(found.row)} is linked to ${deps.lines.join(", ")}. Permanent deletion would damage history — archive instead.`,
        };
      }
      return built({
        summary: `Permanently delete ${clientLabel(found.row)}`, risk: "high",
        targetId: found.row.id, targetLabel: clientLabel(found.row), payload: {},
        preview: { fields: [{ label: "Record", current: clientLabel(found.row), proposed: "deleted" }], impact: ["No linked history was found, so deletion is safe."] },
      });
    },
    async execute(ctx, b) {
      const previous = (await ctx.admin.from("clients").select("*").eq("id", b.targetId).maybeSingle()).data;
      const { error } = await ctx.admin.from("clients").delete().eq("id", b.targetId);
      if (error) throw new Error(error.message);
      return { summary: `Client "${b.targetLabel}" deleted.`, previous };
    },
  },

  "client.invite": {
    label: "Invite client", risk: "medium", targetType: "client",
    async build(_ctx, input) {
      const email = text(input?.email, 160).toLowerCase();
      const contactName = text(input?.contactName ?? input?.name, 120);
      const company = text(input?.company, 120) || contactName;
      if (!email.includes("@")) return { error: "I need a valid email address to send the invitation." };
      if (!contactName) return { error: "I need the contact's name for the invitation." };
      return built({
        summary: `Invite ${contactName} (${email})`, risk: "medium", targetLabel: company,
        payload: { email, contactName, company, phone: text(input?.phone, 40) },
        preview: { fields: [
          { label: "Email", proposed: email }, { label: "Contact", proposed: contactName },
          { label: "Company", proposed: company },
        ], impact: ["An invitation email and a secure onboarding link are created."] },
      });
    },
    async execute(ctx, b) {
      const res = await callFunction(ctx, "access-admin", { action: "quickInviteClient", ...b.payload });
      return { summary: `Client invitation created${res.emailed ? " and emailed" : ""}.`, next: { link: res.link, clientId: res.clientId } };
    },
  },

  "client.resend_invitation": {
    label: "Resend client invitation", risk: "medium", targetType: "client",
    async build(ctx, input) {
      const email = text(input?.email, 160).toLowerCase();
      if (!email.includes("@")) return { error: "Which email address should I resend the invitation to?" };
      const { data } = await ctx.admin.from("onboarding_invitations").select("*").ilike("email", email).limit(1);
      const invitation = (data ?? [])[0];
      if (!invitation) return { error: `No invitation exists for ${email} yet.` };
      return built({
        summary: `Resend invitation to ${email}`, risk: "medium", targetLabel: email,
        payload: { email, role: invitation.role, contactName: invitation.contact_name, company: invitation.company, phone: invitation.phone },
        preview: { fields: [{ label: "Email", proposed: email }, { label: "Role", proposed: invitation.role }] },
      });
    },
    async execute(ctx, b) {
      const isClient = b.payload.role !== "supplier";
      const res = await callFunction(ctx, "access-admin", {
        action: isClient ? "quickInviteClient" : "quickInviteSupplier", ...b.payload,
      });
      return { summary: `Invitation resent to ${b.payload.email}.`, next: { link: res.link } };
    },
  },

  "access.set_active": {
    label: "Enable or disable account access", risk: "high", targetType: "none",
    async build(ctx, input) {
      const email = text(input?.email, 160).toLowerCase();
      const active = input?.active !== false;
      if (!email.includes("@")) return { error: "Which account (email) should I change?" };
      const { data: profile } = await ctx.admin.from("profiles").select("id, email, role, is_active").ilike("email", email).maybeSingle();
      if (!profile) return { error: `No account exists for ${email}.` };
      if (profile.id === ctx.profile.id) return { error: "You cannot disable your own account." };
      return built({
        summary: `${active ? "Enable" : "Disable"} access for ${email}`, risk: "high", targetLabel: email,
        payload: { id: profile.id, active },
        preview: { fields: [{ label: "Access", current: profile.is_active ? "enabled" : "disabled", proposed: active ? "enabled" : "disabled" }] },
      });
    },
    async execute(ctx, b) {
      await updateRow(ctx, "profiles", String(b.payload.id), { is_active: b.payload.active === true });
      return { summary: `Access ${b.payload.active ? "enabled" : "disabled"} for ${b.targetLabel}.`, next: b.payload };
    },
  },

  // --------------------------------------------------------------- projects
  "project.create": {
    label: "Create project", risk: "medium", targetType: "project",
    async build(ctx, input) {
      const name = text(input?.name ?? input?.projectName, 160);
      if (!name) return { error: "What should the project be called?" };
      const found = await resolveClient(ctx, { clientId: input?.clientId, name: input?.clientName ?? input?.client });
      if ("error" in found) return found;
      return built({
        summary: `Create project "${name}" for ${clientLabel(found.row)}`, risk: "medium", targetLabel: name,
        payload: { name, client_id: found.row.id, summary: text(input?.summary, 2000), budget_signal: text(input?.budgetSignal, 200) },
        preview: { fields: [
          { label: "Project", proposed: name }, { label: "Client", proposed: clientLabel(found.row) },
          { label: "Status", proposed: "lead_started" },
        ] },
      });
    },
    async execute(ctx, b) {
      const row = await insertRow(ctx, "projects", { ...b.payload, status: "lead_started", payment_gate_status: "blocked" });
      await insertRow(ctx, "project_schedule", { project_id: row.id, target_date_status: "no_date_requested" });
      return { summary: `Project "${row.name}" created.`, next: row };
    },
  },

  "project.update": {
    label: "Edit project", risk: "medium", targetType: "project",
    async build(ctx, input) {
      const found = await resolveProject(ctx, input);
      if ("error" in found) return found;
      const patch: Record<string, unknown> = {};
      for (const key of ["name", "summary", "budget_signal"]) {
        if (input?.[key] !== undefined && text(input[key], 2000)) patch[key] = text(input[key], 2000);
      }
      if (!Object.keys(patch).length) return { error: "Tell me what to change on this project." };
      return built({
        summary: `Update ${projectLabel(found.row)}`, risk: "medium",
        targetId: found.row.id, targetLabel: projectLabel(found.row), payload: patch,
        preview: { fields: Object.entries(patch).map(([k, v]) => ({ label: k, current: text(found.row[k], 80) || "—", proposed: text(v, 80) })) },
      });
    },
    async execute(ctx, b) {
      const previous = (await ctx.admin.from("projects").select("*").eq("id", b.targetId).maybeSingle()).data;
      const row = await updateRow(ctx, "projects", b.targetId!, b.payload);
      return { summary: `Project "${row.name}" updated.`, previous, next: row };
    },
  },

  "project.set_status": {
    label: "Change project status", risk: "high", targetType: "project",
    async build(ctx, input) {
      const found = await resolveProject(ctx, input);
      if ("error" in found) return found;
      const status = text(input?.status, 60);
      if (!PROJECT_STATUSES.includes(status)) return { error: `"${status}" is not a valid project status.` };
      const impact: string[] = [];
      if (status === "paid_ready_to_start" || status === "assigned_to_supplier" || status === "in_development") {
        const [{ data: scopes }, { data: payments }, { data: hours }] = await Promise.all([
          ctx.admin.from("scopes").select("status").eq("project_id", found.row.id),
          ctx.admin.from("payments").select("status").eq("project_id", found.row.id),
          ctx.admin.from("paid_hours").select("hours_remaining").eq("client_id", found.row.client_id),
        ]);
        const approvedScope = (scopes ?? []).some((s: any) => s.status === "approved");
        const paid = (payments ?? []).some((p: any) => p.status === "received");
        const bank = (hours ?? []).some((h: any) => Number(h.hours_remaining) > 0);
        if (!approvedScope) return { error: "Work cannot start: no approved scope exists for this project yet." };
        if (!paid && !bank) return { error: "Work cannot start: no payment has been received and no paid hours are available." };
        impact.push("Approved scope and payment or paid hours were verified.");
      }
      return built({
        summary: `Set ${projectLabel(found.row)} to ${status}`, risk: "high",
        targetId: found.row.id, targetLabel: projectLabel(found.row), payload: { status },
        preview: { fields: [{ label: "Status", current: text(found.row.status), proposed: status }], impact },
      });
    },
    async execute(ctx, b) {
      const previous = (await ctx.admin.from("projects").select("status").eq("id", b.targetId).maybeSingle()).data;
      const row = await updateRow(ctx, "projects", b.targetId!, { status: b.payload.status });
      await insertRow(ctx, "decision_logs", {
        project_id: row.id, decision: `Status set to ${row.status}`, made_by_role: "agency_admin",
        impact: "Changed through Copilot Operator Mode.",
      });
      return { summary: `Project "${row.name}" is now ${row.status}.`, previous, next: { status: row.status } };
    },
  },

  "project.archive": {
    label: "Archive project", risk: "high", targetType: "project",
    async build(ctx, input) {
      const found = await resolveProject(ctx, input);
      if ("error" in found) return found;
      const deps = await dependencies(ctx, "project", found.row.id);
      return built({
        summary: `Archive ${projectLabel(found.row)}`, risk: "high",
        targetId: found.row.id, targetLabel: projectLabel(found.row), payload: {},
        preview: { fields: [{ label: "Archived", current: "no", proposed: "yes" }], related: deps.lines, impact: ["All history is kept and the project can be restored."] },
      });
    },
    async execute(ctx, b) {
      const row = await updateRow(ctx, "projects", b.targetId!, { archived_at: now() });
      return { summary: `Project "${row.name}" archived.`, next: row };
    },
  },

  "project.restore": {
    label: "Restore project", risk: "medium", targetType: "project",
    async build(ctx, input) {
      const found = await resolveProject(ctx, input);
      if ("error" in found) return found;
      return built({
        summary: `Restore ${projectLabel(found.row)}`, risk: "medium",
        targetId: found.row.id, targetLabel: projectLabel(found.row), payload: {},
        preview: { fields: [{ label: "Archived", current: "yes", proposed: "no" }] },
      });
    },
    async execute(ctx, b) {
      const row = await updateRow(ctx, "projects", b.targetId!, { archived_at: null });
      return { summary: `Project "${row.name}" restored.`, next: row };
    },
  },

  "project.duplicate": {
    label: "Duplicate project", risk: "medium", targetType: "project",
    async build(ctx, input) {
      const found = await resolveProject(ctx, input);
      if ("error" in found) return found;
      const name = text(input?.name, 160) || `${found.row.name} (copy)`;
      return built({
        summary: `Duplicate ${projectLabel(found.row)} as "${name}"`, risk: "medium",
        targetId: found.row.id, targetLabel: projectLabel(found.row), payload: { name },
        preview: { fields: [{ label: "New project", proposed: name }], impact: ["Copies the brief and summary. Estimates, payments and assignments are not copied."] },
      });
    },
    async execute(ctx, b) {
      const source = (await ctx.admin.from("projects").select("*").eq("id", b.targetId).maybeSingle()).data;
      const row = await insertRow(ctx, "projects", {
        client_id: source.client_id, name: b.payload.name, status: "lead_started",
        summary: source.summary, budget_signal: source.budget_signal, payment_gate_status: "blocked",
      });
      const brief = (await ctx.admin.from("project_briefs").select("*").eq("project_id", source.id).maybeSingle()).data;
      if (brief) {
        const { id, created_at, updated_at, project_id, ...rest } = brief;
        await insertRow(ctx, "project_briefs", { ...rest, project_id: row.id });
      }
      await insertRow(ctx, "project_schedule", { project_id: row.id, target_date_status: "no_date_requested" });
      return { summary: `Created "${row.name}" from ${source.name}.`, next: row };
    },
  },

  "project.set_requested_date": {
    label: "Set requested completion date", risk: "medium", targetType: "project",
    async build(ctx, input) {
      const found = await resolveProject(ctx, input);
      if ("error" in found) return found;
      const date = text(input?.date ?? input?.requestedDate, 20);
      if (!isDate(date)) return { error: "I need the date as YYYY-MM-DD." };
      const schedule = (await ctx.admin.from("project_schedule").select("*").eq("project_id", found.row.id).maybeSingle()).data;
      return built({
        summary: `Set requested completion date to ${date}`, risk: "medium",
        targetId: found.row.id, targetLabel: projectLabel(found.row), payload: { date, priority: text(input?.priority, 40) },
        preview: { fields: [{ label: "Requested date", current: schedule?.requested_completion_date ?? "none", proposed: date }], impact: ["The target date goes back to under review."] },
      });
    },
    async execute(ctx, b) {
      const patch: Record<string, unknown> = {
        project_id: b.targetId, requested_completion_date: b.payload.date, target_date_status: "under_review",
      };
      if (b.payload.priority) patch.date_priority = b.payload.priority;
      const previous = (await ctx.admin.from("project_schedule").select("*").eq("project_id", b.targetId).maybeSingle()).data;
      const { error } = await ctx.admin.from("project_schedule").upsert(patch, { onConflict: "project_id" });
      if (error) throw new Error(error.message);
      return { summary: `Requested completion date set to ${b.payload.date}.`, previous, next: patch };
    },
  },

  "project.set_approved_delivery_date": {
    label: "Set approved delivery date", risk: "high", targetType: "project",
    async build(ctx, input) {
      const found = await resolveProject(ctx, input);
      if ("error" in found) return found;
      const date = text(input?.date ?? input?.approvedDate, 20);
      if (!isDate(date)) return { error: "I need the date as YYYY-MM-DD." };
      const schedule = (await ctx.admin.from("project_schedule").select("*").eq("project_id", found.row.id).maybeSingle()).data;
      return built({
        summary: `Approve delivery date ${date}`, risk: "high",
        targetId: found.row.id, targetLabel: projectLabel(found.row), payload: { date },
        preview: {
          fields: [{ label: "Approved delivery date", current: schedule?.approved_delivery_date ?? "none", proposed: date }],
          impact: ["This is a client-facing commitment and becomes visible to the client."],
        },
      });
    },
    async execute(ctx, b) {
      const previous = (await ctx.admin.from("project_schedule").select("*").eq("project_id", b.targetId).maybeSingle()).data;
      const { error } = await ctx.admin.from("project_schedule").upsert({
        project_id: b.targetId, approved_delivery_date: b.payload.date, target_date_status: "approved",
      }, { onConflict: "project_id" });
      if (error) throw new Error(error.message);
      await insertRow(ctx, "decision_logs", {
        project_id: b.targetId, decision: `Approved delivery date ${b.payload.date}`,
        made_by_role: "agency_admin", impact: "Client-facing delivery commitment (Copilot Operator Mode).",
      });
      return { summary: `Approved delivery date set to ${b.payload.date}.`, previous, next: { approved_delivery_date: b.payload.date } };
    },
  },

  "project.set_calculation_rate": {
    label: "Set project calculation rate", risk: "high", targetType: "project",
    async build(ctx, input) {
      const found = await resolveProject(ctx, input);
      if ("error" in found) return found;
      const rate = num(input?.rate ?? input?.value ?? input?.hourlyRate ?? input?.hourly_rate ?? input?.client_calculation_rate);
      if (rate === null || rate < 0 || rate > 100000) return { error: "Give me the hourly calculation rate as a number." };
      const estimate = await liveEstimate(ctx, found.row.id);
      if (estimate?.final_fixed_price) return { error: "A fixed price is already approved; the rate can no longer be changed." };
      const currency = text(input?.currency, 8).toUpperCase() || String(estimate?.currency ?? "ILS").toUpperCase();
      if (!["ILS", "GBP", "USD", "EUR"].includes(currency)) {
        return { error: `I do not support the currency "${currency}". Use ILS, GBP, USD or EUR.` };
      }
      return built({
        summary: `Set calculation rate to ${currency} ${rate} per hour`, risk: "high",
        targetId: found.row.id, targetLabel: projectLabel(found.row),
        payload: { rate, currency, estimateId: estimate?.id ?? null },
        preview: {
          fields: [
            {
              label: "Client calculation rate",
              current: Number(estimate?.client_calculation_rate)
                ? `${estimate.currency ?? ""} ${estimate.client_calculation_rate} per hour`.trim()
                : "Not configured",
              proposed: `${currency} ${rate} per hour`,
            },
          ],
          impact: ["The project budget estimate will be recalculated from this rate."],
        },
      });
    },
    async execute(ctx, b) {
      let estimateId = b.payload.estimateId;
      if (!estimateId) {
        const { data, error } = await ctx.admin.from("project_estimates").insert({
          project_id: b.targetId, currency: b.payload.currency ?? "ILS",
        }).select("id").single();
        if (error) throw new Error(`Create estimate: ${error.message}`);
        estimateId = data.id;
      }
      const previous = (await ctx.admin.from("project_estimates")
        .select("client_calculation_rate, currency").eq("id", estimateId).maybeSingle()).data;
      const current = await liveEstimate(ctx, b.targetId);
      const rate = Number(b.payload.rate) || 0;
      const patch: Record<string, unknown> = {
        client_calculation_rate: rate,
        estimated_budget_min: Math.round((Number(current?.estimated_hours_min) || 0) * rate),
        estimated_budget_max: Math.round((Number(current?.estimated_hours_max) || 0) * rate),
      };
      if (b.payload.currency) patch.currency = b.payload.currency;
      const saved = await updateRow(ctx, "project_estimates", String(estimateId), patch);
      if (!saved) throw new Error("The estimate could not be updated — it may have been replaced.");
      return {
        summary: `Calculation rate set to ${saved.currency ?? ""} ${saved.client_calculation_rate} per hour.`.trim(),
        previous,
        next: { client_calculation_rate: saved.client_calculation_rate, currency: saved.currency },
      };
    },
  },

  "project.update_estimate_settings": {
    label: "Update estimate settings", risk: "high", targetType: "project",
    async build(ctx, input) {
      const found = await resolveProject(ctx, input);
      if ("error" in found) return found;
      const estimate = await liveEstimate(ctx, found.row.id);
      if (!estimate) return { error: "This project has no estimate yet." };
      if (estimate.final_fixed_price) return { error: "A fixed price is already approved; estimate settings are locked." };
      const patch: Record<string, number> = {};
      for (const [key, [min, max]] of Object.entries(ESTIMATE_SETTING_RANGES)) {
        const value = num(input?.[key]);
        if (value !== null) patch[key] = Math.min(Math.max(value, min), max);
      }
      if (!Object.keys(patch).length) return { error: "Tell me which estimate setting to change." };
      return built({
        summary: `Update estimate settings on ${projectLabel(found.row)}`, risk: "high",
        targetId: found.row.id, targetLabel: projectLabel(found.row), payload: { patch, estimateId: estimate.id },
        preview: {
          fields: Object.entries(patch).map(([k, v]) => ({ label: k, current: String(estimate[k] ?? "not set"), proposed: String(v) })),
          impact: ["Affects the client budget range and the internal margin."],
        },
      });
    },
    async execute(ctx, b) {
      const previous = (await ctx.admin.from("project_estimates").select("*").eq("id", b.payload.estimateId).maybeSingle()).data;
      await updateRow(ctx, "project_estimates", String(b.payload.estimateId), b.payload.patch as Record<string, unknown>);
      return { summary: "Estimate settings updated.", previous, next: b.payload.patch };
    },
  },

  "project.create_brief": {
    label: "Create or update project brief", risk: "medium", targetType: "project",
    async build(ctx, input) {
      const found = await resolveProject(ctx, input);
      if ("error" in found) return found;
      const problem = text(input?.problemStatement ?? input?.problem, 4000);
      if (!problem) return { error: "I need at least a problem statement for the brief." };
      const goals = Array.isArray(input?.goals) ? input.goals.map((g: unknown) => text(g, 500)).filter(Boolean).slice(0, 20) : [];
      return built({
        summary: `Write the brief for ${projectLabel(found.row)}`, risk: "medium",
        targetId: found.row.id, targetLabel: projectLabel(found.row),
        payload: { problem, goals, notes: text(input?.notes, 4000) },
        preview: { fields: [
          { label: "Problem statement", proposed: problem.slice(0, 160) },
          { label: "Goals", proposed: goals.join("; ").slice(0, 160) || "—" },
        ] },
      });
    },
    async execute(ctx, b) {
      const { error } = await ctx.admin.from("project_briefs").upsert({
        project_id: b.targetId, problem_statement: b.payload.problem,
        goals: b.payload.goals, discovery_notes: b.payload.notes,
      }, { onConflict: "project_id" });
      if (error) throw new Error(error.message);
      return { summary: "Project brief saved.", next: b.payload };
    },
  },

  // -------------------------------------------------------------- suppliers
  "supplier.create": {
    label: "Create supplier", risk: "medium", targetType: "supplier",
    async build(_ctx, input) {
      const name = text(input?.name, 120);
      if (!name) return { error: "What is the supplier's name?" };
      return built({
        summary: `Create supplier ${name}`, risk: "medium", targetLabel: name,
        payload: {
          name, email: text(input?.email, 160).toLowerCase(), phone: text(input?.phone, 40),
          country: text(input?.country, 80), timezone: text(input?.timezone, 60),
        },
        preview: { fields: [{ label: "Supplier", proposed: name }, { label: "Email", proposed: text(input?.email, 80) || "—" }] },
      });
    },
    async execute(ctx, b) {
      const row = await insertRow(ctx, "suppliers", { ...b.payload, status: "pending_review" });
      return { summary: `Supplier "${row.name}" created.`, next: row };
    },
  },

  "supplier.update": {
    label: "Edit supplier", risk: "medium", targetType: "supplier",
    async build(ctx, input) {
      const found = await resolveSupplier(ctx, input);
      if ("error" in found) return found;
      const patch: Record<string, unknown> = {};
      for (const key of ["name", "email", "phone", "country", "timezone"]) {
        if (input?.[key] !== undefined && text(input[key], 200)) patch[key] = text(input[key], 200);
      }
      if (input?.status && ["pending_review", "approved", "inactive"].includes(String(input.status))) patch.status = String(input.status);
      if (!Object.keys(patch).length) return { error: "Tell me what to change on this supplier." };
      return built({
        summary: `Update ${supplierLabel(found.row)}`, risk: "medium",
        targetId: found.row.id, targetLabel: supplierLabel(found.row), payload: patch,
        preview: { fields: Object.entries(patch).map(([k, v]) => ({ label: k, current: text(found.row[k], 80) || "—", proposed: text(v, 80) })) },
      });
    },
    async execute(ctx, b) {
      const previous = (await ctx.admin.from("suppliers").select("*").eq("id", b.targetId).maybeSingle()).data;
      const row = await updateRow(ctx, "suppliers", b.targetId!, b.payload);
      return { summary: `Supplier "${row.name}" updated.`, previous, next: row };
    },
  },

  "supplier.update_profile": {
    label: "Update supplier rate or availability", risk: "medium", targetType: "supplier",
    async build(ctx, input) {
      const found = await resolveSupplier(ctx, input);
      if ("error" in found) return found;
      const patch: Record<string, unknown> = {};
      const rate = num(input?.hourlyRate ?? input?.rate);
      const availability = num(input?.weeklyAvailability ?? input?.availability);
      if (rate !== null) patch.hourly_rate = Math.min(Math.max(rate, 0), 100000);
      if (availability !== null) patch.weekly_availability_hours = Math.min(Math.max(availability, 0), 168);
      if (input?.currency) patch.currency = text(input.currency, 8).toUpperCase();
      if (!Object.keys(patch).length) return { error: "Tell me the rate or availability to set." };
      const profile = (await ctx.admin.from("supplier_profiles").select("*").eq("supplier_id", found.row.id).maybeSingle()).data;
      return built({
        summary: `Update ${supplierLabel(found.row)}'s working terms`, risk: "medium",
        targetId: found.row.id, targetLabel: supplierLabel(found.row), payload: patch,
        preview: { fields: Object.entries(patch).map(([k, v]) => ({ label: k, current: String(profile?.[k] ?? "not set"), proposed: String(v) })) },
      });
    },
    async execute(ctx, b) {
      const previous = (await ctx.admin.from("supplier_profiles").select("*").eq("supplier_id", b.targetId).maybeSingle()).data;
      const { error } = await ctx.admin.from("supplier_profiles")
        .upsert({ supplier_id: b.targetId, ...b.payload }, { onConflict: "supplier_id" });
      if (error) throw new Error(error.message);
      return { summary: `Working terms updated for ${b.targetLabel}.`, previous, next: b.payload };
    },
  },

  "supplier.archive": {
    label: "Archive supplier", risk: "high", targetType: "supplier",
    async build(ctx, input) {
      const found = await resolveSupplier(ctx, input);
      if ("error" in found) return found;
      const deps = await dependencies(ctx, "supplier", found.row.id);
      return built({
        summary: `Archive ${supplierLabel(found.row)}`, risk: "high",
        targetId: found.row.id, targetLabel: supplierLabel(found.row), payload: {},
        preview: {
          fields: [{ label: "Status", current: text(found.row.status), proposed: "inactive (archived)" }],
          related: deps.lines,
          impact: ["History is preserved. Existing assignments are kept — remove them separately if needed."],
        },
      });
    },
    async execute(ctx, b) {
      const row = await updateRow(ctx, "suppliers", b.targetId!, { archived_at: now(), status: "inactive" });
      return { summary: `Supplier "${row.name}" archived.`, next: row };
    },
  },

  "supplier.restore": {
    label: "Restore supplier", risk: "medium", targetType: "supplier",
    async build(ctx, input) {
      const found = await resolveSupplier(ctx, input);
      if ("error" in found) return found;
      return built({
        summary: `Restore ${supplierLabel(found.row)}`, risk: "medium",
        targetId: found.row.id, targetLabel: supplierLabel(found.row), payload: {},
        preview: { fields: [{ label: "Status", current: "inactive (archived)", proposed: "approved" }] },
      });
    },
    async execute(ctx, b) {
      const row = await updateRow(ctx, "suppliers", b.targetId!, { archived_at: null, status: "approved" });
      return { summary: `Supplier "${row.name}" restored.`, next: row };
    },
  },

  "supplier.delete": {
    label: "Permanently delete supplier", risk: "high", targetType: "supplier",
    async build(ctx, input) {
      const found = await resolveSupplier(ctx, input);
      if ("error" in found) return found;
      const deps = await dependencies(ctx, "supplier", found.row.id);
      if (deps.total > 0) {
        return { error: `${supplierLabel(found.row)} is linked to ${deps.lines.join(", ")}. Permanent deletion would damage history — I recommend archiving instead.` };
      }
      return built({
        summary: `Permanently delete ${supplierLabel(found.row)}`, risk: "high",
        targetId: found.row.id, targetLabel: supplierLabel(found.row), payload: {},
        preview: { fields: [{ label: "Record", current: supplierLabel(found.row), proposed: "deleted" }], impact: ["No linked history was found, so deletion is safe."] },
      });
    },
    async execute(ctx, b) {
      const previous = (await ctx.admin.from("suppliers").select("*").eq("id", b.targetId).maybeSingle()).data;
      const { error } = await ctx.admin.from("suppliers").delete().eq("id", b.targetId);
      if (error) throw new Error(error.message);
      return { summary: `Supplier "${b.targetLabel}" deleted.`, previous };
    },
  },

  "supplier.invite": {
    label: "Invite supplier", risk: "medium", targetType: "supplier",
    async build(_ctx, input) {
      const email = text(input?.email, 160).toLowerCase();
      const contactName = text(input?.contactName ?? input?.name, 120);
      if (!email.includes("@")) return { error: "I need a valid email address for the supplier invitation." };
      if (!contactName) return { error: "I need the supplier's name." };
      return built({
        summary: `Invite supplier ${contactName}`, risk: "medium", targetLabel: contactName,
        payload: { email, contactName, phone: text(input?.phone, 40) },
        preview: { fields: [{ label: "Email", proposed: email }, { label: "Name", proposed: contactName }] },
      });
    },
    async execute(ctx, b) {
      const res = await callFunction(ctx, "access-admin", { action: "quickInviteSupplier", ...b.payload });
      return { summary: `Supplier invitation created${res.emailed ? " and emailed" : ""}.`, next: { link: res.link, supplierId: res.supplierId } };
    },
  },

  "supplier.assign": {
    label: "Assign supplier to project", risk: "medium", targetType: "project",
    async build(ctx, input) {
      const project = await resolveProject(ctx, { projectId: input?.projectId, name: input?.projectName ?? input?.project });
      if ("error" in project) return project;
      const supplier = await resolveSupplier(ctx, { supplierId: input?.supplierId, name: input?.supplierName ?? input?.supplier ?? input?.name });
      if ("error" in supplier) return supplier;
      const { data: existing } = await ctx.admin.from("project_supplier_assignments")
        .select("id").eq("project_id", project.row.id).eq("supplier_id", supplier.row.id).maybeSingle();
      if (existing) return { error: `${supplierLabel(supplier.row)} is already assigned to ${projectLabel(project.row)}.` };
      return built({
        summary: `Assign ${supplierLabel(supplier.row)} to ${projectLabel(project.row)}`, risk: "medium",
        targetId: project.row.id, targetLabel: projectLabel(project.row),
        payload: { projectId: project.row.id, supplierId: supplier.row.id, supplierName: supplierLabel(supplier.row) },
        preview: { fields: [
          { label: "Project", proposed: projectLabel(project.row) },
          { label: "Supplier", proposed: supplierLabel(supplier.row) },
        ], impact: ["The supplier gains access to the supplier-facing view of this project. Client price and margin stay hidden."] },
      });
    },
    async execute(ctx, b) {
      const row = await insertRow(ctx, "project_supplier_assignments", {
        project_id: b.payload.projectId, supplier_id: b.payload.supplierId,
      });
      return { summary: `${b.payload.supplierName} assigned to ${b.targetLabel}.`, next: row };
    },
  },

  "supplier.unassign": {
    label: "Remove supplier from project", risk: "high", targetType: "project",
    async build(ctx, input) {
      const project = await resolveProject(ctx, { projectId: input?.projectId, name: input?.projectName ?? input?.project });
      if ("error" in project) return project;
      const supplier = await resolveSupplier(ctx, { supplierId: input?.supplierId, name: input?.supplierName ?? input?.supplier ?? input?.name });
      if ("error" in supplier) return supplier;
      const { data: link } = await ctx.admin.from("project_supplier_assignments")
        .select("id").eq("project_id", project.row.id).eq("supplier_id", supplier.row.id).maybeSingle();
      if (!link) return { error: `${supplierLabel(supplier.row)} is not assigned to ${projectLabel(project.row)}.` };
      const { count: openTime } = await ctx.admin.from("supplier_time_entries")
        .select("id", { count: "exact", head: true })
        .eq("project_id", project.row.id).eq("supplier_id", supplier.row.id).eq("status", "submitted");
      return built({
        summary: `Remove ${supplierLabel(supplier.row)} from ${projectLabel(project.row)}`, risk: "high",
        targetId: project.row.id, targetLabel: projectLabel(project.row),
        payload: { linkId: link.id, supplierName: supplierLabel(supplier.row) },
        preview: {
          fields: [{ label: "Assignment", current: "active", proposed: "removed" }],
          related: openTime ? [`${openTime} time entries still awaiting approval`] : [],
          impact: ["The supplier immediately loses access to this project. Logged time is kept."],
        },
      });
    },
    async execute(ctx, b) {
      const { error } = await ctx.admin.from("project_supplier_assignments").delete().eq("id", b.payload.linkId);
      if (error) throw new Error(error.message);
      return { summary: `${b.payload.supplierName} removed from ${b.targetLabel}.`, previous: b.payload };
    },
  },

  // ------------------------------------------------------- payments & hours
  "payment.create_request": {
    label: "Create payment request", risk: "medium", targetType: "project",
    async build(ctx, input) {
      const project = await resolveProject(ctx, input);
      if ("error" in project) return project;
      const amount = num(input?.amount);
      if (amount === null || amount <= 0) return { error: "How much should the payment request be for?" };
      return built({
        summary: `Request ${amount} from ${projectLabel(project.row)}`, risk: "medium",
        targetId: project.row.id, targetLabel: projectLabel(project.row),
        payload: {
          amount, currency: text(input?.currency, 8).toUpperCase() || "GBP",
          dueDate: isDate(input?.dueDate) ? input.dueDate : null, notes: text(input?.notes, 500),
        },
        preview: { fields: [
          { label: "Amount", proposed: String(amount) },
          { label: "Due date", proposed: isDate(input?.dueDate) ? input.dueDate : "—" },
        ] },
      });
    },
    async execute(ctx, b) {
      const row = await insertRow(ctx, "payments", {
        project_id: b.targetId, amount: b.payload.amount, currency: b.payload.currency,
        status: "requested", due_date: b.payload.dueDate, notes: b.payload.notes,
      });
      return { summary: `Payment request for ${row.currency} ${row.amount} created.`, next: row };
    },
  },

  "payment.mark_received": {
    label: "Mark payment received", risk: "high", targetType: "payment",
    async build(ctx, input) {
      const project = await resolveProject(ctx, input);
      if ("error" in project) return project;
      const { data: payments } = await ctx.admin.from("payments").select("*")
        .eq("project_id", project.row.id).neq("status", "received").order("created_at").limit(6);
      const list = payments ?? [];
      if (!list.length) return { error: `No outstanding payment exists on ${projectLabel(project.row)}.` };
      const chosen = isUuid(input?.paymentId) ? list.find((p: any) => p.id === input.paymentId) : list.length === 1 ? list[0] : null;
      if (!chosen) {
        return {
          error: "Which payment should I mark as received?",
          choices: list.map((p: any) => ({ id: p.id, label: `${p.currency ?? ""} ${p.amount} (${p.status})` })),
        };
      }
      return built({
        summary: `Mark ${chosen.currency ?? ""} ${chosen.amount} as received`, risk: "high",
        targetId: chosen.id, targetLabel: `${projectLabel(project.row)} payment`,
        payload: { paymentId: chosen.id, projectId: project.row.id, amount: chosen.amount, currency: chosen.currency },
        preview: {
          fields: [{ label: "Payment status", current: text(chosen.status), proposed: "received" }],
          impact: ["Unblocks the payment gate on this project, so work may become ready to start."],
        },
      });
    },
    async execute(ctx, b) {
      const previous = (await ctx.admin.from("payments").select("*").eq("id", b.payload.paymentId).maybeSingle()).data;
      const row = await updateRow(ctx, "payments", String(b.payload.paymentId), {
        status: "received", received_date: new Date().toISOString().slice(0, 10),
      });
      await updateRow(ctx, "projects", String(b.payload.projectId), { payment_gate_status: "paid" });
      await insertRow(ctx, "decision_logs", {
        project_id: b.payload.projectId, decision: `Payment ${row.currency ?? ""} ${row.amount} marked received`,
        made_by_role: "agency_admin", impact: "Payment gate unblocked (Copilot Operator Mode).",
      });
      return { summary: `Payment ${row.currency ?? ""} ${row.amount} marked received.`, previous, next: row };
    },
  },

  "paid_hours.set": {
    label: "Create or update paid-hours balance", risk: "high", targetType: "client",
    async build(ctx, input) {
      const found = await resolveClient(ctx, input);
      if ("error" in found) return found;
      const purchased = num(input?.hoursPurchased ?? input?.hours);
      if (purchased === null || purchased < 0) return { error: "How many paid hours should the balance hold?" };
      const existing = (await ctx.admin.from("paid_hours").select("*").eq("client_id", found.row.id).maybeSingle()).data;
      return built({
        summary: `Set paid hours for ${clientLabel(found.row)} to ${purchased}`, risk: "high",
        targetId: found.row.id, targetLabel: clientLabel(found.row),
        payload: { purchased, id: existing?.id ?? null, used: Number(existing?.hours_used ?? 0) },
        preview: {
          fields: [{ label: "Hours purchased", current: String(existing?.hours_purchased ?? 0), proposed: String(purchased) }],
          impact: ["Paid hours can unblock work without a separate payment."],
        },
      });
    },
    async execute(ctx, b) {
      const used = Number(b.payload.used ?? 0);
      const purchased = Number(b.payload.purchased);
      const values = { hours_purchased: purchased, hours_used: used, hours_remaining: Math.max(purchased - used, 0) };
      if (b.payload.id) {
        const row = await updateRow(ctx, "paid_hours", String(b.payload.id), values);
        return { summary: `Paid-hour balance updated to ${purchased} hours.`, next: row };
      }
      const row = await insertRow(ctx, "paid_hours", { client_id: b.targetId, ...values });
      return { summary: `Paid-hour balance of ${purchased} hours created.`, next: row };
    },
  },

  "time.approve": {
    label: "Approve supplier time", risk: "high", targetType: "time_entry",
    async build(ctx, input) { return buildTimeDecision(ctx, input, "approve"); },
    async execute(ctx, b) {
      const ids = b.payload.ids as string[];
      const previous = (await ctx.admin.from("supplier_time_entries").select("*").in("id", ids)).data;
      const { error } = await ctx.admin.from("supplier_time_entries")
        .update({ status: "approved", approved_by: ctx.profile.id }).in("id", ids);
      if (error) throw new Error(error.message);
      return { summary: `${ids.length} time ${ids.length === 1 ? "entry" : "entries"} approved (${b.payload.hours}h).`, previous, next: { status: "approved" } };
    },
  },

  "time.reject": {
    label: "Reject supplier time", risk: "high", targetType: "time_entry",
    async build(ctx, input) { return buildTimeDecision(ctx, input, "reject"); },
    async execute(ctx, b) {
      const ids = b.payload.ids as string[];
      const previous = (await ctx.admin.from("supplier_time_entries").select("*").in("id", ids)).data;
      const { error } = await ctx.admin.from("supplier_time_entries")
        .update({ status: "rejected", approved_by: ctx.profile.id }).in("id", ids);
      if (error) throw new Error(error.message);
      return { summary: `${ids.length} time ${ids.length === 1 ? "entry" : "entries"} rejected.`, previous, next: { status: "rejected" } };
    },
  },

  // ------------------------------------------------------------- documents
  "document.generate": {
    label: "Generate document", risk: "medium", targetType: "project",
    async build(ctx, input) {
      const found = await resolveProject(ctx, input);
      if ("error" in found) return found;
      const docType = text(input?.docType, 60);
      const allowed = [
        "project_brief", "functional_spec", "technical_spec", "supplier_brief", "client_proposal",
        "internal_planning", "implementation_checklist", "meeting_summary", "change_request",
      ];
      if (!allowed.includes(docType)) return { error: `Which document should I generate? One of: ${allowed.join(", ")}.` };
      const language = /he|hebrew|עברית/i.test(String(input?.language ?? "")) ? "Hebrew" : "English";
      return built({
        summary: `Generate ${docType.replace(/_/g, " ")} (${language})`, risk: "medium",
        targetId: found.row.id, targetLabel: projectLabel(found.row),
        payload: { projectId: found.row.id, docType, language, notes: text(input?.notes, 1000) },
        preview: { fields: [
          { label: "Document", proposed: docType.replace(/_/g, " ") },
          { label: "Language", proposed: language },
          { label: "Audience", proposed: docType === "client_proposal" ? "client-safe" : docType === "supplier_brief" ? "supplier-safe" : "internal" },
        ], impact: ["The document is produced as a draft for your review; nothing is sent."] },
      });
    },
    async execute(ctx, b) {
      const res = await callFunction(ctx, "project-documents", b.payload);
      return { summary: `${String(b.payload.docType).replace(/_/g, " ")} draft ready.`, next: { markdown: String(res.markdown ?? res.content ?? "").slice(0, 20000) } };
    },
  },
};

async function buildTimeDecision(ctx: OperatorCtx, input: any, mode: "approve" | "reject"): Promise<BuildResult> {
  let query = ctx.admin.from("supplier_time_entries").select("*").eq("status", "submitted").limit(50);
  let scopeLabel = "all projects";
  if (isUuid(input?.entryId)) query = ctx.admin.from("supplier_time_entries").select("*").eq("id", input.entryId);
  else {
    if (input?.projectId || input?.projectName || input?.project) {
      const project = await resolveProject(ctx, { projectId: input?.projectId, name: input?.projectName ?? input?.project });
      if ("error" in project) return project;
      query = query.eq("project_id", project.row.id);
      scopeLabel = projectLabel(project.row);
    }
    if (input?.supplierId || input?.supplierName || input?.supplier) {
      const supplier = await resolveSupplier(ctx, { supplierId: input?.supplierId, name: input?.supplierName ?? input?.supplier });
      if ("error" in supplier) return supplier;
      query = query.eq("supplier_id", supplier.row.id);
      scopeLabel = `${supplierLabel(supplier.row)} on ${scopeLabel}`;
    }
  }
  const { data } = await query;
  const entries = (data ?? []).filter((e: any) => e.status === "submitted");
  if (!entries.length) return { error: "There is no submitted time matching that." };
  // A supplier may never approve their own time; the operator is always the agency owner.
  if (ctx.profile.supplier_id && entries.some((e: any) => e.supplier_id === ctx.profile.supplier_id)) {
    return { error: "You cannot approve your own time entries." };
  }
  const hours = entries.reduce((sum: number, e: any) => sum + Number(e.hours ?? 0), 0);
  return built({
    summary: `${mode === "approve" ? "Approve" : "Reject"} ${entries.length} time ${entries.length === 1 ? "entry" : "entries"} (${hours}h)`,
    risk: "high", targetId: entries[0].id, targetLabel: scopeLabel,
    payload: { ids: entries.map((e: any) => e.id), hours },
    preview: {
      fields: [
        { label: "Entries", proposed: String(entries.length) },
        { label: "Hours", proposed: String(hours) },
        { label: "Status", current: "submitted", proposed: mode === "approve" ? "approved" : "rejected" },
      ],
      impact: mode === "approve" ? ["Approved hours become payable to the supplier."] : ["The supplier is asked to correct these entries."],
    },
  });
}

export const OPERATOR_ACTION_TYPES = Object.keys(OPERATOR_ACTIONS);

export function catalogForPrompt() {
  return OPERATOR_ACTION_TYPES
    .map((key) => `- ${key} (${OPERATOR_ACTIONS[key].risk} risk): ${OPERATOR_ACTIONS[key].label}`)
    .join("\n");
}

/** Validates and previews one AI-named action without touching data. */
export async function buildOperatorAction(ctx: OperatorCtx, actionType: string, input: any): Promise<BuildResult & { spec?: Spec }> {
  const spec = OPERATOR_ACTIONS[actionType];
  if (!spec) return { error: `"${actionType}" is not an action I can perform.` };
  try {
    const result = await spec.build(ctx, input ?? {});
    if ("error" in result) return result;
    return { ...result, risk: result.risk ?? spec.risk, spec };
  } catch (err) {
    return { error: String((err as Error).message).slice(0, 300) };
  }
}

/** Executes a queued action row and writes the audit trail. */
export async function runOperatorAction(ctx: OperatorCtx, row: any) {
  const spec = OPERATOR_ACTIONS[row.action_type];
  if (!spec) throw new Error("Unknown action.");
  let b: Built = {
    targetId: row.target_id, targetLabel: row.target_label,
    payload: row.payload ?? {}, preview: row.preview ?? { fields: [] },
    summary: row.action_label, risk: row.risk_level,
  };
  try {
    // Later plan steps often target a record an earlier step creates, so they are
    // resolved and validated at execution time instead of when they were queued.
    if ((row.payload as any)?.__deferred) {
      const resolved = await buildOperatorAction(ctx, row.action_type, (row.payload as any).input ?? {});
      if ("error" in resolved) throw new Error(resolved.error);
      b = resolved as Built;
      await ctx.admin.from("copilot_operator_actions").update({
        target_id: b.targetId, target_label: b.targetLabel,
        payload: b.payload, preview: b.preview, action_label: b.summary,
      }).eq("id", row.id);
    }
    const result = await spec.execute(ctx, b);
    await ctx.admin.from("copilot_operator_actions").update({
      status: "completed", executed_at: now(), result: { summary: result.summary, next: result.next ?? null }, failure_reason: null,
    }).eq("id", row.id);
    await ctx.admin.from("copilot_audit_log").insert({
      profile_id: ctx.profile.id, actor_role: "agency_admin", operator_action_id: row.id,
      command: row.source_command, interpreted_intent: row.action_label,
      action_type: row.action_type, target_type: row.target_type, target_id: row.target_id,
      target_label: row.target_label, previous_value: result.previous ?? null, new_value: result.next ?? null,
      confirmed: Boolean(row.confirmed_at) || row.requires_confirmation === false,
      execution_result: "completed", source: row.source,
    });
    await ctx.admin.from("activity_logs").insert({
      label: `${spec.label} (copilot operator)`,
      detail: `${result.summary} — by ${ctx.profile.full_name || ctx.profile.email || "agency admin"} via ${row.source}.`,
    });
    return { ok: true as const, summary: result.summary };
  } catch (err) {
    const reason = String((err as Error).message).slice(0, 400);
    await ctx.admin.from("copilot_operator_actions").update({
      status: "failed", executed_at: now(), failure_reason: reason,
    }).eq("id", row.id);
    await ctx.admin.from("copilot_audit_log").insert({
      profile_id: ctx.profile.id, actor_role: "agency_admin", operator_action_id: row.id,
      command: row.source_command, interpreted_intent: row.action_label, action_type: row.action_type,
      target_type: row.target_type, target_id: row.target_id, target_label: row.target_label,
      confirmed: Boolean(row.confirmed_at), execution_result: "failed", failure_reason: reason, source: row.source,
    });
    return { ok: false as const, error: reason };
  }
}
