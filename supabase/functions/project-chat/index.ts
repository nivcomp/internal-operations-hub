import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import {
  ACTION_SPECS, applyAction, loadBundle, validateAction,
  type ActionKind, type Bundle, type Ctx,
} from "./actions.ts";
import { calendarWeeks, perUnitHours, snapshot } from "./estimation.ts";
import {
  PROJECT_ONLY_MESSAGE, PROJECT_ONLY_MESSAGE_HE, UNCLEAR_MESSAGE, UNCLEAR_MESSAGE_HE,
  classifyRequest, detectSpam, estimateCost, estimateTokens, getCachedResponse, hashText,
  invalidateProjectCache, isHebrew, loadUsage, putCachedResponse, raiseAlert, recordClassification,
  recordEvent, resolveLimits, usagePercent,
} from "./guard.ts";

type AgentType = "project_guide" | "agency_control" | "work_assistant";

const MODEL = "openai/gpt-5.6-sol";
const GATEWAY = "https://ai.gateway.lovable.dev/v1/responses";
const RATE_LIMIT_PER_MINUTE = 12;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const AGENT_CONFIG: Record<AgentType, { role: string; kind: string; visibility: string; senderType: string }> = {
  project_guide: { role: "client", kind: "client_agency", visibility: "client_agency", senderType: "client" },
  agency_control: { role: "agency_admin", kind: "agency_internal", visibility: "agency_only", senderType: "agency_admin" },
  work_assistant: { role: "supplier", kind: "supplier_agency", visibility: "supplier_agency", senderType: "supplier" },
};

const ACTION_GRAMMAR = `
--- PROPOSED ACTIONS ---
You can never change data yourself. To change anything, put an entry in "proposed_actions". A human must confirm it before it happens.
Each entry is: {"kind": <one of the allowed kinds>, "title": short label, "summary": one sentence describing the change in plain language, "payload": object}
NEVER say "I have updated / saved / approved / assigned / priced" anything. Say you have prepared a proposal that needs confirmation.
Propose at most 2 actions per reply, and only when the user clearly asked for that change. If required details are missing, ask a question instead of guessing.

Payload shapes:
- add_estimate_items: {"items":[{"title","description","project_phase","base_hours":number,"quantity":number,"complexity_level":"simple|standard|complex|very_complex","uncertainty_multiplier":number,"integration_multiplier":number,"responsible_role":"yaniv_discovery|yaniv_project_management|architecture|design|development|automation|integration|testing|deployment|training|supplier_work","client_visible":boolean,"client_visible_label","client_visible_description","client_optional":boolean,"option_group","option_tier":"basic|standard|advanced","max_quantity":number,"dependency_notes","risk_notes","acceptance_criteria"}]} — base_hours is realistic effort for ONE unit before multipliers. Always fill assumptions in risk_notes and dependency_notes.
- update_estimate_items: {"updates":[{"item_id" or "title", "patch": {any of title, description, base_hours, quantity, complexity_level, responsible_role, client_optional, client_visible, option_tier, dependency_notes, risk_notes, acceptance_criteria}}]}
- update_estimate_settings: {"client_calculation_rate","yaniv_internal_hourly_cost","external_costs","target_margin_percent","risk_buffer_percent","management_buffer_percent","testing_buffer_percent","contingency_percent","estimate_rounding_increment","show_hourly_rate_to_client","notes"} — include only the keys being changed.
- assign_supplier: {"supplier_name" or "supplier_id", "item_titles":[...] or "item_ids":[...]}
- request_supplier_review: {}
- accept_supplier_review: {"review_ids":[...]} (empty means all reviewed items)
- publish_client_estimate: {}
- approve_fixed_price: {"final_fixed_price":number,"fixed_price_scope","fixed_price_exclusions","payment_milestones","delivery_range_label"}
- save_client_scenario: {"name","client_notes","selections":[{"item_id" or "title","selected":boolean,"quantity":number}]}
- supplier_review_response: {"responses":[{"item_id" or "title","decision":"accept|change|decline","suggested_hours_min":number,"suggested_hours_max":number,"fixed_quote":number,"assumptions","dependencies","missing_information","delivery_risk","proposed_duration_days":number,"weekly_availability_hours":number}]}
- create_change_request: {"title","description"}`;

const ALLOWED_KINDS: Record<AgentType, ActionKind[]> = {
  project_guide: ["save_client_scenario", "create_change_request", "add_estimate_items"],
  agency_control: [
    "add_estimate_items", "update_estimate_items", "update_estimate_settings", "assign_supplier",
    "request_supplier_review", "accept_supplier_review", "publish_client_estimate", "approve_fixed_price",
  ],
  work_assistant: ["supplier_review_response"],
};

