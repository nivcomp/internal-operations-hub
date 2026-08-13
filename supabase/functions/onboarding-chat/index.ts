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

type LeadStatus = "invited" | "active" | "awaiting_review" | "paused" | "disqualified" | "promoted";
type LeadTurn = { role: "user" | "assistant" | "agency"; body: string; at: string };

function mapLeadMessages(rows: Array<Record<string, any>>): LeadTurn[] {
  return rows
    .filter((row) => row.visibility === "client_agency")
    .map((row) => ({
      role: row.sender_type === "client" ? "user" : row.sender_type === "agency_admin" ? "agency" : "assistant",
      body: String(row.body ?? ""),
      at: String(row.created_at ?? new Date().toISOString()),
    }));
}

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
  const isClient = profile.role === "client";

  const { data: clientAccount } = isClient && profile.client_id
    ? await admin.from("clients").select("id, name, company, email").eq("id", profile.client_id).maybeSingle()
    : { data: null };

  let body: {
    action?: string;
    message?: string;
    patch?: Record<string, unknown>;
    answers?: Record<string, unknown>;
  };
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
  const identity = isClient ? {
    clientId: String(clientAccount?.id ?? profile.client_id ?? ""),
    clientName: String(clientAccount?.name ?? profile.full_name ?? profile.email ?? ""),
    businessName: String(clientAccount?.company ?? clientAccount?.name ?? profile.full_name ?? ""),
    email: String(profile.email ?? clientAccount?.email ?? ""),
  } : undefined;

  let leadThread: Record<string, any> | null = null;
  let clientTranscript: LeadTurn[] = transcript.map((turn) => ({
    role: turn.role === "assistant" ? "assistant" : "user",
    body: turn.body,
    at: turn.at,
  }));

  if (isClient && profile.client_id) {
    const { data: existingThread } = await admin
      .from("lead_conversations")
      .select("*")
      .eq("profile_id", userId)
      .maybeSingle();

    if (existingThread) {
      leadThread = existingThread;
    } else {
      const { data: invitation } = await admin
        .from("onboarding_invitations")
        .select("id")
        .eq("invited_profile_id", userId)
        .is("project_id", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const { data: insertedThread, error: threadError } = await admin
        .from("lead_conversations")
        .insert({
          profile_id: userId,
          client_id: profile.client_id,
          invitation_id: invitation?.id ?? null,
          status: "active",
          first_opened_at: new Date().toISOString(),
        })
        .select("*")
        .maybeSingle();
      if (threadError || !insertedThread) {
        return json({ error: threadError?.message ?? "Could not prepare the lead conversation." }, 400);
      }
      leadThread = insertedThread;
    }

    if (leadThread.status === "invited") {
      const { data: openedThread } = await admin
        .from("lead_conversations")
        .update({ status: "active", first_opened_at: leadThread.first_opened_at ?? new Date().toISOString() })
        .eq("id", leadThread.id)
        .select("*")
        .maybeSingle();
      leadThread = openedThread ?? leadThread;
    }

    let { data: leadMessages } = await admin
      .from("lead_conversation_messages")
      .select("sender_type, body, visibility, created_at")
      .eq("conversation_id", leadThread.id)
      .order("created_at", { ascending: true })
      .limit(300);

    // Lazy compatibility for a conversation that existed before the inbox
    // migration but was first opened while deployments were rolling out.
    if (!(leadMessages?.length) && transcript.length) {
      await admin.from("lead_conversation_messages").insert(transcript.map((turn, index) => ({
        conversation_id: leadThread!.id,
        sender_type: turn.role === "assistant" ? "ai_agent" : "client",
        sender_profile_id: turn.role === "assistant" ? null : userId,
        body: String(turn.body).slice(0, 10000),
        visibility: "client_agency",
        source_key: `legacy:${index + 1}`,
        created_at: turn.at || new Date().toISOString(),
      })));
      const loaded = await admin
        .from("lead_conversation_messages")
        .select("sender_type, body, visibility, created_at")
        .eq("conversation_id", leadThread.id)
        .order("created_at", { ascending: true })
        .limit(300);
      leadMessages = loaded.data;
    }
    clientTranscript = mapLeadMessages(leadMessages ?? []);
  }

  const clientState = () => ({
    conversationStatus: (leadThread?.status ?? null) as LeadStatus | null,
    statusMessage: String(leadThread?.pause_message ?? ""),
    projectId: leadThread?.project_id ? String(leadThread.project_id) : null,
  });

  if (action === "state") {
    return json({
      answers,
      transcript: isClient ? clientTranscript : transcript,
      identity,
      completedAt: state.onboarding_completed_at ?? null,
      ...(isClient ? clientState() : {}),
    });
  }

  if (action === "patch") {
    if (isClient && leadThread?.status !== "active") {
      return json({ error: "This conversation is not open for editing right now." }, 409);
    }
    // Manual edits made by the client / supplier in the live document panel.
    const patch = body.patch && typeof body.patch === "object" ? body.patch : {};
    const next = { ...answers, ...patch, _editedAt: new Date().toISOString() };
    const { error } = await admin.from("onboarding_state")
      .update({ answers: next }).eq("profile_id", userId);
    if (error) return json({ error: error.message }, 400);
    return json({
      answers: next,
      transcript: isClient ? clientTranscript : transcript,
      identity,
      ...(isClient ? clientState() : {}),
    });
  }

  if (action === "submitForReview") {
    if (!isClient || !leadThread) return json({ error: "Only a client lead can submit for review." }, 403);
    if (leadThread.status === "paused" || leadThread.status === "disqualified") {
      return json({ error: "This conversation is not open for submission." }, 409);
    }
    if (leadThread.status === "promoted") {
      return json({
        answers,
        transcript: clientTranscript,
        identity,
        completedAt: state.onboarding_completed_at ?? null,
        ...clientState(),
      });
    }

    const submittedAnswers = body.answers && typeof body.answers === "object"
      ? { ...answers, ...body.answers }
      : answers;
    const now = new Date().toISOString();
    const wasAwaiting = leadThread.status === "awaiting_review";
    const { data: submittedThread, error: submitError } = await admin
      .from("lead_conversations")
      .update({ status: "awaiting_review", submitted_at: leadThread.submitted_at ?? now })
      .eq("id", leadThread.id)
      .select("*")
      .maybeSingle();
    if (submitError || !submittedThread) {
      return json({ error: submitError?.message ?? "Could not submit the conversation." }, 400);
    }
    leadThread = submittedThread;

    const { error: stateError } = await admin.from("onboarding_state")
      .update({ answers: submittedAnswers, completion_percentage: 95 })
      .eq("profile_id", userId);
    if (stateError) return json({ error: stateError.message }, 400);

    if (!wasAwaiting) {
      await admin.from("lead_conversation_messages").insert({
        conversation_id: leadThread.id,
        sender_type: "system",
        body: "האפיון נשלח ליניב לבדיקה. נעדכן אתכם כאן לאחר המעבר לפרויקט.",
        visibility: "client_agency",
      });
      const loaded = await admin
        .from("lead_conversation_messages")
        .select("sender_type, body, visibility, created_at")
        .eq("conversation_id", leadThread.id)
        .order("created_at", { ascending: true })
        .limit(300);
      clientTranscript = mapLeadMessages(loaded.data ?? []);
    }

    return json({
      answers: submittedAnswers,
      transcript: clientTranscript,
      identity,
      readyToSubmit: true,
      ...clientState(),
    });
  }

  if (action !== "send") return json({ error: "Unknown action." }, 400);

  if (isClient && leadThread?.status !== "active") {
    const messageByStatus: Record<string, string> = {
      awaiting_review: "The onboarding has been sent to the agency for review.",
      paused: leadThread?.pause_message || "The agency has paused this conversation.",
      disqualified: "This conversation has been closed by the agency.",
      promoted: "This lead is now connected to a project.",
    };
    return json({ error: messageByStatus[String(leadThread?.status)] ?? "This conversation is not open." }, 409);
  }

  const message = String(body.message ?? "").trim();
  if (!message) return json({ error: "Please write a message." }, 400);
  if (message.length > MAX_MESSAGE) return json({ error: `Please keep messages under ${MAX_MESSAGE} characters.` }, 400);
  const activeTranscript = isClient ? clientTranscript : transcript;
  if (activeTranscript.length > MAX_TURNS) {
    return json({ error: "This onboarding conversation is very long. Please finish and submit it." }, 429);
  }

  const known = JSON.stringify({
    accountIdentity: identity,
    projectBinding: isClient
      ? "No project exists during onboarding. On submit, one project is created for this client account and receives this transcript, brief and flow."
      : undefined,
    document: answers._document ?? {},
    profile: answers._profile ?? {},
    flow: answers._flow ?? {},
    answers: Object.fromEntries(Object.entries(answers).filter(([k]) => !k.startsWith("_"))),
  }).slice(0, 12000);
  const identityInstruction = isClient
    ? "The account identity above comes from the authenticated client record. Treat the client and business names as already known, answer with them when asked, and never ask the client to repeat them. You may still ask what the business does when that activity has not been described."
    : "Use only the authenticated supplier contact and information the supplier has shared. Never invent identity or profile details.";

  const input: ModelMessage[] = [
    { role: "system", content: `${isClient ? clientSystem() : supplierSystem()}\n\n--- KNOWN SO FAR (authoritative) ---\n${known}\n\n${identityInstruction}\n\nContact: ${profile.full_name ?? profile.email}` },
    ...activeTranscript.slice(-16).map((entry) => ({
      role: entry.role === "user" ? "user" as const : "assistant" as const,
      content: `${entry.role === "agency" ? "[Agency project manager] " : ""}${String(entry.body).slice(0, 1500)}`,
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

  if (isClient && leadThread) {
    const userAt = nextTranscript[nextTranscript.length - 2]?.at ?? new Date().toISOString();
    const assistantAt = nextTranscript[nextTranscript.length - 1]?.at ?? new Date().toISOString();
    const { error: messageError } = await admin.from("lead_conversation_messages").insert([
      {
        conversation_id: leadThread.id,
        sender_type: "client",
        sender_profile_id: userId,
        body: message,
        visibility: "client_agency",
        created_at: userAt,
      },
      {
        conversation_id: leadThread.id,
        sender_type: "ai_agent",
        body: reply,
        visibility: "client_agency",
        created_at: assistantAt,
      },
    ]);
    if (messageError) return json({ error: messageError.message }, 400);
    await admin.from("lead_conversations")
      .update({ last_client_message_at: userAt })
      .eq("id", leadThread.id);
    clientTranscript = [
      ...clientTranscript,
      { role: "user", body: message, at: userAt },
      { role: "assistant", body: reply, at: assistantAt },
    ];
  }

  await admin.from("ai_runs").insert({
    project_id: null, agent_type: isClient ? "project_guide" : "work_assistant",
    requested_by_profile_id: userId, model: DEFAULT_MODEL, status: "success", error: "",
    latency_ms: Date.now() - started,
  });

  return json({
    reply,
    answers: nextAnswers,
    transcript: isClient ? clientTranscript : nextTranscript,
    identity,
    readyToSubmit: Boolean(parsed?.complete),
    ...(isClient ? clientState() : {}),
  });
});
