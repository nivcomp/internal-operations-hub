import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import {
  ACTION_SPECS, applyAction, loadBundle, validateAction, type ActionKind, type Ctx,
} from "../_shared/actions.ts";
import {
  detectSpam, estimateCost, estimateTokens, hashText, isHebrew, loadUsage,
  raiseAlert, recordEvent, resolveLimits, usagePercent,
} from "../_shared/guard.ts";
import {
  allowedTargets, buildCopilotContext, contextLabel, resolveAccess, type ScreenHint,
} from "./context.ts";
import { buildOperatorSnapshot } from "./context.ts";
import {
  buildOperatorAction, catalogForPrompt, OPERATOR_ACTIONS, runOperatorAction, type OperatorCtx,
} from "../_shared/operator.ts";

const MODEL = "openai/gpt-5.6-sol";
const GATEWAY = "https://ai.gateway.lovable.dev/v1/responses";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const AGENT_FOR_ROLE = {
  agency_admin: "agency_control",
  client: "project_guide",
  supplier: "work_assistant",
} as const;

const VIEWS_FOR_ROLE: Record<string, string[]> = {
  agency_admin: [
    "home", "dashboard", "action-queue", "clients", "client-detail", "client-portal",
    "projects", "project-detail", "change-requests", "suppliers", "supplier-detail",
    "supplier-time", "supplier-portal", "pricing-margin", "payments-hours",
    "ai-workbench", "ai-usage", "access-management",
  ],
  client: ["home", "client-portal"],
  supplier: ["home", "supplier-portal"],
};

const ALLOWED_KINDS: Record<string, ActionKind[]> = {
  agency_control: [
    "add_estimate_items", "update_estimate_items", "update_estimate_settings", "assign_supplier",
    "request_supplier_review", "accept_supplier_review", "publish_client_estimate", "approve_fixed_price",
  ],
  project_guide: ["save_client_scenario", "create_change_request"],
  work_assistant: ["supplier_review_response"],
};

function systemPrompt(role: string, agent: string, label: string) {
  const kinds = ALLOWED_KINDS[agent].join(", ");
  const views = VIEWS_FOR_ROLE[role].join(", ");
  const shared = `You are "Copilot", a compact assistant that lives inside an agency delivery workspace and follows the user from screen to screen.
You see a role-filtered snapshot of the CURRENT screen and entity. Never invent data that is not in the context; if something is missing, say it is missing.
Answer in the same language the user writes or speaks in (Hebrew or English). Be calm and short: at most 3 sentences in "reply" unless the user explicitly asks for detail.
You are currently: ${label}.

You MUST reply with a single JSON object and nothing else:
{"reply": string, "language": "he"|"en", "observation": string, "chips": [{"label": string, "type": string, ...}], "proposed_actions": [{"kind": string, "title": string, "summary": string, "payload": object}]}

"observation" is one short sentence naming the single most important problem or next step on this screen (empty string if there is none).

"chips" are at most 3 clickable shortcuts. Allowed shapes:
- {"label","type":"navigate","view":"<one of: ${views}>"}
- {"label","type":"open_project","id":"<project uuid from the context>"}
- {"label","type":"open_client","id":"<client uuid from the context>"}
- {"label","type":"open_supplier","id":"<supplier uuid from the context>"}
- {"label","type":"focus_field","field":"<a form field name from the screen context>"}
- {"label","type":"suggest_value","field":"<form field name>","value":"<value to put in the field>"}
- {"label","type":"back"}
Only reference ids and field names that appear in the context. Chips that reference anything else are dropped.
"suggest_value" only fills an unsaved form field for the user to review; it never saves anything.

"proposed_actions" are real data changes. You can NEVER change data yourself. Allowed kinds for you: ${kinds || "none"}.
NEVER claim you saved, approved, assigned, priced or sent anything — say you prepared a proposal that the user must confirm.
Propose at most 2 actions, and only when the user clearly asked for that change.

Stay inside this workspace: projects, clients, suppliers, scope, estimates, budget, dates, approvals, payments, time entries, navigation and forms. For anything unrelated, reply in one sentence that you only help with this workspace.`;

  if (role === "client") {
    return `${shared}
You serve a CLIENT. You may only discuss their own projects. Never state or imply supplier cost, supplier rates, agency margin, internal notes or any other client's data — that information is not available to you. Estimates are ranges prepared by the agency, never a final promise, and you can never promise a delivery date.`;
  }
  if (role === "supplier") {
    return `${shared}
You serve a SUPPLIER. You may only discuss work assigned to them, their own profile, availability, rate, estimate reviews and their own time entries. Never state client price, client budget, agency margin, other suppliers or unassigned projects — that information is not available to you.`;
  }
  return `${shared}
You serve the AGENCY OWNER. You may discuss client price, supplier cost, margin, risk, delivery and internal notes. Point out missing calculation rates, unrealistic dates, unapproved scope, blocked payments and margin risk, but never approve, price or assign anything yourself.`;
}