function systemPrompt(agent: AgentType) {
  const shared = `You are part of an agency delivery system. Answer in the same language the user writes in (Hebrew or English). Never invent facts about the project; if information is missing, ask for it.
You MUST reply with a single JSON object and nothing else, in this exact shape:
{"reply": string, "language": "he" | "en", "drafts": object, "questions": string[], "proposed_actions": [{"kind": string, "title": string, "summary": string, "payload": object}]}
"reply" is the message the user sees. "drafts" may be empty. Never put pricing you were not given into any field.
Allowed action kinds for you: ${ALLOWED_KINDS[agent].join(", ")}. Any other kind is rejected.
${ACTION_GRAMMAR}`;

  if (agent === "project_guide") {
    return `${shared}
You are the "Project Guide" that helps a CLIENT describe a new project.
Ask ONE clear question at a time. Understand: the business problem, the desired result, who will use it, the current process, existing systems and tools, required integrations, deadlines and priorities, files/examples, constraints, and what is in or out of scope. Explain technical concepts in simple language. Summarize periodically and ask the client to confirm.
Populate "drafts" progressively with any of: project_title, business_problem, desired_outcome, users, current_process, requested_solution, requirements (array), integrations (array), assumptions (array), exclusions (array), risks (array), open_questions (array), suggested_phases (array), acceptance_criteria (array).
Everything you produce is an AI draft awaiting agency review — never promise scope, delivery dates, discounts or final prices. You may only repeat client-facing pricing facts that appear in the supplied context. Never mention supplier cost, supplier rates, agency margin or internal notes; they are not available to you.
If the project scope is already approved and the client asks for something new, say it may be a change to the approved project that the agency will review and price, and propose a create_change_request action.
ESTIMATE BEHAVIOUR (client-safe):
- Explain the published estimate in ranges only: what is included, what drives the hours, what is optional, and what makes it uncertain. Always say it is an estimate range, not a final price, unless the context shows an approved fixed price.
- When the client asks "what if we remove/add X" or "what fits a budget of Y", explain the effect on the range and delivery time, then propose save_client_scenario so they can keep that option. Only use optional items that appear in the client-visible estimate.
- If there is no published estimate yet, say the agency is still preparing it. Never guess numbers.
- You may propose add_estimate_items when the client describes new work, but tell the client it is a suggestion sent to the agency for review and pricing — never that it changed their estimate.
- Never state or imply supplier cost, agency margin, the internal hourly cost, or how the price is built up internally.`;
  }
  if (agent === "agency_control") {
    return `${shared}
You are "Agency Control", the internal assistant for the agency owner. You may discuss client price, supplier cost, margin, internal notes and delivery risk.
You may draft scope, phases, supplier briefings, client-friendly summaries, questions and risk lists.
You must NEVER claim to have changed anything. Any change to scope, price, supplier assignment, approval, payment state, project readiness or a client-facing commitment must be returned in "proposed_actions" for the owner to confirm manually.
ESTIMATION BEHAVIOUR:
- You can build a first estimate from the client conversation: break the work into phases and concrete work items, set base hours, complexity, uncertainty and the responsible role, and state your assumptions in risk_notes and dependency_notes. Mark genuinely optional work as client_optional with an option_group and option_tier.
- Explain your reasoning in "reply": why these items, where the risk is, what is still unknown, and where the estimate is weak.
- Compare against the target margin. If the recommended price or a proposed price falls below the target margin, say so explicitly and suggest options (reduce scope, change supplier, raise price).
- Recommend supplier assignment and review only from suppliers already assigned to this project.
- Never approve a fixed price on your own initiative. Only propose approve_fixed_price when the owner explicitly asks for a specific price, and state the resulting margin.`;
  }
  return `${shared}
You are the "Work Assistant" for an assigned SUPPLIER. Explain the assigned scope simply, explain acceptance criteria and dependencies, say whether the work is approved and funded, help draft progress updates, blocker reports and time-entry descriptions, and help send questions to the agency.
You only know what is in the supplied supplier-safe context. You never know and must never state client price, client hourly rate, agency margin or internal client notes; if asked, say that information is not part of the supplier workspace.
When the supplier asks to log time, do not claim it was saved: describe the entry in "reply" and ask them to confirm it in the time-tracking screen.
ESTIMATE REVIEW BEHAVIOUR:
- Help the supplier review the work items assigned to them: are the hours realistic, what is missing, what are the dependencies, what is the delivery risk, how long it will take in calendar days at their availability.
- Help them answer per item with accept, change (with their own hour range or a fixed quote) or decline, then propose supplier_review_response so they can confirm and send it to the agency.
- Never send anything to the agency by yourself, and never state or guess what the client is paying.`;
}

async function resolveActor(authHeader: string | null) {
  if (!authHeader?.startsWith("Bearer ")) return { error: "Unauthorized", status: 401 } as const;
  const token = authHeader.slice(7);
  const { data, error } = await admin.auth.getClaims(token);
  if (error || !data?.claims?.sub) return { error: "Unauthorized", status: 401 } as const;
  const userId = data.claims.sub as string;
  const { data: profile } = await admin
    .from("profiles")
    .select("id, full_name, role, client_id, supplier_id, is_active")
    .eq("id", userId)
    .maybeSingle();
  if (!profile || profile.is_active === false) return { error: "No active profile", status: 403 } as const;
  return { profile } as const;
}

async function assertAccess(agent: AgentType, profile: any, projectId: string) {
  const { data: project } = await admin
    .from("projects")
    .select("id, name, status, summary, client_id, payment_gate_status")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return { error: "Project not found", status: 404 } as const;

  if (profile.role === "agency_admin") {
    if (agent === "project_guide" || agent === "agency_control") return { project, supplierId: null } as const;
    // Supplier mode: admin must be linked to a supplier assigned to the project.
    if (!profile.supplier_id) return { error: "No supplier profile linked", status: 403 } as const;
    const { data: link } = await admin.from("project_supplier_assignments")
      .select("id").eq("project_id", projectId).eq("supplier_id", profile.supplier_id).maybeSingle();
    if (!link) return { error: "Project is not assigned to you", status: 403 } as const;
    return { project, supplierId: profile.supplier_id } as const;
  }

  if (profile.role === "client") {
    if (agent !== "project_guide") return { error: "Forbidden", status: 403 } as const;
    if (project.client_id !== profile.client_id) return { error: "Forbidden", status: 403 } as const;
    return { project, supplierId: null } as const;
  }

  if (profile.role === "supplier") {
    if (agent !== "work_assistant" || !profile.supplier_id) return { error: "Forbidden", status: 403 } as const;
    const { data: link } = await admin.from("project_supplier_assignments")
      .select("id").eq("project_id", projectId).eq("supplier_id", profile.supplier_id).maybeSingle();
    if (!link) return { error: "Forbidden", status: 403 } as const;
    return { project, supplierId: profile.supplier_id } as const;
  }
  return { error: "Forbidden", status: 403 } as const;
}

async function ensureConversation(agent: AgentType, projectId: string, supplierId: string | null, profileId: string) {
  const cfg = AGENT_CONFIG[agent];
  let query = admin.from("project_conversations").select("*").eq("project_id", projectId).eq("kind", cfg.kind);
  query = supplierId ? query.eq("supplier_id", supplierId) : query.is("supplier_id", null);
  const { data: existing } = await query.maybeSingle();
  if (existing) return existing;

  const titles: Record<AgentType, string> = {
    project_guide: "Project Guide",
    agency_control: "Agency Control",
    work_assistant: "Work Assistant",
  };
  const { data, error } = await admin.from("project_conversations")
    .insert({ project_id: projectId, kind: cfg.kind, supplier_id: supplierId, title: titles[agent] })
    .select("*").single();
  if (error) throw new Error(error.message);
  await admin.from("conversation_participants").upsert(
    [
      { conversation_id: data.id, profile_id: profileId, participant_role: cfg.role },
      { conversation_id: data.id, profile_id: null, participant_role: "ai_agent" },
    ],
    { onConflict: "conversation_id,profile_id,participant_role", ignoreDuplicates: true },
  );
  return data;
}

