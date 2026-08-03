import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import {
  ACTION_SPECS, applyAction, loadBundle, validateAction,
  type ActionKind, type Bundle, type Ctx,
} from "./actions.ts";
import { calendarWeeks, computeHours, perUnitHours, snapshot } from "./estimation.ts";

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

function systemPrompt(agent: AgentType) {
  const shared = `You are part of an agency delivery system. Answer in the same language the user writes in (Hebrew or English). Never invent facts about the project; if information is missing, ask for it.
You MUST reply with a single JSON object and nothing else, in this exact shape:
{"reply": string, "language": "he" | "en", "drafts": object, "questions": string[], "proposed_actions": [{"title": string, "detail": string, "affects": string}]}
"reply" is the message the user sees. "drafts" may be empty. Never put pricing you were not given into any field.`;

  if (agent === "project_guide") {
    return `${shared}
You are the "Project Guide" that helps a CLIENT describe a new project.
Ask ONE clear question at a time. Understand: the business problem, the desired result, who will use it, the current process, existing systems and tools, required integrations, deadlines and priorities, files/examples, constraints, and what is in or out of scope. Explain technical concepts in simple language. Summarize periodically and ask the client to confirm.
Populate "drafts" progressively with any of: project_title, business_problem, desired_outcome, users, current_process, requested_solution, requirements (array), integrations (array), assumptions (array), exclusions (array), risks (array), open_questions (array), suggested_phases (array), acceptance_criteria (array).
Everything you produce is an AI draft awaiting agency review — never promise scope, delivery dates, discounts or final prices. You may only repeat client-facing pricing facts that appear in the supplied context. Never mention supplier cost, supplier rates, agency margin or internal notes; they are not available to you.
If the project scope is already approved and the client asks for something new, say it may be a change to the approved project that the agency will review and price, and add a proposed_action of type change_request.`;
  }
  if (agent === "agency_control") {
    return `${shared}
You are "Agency Control", the internal assistant for the agency owner. You may discuss client price, supplier cost, margin, internal notes and delivery risk.
You may draft scope, phases, supplier briefings, client-friendly summaries, questions and risk lists.
You must NEVER claim to have changed anything. Any change to scope, price, supplier assignment, approval, payment state, project readiness or a client-facing commitment must be returned in "proposed_actions" with the record affected, the previous value and the new value, for the owner to confirm manually.`;
  }
  return `${shared}
You are the "Work Assistant" for an assigned SUPPLIER. Explain the assigned scope simply, explain acceptance criteria and dependencies, say whether the work is approved and funded, help draft progress updates, blocker reports and time-entry descriptions, and help send questions to the agency.
You only know what is in the supplied supplier-safe context. You never know and must never state client price, client hourly rate, agency margin or internal client notes; if asked, say that information is not part of the supplier workspace.
When the supplier asks to log time, do not claim it was saved: return a proposed_action with title "log_time" and detail containing the hours, date and description so it can be confirmed.`;
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

/** Role-safe project context. Pricing separation is enforced here, server-side. */
async function buildContext(agent: AgentType, project: any, supplierId: string | null) {
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

  return lines.join("\n");
}

async function callModel(system: string, context: string, history: any[], userText: string) {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("AI is not configured (missing LOVABLE_API_KEY).");

  const input = [
    { role: "system", content: `${system}\n\n--- PROJECT CONTEXT (role-filtered, authoritative) ---\n${context}` },
    ...history.slice(-20).map((m: any) => ({
      role: m.sender_type === "ai_agent" ? "assistant" : "user",
      content: m.body,
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

    if (action === "history") {
      const messages = await loadMessages(agent, conversation.id, profile.role);
      const { data: drafts } = await admin.from("ai_generated_drafts")
        .select("*").eq("conversation_id", conversation.id).order("created_at", { ascending: false }).limit(5);
      return json({ conversation, messages, drafts: drafts ?? [] });
    }

    if (action !== "send") return json({ error: "Unknown action" }, 400);

    const text = typeof body.body === "string" ? body.body.trim() : "";
    if (!text) return json({ error: "Message body is required" }, 400);
    if (text.length > 4000) return json({ error: "Message is too long (max 4000 characters)" }, 400);

    // Basic abuse protection: cap AI runs per profile per minute.
    const since = new Date(Date.now() - 60_000).toISOString();
    const { count } = await admin.from("ai_runs")
      .select("id", { count: "exact", head: true })
      .eq("requested_by_profile_id", profile.id)
      .gte("created_at", since);
    if ((count ?? 0) >= RATE_LIMIT_PER_MINUTE) {
      return json({ error: "Too many messages in a short time. Please wait a moment." }, 429);
    }

    const cfg = AGENT_CONFIG[agent];
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
      const context = await buildContext(agent, access.project, access.supplierId);
      const raw = await callModel(systemPrompt(agent), context, history.slice(0, -1), text);
      if (!raw) throw new Error("The AI returned an empty response.");
      const parsed = parseModelOutput(raw);

      const { data: aiMessage, error: aiErr } = await admin.from("chat_messages").insert({
        conversation_id: conversation.id,
        project_id: projectId,
        sender_type: "ai_agent",
        agent_type: agent,
        body: parsed.reply,
        structured_payload: {
          language: parsed.language ?? "en",
          questions: parsed.questions ?? [],
          proposed_actions: parsed.proposed_actions ?? [],
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
        }).select("*").single();
        draftRow = data;
      }

      await admin.from("ai_runs").update({
        status: "succeeded", latency_ms: Date.now() - started,
      }).eq("id", run?.id);

      return json({ conversation, userMessage, aiMessage, draft: draftRow });
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