import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { callModel, DEFAULT_MODEL, parseJsonOutput, type ModelMessage } from "../_shared/model.ts";

// AI-first onboarding conversation for invited clients and suppliers.
// It only writes into the existing onboarding_state row for the caller's own
// profile. Project / supplier records are still created by the existing
// security-definer RPCs, called from the browser as the signed-in user.

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const MAX_MESSAGE = 2000;
const MAX_TURNS = 120;

const CLIENT_TOPICS = [
  "business description", "desired outcome", "current workflow", "existing software",
  "integrations", "users", "priorities", "desired completion date", "budget preference",
  "examples", "files", "constraints", "open questions", "optional features",
];

const SUPPLIER_TOPICS = [
  "professional background", "skills", "experience", "technologies", "availability",
  "timezone", "working hours", "preferred communication", "hourly rate", "currency",
  "fixed-price preference", "typical project size", "portfolio links", "certificates", "languages",
];

function clientSystem() {
  return `You are the "AI Project Guide" for an agency delivery workspace. An invited client is planning a new project with you.
Ask about ONE topic at a time, in a warm, plain, non-technical tone. Never show forms or long checklists.
Reply in the same language the client writes in (Hebrew or English).
Topics to cover gradually: ${CLIENT_TOPICS.join(", ")}.
You must NEVER invent prices, hourly rates or commitments. Hours and budget are rough planning ranges only, clearly marked as a draft under agency review.
Never promise delivery dates. Record what the client requests; the agency confirms feasibility later.

Return ONE JSON object and nothing else:
{
  "reply": "your next message, at most 4 short sentences, ending with one question",
  "topic": "the topic you just asked about",
  "complete": false,
  "confidence": 0-100,
  "missing": ["topics still unknown"],
  "document": {
    "summary": "", "businessGoal": "", "currentSituation": "", "desiredOutcome": "",
    "requirements": [], "integrations": [], "workflow": [], "phases": [],
    "openQuestions": [], "assumptions": [], "risks": [], "exclusions": [],
    "timeline": "", "estimatedHoursMin": 0, "estimatedHoursMax": 0,
    "estimatedBudgetNote": "", "requestedDate": "", "scopeVersion": 1
  },
  "flow": { "nodes": [{ "id": "", "label": "", "kind": "user|system|integration|approval|automation" }],
            "edges": [{ "from": "", "to": "", "label": "" }] },
  "answers": {
    "project_name": "", "goal": "", "current_process": "", "existing_systems": "", "users": "",
    "capabilities": "", "pain_points": "", "budget_range": "", "links": "",
    "requested_date": "YYYY-MM-DD or empty", "date_priority": "flexible|preferred|hard", "date_reason": ""
  }
}
Always return the FULL current document, flow and answers (merged with everything learned so far), not only the delta.
Set "complete" to true only once business goal, desired outcome, current workflow, users and a date preference are known.`;
}