/** Operator Mode is appended for agency admins only. */
function operatorPrompt() {
  return `

--- OPERATOR MODE (agency owner only) ---
You also act as the system operator for the agency owner. You receive a SYSTEM SNAPSHOT covering every client, project, supplier, estimate, payment and pending time entry, so you can answer cross-project questions directly ("what needs my attention", "which projects have no supplier", "who has not paid", "which margin is below 35%").
Answer style for the owner: one direct sentence with the answer, then the few supporting records, then the single recommended next step. Never dump long tables unless asked.

To change data, add an "operator_actions" array to your JSON (at most 6 entries, in execution order):
{"action_type": string, "input": object, "why": string, "plan_title": string}
Only these action types exist:
${catalogForPrompt()}

Rules for operator_actions:
- Use ids from the snapshot when you have them (clientId, projectId, supplierId). Otherwise pass "name" and I will resolve it.
- Never guess between two matching records; if you are unsure, ask instead of proposing.
- Low-risk answers, navigation and explanations need no action at all.
- Every action is queued and previewed. Medium and high risk actions require the owner's explicit confirmation before anything is written.
- For several steps that belong together, give them the same "plan_title" and list them in order.
- Say that you prepared the action(s) for confirmation. Never claim anything was already saved, paid, approved, assigned or sent.
- Prefer archiving over deleting when history exists.`;
}

async function resolveActor(authHeader: string | null) {
  if (!authHeader?.startsWith("Bearer ")) return { error: "Unauthorized", status: 401 } as const;
  const { data, error } = await admin.auth.getClaims(authHeader.slice(7));
  if (error || !data?.claims?.sub) return { error: "Unauthorized", status: 401 } as const;
  const { data: profile } = await admin.from("profiles")
    .select("id, full_name, email, role, client_id, supplier_id, is_active")
    .eq("id", data.claims.sub as string).maybeSingle();
  if (!profile || profile.is_active === false) return { error: "No active profile", status: 403 } as const;
  return { profile } as const;
}

async function callModel(system: string, context: string, history: any[], userText: string) {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("AI is not configured (missing LOVABLE_API_KEY).");
  const input = [
    { role: "system", content: `${system}\n\n--- AUTHORITATIVE CONTEXT (role-filtered) ---\n${context}` },
    ...history.slice(-10).map((m: any) => ({
      role: m.sender === "assistant" ? "assistant" : "user",
      content: String(m.body ?? "").slice(0, 1500),
    })),
    { role: "user", content: userText },
  ];
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({
      model: MODEL, input, stream: true, store: false,
      max_output_tokens: 4000,
      reasoning: { effort: "low", summary: "auto" },
    }),
  });
  if (!res.ok || !res.body) {
    throw new Error(`AI request failed [${res.status}]: ${(await res.text()).slice(0, 400)}`);
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
        } catch { /* partial */ }
      }
    }
  }
  return text.trim();
}

function parseOutput(raw: string) {
  const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      const parsed = JSON.parse(cleaned.slice(start, end + 1));
      if (typeof parsed.reply === "string") return parsed;
    } catch { /* fall through */ }
  }
  return { reply: raw, language: "en", observation: "", chips: [], proposed_actions: [] };
}

/** Chips are executed in the browser, so they are validated against what the role may reach. */
function sanitizeChips(raw: any, role: string, targets: any, hint: ScreenHint) {
  const fieldNames = new Set((hint.fields ?? []).map((f) => f.name));
  const views = new Set(VIEWS_FOR_ROLE[role] ?? []);
  const out: any[] = [];
  for (const chip of Array.isArray(raw) ? raw : []) {
    const label = String(chip?.label ?? "").slice(0, 40);
    const type = String(chip?.type ?? "");
    if (!label) continue;
    if (type === "navigate" && views.has(String(chip.view))) out.push({ label, type, view: String(chip.view) });
    else if (type === "open_project" && targets.projects.has(String(chip.id))) out.push({ label, type, id: String(chip.id) });
    else if (type === "open_client" && targets.clients.has(String(chip.id))) out.push({ label, type, id: String(chip.id) });
    else if (type === "open_supplier" && targets.suppliers.has(String(chip.id))) out.push({ label, type, id: String(chip.id) });
    else if (type === "focus_field" && fieldNames.has(String(chip.field))) out.push({ label, type, field: String(chip.field) });
    else if (type === "suggest_value" && fieldNames.has(String(chip.field))) {
      out.push({ label, type, field: String(chip.field), value: String(chip.value ?? "").slice(0, 400) });
    } else if (type === "back") out.push({ label, type });
    if (out.length >= 3) break;
  }
  return out;
}