function visibilityFilter(agent: AgentType, role: string) {
  if (role === "agency_admin" && agent !== "work_assistant") return null; // sees everything in the conversation
  if (agent === "project_guide") return ["client_agency", "shared_all"];
  if (agent === "work_assistant") return ["supplier_agency", "shared_all"];
  return ["agency_only", "shared_all"];
}

async function loadMessages(agent: AgentType, conversationId: string, role: string) {
  let q = admin.from("chat_messages").select("*").eq("conversation_id", conversationId).order("created_at");
  const allowed = visibilityFilter(agent, role);
  if (allowed) q = q.in("visibility", allowed);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

const fmt = (n: number) => Math.round(n).toLocaleString("en-GB");

/** Estimate context, filtered per role. This is the only place estimate data enters a prompt. */
function estimateContext(agent: AgentType, bundle: Bundle, supplierId: string | null): string[] {
  const est = bundle.estimate;
  const lines: string[] = [];
  if (!est) {
    lines.push(agent === "agency_control"
      ? "Estimate: none exists for this project yet."
      : "Estimate: the agency has not published an estimate for this project yet.");
    return lines;
  }
  const cur = est.currency ?? "GBP";
  const s = snapshot(est, bundle.items, bundle.allocations, bundle.adjustments);

  if (agent === "project_guide") {
    if (!est.client_visible) {
      lines.push("Estimate: the agency is still preparing it. No numbers may be shared yet.");
      return lines;
    }
    lines.push(`Estimate status: ${est.status}`);
    if (est.final_fixed_price != null && est.approved_by_yaniv) {
      lines.push(`APPROVED FIXED PRICE: ${cur} ${fmt(Number(est.final_fixed_price))}. Scope: ${est.fixed_price_scope || "(see scope)"}. Exclusions: ${est.fixed_price_exclusions || "(none listed)"}. Payment milestones: ${est.payment_milestones || "(not set)"}.`);
      lines.push(`Change rule: ${est.change_request_rule || "Anything outside the fixed scope is a change request the agency prices."}`);
    } else {
      lines.push(`Estimated budget range (not a final price): ${cur} ${fmt(s.budget.min)} – ${cur} ${fmt(s.budget.max)}`);
      lines.push(`Estimated effort range: ${s.hours.totalMin}–${s.hours.totalMax} hours`);
    }
    if (est.show_hourly_rate_to_client) lines.push(`Client hourly rate used: ${cur} ${est.client_calculation_rate}/hour`);
    if (est.delivery_range_label) lines.push(`Indicative delivery: ${est.delivery_range_label}`);
    else {
      const weeks = calendarWeeks(s.hours.totalMin, s.hours.totalMax, 20);
      lines.push(`Indicative delivery: about ${weeks.min}–${weeks.max} weeks of elapsed time`);
    }
    if (est.validity_date) lines.push(`Estimate valid until: ${est.validity_date}`);
    for (const item of bundle.items.filter((i) => i.client_visible)) {
      const unit = perUnitHours(item);
      lines.push(`Client-visible item${item.client_optional ? " (OPTIONAL)" : ""}: "${item.client_visible_label || item.title}" — ${item.client_visible_description || item.description}. Effort ${round(unit.min)}–${round(unit.max)} hrs per unit, quantity ${item.quantity}${item.client_optional ? `, max quantity ${item.max_quantity}, group ${item.option_group || "-"}, tier ${item.option_tier}` : ""}. Uncertainty driver: ${item.risk_notes || "standard"}.`);
    }
    for (const sc of bundle.scenarios) {
      lines.push(`Saved scenario "${sc.name}": ${cur} ${fmt(Number(sc.estimated_budget_min))}–${fmt(Number(sc.estimated_budget_max))}, ${sc.estimated_hours_min}–${sc.estimated_hours_max} hrs. Notes: ${sc.client_notes}`);
    }
    lines.push("Supplier cost, agency margin and internal cost are deliberately excluded and must never be stated or estimated.");
    return lines;
  }

  if (agent === "work_assistant") {
    const mine = bundle.items.filter((i) => i.supplier_id === supplierId);
    lines.push(`Estimate status: ${est.status}. Work items assigned to you: ${mine.length}.`);
    for (const item of mine) {
      const review = bundle.reviews.find((r) => r.item_id === item.id && r.supplier_id === supplierId);
      lines.push(`Assigned estimate item "${item.title}" [${item.project_phase}] — ${item.description}. Agency estimate ${item.estimated_hours_min}–${item.estimated_hours_max} hrs (complexity ${item.complexity_level}, quantity ${item.quantity}). Dependencies: ${item.dependency_notes || "none stated"}. Risk: ${item.risk_notes || "none stated"}. Acceptance: ${item.acceptance_criteria || "not defined"}. Review status: ${review ? `${review.status}/${review.supplier_decision || "no decision"}${review.suggested_hours_max != null ? ` (you suggested ${review.suggested_hours_min}–${review.suggested_hours_max} hrs)` : ""}` : "not requested yet"}.`);
    }
    lines.push("Client budget, client hourly rate, agency margin and total project price are deliberately excluded and must never be stated or estimated.");
    return lines;
  }

  // agency_control — full internal view
  lines.push(`Estimate v${est.version} (${est.status}), currency ${cur}, client_visible=${est.client_visible}, approved_by_yaniv=${est.approved_by_yaniv}`);
  lines.push(`Settings: client rate ${est.client_calculation_rate}/h, Yaniv internal cost ${est.yaniv_internal_hourly_cost}/h, external costs ${est.external_costs}, target margin ${est.target_margin_percent}%, buffers risk ${est.risk_buffer_percent}% / management ${est.management_buffer_percent}% / testing ${est.testing_buffer_percent}% / contingency ${est.contingency_percent}%, rounding ${est.estimate_rounding_increment}`);
  lines.push(`Computed: effort ${s.hours.totalMin}–${s.hours.totalMax} hrs (direct ${s.hours.directMin}–${s.hours.directMax}), client budget ${cur} ${fmt(s.budget.min)}–${fmt(s.budget.max)}, internal cost ${cur} ${fmt(s.internal.min)}–${fmt(s.internal.max)} (supplier ${fmt(s.internal.supplierMax)}, Yaniv ${fmt(s.internal.yanivMax)}, external ${fmt(s.internal.external)}), recommended fixed price ${cur} ${fmt(s.recommended)}, current expected margin ${s.margin}% vs target ${est.target_margin_percent}%`);
  if (est.final_fixed_price != null) lines.push(`Final fixed price: ${cur} ${fmt(Number(est.final_fixed_price))}`);
  if (s.hours.unassignedMax > 0) lines.push(`Unassigned non-Yaniv effort: ${s.hours.unassignedMin}–${s.hours.unassignedMax} hrs (no supplier chosen — internal cost may be understated).`);
  for (const item of bundle.items) {
    lines.push(`Estimate item id=${item.id} "${item.title}" [${item.project_phase}] role=${item.responsible_role} supplier=${item.supplier_id ?? "unassigned"} base ${item.base_hours}h ×${item.quantity} complexity ${item.complexity_level}(${item.complexity_multiplier}) uncertainty ${item.uncertainty_multiplier} integration ${item.integration_multiplier} => ${item.estimated_hours_min}–${item.estimated_hours_max} hrs. client_visible=${item.client_visible} optional=${item.client_optional} tier=${item.option_tier} ai_generated=${item.ai_generated}. Risk: ${item.risk_notes || "-"}. Dependencies: ${item.dependency_notes || "-"}.`);
  }
  for (const a of bundle.allocations) {
    lines.push(`Role allocation ${a.role}${a.supplier_id ? ` (supplier ${a.supplier_id})` : ""}: ${a.estimated_hours_min}–${a.estimated_hours_max} hrs at internal ${a.internal_hourly_cost}/h${a.fixed_internal_cost != null ? ` fixed ${a.fixed_internal_cost}` : ""} => ${fmt(Number(a.calculated_internal_cost_min))}–${fmt(Number(a.calculated_internal_cost_max))}`);
  }
  for (const adj of bundle.adjustments) {
    lines.push(`Adjustment "${adj.label}" ${adj.kind} ${adj.amount} (client_visible=${adj.client_visible})`);
  }
  for (const r of bundle.reviews) {
    const item = bundle.items.find((i) => i.id === r.item_id);
    lines.push(`Supplier review id=${r.id} for "${item?.title ?? r.item_id}": ${r.status}/${r.supplier_decision || "no decision"}${r.suggested_hours_max != null ? ` suggested ${r.suggested_hours_min}–${r.suggested_hours_max} hrs` : ""}${r.fixed_quote ? ` fixed quote ${r.fixed_quote}` : ""}. Assumptions: ${r.assumptions || "-"}. Missing info: ${r.missing_information || "-"}. Risk: ${r.delivery_risk || "-"}.`);
  }
  for (const sc of bundle.scenarios) {
    lines.push(`Client scenario "${sc.name}": ${sc.estimated_hours_min}–${sc.estimated_hours_max} hrs, ${cur} ${fmt(Number(sc.estimated_budget_min))}–${fmt(Number(sc.estimated_budget_max))}${sc.is_promoted ? " (promoted)" : ""}. Client notes: ${sc.client_notes}`);
  }
  return lines;
}

const round = (n: number) => Math.round(n * 10) / 10;

/**
 * Keeps only the recent turns and folds everything older into a stored, compressed
 * summary, so the whole conversation is never resent to the model.
 */
async function compressHistory(conversationId: string, projectId: string, audience: string, history: any[]) {
  const RECENT = 12;
  if (history.length <= RECENT) return { recent: history, summary: "" };
  const older = history.slice(0, history.length - RECENT);
  const recent = history.slice(-RECENT);
  const summary = older
    .map((m: any) => `${m.sender_type}: ${String(m.body ?? "").replace(/\s+/g, " ").slice(0, 220)}`)
    .slice(-40)
    .join("\n")
    .slice(0, 6000);
  const row = {
    project_id: projectId,
    conversation_id: conversationId,
    audience_role: audience,
    summary,
    covered_message_count: older.length,
    last_message_at: older[older.length - 1]?.created_at ?? null,
  };
  const { data: existing } = await admin.from("ai_project_summaries")
    .select("id").eq("project_id", projectId).eq("conversation_id", conversationId)
    .eq("audience_role", audience).maybeSingle();
  if (existing) await admin.from("ai_project_summaries").update(row).eq("id", existing.id);
  else await admin.from("ai_project_summaries").insert(row);
  return { recent, summary };
}

/** Role-safe project context. Pricing separation is enforced here, server-side. */
async function buildContext(agent: AgentType, project: any, supplierId: string | null, bundle: Bundle) {
  const lines: string[] = [
    `Project: ${project.name}`,
    `Status: ${project.status}`,
    `Summary: ${project.summary || "(none yet)"}`,
  ];

  const { data: scopes } = await admin.from("scopes").select("*").eq("project_id", project.id).order("version");
  const scopeIds = (scopes ?? []).map((s: any) => s.id);
  const { data: items } = scopeIds.length
    ? await admin.from("scope_items").select("*").in("scope_id", scopeIds)
    : { data: [] as any[] };

  if (agent === "project_guide") {
    lines.push(`Payment gate: ${project.payment_gate_status}`);
    for (const s of scopes ?? []) lines.push(`Scope v${s.version} (${s.status}): ${s.client_facing_summary}`);
    for (const i of items ?? []) if (i.client_visible) lines.push(`Scope item: ${i.title} — ${i.description}`);
    const { data: pricing } = await admin.from("project_pricing").select("currency, client_price").eq("project_id", project.id);
    for (const p of pricing ?? []) {
      if (Number(p.client_price) > 0) lines.push(`Approved client price: ${p.currency} ${p.client_price}`);
    }
    const { data: hours } = await admin.from("paid_hours").select("hours_remaining").eq("project_id", project.id);
    for (const h of hours ?? []) lines.push(`Paid hours remaining: ${h.hours_remaining}`);
    const { data: crs } = await admin.from("change_requests").select("title, status, agency_price").eq("project_id", project.id);
    for (const c of crs ?? []) {
      const price = c.status === "priced" || c.status === "client_approved" ? ` (price ${c.agency_price ?? "n/a"})` : "";
      lines.push(`Change request: ${c.title} — ${c.status}${price}`);
    }
  }

  if (agent === "agency_control") {
    for (const s of scopes ?? []) {
      lines.push(`Scope v${s.version} (${s.status}) client summary: ${s.client_facing_summary}`);
      lines.push(`Scope v${s.version} internal notes: ${s.internal_delivery_notes}`);
    }
    for (const i of items ?? []) lines.push(`Scope item [${i.phase}] ${i.title} — ${i.description} (client:${i.client_visible}, supplier:${i.supplier_visible})`);
    const { data: pricing } = await admin.from("project_pricing").select("*").eq("project_id", project.id);
    for (const p of pricing ?? []) {
      lines.push(`Pricing: client ${p.currency} ${p.client_price}, supplier cost ${p.supplier_cost_estimate}, target margin ${p.target_margin_percent}%, actual ${p.actual_margin_percent}%. Notes: ${p.pricing_notes}`);
    }
    const { data: crs } = await admin.from("change_requests").select("*").eq("project_id", project.id);
    for (const c of crs ?? []) lines.push(`Change request: ${c.title} — ${c.status} (client price ${c.agency_price ?? "n/a"}, supplier cost ${c.supplier_cost ?? "n/a"})`);
    const { data: reqs } = await admin.from("project_requirements").select("title, detail, status").eq("project_id", project.id);
    for (const r of reqs ?? []) lines.push(`Requirement (${r.status}): ${r.title} — ${r.detail}`);
    const { data: qs } = await admin.from("project_questions").select("question, status, target_role").eq("project_id", project.id);
    for (const q of qs ?? []) lines.push(`Open question to ${q.target_role} (${q.status}): ${q.question}`);
    const { data: sup } = await admin.from("project_supplier_assignments").select("supplier_id, suppliers(name)").eq("project_id", project.id);
    for (const s of sup ?? []) lines.push(`Assigned supplier: ${(s as any).suppliers?.name ?? s.supplier_id}`);
    // Full client conversation, for summarisation.
    const { data: conv } = await admin.from("project_conversations").select("id").eq("project_id", project.id).eq("kind", "client_agency").maybeSingle();
    if (conv) {
      const { data: clientMsgs } = await admin.from("chat_messages").select("sender_type, body").eq("conversation_id", conv.id).order("created_at").limit(60);
      for (const m of clientMsgs ?? []) lines.push(`Client conversation [${m.sender_type}]: ${m.body}`);
    }
  }

  if (agent === "work_assistant" && supplierId) {
    for (const s of scopes ?? []) if (s.status === "approved") lines.push(`Delivery notes: ${s.internal_delivery_notes}`);
    for (const i of items ?? []) if (i.supplier_visible) lines.push(`Assigned item [${i.phase}] ${i.title} — ${i.description}. Acceptance: ${i.acceptance_notes}`);
    const { data: prof } = await admin.from("supplier_profiles").select("hourly_rate, currency").eq("supplier_id", supplierId).maybeSingle();
    if (prof) lines.push(`Your agreed rate: ${prof.currency} ${prof.hourly_rate}/hour`);
    const { data: entries } = await admin.from("supplier_time_entries").select("entry_date, hours, status, description").eq("project_id", project.id).eq("supplier_id", supplierId);
    for (const e of entries ?? []) lines.push(`Time entry ${e.entry_date}: ${e.hours}h (${e.status}) — ${e.description}`);
    lines.push(`Work approved and funded: ${project.payment_gate_status !== "blocked" ? "yes" : "not yet"}`);
    lines.push("Client price, client hourly rate, agency margin and internal client notes are deliberately not included and must never be stated.");
  }

  lines.push("--- ESTIMATE ---");
  lines.push(...estimateContext(agent, bundle, supplierId));

  return lines.join("\n");
}

async function callModel(
  system: string,
  context: string,
  history: any[],
  userText: string,
  maxOutputTokens: number,
) {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("AI is not configured (missing LOVABLE_API_KEY).");

  const input = [
    { role: "system", content: `${system}\n\n--- PROJECT CONTEXT (role-filtered, authoritative) ---\n${context}` },
    ...history.slice(-12).map((m: any) => ({
      role: m.sender_type === "ai_agent" ? "assistant" : "user",
      content: String(m.body ?? "").slice(0, 2000),
    })),
    { role: "user", content: userText },
  ];

  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: MODEL,
      input,
      stream: true,
      store: false,
      // Reasoning tokens are drawn from the same budget, so a headroom is added.
      max_output_tokens: Math.max(2500, Math.min(maxOutputTokens + 2000, 10000)),
      reasoning: { effort: "low", summary: "auto" },
    }),
  });

  if (!res.ok || !res.body) {
    const detail = await res.text();
    throw new Error(`AI request failed [${res.status}]: ${detail.slice(0, 500)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      for (const line of part.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const evt = JSON.parse(payload);
          if (evt.type === "response.output_text.delta" && typeof evt.delta === "string") text += evt.delta;
          if (evt.type === "response.completed" && !text && evt.response?.output_text) text = evt.response.output_text;
        } catch { /* partial event */ }
      }
    }
  }
  return text.trim();
}

function parseModelOutput(raw: string) {
  const fenced = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = fenced.indexOf("{");
  const end = fenced.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      const parsed = JSON.parse(fenced.slice(start, end + 1));
      if (typeof parsed.reply === "string") return parsed;
    } catch { /* fall through */ }
  }
  return { reply: raw, language: "en", drafts: {}, questions: [], proposed_actions: [] };
}

/** The role that is actually acting right now (Yaniv in supplier mode acts as a supplier). */
function effectiveRole(agent: AgentType, profile: any): "agency_admin" | "client" | "supplier" {
  if (agent === "work_assistant") return "supplier";
  return profile.role;
}

function canConfirm(draft: any, agent: AgentType, profile: any) {
  const acting = effectiveRole(agent, profile);
  if (draft.confirm_role === acting) return true;
  // Yaniv may also confirm client-side proposals from his own workspace, but never as a supplier.
  return profile.role === "agency_admin" && agent !== "work_assistant" && draft.confirm_role !== "supplier";
}

function draftVisibleTo(draft: any, profile: any) {
  if (profile.role === "agency_admin") return true;
  if (profile.role === "client") return draft.visibility === "client_agency";
  return draft.visibility === "supplier_agency";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const actor = await resolveActor(req.headers.get("Authorization"));
    if ("error" in actor) return json({ error: actor.error }, actor.status);
    const profile = actor.profile;

    const body = await req.json().catch(() => ({}));
    const action: string = body.action ?? "history";
    const agent: AgentType = body.agent;
    const projectId: string = body.projectId;
    if (!agent || !AGENT_CONFIG[agent]) return json({ error: "Unknown agent" }, 400);
    if (typeof projectId !== "string" || projectId.length < 10) return json({ error: "projectId is required" }, 400);

    const access = await assertAccess(agent, profile, projectId);
    if ("error" in access) return json({ error: access.error }, access.status);

    const conversation = await ensureConversation(agent, projectId, access.supplierId, profile.id);
    const ctx: Ctx = {
      admin, projectId, project: access.project, profile, supplierId: access.supplierId, agent,
    };

    if (action === "history") {
      const messages = await loadMessages(agent, conversation.id, profile.role);
      const { data: drafts } = await admin.from("ai_generated_drafts")
        .select("*").eq("conversation_id", conversation.id).order("created_at", { ascending: false }).limit(5);
      const { data: pending } = await admin.from("ai_generated_drafts")
        .select("*").eq("project_id", projectId).neq("action_kind", "")
        .eq("status", "awaiting_agency_review").order("created_at", { ascending: false }).limit(20);
      const limits = await resolveLimits(admin, profile, projectId);
      const usage = await loadUsage(admin, profile.id, projectId);
      return json({
        conversation,
        messages,
        drafts: (drafts ?? []).filter((d: any) => !d.action_kind && draftVisibleTo(d, profile)),
        pendingActions: (pending ?? []).filter((d: any) => draftVisibleTo(d, profile) && canConfirm(d, agent, profile)),
        usage: {
          percentUsed: usagePercent(usage, limits),
          messagesToday: usage.dayMessages,
          dailyMessageLimit: limits.daily_message_limit,
          warningThreshold: limits.warning_threshold_percent,
          paused: limits.is_paused,
          pausedReason: limits.paused_reason,
          maximumMessageLength: limits.maximum_message_length,
        },
      });
    }

    if (action === "confirm_action" || action === "cancel_action") {
      const draftId = String(body.draftId ?? "");
      const { data: draft } = await admin.from("ai_generated_drafts").select("*").eq("id", draftId).maybeSingle();
      if (!draft || draft.project_id !== projectId || !draft.action_kind) return json({ error: "Proposal not found" }, 404);
      if (draft.status !== "awaiting_agency_review") return json({ error: "This proposal was already handled." }, 409);
      if (!draftVisibleTo(draft, profile) || !canConfirm(draft, agent, profile)) return json({ error: "Forbidden" }, 403);

      if (action === "cancel_action") {
        await admin.from("ai_generated_drafts").update({ status: "cancelled", applied_by_profile_id: profile.id, applied_at: new Date().toISOString() }).eq("id", draft.id);
        return json({ ok: true, status: "cancelled" });
      }

      // Optional edits made by the confirming human before applying.
      let working = draft;
      if (body.payload && typeof body.payload === "object") {
        const bundle = await loadBundle(admin, projectId);
        const revalidated = await validateAction(ctx, bundle, { kind: draft.action_kind, title: draft.payload?.title, summary: draft.payload?.summary, payload: body.payload });
        if ("error" in revalidated) return json({ error: revalidated.error }, 400);
        working = { ...draft, payload: revalidated.payload, preview: revalidated.preview };
      }

      try {
        const summary = await applyAction(ctx, working);
        await admin.from("ai_generated_drafts").update({
          status: "applied",
          payload: working.payload,
          preview: working.preview,
          applied_by_profile_id: profile.id,
          applied_at: new Date().toISOString(),
        }).eq("id", draft.id);
        await admin.from("activity_logs").insert({
          label: `${ACTION_SPECS[draft.action_kind as ActionKind].label} confirmed`,
          detail: `${access.project.name}: ${summary} (proposed by AI ${draft.agent_type}, confirmed by ${profile.full_name || profile.role})`,
        });
        await admin.from("decision_logs").insert({
          project_id: projectId,
          decision: summary,
          made_by_role: effectiveRole(agent, profile),
          impact: JSON.stringify(working.preview ?? {}).slice(0, 4000),
        });
        await admin.from("chat_messages").insert({
          conversation_id: draft.conversation_id ?? conversation.id,
          project_id: projectId,
          sender_type: "system",
          body: `✅ Confirmed by ${profile.full_name || profile.role}: ${summary}`,
          visibility: draft.visibility,
          status: "sent",
          structured_payload: { confirmed_action: draft.action_kind, draft_id: draft.id },
        });
        // Project data changed, so cached answers about it are no longer valid.
        await invalidateProjectCache(admin, projectId);
        return json({ ok: true, status: "applied", summary });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("apply action failed:", message);
        return json({ error: message }, 400);
      }
    }

    if (action !== "send") return json({ error: "Unknown action" }, 400);

    const text = typeof body.body === "string" ? body.body.trim() : "";
    if (!text) return json({ error: "Message body is required" }, 400);
    const cfg = AGENT_CONFIG[agent];
    const he = isHebrew(text);
    const messageHash = await hashText(`${agent}:${projectId}:${text}`);
    const limits = await resolveLimits(admin, profile, projectId);
    const usage = await loadUsage(admin, profile.id, projectId);
    const percent = usagePercent(usage, limits);

    const baseEvent = {
      profile_id: profile.id,
      project_id: projectId,
      conversation_id: conversation.id,
      client_id: profile.client_id,
      supplier_id: access.supplierId,
      actor_role: effectiveRole(agent, profile),
      agent_type: agent,
      model: "",
      message_hash: messageHash,
      message_length: text.length,
    };

    /** Denies the request, records it, and never reaches the expensive model. */
    const deny = async (
      opts: { outcome: "rejected" | "blocked"; classification: string; reason: string; message: string; status: number; tokens?: number },
    ) => {
      await recordEvent(admin, {
        ...baseEvent,
        classification: opts.classification,
        outcome: opts.outcome,
        rejection_reason: opts.reason,
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: opts.tokens ?? 0,
        estimated_cost: 0,
      });
      return json({ error: opts.message, limited: true, classification: opts.classification }, opts.status);
    };

    if (text.length > limits.maximum_message_length) {
      return await deny({
        outcome: "rejected", classification: "unclear", reason: "Message exceeded the maximum length.",
        message: `Message is too long (max ${limits.maximum_message_length} characters).`, status: 400,
      });
    }

    if (limits.is_paused) {
      return await deny({
        outcome: "blocked", classification: "repeated_spam", reason: `AI paused at ${limits.pausedScope} level.`,
        message: he
          ? "הגישה ל-AI מושהית זמנית עקב שימוש חריג. יניב עודכן."
          : "AI access is temporarily paused because of unusual usage. Yaniv has been notified.",
        status: 429,
      });
    }

    // Cooldown between consecutive requests.
    if (usage.lastActivityAt && limits.cooldown_seconds > 0) {
      const gap = (Date.now() - new Date(usage.lastActivityAt).getTime()) / 1000;
      if (gap < limits.cooldown_seconds) {
        return await deny({
          outcome: "rejected", classification: "repeated_spam", reason: "Cooldown between messages.",
          message: he ? "רגע אחד לפני ההודעה הבאה." : "Please wait a moment before sending the next message.",
          status: 429,
        });
      }
    }

    // Hard stop on usage limits.
    if (percent >= limits.hard_stop_threshold_percent) {
      await raiseAlert(admin, {
        alert_type: "limit_reached", severity: "critical", profile_id: profile.id, project_id: projectId,
        title: "AI usage limit reached",
        detail: `${profile.full_name || profile.role} reached ${percent}% of the AI usage allowance.`,
        metadata: { percent, usage, project: access.project.name },
      });
      return await deny({
        outcome: "blocked", classification: "repeated_spam", reason: `Usage at ${percent}% of allowance.`,
        message: he
          ? "מכסת השימוש ב-AI לפרויקט הזה הסתיימה. אנא פנה ליניב כדי להמשיך."
          : "The AI usage limit for this project has been reached. Please contact Yaniv to continue.",
        status: 429,
      });
    }
    if (percent >= 90) {
      await raiseAlert(admin, {
        alert_type: "limit_90", severity: "warning", profile_id: profile.id, project_id: projectId,
        title: "AI usage at 90%", detail: `${profile.full_name || profile.role} is at ${percent}% of the allowance.`,
        metadata: { percent },
      });
    } else if (percent >= limits.warning_threshold_percent) {
      await raiseAlert(admin, {
        alert_type: "limit_warning", severity: "info", profile_id: profile.id, project_id: projectId,
        title: `AI usage at ${percent}%`, detail: `${profile.full_name || profile.role} passed the warning threshold.`,
        metadata: { percent },
      });
    }

    // Repeated / spam behaviour.
    const spam = await detectSpam(admin, profile.id, messageHash);
    if (spam.burst >= 10) {
      await raiseAlert(admin, {
        alert_type: "message_burst", severity: "warning", profile_id: profile.id, project_id: projectId,
        title: "Rapid AI message burst", detail: `${spam.burst} AI messages in the last minute.`, metadata: spam,
      });
      return await deny({
        outcome: "rejected", classification: "repeated_spam", reason: "Too many messages in a short time.",
        message: he ? "יותר מדי הודעות בזמן קצר. נסה שוב בעוד רגע." : "Too many messages in a short time. Please wait a moment.",
        status: 429,
      });
    }
    if (spam.isSpam) {
      await admin.from("ai_usage_limits").insert({
        scope_type: "profile", scope_id: profile.id, is_paused: true,
        paused_reason: "Automatic pause after repeated identical or unrelated prompts.",
        paused_until: new Date(Date.now() + 60 * 60_000).toISOString(),
        note: "Created automatically by the AI guard.",
      }).select("id").maybeSingle().then(async ({ error }: any) => {
        if (error) {
          await admin.from("ai_usage_limits").update({
            is_paused: true,
            paused_reason: "Automatic pause after repeated identical or unrelated prompts.",
            paused_until: new Date(Date.now() + 60 * 60_000).toISOString(),
          }).eq("scope_type", "profile").eq("scope_id", profile.id);
        }
      });
      await raiseAlert(admin, {
        alert_type: "repeated_spam", severity: "critical", profile_id: profile.id, project_id: projectId,
        title: "AI access paused automatically",
        detail: `Repeated prompts detected (${spam.identical} identical, ${spam.rejected} unrelated). AI paused for one hour.`,
        metadata: spam,
      });
      return await deny({
        outcome: "blocked", classification: "repeated_spam", reason: "Repeated identical or unrelated prompts.",
        message: he
          ? "הגישה ל-AI מושהית זמנית עקב שימוש חריג. יניב עודכן."
          : "AI access is temporarily paused because of unusual usage. Yaniv has been notified.",
        status: 429,
      });
    }

    // Project-scope relevance check on a low-cost model, before the main model.
    const verdict = await classifyRequest(text, {
      projectName: access.project.name,
      projectSummary: access.project.summary ?? "",
      agentType: agent,
    });
    await recordClassification(admin, {
      profile_id: profile.id, project_id: projectId, conversation_id: conversation.id, agent_type: agent,
      classification: verdict.classification, confidence: verdict.confidence, reason: verdict.reason,
      message_excerpt: text.slice(0, 300), message_hash: messageHash,
      classifier_model: verdict.model, classifier_tokens: verdict.tokens,
    });

    if (verdict.classification === "abusive") {
      await raiseAlert(admin, {
        alert_type: "abusive_prompt", severity: "critical", profile_id: profile.id, project_id: projectId,
        title: "Abusive or injection prompt blocked", detail: verdict.reason,
        metadata: { excerpt: text.slice(0, 300) },
      });
      return await deny({
        outcome: "rejected", classification: "abusive", reason: verdict.reason,
        message: he ? PROJECT_ONLY_MESSAGE_HE : PROJECT_ONLY_MESSAGE, status: 400, tokens: verdict.tokens,
      });
    }
    if (verdict.classification === "unrelated" || verdict.classification === "unclear") {
      const replyBody = verdict.classification === "unrelated"
        ? (he ? PROJECT_ONLY_MESSAGE_HE : PROJECT_ONLY_MESSAGE)
        : (he ? UNCLEAR_MESSAGE_HE : UNCLEAR_MESSAGE);
      if (verdict.classification === "unrelated" && spam.rejected >= 2) {
        await raiseAlert(admin, {
          alert_type: "repeated_unrelated", severity: "warning", profile_id: profile.id, project_id: projectId,
          title: "Repeated unrelated AI prompts",
          detail: `${spam.rejected + 1} unrelated prompts in the last 30 minutes.`,
          metadata: { excerpt: text.slice(0, 300) },
        });
      }
      const { data: um } = await admin.from("chat_messages").insert({
        conversation_id: conversation.id, project_id: projectId, sender_type: cfg.senderType,
        sender_profile_id: profile.id, body: text, visibility: cfg.visibility, status: "sent",
      }).select("*").single();
      const { data: am } = await admin.from("chat_messages").insert({
        conversation_id: conversation.id, project_id: projectId, sender_type: "ai_agent", agent_type: agent,
        body: replyBody, visibility: cfg.visibility, status: "sent",
        structured_payload: { language: he ? "he" : "en", questions: [], proposed_actions: [], rejected_actions: [], scope_limited: true },
      }).select("*").single();
      await recordEvent(admin, {
        ...baseEvent, classification: verdict.classification, outcome: "rejected",
        rejection_reason: verdict.reason, model: verdict.model,
        input_tokens: verdict.tokens, output_tokens: 0, total_tokens: verdict.tokens,
        estimated_cost: estimateCost(verdict.model, verdict.tokens),
      });
      return json({
        conversation, userMessage: um, aiMessage: am, draft: null,
        pendingActions: [], rejectedActions: [], scopeLimited: true,
      });
    }

    // Cached answer for an identical, still-fresh project question.
    const cacheKey = `${projectId}:${agent}:${effectiveRole(agent, profile)}:${messageHash}`;
    const cached = await getCachedResponse(admin, cacheKey);
    if (cached) {
      const { data: um } = await admin.from("chat_messages").insert({
        conversation_id: conversation.id, project_id: projectId, sender_type: cfg.senderType,
        sender_profile_id: profile.id, body: text, visibility: cfg.visibility, status: "sent",
      }).select("*").single();
      const { data: am } = await admin.from("chat_messages").insert({
        conversation_id: conversation.id, project_id: projectId, sender_type: "ai_agent", agent_type: agent,
        body: cached, visibility: cfg.visibility, status: "sent",
        structured_payload: { language: he ? "he" : "en", questions: [], proposed_actions: [], rejected_actions: [], cached: true },
      }).select("*").single();
      await recordEvent(admin, {
        ...baseEvent, classification: "project_relevant", outcome: "cached",
        model: MODEL, input_tokens: 0, output_tokens: 0, total_tokens: 0, estimated_cost: 0,
      });
      return json({ conversation, userMessage: um, aiMessage: am, draft: null, pendingActions: [], rejectedActions: [] });
    }

    const { data: userMessage, error: userErr } = await admin.from("chat_messages").insert({
      conversation_id: conversation.id,
      project_id: projectId,
      sender_type: cfg.senderType,
      sender_profile_id: profile.id,
      body: text,
      visibility: cfg.visibility,
      status: "sent",
    }).select("*").single();
    if (userErr) return json({ error: userErr.message }, 500);

    const { data: run } = await admin.from("ai_runs").insert({
      project_id: projectId,
      conversation_id: conversation.id,
      agent_type: agent,
      requested_by_profile_id: profile.id,
      model: MODEL,
      status: "generating",
    }).select("*").single();

    const started = Date.now();
    try {
      const history = await loadMessages(agent, conversation.id, profile.role);
      const bundle = await loadBundle(admin, projectId);
      const fullContext = await buildContext(agent, access.project, access.supplierId, bundle);
      const { recent, summary } = await compressHistory(
        conversation.id, projectId, effectiveRole(agent, profile), history.slice(0, -1),
      );
      const context = (summary ? `${fullContext}\n\n--- EARLIER CONVERSATION (compressed) ---\n${summary}` : fullContext)
        .slice(0, limits.maximum_context_size);
      const raw = await callModel(systemPrompt(agent), context, recent, text, limits.maximum_output_tokens);
      if (!raw) throw new Error("The AI returned an empty response.");
      const parsed = parseModelOutput(raw);

      // Validate every proposed action server-side before it is ever shown as confirmable.
      const rawActions = Array.isArray(parsed.proposed_actions) ? parsed.proposed_actions.slice(0, 3) : [];
      const validated: any[] = [];
      const rejected: { kind: string; reason: string }[] = [];
      for (const candidate of rawActions) {
        const kind = String(candidate?.kind ?? "");
        if (!ALLOWED_KINDS[agent].includes(kind as ActionKind)) {
          rejected.push({ kind: kind || "(none)", reason: "This assistant is not allowed to propose that change." });
          continue;
        }
        const result = await validateAction(ctx, bundle, candidate);
        if ("error" in result) rejected.push({ kind, reason: result.error });
        else validated.push(result);
      }

      const { data: aiMessage, error: aiErr } = await admin.from("chat_messages").insert({
        conversation_id: conversation.id,
        project_id: projectId,
        sender_type: "ai_agent",
        agent_type: agent,
        body: parsed.reply,
        structured_payload: {
          language: parsed.language ?? "en",
          questions: parsed.questions ?? [],
          proposed_actions: validated.map((v) => ({ kind: v.kind, title: v.title, summary: v.summary })),
          rejected_actions: rejected,
          drafts: parsed.drafts ?? {},
          ai_draft: true,
        },
        visibility: cfg.visibility,
        status: "sent",
      }).select("*").single();
      if (aiErr) throw new Error(aiErr.message);

      let draftRow = null;
      if (parsed.drafts && Object.keys(parsed.drafts).length > 0) {
        const { data } = await admin.from("ai_generated_drafts").insert({
          project_id: projectId,
          conversation_id: conversation.id,
          message_id: aiMessage.id,
          draft_type: agent === "project_guide" ? "project_brief" : agent,
          payload: parsed.drafts,
          status: "awaiting_agency_review",
          visibility: agent === "project_guide" ? "client_agency" : cfg.visibility,
          agent_type: agent,
          created_by_profile_id: profile.id,
        }).select("*").single();
        draftRow = data;
      }

      const pendingActions: any[] = [];
      for (const item of validated) {
        const spec = ACTION_SPECS[item.kind as ActionKind];
        const { data } = await admin.from("ai_generated_drafts").insert({
          project_id: projectId,
          conversation_id: conversation.id,
          message_id: aiMessage.id,
          draft_type: "proposed_action",
          action_kind: item.kind,
          confirm_role: spec.confirmRole,
          agent_type: agent,
          estimate_id: item.estimateId,
          estimate_version: item.estimateVersion,
          payload: { ...item.payload, title: item.title, summary: item.summary },
          preview: item.preview,
          status: "awaiting_agency_review",
          visibility: spec.visibility,
          created_by_profile_id: profile.id,
        }).select("*").single();
        if (data && draftVisibleTo(data, profile) && canConfirm(data, agent, profile)) pendingActions.push(data);
      }

      await admin.from("ai_runs").update({
        status: "succeeded", latency_ms: Date.now() - started,
      }).eq("id", run?.id);

      return json({ conversation, userMessage, aiMessage, draft: draftRow, pendingActions, rejectedActions: rejected });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("project-chat AI failure:", message);
      await admin.from("ai_runs").update({
        status: "failed", error: message.slice(0, 800), latency_ms: Date.now() - started,
      }).eq("id", run?.id);
      return json({ error: message, userMessage }, 502);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("project-chat error:", message);
    return json({ error: message }, 500);
  }
});