function supplierSystem() {
  return `You are the "AI Onboarding Assistant" for suppliers joining an agency delivery workspace.
Ask about ONE topic at a time, short and friendly. Reply in the language the supplier writes in (Hebrew or English).
Topics to cover gradually: ${SUPPLIER_TOPICS.join(", ")}.
Never invent rates, availability or experience. Only record what the supplier says.

Return ONE JSON object and nothing else:
{
  "reply": "your next message, at most 4 short sentences, ending with one question",
  "topic": "", "complete": false, "confidence": 0-100, "missing": [],
  "profile": {
    "background": "", "skills": [], "tools": [], "languages": [], "specialisations": [],
    "experienceYears": 0, "typicalProjectSize": "", "portfolioLinks": [], "certificates": [],
    "availabilityHours": 0, "timezone": "", "workingHours": "", "communication": "",
    "hourlyRate": 0, "currency": "GBP", "fixedPricePreference": "", "earliestStart": "", "responseTime": ""
  },
  "answers": {
    "name": "", "email": "", "phone": "", "country": "", "timezone": "",
    "skills": [], "tools": [], "hourly_rate": "", "currency": "GBP", "weekly_availability": "",
    "portfolio_links": [], "project_types": "", "working_days": "", "earliest_start": "",
    "fixed_price": "", "minimum_engagement": "", "communication": "", "response_time": ""
  }
}
Always return the FULL merged profile and answers, not only the delta.
Set "complete" to true once skills, availability, rate and timezone are known.`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: claims, error: claimsError } = await anon.auth.getClaims(authHeader.replace("Bearer ", ""));
  if (claimsError || !claims?.claims) return json({ error: "Unauthorized" }, 401);
  const userId = claims.claims.sub as string;

  const { data: profile } = await admin
    .from("profiles").select("id, role, is_active, full_name, email, client_id, supplier_id")
    .eq("id", userId).maybeSingle();
  if (!profile || profile.is_active === false) return json({ error: "No active profile" }, 403);
  if (profile.role !== "client" && profile.role !== "supplier") {
    return json({ error: "Onboarding conversations are for invited clients and suppliers." }, 403);
  }

  let body: { action?: string; message?: string; patch?: Record<string, unknown> };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }
  const action = body.action ?? "send";

  // Ensure the onboarding row exists (same table the classic wizard uses).
  let { data: state } = await admin
    .from("onboarding_state").select("*").eq("profile_id", userId).maybeSingle();
  if (!state) {
    const inserted = await admin.from("onboarding_state")
      .insert({ profile_id: userId, role: profile.role }).select("*").maybeSingle();
    state = inserted.data;
  }
  if (!state) return json({ error: "Could not prepare onboarding state." }, 400);

  const answers = (state.answers ?? {}) as Record<string, any>;
  const transcript: Array<{ role: string; body: string; at: string }> = Array.isArray(answers._transcript)
    ? answers._transcript : [];

  if (action === "state") {
    return json({ answers, transcript, completedAt: state.onboarding_completed_at ?? null });
  }

  if (action === "patch") {
    // Manual edits made by the client / supplier in the live document panel.
    const patch = body.patch && typeof body.patch === "object" ? body.patch : {};
    const next = { ...answers, ...patch, _editedAt: new Date().toISOString() };
    const { error } = await admin.from("onboarding_state")
      .update({ answers: next }).eq("profile_id", userId);
    if (error) return json({ error: error.message }, 400);
    return json({ answers: next, transcript });
  }

  if (action !== "send") return json({ error: "Unknown action." }, 400);

  const message = String(body.message ?? "").trim();
  if (!message) return json({ error: "Please write a message." }, 400);
  if (message.length > MAX_MESSAGE) return json({ error: `Please keep messages under ${MAX_MESSAGE} characters.` }, 400);
  if (transcript.length > MAX_TURNS) {
    return json({ error: "This onboarding conversation is very long. Please finish and submit it." }, 429);
  }

  const isClient = profile.role === "client";
  const known = JSON.stringify({
    document: answers._document ?? {},
    profile: answers._profile ?? {},
    flow: answers._flow ?? {},
    answers: Object.fromEntries(Object.entries(answers).filter(([k]) => !k.startsWith("_"))),
  }).slice(0, 12000);

  const input: ModelMessage[] = [
    { role: "system", content: `${isClient ? clientSystem() : supplierSystem()}\n\n--- KNOWN SO FAR (authoritative) ---\n${known}\n\nContact: ${profile.full_name ?? profile.email}` },
    ...transcript.slice(-16).map((entry) => ({
      role: entry.role === "assistant" ? "assistant" as const : "user" as const,
      content: String(entry.body).slice(0, 1500),
    })),
    { role: "user", content: message },
  ];

  const started = Date.now();
  let raw = "";
  try {
    raw = await callModel(input, { maxOutputTokens: 3500 });
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : "AI request failed.";
    await admin.from("ai_runs").insert({
      project_id: null, agent_type: isClient ? "project_guide" : "work_assistant",
      requested_by_profile_id: userId, model: DEFAULT_MODEL, status: "error", error: detail.slice(0, 500),
      latency_ms: Date.now() - started,
    });
    return json({ error: detail }, 400);
  }

  const parsed = parseJsonOutput<Record<string, any>>(raw);
  const reply = String(parsed?.reply ?? raw ?? "").trim() || "Thanks — could you tell me a little more?";

  const nextTranscript = [
    ...transcript,
    { role: "user", body: message, at: new Date().toISOString() },
    { role: "assistant", body: reply, at: new Date().toISOString() },
  ].slice(-200);

  const flatAnswers = parsed?.answers && typeof parsed.answers === "object" ? parsed.answers : {};
  const nextAnswers: Record<string, unknown> = {
    ...answers,
    ...flatAnswers,
    _transcript: nextTranscript,
    _confidence: Number(parsed?.confidence ?? answers._confidence ?? 0),
    _missing: Array.isArray(parsed?.missing) ? parsed.missing : answers._missing ?? [],
    _lastTopic: parsed?.topic ?? answers._lastTopic ?? "",
    _readyToSubmit: Boolean(parsed?.complete),
  };
  if (isClient) {
    if (parsed?.document && typeof parsed.document === "object") nextAnswers._document = parsed.document;
    if (parsed?.flow && typeof parsed.flow === "object") nextAnswers._flow = parsed.flow;
  } else if (parsed?.profile && typeof parsed.profile === "object") {
    nextAnswers._profile = parsed.profile;
  }

  const completion = Math.min(95, Math.round(Number(parsed?.confidence ?? 0)));
  const { error: saveError } = await admin.from("onboarding_state")
    .update({ answers: nextAnswers, completion_percentage: completion }).eq("profile_id", userId);
  if (saveError) return json({ error: saveError.message }, 400);

  await admin.from("ai_runs").insert({
    project_id: null, agent_type: isClient ? "project_guide" : "work_assistant",
    requested_by_profile_id: userId, model: DEFAULT_MODEL, status: "success", error: "",
    latency_ms: Date.now() - started,
  });

  return json({ reply, answers: nextAnswers, transcript: nextTranscript, readyToSubmit: Boolean(parsed?.complete) });
});