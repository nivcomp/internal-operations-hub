/**
 * Server-side AI usage governance: project-scope enforcement, cheap relevance
 * classification, usage limits, dedupe/caching and alerting.
 * Nothing here trusts the client; every decision is made from database state.
 */

const CLASSIFIER_MODEL = "openai/gpt-5.6-luna";
const GATEWAY = "https://ai.gateway.lovable.dev/v1/responses";

/** Rough blended credit cost per 1k tokens, used only for internal reporting. */
const COST_PER_1K: Record<string, number> = {
  "openai/gpt-5.6-sol": 0.012,
  "openai/gpt-5.6-luna": 0.001,
};

export type Classification =
  | "project_relevant"
  | "unclear"
  | "unrelated"
  | "abusive"
  | "repeated_spam";

export type Limits = {
  daily_message_limit: number;
  monthly_message_limit: number;
  daily_token_limit: number;
  monthly_token_limit: number;
  maximum_message_length: number;
  maximum_context_size: number;
  maximum_output_tokens: number;
  cooldown_seconds: number;
  warning_threshold_percent: number;
  hard_stop_threshold_percent: number;
  is_paused: boolean;
  paused_reason: string;
  paused_until: string | null;
  pausedScope: string | null;
};

export const PROJECT_ONLY_MESSAGE =
  "I can help only with this project and its related requirements, budget, delivery and work process.";
export const PROJECT_ONLY_MESSAGE_HE =
  "אני יכול לעזור רק בפרויקט הזה — בדרישות, בתקציב, באספקה ובתהליך העבודה שלו.";
export const UNCLEAR_MESSAGE =
  "I am not sure how that relates to this project. Could you explain how it connects to the project's scope, budget, delivery or work?";
export const UNCLEAR_MESSAGE_HE =
  "לא ברור לי איך זה קשור לפרויקט הזה. אפשר להסביר איך זה מתחבר להיקף, לתקציב, ללוח הזמנים או לעבודה בפרויקט?";

export function isHebrew(text: string) {
  return /[\u0590-\u05FF]/.test(text);
}

export async function hashText(text: string) {
  const data = new TextEncoder().encode(text.trim().toLowerCase().replace(/\s+/g, " "));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function estimateTokens(text: string) {
  return Math.ceil((text || "").length / 4);
}

export function estimateCost(model: string, totalTokens: number) {
  const rate = COST_PER_1K[model] ?? 0.01;
  return Math.round((totalTokens / 1000) * rate * 10000) / 10000;
}

const DEFAULTS: Omit<Limits, "pausedScope"> = {
  daily_message_limit: 40,
  monthly_message_limit: 600,
  daily_token_limit: 200000,
  monthly_token_limit: 3000000,
  maximum_message_length: 4000,
  maximum_context_size: 24000,
  maximum_output_tokens: 2000,
  cooldown_seconds: 3,
  warning_threshold_percent: 70,
  hard_stop_threshold_percent: 100,
  is_paused: false,
  paused_reason: "",
  paused_until: null,
};

const NUMERIC_KEYS = [
  "daily_message_limit", "monthly_message_limit", "daily_token_limit", "monthly_token_limit",
  "maximum_message_length", "maximum_context_size", "maximum_output_tokens",
] as const;

/**
 * Effective limits = most restrictive value across every matching scope row.
 * A pause on any matching scope pauses the user.
 */
export async function resolveLimits(
  admin: any,
  profile: { id: string; client_id: string | null; supplier_id: string | null },
  projectId: string,
): Promise<Limits> {
  const scopeIds = [profile.id, profile.client_id, profile.supplier_id, projectId].filter(Boolean);
  const { data } = await admin
    .from("ai_usage_limits")
    .select("*")
    .or(`scope_type.eq.global,scope_id.in.(${scopeIds.join(",")})`);

  const rows = (data ?? []).filter((r: any) =>
    r.scope_type === "global" ||
    (r.scope_type === "profile" && r.scope_id === profile.id) ||
    (r.scope_type === "client" && r.scope_id === profile.client_id) ||
    (r.scope_type === "supplier" && r.scope_id === profile.supplier_id) ||
    (r.scope_type === "project" && r.scope_id === projectId));

  const limits: Limits = { ...DEFAULTS, pausedScope: null };
  const now = Date.now();
  for (const row of rows) {
    for (const key of NUMERIC_KEYS) {
      const value = Number(row[key]);
      if (Number.isFinite(value) && value > 0) limits[key] = Math.min(limits[key], value);
    }
    limits.cooldown_seconds = Math.max(limits.cooldown_seconds, Number(row.cooldown_seconds) || 0);
    limits.warning_threshold_percent = Math.min(limits.warning_threshold_percent, Number(row.warning_threshold_percent) || 100);
    limits.hard_stop_threshold_percent = Math.min(limits.hard_stop_threshold_percent, Number(row.hard_stop_threshold_percent) || 100);
    const stillPaused = row.is_paused && (!row.paused_until || new Date(row.paused_until).getTime() > now);
    if (stillPaused) {
      limits.is_paused = true;
      limits.paused_reason = row.paused_reason || limits.paused_reason;
      limits.paused_until = row.paused_until;
      limits.pausedScope = row.scope_type;
    }
  }
  return limits;
}

export type Usage = {
  dayMessages: number;
  monthMessages: number;
  dayTokens: number;
  monthTokens: number;
  lastActivityAt: string | null;
  rejectedToday: number;
};

export async function loadUsage(admin: any, profileId: string, projectId: string): Promise<Usage> {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);

  const { data } = await admin
    .from("ai_usage_events")
    .select("total_tokens, created_at, outcome, project_id")
    .eq("profile_id", profileId)
    .gte("created_at", startOfMonth.toISOString())
    .order("created_at", { ascending: false })
    .limit(2000);

  const rows = data ?? [];
  const usage: Usage = {
    dayMessages: 0, monthMessages: 0, dayTokens: 0, monthTokens: 0,
    lastActivityAt: rows[0]?.created_at ?? null, rejectedToday: 0,
  };
  for (const row of rows) {
    const at = new Date(row.created_at).getTime();
    const inDay = at >= startOfDay.getTime();
    const billable = row.outcome === "success" || row.outcome === "cached";
    usage.monthMessages += 1;
    usage.monthTokens += Number(row.total_tokens) || 0;
    if (inDay) {
      usage.dayMessages += 1;
      usage.dayTokens += Number(row.total_tokens) || 0;
      if (!billable) usage.rejectedToday += 1;
    }
  }
  void projectId;
  return usage;
}