async function saveMessage(row: Record<string, unknown>) {
  const { data } = await admin.from("copilot_messages").insert(row).select("*").single();
  return data;
}

function operatorCtx(profile: any, authHeader: string, source: string, command: string): OperatorCtx {
  return {
    admin, profile, authHeader,
    supabaseUrl: Deno.env.get("SUPABASE_URL")!,
    source: source === "voice" ? "voice" : source === "chip" ? "chip" : "text",
    command,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const actor = await resolveActor(req.headers.get("Authorization"));
    if ("error" in actor) return json({ error: actor.error }, actor.status);
    const profile = actor.profile;
    const role: string = profile.role;
    const agent = AGENT_FOR_ROLE[role as keyof typeof AGENT_FOR_ROLE];
    if (!agent) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const action: string = body.action ?? "history";
    const hint: ScreenHint = (body.screen && typeof body.screen === "object") ? body.screen : {};
    const access = await resolveAccess(admin, profile, hint);
    const label = contextLabel(access, hint);
    const operatorMode = role === "agency_admin";

    // ---------------------------------------------------------- Operator Mode
    if (action.startsWith("operator_")) {
      if (!operatorMode) return json({ error: "Forbidden" }, 403);
      const authHeader = req.headers.get("Authorization")!;

      if (action === "operator_queue") {
        const { data } = await admin.from("copilot_operator_actions")
          .select("*").eq("profile_id", profile.id)
          .order("created_at", { ascending: false }).limit(60);
        return json({ actions: data ?? [] });
      }

      const ids: string[] = Array.isArray(body.ids)
        ? body.ids.map((v: unknown) => String(v)).slice(0, 20)
        : body.id ? [String(body.id)] : [];
      if (!ids.length) return json({ error: "No action selected." }, 400);
      const { data: rows } = await admin.from("copilot_operator_actions")
        .select("*").in("id", ids).eq("profile_id", profile.id);
      const queued = (rows ?? []).sort((a: any, b: any) => a.plan_step - b.plan_step);
      if (!queued.length) return json({ error: "Action not found." }, 404);

      if (action === "operator_cancel") {
        await admin.from("copilot_operator_actions")
          .update({ status: "cancelled" }).in("id", queued.map((r: any) => r.id))
          .in("status", ["proposed", "awaiting_confirmation", "failed"]);
        return json({ ok: true });
      }

      if (action === "operator_confirm" || action === "operator_retry") {
        const results: any[] = [];
        let stopped = false;
        for (const row of queued) {
          if (stopped) {
            await admin.from("copilot_operator_actions")
              .update({ status: "cancelled", failure_reason: "Skipped because an earlier step failed." })
              .eq("id", row.id);
            results.push({ id: row.id, ok: false, skipped: true });
            continue;
          }
          if (!["proposed", "awaiting_confirmation", "failed"].includes(row.status)) {
            results.push({ id: row.id, ok: false, error: "This action was already handled." });
            continue;
          }
          await admin.from("copilot_operator_actions")
            .update({ status: "executing", confirmed_at: new Date().toISOString(), failure_reason: null })
            .eq("id", row.id);
          const ctx = operatorCtx(profile, authHeader, row.source, row.source_command);
          const result = await runOperatorAction(ctx, { ...row, confirmed_at: new Date().toISOString() });
          results.push({ id: row.id, ...result });
          if (!result.ok) stopped = true;
        }
        const completed = results.filter((r) => r.ok).length;
        const status = completed === 0 ? "failed" : completed === results.length ? "completed" : "partially_completed";
        const { data: fresh } = await admin.from("copilot_operator_actions")
          .select("*").eq("profile_id", profile.id).order("created_at", { ascending: false }).limit(60);
        return json({ ok: status !== "failed", status, results, actions: fresh ?? [] });
      }

      return json({ error: "Unknown operator action" }, 400);
    }

    if (action === "history") {
      const { data: messages } = await admin.from("copilot_messages")
        .select("*").eq("profile_id", profile.id).eq("scope_key", access.scopeKey)
        .order("created_at", { ascending: false }).limit(30);
      const { data: state } = await admin.from("copilot_state")
        .select("preferences").eq("profile_id", profile.id).maybeSingle();
      const limits = await resolveLimits(admin, profile, access.projectId ?? "");
      const usage = await loadUsage(admin, profile.id, access.projectId ?? "");
      const { data: operatorActions } = operatorMode
        ? await admin.from("copilot_operator_actions").select("*")
            .eq("profile_id", profile.id).order("created_at", { ascending: false }).limit(60)
        : { data: [] };
      return json({
        scopeKey: access.scopeKey,
        label,
        messages: (messages ?? []).reverse(),
        preferences: state?.preferences ?? {},
        operatorMode,
        operatorActions: operatorActions ?? [],
        usage: {
          percentUsed: usagePercent(usage, limits),
          messagesToday: usage.dayMessages,
          dailyMessageLimit: limits.daily_message_limit,
          paused: limits.is_paused,
          pausedReason: limits.paused_reason,
          maximumMessageLength: limits.maximum_message_length,
        },
      });
    }

    if (action === "save_preferences") {
      const preferences = (body.preferences && typeof body.preferences === "object") ? body.preferences : {};
      await admin.from("copilot_state")
        .upsert({ profile_id: profile.id, preferences }, { onConflict: "profile_id" });
      return json({ ok: true });
    }

    if (action === "clear") {
      await admin.from("copilot_messages").delete()
        .eq("profile_id", profile.id).eq("scope_key", access.scopeKey);
      return json({ ok: true });
    }

    if (action === "confirm_action" || action === "cancel_action") {
      const draftId = String(body.draftId ?? "");
      const { data: draft } = await admin.from("ai_generated_drafts").select("*").eq("id", draftId).maybeSingle();
      if (!draft || !draft.action_kind) return json({ error: "Proposal not found" }, 404);
      if (draft.status !== "awaiting_agency_review") return json({ error: "This proposal was already handled." }, 409);
      const spec = ACTION_SPECS[draft.action_kind as ActionKind];
      if (!spec || spec.confirmRole !== role) return json({ error: "Forbidden" }, 403);
      // Re-authorize the project the draft belongs to for this specific user.
      const draftAccess = await resolveAccess(admin, profile, { projectId: draft.project_id, entityType: "project" });
      if (!draftAccess.project) return json({ error: "Forbidden" }, 403);

      if (action === "cancel_action") {
        await admin.from("ai_generated_drafts")
          .update({ status: "cancelled", applied_by_profile_id: profile.id, applied_at: new Date().toISOString() })
          .eq("id", draft.id);
        return json({ ok: true, status: "cancelled" });
      }

      const ctx: Ctx = {
        admin, projectId: draft.project_id, project: draftAccess.project, profile,
        supplierId: role === "supplier" ? profile.supplier_id : null, agent: agent as any,
      };
      const summary = await applyAction(ctx, draft);
      await admin.from("ai_generated_drafts").update({
        status: "applied", applied_by_profile_id: profile.id, applied_at: new Date().toISOString(),
      }).eq("id", draft.id);
      await admin.from("activity_logs").insert({
        label: `${spec.label} confirmed (copilot)`,
        detail: `${draftAccess.project.name}: ${summary} (proposed by copilot, confirmed by ${profile.full_name || role})`,
      });
      return json({ ok: true, status: "applied", summary });
    }

    if (action !== "send") return json({ error: "Unknown action" }, 400);

    const limits = await resolveLimits(admin, profile, access.projectId ?? "");
    const text = String(body.text ?? "").trim().slice(0, Math.max(200, limits.maximum_message_length));
    if (!text) return json({ error: "Empty message" }, 400);
    const he = isHebrew(text);

    const usage = await loadUsage(admin, profile.id, access.projectId ?? "");
    const percent = usagePercent(usage, limits);
    if (limits.is_paused || percent >= limits.hard_stop_threshold_percent) {
      return json({
        error: he
          ? "השימוש ב-AI מושהה כרגע. פנה ליניב כדי להמשיך."
          : "AI usage is currently paused for this account. Please contact Yaniv.",
      }, 429);
    }
    const messageHash = await hashText(text);
    const spam = await detectSpam(admin, profile.id, messageHash);
    if (spam.burst >= 10) {
      return json({ error: he ? "יותר מדי הודעות בזמן קצר." : "Too many messages in a short time." }, 429);
    }

    const { data: prior } = await admin.from("copilot_messages")
      .select("sender, body").eq("profile_id", profile.id).eq("scope_key", access.scopeKey)
      .order("created_at", { ascending: false }).limit(10);
    const history = (prior ?? []).reverse();

    const userMessage = await saveMessage({
      profile_id: profile.id, scope_key: access.scopeKey,
      entity_type: hint.entityType ?? "none",
      entity_id: access.projectId ?? access.clientId ?? access.supplierId ?? null,
      project_id: access.projectId, sender: "user", body: text,
      payload: { page: String(hint.page ?? ""), voice: body.viaVoice === true },
    });

    const started = Date.now();
    let context = await buildCopilotContext(admin, profile, access, hint);
    if (operatorMode) context += `\n${await buildOperatorSnapshot(admin)}`;
    context = context.slice(0, Math.max(limits.maximum_context_size, operatorMode ? 60000 : 0));
    let parsed: any;
    try {
      const prompt = systemPrompt(role, agent, label) + (operatorMode ? operatorPrompt() : "");
      const raw = await callModel(prompt, context, history, text);
      if (!raw) throw new Error("The AI returned an empty response.");
      parsed = parseOutput(raw);
    } catch (err) {
      await recordEvent(admin, {
        profile_id: profile.id, project_id: access.projectId, agent_type: `copilot_${agent}`,
        actor_role: role, classification: "project_relevant", outcome: "failed",
        message_hash: messageHash, message_length: text.length, model: MODEL,
        rejection_reason: String((err as Error).message).slice(0, 300),
        duration_ms: Date.now() - started,
      });
      return json({ error: (err as Error).message }, 502);
    }

    const targets = await allowedTargets(admin, profile);
    const chips = sanitizeChips(parsed.chips, role, targets, hint);

    // Real data changes go through the same validated, human-confirmed pipeline as project chat.
    const pendingActions: any[] = [];
    const rejectedActions: { kind: string; reason: string }[] = [];
    const rawActions = Array.isArray(parsed.proposed_actions) ? parsed.proposed_actions.slice(0, 2) : [];
    if (rawActions.length && access.project) {
      const ctx: Ctx = {
        admin, projectId: access.project.id, project: access.project, profile,
        supplierId: role === "supplier" ? profile.supplier_id : null, agent: agent as any,
      };
      const bundle = await loadBundle(admin, access.project.id);
      for (const candidate of rawActions) {
        const kind = String(candidate?.kind ?? "");
        if (!ALLOWED_KINDS[agent].includes(kind as ActionKind)) {
          rejectedActions.push({ kind, reason: "This assistant may not propose that change." });
          continue;
        }
        const validated = await validateAction(ctx, bundle, candidate);
        if ("error" in validated) {
          rejectedActions.push({ kind, reason: validated.error });
          continue;
        }
        const spec = ACTION_SPECS[validated.kind];
        const { data: draft } = await admin.from("ai_generated_drafts").insert({
          project_id: access.project.id,
          draft_type: "copilot_action",
          action_kind: validated.kind,
          confirm_role: spec.confirmRole,
          agent_type: agent,
          status: "awaiting_agency_review",
          visibility: spec.visibility,
          payload: validated.payload,
          preview: validated.preview,
        }).select("*").single();
        if (draft) pendingActions.push({ ...draft, title: validated.title, summary: validated.summary });
      }
    } else if (rawActions.length) {
      for (const candidate of rawActions) {
        rejectedActions.push({ kind: String(candidate?.kind ?? ""), reason: "Open the project first so the change can be checked." });
      }
    }

    // Operator Mode: typed, catalog-bound admin operations queued for confirmation.
    const operatorActions: any[] = [];
    if (operatorMode) {
      const source = body.viaVoice === true ? "voice" : "text";
      const ctx = operatorCtx(profile, req.headers.get("Authorization")!, source, text);
      const raw = Array.isArray(parsed.operator_actions) ? parsed.operator_actions.slice(0, 6) : [];
      const planTitle = String(raw[0]?.plan_title ?? "").slice(0, 120);
      const planId = raw.length > 1 ? crypto.randomUUID() : null;
      let step = 0;
      for (const candidate of raw) {
        step += 1;
        const actionType = String(candidate?.action_type ?? "");
        const spec = OPERATOR_ACTIONS[actionType];
        if (!spec) {
          rejectedActions.push({ kind: actionType, reason: "That operation is not in the action catalog." });
          continue;
        }
        // Later steps of a plan often depend on records the earlier steps create,
        // so only the first step is resolved now; the rest stay as a stated plan.
        const validated = await buildOperatorAction(ctx, actionType, candidate?.input ?? {});
        if ("error" in validated) {
          // Inside a plan, a later step may depend on a record an earlier step
          // creates, so it is queued and resolved just before it runs.
          if (planId && step > 1) {
            const { data: deferred } = await admin.from("copilot_operator_actions").insert({
              profile_id: profile.id,
              plan_id: planId, plan_title: planTitle || null, plan_step: step,
              action_type: actionType, action_label: `${spec.label} (resolved when the earlier steps finish)`,
              target_type: spec.targetType, target_label: String(candidate?.why ?? "").slice(0, 120),
              source_command: text, source,
              risk_level: spec.risk, requires_confirmation: spec.risk !== "low",
              status: "awaiting_confirmation",
              payload: { __deferred: true, input: candidate?.input ?? {} },
              preview: { fields: [], impact: ["Checked against the live data just before this step runs."] },
            }).select("*").single();
            if (deferred) operatorActions.push(deferred);
            continue;
          }
          rejectedActions.push({ kind: spec.label, reason: validated.error });
          continue;
        }
        const { data: row } = await admin.from("copilot_operator_actions").insert({
          profile_id: profile.id,
          plan_id: planId, plan_title: planTitle || null, plan_step: step,
          action_type: actionType, action_label: validated.summary,
          target_type: spec.targetType, target_id: validated.targetId, target_label: validated.targetLabel,
          source_command: text, source,
          risk_level: validated.risk,
          requires_confirmation: validated.risk !== "low",
          status: validated.risk === "low" ? "proposed" : "awaiting_confirmation",
          payload: validated.payload, preview: validated.preview,
        }).select("*").single();
        if (row) operatorActions.push(row);
      }
    }

    const assistantMessage = await saveMessage({
      profile_id: profile.id, scope_key: access.scopeKey,
      entity_type: hint.entityType ?? "none",
      entity_id: access.projectId ?? access.clientId ?? access.supplierId ?? null,
      project_id: access.projectId, sender: "assistant",
      body: String(parsed.reply ?? "").slice(0, 4000),
      payload: {
        language: parsed.language === "he" || he ? "he" : "en",
        observation: String(parsed.observation ?? "").slice(0, 300),
        chips, rejectedActions,
        pendingActionIds: pendingActions.map((p) => p.id),
        operatorActionIds: operatorActions.map((a) => a.id),
      },
    });

    const inputTokens = estimateTokens(context + text);
    const outputTokens = estimateTokens(String(parsed.reply ?? ""));
    await recordEvent(admin, {
      profile_id: profile.id, project_id: access.projectId, client_id: access.clientId,
      supplier_id: access.supplierId, agent_type: `copilot_${agent}`, actor_role: role,
      classification: "project_relevant", outcome: "success",
      message_hash: messageHash, message_length: text.length, model: MODEL,
      input_tokens: inputTokens, output_tokens: outputTokens,
      total_tokens: inputTokens + outputTokens,
      estimated_cost: estimateCost(MODEL, inputTokens + outputTokens),
      duration_ms: Date.now() - started,
    });

    const freshUsage = await loadUsage(admin, profile.id, access.projectId ?? "");
    const freshPercent = usagePercent(freshUsage, limits);
    if (freshPercent >= 90) {
      await raiseAlert(admin, {
        alert_type: "limit_90", severity: "warning", profile_id: profile.id, project_id: access.projectId,
        title: "AI usage at 90%", detail: `${profile.full_name || role} is at ${freshPercent}% of the allowance (copilot).`,
        metadata: { percent: freshPercent, surface: "copilot" },
      });
    }

    return json({
      scopeKey: access.scopeKey,
      label,
      userMessage,
      assistantMessage,
      chips,
      pendingActions,
      operatorActions,
      operatorMode,
      rejectedActions,
      usage: {
        percentUsed: freshPercent,
        messagesToday: freshUsage.dayMessages,
        dailyMessageLimit: limits.daily_message_limit,
        paused: limits.is_paused,
        pausedReason: limits.paused_reason,
        maximumMessageLength: limits.maximum_message_length,
      },
    });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});