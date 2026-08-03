/**
 * Named, read-only admin queries.
 *
 * Cross-project questions are answered from a targeted query instead of pushing
 * the whole database into the prompt. Agency-admin only; callers must check the
 * role before running one.
 */

type Runner = (admin: any) => Promise<string>;

const YESTERDAY = () => new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

async function latestEstimates(admin: any) {
  const { data } = await admin.from("project_estimates")
    .select("project_id, version, client_calculation_rate, currency, target_margin_percent, status, final_fixed_price")
    .order("version", { ascending: false }).limit(400);
  const map = new Map<string, any>();
  for (const row of data ?? []) if (!map.has(row.project_id)) map.set(row.project_id, row);
  return map;
}

export const ADMIN_QUERIES: Record<string, Runner> = {
  projects_without_rate: async (admin) => {
    const { data: projects } = await admin.from("projects")
      .select("id, name, status").is("archived_at", null).limit(200);
    const estimates = await latestEstimates(admin);
    const rows = (projects ?? []).filter((p: any) => {
      const e = estimates.get(p.id);
      return !e || !Number(e.client_calculation_rate);
    });
    if (!rows.length) return "Every active project has a calculation rate.";
    return rows.map((p: any) => `- ${p.name} [id ${p.id}] (${p.status}) — no calculation rate`).join("\n");
  },

  projects_waiting_for_pricing: async (admin) => {
    const { data } = await admin.from("projects")
      .select("id, name, status, updated_at").is("archived_at", null)
      .in("status", ["waiting_for_agency_pricing", "discovery_in_progress", "lead_started"]).limit(100);
    if (!data?.length) return "No project is waiting for pricing.";
    return data.map((p: any) => `- ${p.name} [id ${p.id}] (${p.status}, updated ${String(p.updated_at).slice(0, 10)})`).join("\n");
  },

  needs_attention: async (admin) => {
    const [{ data: projects }, { data: times }, { data: changes }, { data: payments }] = await Promise.all([
      admin.from("projects").select("id, name, status, payment_gate_status").is("archived_at", null).limit(200),
      admin.from("supplier_time_entries").select("id, hours").eq("status", "submitted").limit(200),
      admin.from("change_requests").select("id, title, status").in("status", ["submitted", "under_review"]).limit(50),
      admin.from("payments").select("id, project_id, amount, currency, status, due_date").neq("status", "received").limit(100),
    ]);
    const estimates = await latestEstimates(admin);
    const lines: string[] = [];
    for (const p of projects ?? []) {
      const e = estimates.get(p.id);
      if (!e) lines.push(`- ${p.name} [id ${p.id}] has no estimate`);
      else if (!Number(e.client_calculation_rate)) lines.push(`- ${p.name} [id ${p.id}] has no calculation rate`);
      if (p.status === "waiting_for_client_approval") lines.push(`- ${p.name} [id ${p.id}] is waiting for client approval`);
    }
    if (times?.length) lines.push(`- ${times.length} supplier time entries awaiting approval (${times.reduce((s: number, t: any) => s + Number(t.hours ?? 0), 0)}h)`);
    for (const c of changes ?? []) lines.push(`- Change request "${c.title}" is ${c.status}`);
    for (const p of payments ?? []) lines.push(`- Payment ${p.currency ?? ""}${p.amount} on project ${p.project_id} is ${p.status}${p.due_date ? ` (due ${p.due_date})` : ""}`);
    return lines.length ? lines.slice(0, 40).join("\n") : "Nothing is waiting on you right now.";
  },

  supplier_availability: async (admin) => {
    const [{ data: suppliers }, { data: profiles }, { data: assignments }] = await Promise.all([
      admin.from("suppliers").select("id, name, status").is("archived_at", null).limit(120),
      admin.from("supplier_profiles").select("supplier_id, weekly_availability_hours, hourly_rate, currency, main_skills").limit(120),
      admin.from("project_supplier_assignments").select("supplier_id").limit(400),
    ]);
    const byId = new Map((profiles ?? []).map((p: any) => [p.supplier_id, p]));
    const load = new Map<string, number>();
    for (const a of assignments ?? []) load.set(a.supplier_id, (load.get(a.supplier_id) ?? 0) + 1);
    if (!suppliers?.length) return "No suppliers on file.";
    return suppliers.map((s: any) => {
      const p = byId.get(s.id);
      return `- ${s.name} [id ${s.id}] (${s.status}) — ${p?.weekly_availability_hours ?? "?"}h/week, rate ${p?.currency ?? ""}${p?.hourly_rate ?? "?"}, ${load.get(s.id) ?? 0} active assignments, skills: ${(p?.main_skills ?? []).join(", ") || "none listed"}`;
    }).join("\n");
  },

  changed_since_yesterday: async (admin) => {
    const since = YESTERDAY();
    const [{ data: activity }, { data: projects }] = await Promise.all([
      admin.from("activity_logs").select("label, detail, created_at").gte("created_at", since)
        .order("created_at", { ascending: false }).limit(40),
      admin.from("projects").select("name, status, updated_at").gte("updated_at", since).limit(40),
    ]);
    const lines = [
      ...(projects ?? []).map((p: any) => `- ${p.name} is now ${p.status} (updated ${String(p.updated_at).slice(0, 16)})`),
      ...(activity ?? []).map((a: any) => `- ${String(a.created_at).slice(0, 16)} ${a.label}: ${String(a.detail ?? "").slice(0, 160)}`),
    ];
    return lines.length ? lines.join("\n") : "Nothing changed in the last 24 hours.";
  },

  margin_risk: async (admin) => {
    const { data: projects } = await admin.from("projects").select("id, name").is("archived_at", null).limit(200);
    const estimates = await latestEstimates(admin);
    const lines: string[] = [];
    for (const p of projects ?? []) {
      const e = estimates.get(p.id);
      if (e && Number(e.target_margin_percent) < 35) {
        lines.push(`- ${p.name} [id ${p.id}] target margin ${e.target_margin_percent}%`);
      }
    }
    return lines.length ? lines.join("\n") : "No project is below a 35% target margin.";
  },
};

export const ADMIN_QUERY_NAMES = Object.keys(ADMIN_QUERIES);

export async function runAdminQuery(admin: any, name: string): Promise<string | null> {
  const runner = ADMIN_QUERIES[name];
  if (!runner) return null;
  try {
    return await runner(admin);
  } catch (err) {
    return `Query failed: ${String((err as Error).message).slice(0, 200)}`;
  }
}