export function usagePercent(usage: Usage, limits: Limits) {
  const values = [
    limits.daily_message_limit ? (usage.dayMessages / limits.daily_message_limit) * 100 : 0,
    limits.monthly_message_limit ? (usage.monthMessages / limits.monthly_message_limit) * 100 : 0,
    limits.daily_token_limit ? (usage.dayTokens / limits.daily_token_limit) * 100 : 0,
    limits.monthly_token_limit ? (usage.monthTokens / limits.monthly_token_limit) * 100 : 0,
  ];
  return Math.round(Math.max(...values));
}

export async function recordEvent(admin: any, row: Record<string, unknown>) {
  const { error } = await admin.from("ai_usage_events").insert(row);
  if (error) console.error("ai_usage_events insert failed:", error.message);
}

export async function recordClassification(admin: any, row: Record<string, unknown>) {
  const { error } = await admin.from("ai_request_classifications").insert(row);
  if (error) console.error("ai_request_classifications insert failed:", error.message);
}

/** Raises an alert at most once per hour for the same type+profile+project. */
export async function raiseAlert(
  admin: any,
  row: {
    alert_type: string;
    severity: "info" | "warning" | "critical";
    profile_id: string | null;
    project_id: string | null;
    title: string;
    detail: string;
    metadata?: Record<string, unknown>;
  },
) {
  const since = new Date(Date.now() - 3_600_000).toISOString();
  let q = admin.from("ai_usage_alerts").select("id", { count: "exact", head: true })
    .eq("alert_type", row.alert_type).gte("created_at", since);
  q = row.profile_id ? q.eq("profile_id", row.profile_id) : q.is("profile_id", null);
  const { count } = await q;
  if ((count ?? 0) > 0) return;
  const { error } = await admin.from("ai_usage_alerts").insert({ ...row, metadata: row.metadata ?? {} });
  if (error) console.error("ai_usage_alerts insert failed:", error.message);
}

/* ------------------------------------------------------------------ */
/* Relevance classification                                            */
/* ------------------------------------------------------------------ */

const ABUSE_PATTERNS = [
  /ignore (all |your |previous |prior )*(instructions|rules|prompt)/i,
  /system prompt/i,
  /\b(service[_ -]?role|api[_ -]?key|supabase[_ -]?url|env(ironment)? variable)\b/i,
  /reveal (your|the) (prompt|instructions|configuration)/i,
  /you are now\b/i,
  /jailbreak|dan mode/i,
];

const OFF_TOPIC_PATTERNS = [
  /\b(homework|essay for school|my exam|בחינה|שיעורי בית)\b/i,
  /\b(joke|poem|song lyrics|story about|בדיחה|שיר)\b/i,
  /\b(recipe|football|weather forecast|horoscope|מתכון|מזג האוויר)\b/i,
  /\b(medical advice|diagnos(e|is)|symptom|legal advice|lawsuit|ייעוץ רפואי|ייעוץ משפטי)\b/i,
  /\b(bitcoin|stock market|crypto price|מניות)\b/i,
  /\btranslate (this|the following) (article|book|song)\b/i,
];

const PROJECT_TERMS =
  /\b(project|scope|estimate|budget|price|quote|hours|timeline|deliver|delivery|milestone|supplier|change request|approval|payment|integration|requirement|risk|phase|option|invoice|brief|diagram|report|task|work item|progress|blocker|proposal|פרויקט|הצעת מחיר|תקציב|היקף|אבן דרך|ספק|אישור|תשלום|שעות|לוח זמנים|דרישה|סיכון|שלב|אינטגרציה|בקשת שינוי|דוח|תרשים)\b/i;

export type ClassificationResult = {
  classification: Classification;
  reason: string;
  confidence: number;
  model: string;
  tokens: number;
};

/**
 * Two-stage check. Cheap local heuristics first; only genuinely ambiguous
 * messages reach the small classifier model. The expensive main model is
 * never called for anything that is not project relevant.
 */
export async function classifyRequest(
  text: string,
  ctx: { projectName: string; projectSummary: string; agentType: string },
): Promise<ClassificationResult> {
  const trimmed = text.trim();

  for (const pattern of ABUSE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { classification: "abusive", reason: "Prompt-injection or credential-extraction attempt.", confidence: 0.95, model: "heuristic", tokens: 0 };
    }
  }
  for (const pattern of OFF_TOPIC_PATTERNS) {
    if (pattern.test(trimmed) && !PROJECT_TERMS.test(trimmed)) {
      return { classification: "unrelated", reason: "Off-topic request with no project reference.", confidence: 0.9, model: "heuristic", tokens: 0 };
    }
  }
  if (trimmed.length <= 240 && PROJECT_TERMS.test(trimmed)) {
    return { classification: "project_relevant", reason: "Contains explicit project terminology.", confidence: 0.8, model: "heuristic", tokens: 0 };
  }
  if (trimmed.length < 12) {
    return { classification: "project_relevant", reason: "Short conversational turn.", confidence: 0.5, model: "heuristic", tokens: 0 };
  }

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    return { classification: "project_relevant", reason: "Classifier unavailable; allowed by default.", confidence: 0.3, model: "none", tokens: 0 };
  }

  const prompt = `You classify whether a message belongs in a dedicated workspace for ONE delivery project.
Project name: ${ctx.projectName}
Project summary: ${(ctx.projectSummary || "(none)").slice(0, 400)}
Assistant role: ${ctx.agentType}

Project relevant topics: discovery, requirements, scope, estimate, options, budget, files, risks, delivery, messages, change requests, supplier work, progress, and technical explanations about this project.
Unrelated topics: homework, unrelated coding, general translation, entertainment, legal or medical questions, general research, or using this as a free general assistant.

Message:
"""${trimmed.slice(0, 1200)}"""

Answer with ONLY one word: project_relevant, unclear, unrelated, or abusive.`;

  try {
    const res = await fetch(GATEWAY, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({ model: CLASSIFIER_MODEL, input: prompt, stream: true, store: false }),
    });
    if (!res.ok || !res.body) throw new Error(`classifier ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let out = "";
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
            if (evt.type === "response.output_text.delta" && typeof evt.delta === "string") out += evt.delta;
            if (evt.type === "response.completed" && !out && evt.response?.output_text) out += evt.response.output_text;
          } catch { /* partial event */ }
        }
      }
    }

    const word = out.toLowerCase().match(/project_relevant|unrelated|unclear|abusive/)?.[0] as Classification | undefined;
    return {
      classification: word ?? "unclear",
      reason: word ? "Classified by the low-cost relevance model." : "Classifier gave no clear answer.",
      confidence: word ? 0.75 : 0.3,
      model: CLASSIFIER_MODEL,
      tokens: estimateTokens(prompt) + estimateTokens(out),
    };
  } catch (err) {
    console.error("relevance classifier failed:", err instanceof Error ? err.message : err);
    return { classification: "unclear", reason: "Relevance check unavailable.", confidence: 0.2, model: CLASSIFIER_MODEL, tokens: 0 };
  }
}

/** Detects rapid repeats of the same message and repeated off-topic behaviour. */
export async function detectSpam(admin: any, profileId: string, messageHash: string) {
  const since = new Date(Date.now() - 30 * 60_000).toISOString();
  const { data } = await admin
    .from("ai_usage_events")
    .select("message_hash, classification, created_at, outcome")
    .eq("profile_id", profileId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(50);

  const rows = data ?? [];
  const identical = rows.filter((r: any) => r.message_hash === messageHash).length;
  const rejected = rows.filter((r: any) => r.classification === "unrelated" || r.classification === "abusive").length;
  const burst = rows.filter((r: any) => Date.now() - new Date(r.created_at).getTime() < 60_000).length;
  return { identical, rejected, burst, isSpam: identical >= 4 || rejected >= 5 };
}

export async function getCachedResponse(admin: any, cacheKey: string) {
  const { data } = await admin.from("ai_response_cache").select("*").eq("cache_key", cacheKey).maybeSingle();
  if (!data) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;
  await admin.from("ai_response_cache").update({ hit_count: (data.hit_count ?? 0) + 1 }).eq("id", data.id);
  return data.response_body as string;
}

export async function putCachedResponse(
  admin: any,
  row: { cache_key: string; project_id: string; agent_type: string; audience_role: string; response_body: string },
) {
  await admin.from("ai_response_cache").upsert(
    { ...row, hit_count: 0, expires_at: new Date(Date.now() + 30 * 60_000).toISOString() },
    { onConflict: "cache_key" },
  );
}

export async function invalidateProjectCache(admin: any, projectId: string) {
  await admin.from("ai_response_cache").delete().eq("project_id", projectId);
}
