import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

/**
 * AI helper for the import wizard and the CRM (agency admin only).
 * `suggestMapping` proposes sheet types and column targets; `enrichLead`
 * proposes a summary and next action. Both return suggestions only — nothing is
 * written to a lead, price or scope without the admin confirming in the UI.
 */

const MODEL = Deno.env.get("CRM_MAPPING_MODEL")?.trim() || "google/gemini-2.5-flash-lite";
const GATEWAY = "https://ai.gateway.lovable.dev/v1/responses";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const LEAD_TARGETS = [
  "ignore", "note", "name", "company", "email", "phone", "source", "stage", "status",
  "service_interest", "estimated_value", "currency", "notes", "tags", "next_follow_up_at", "last_contact_at",
];
const PAST_TARGETS = [
  "ignore", "note", "company", "project_name", "description", "status", "start_date", "end_date",
  "value", "currency", "technologies", "outcome", "notes",
];

async function askModel(apiKey: string, instructions: string, input: string) {
  const response = await fetch(GATEWAY, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
    body: JSON.stringify({ model: MODEL, instructions, input, max_output_tokens: 1200 }),
  });
  if (!response.ok) {
    const detail = await response.text();
    if ((response.status === 400 || response.status === 404) && /model|unsupported|not found/i.test(detail)) {
      throw new Error("The selected AI model is unavailable.");
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error("AI mapping is not configured. You may continue with manual column mapping.");
    }
    if (response.status === 429) throw new Error("AI mapping is temporarily busy. Try again shortly.");
    throw new Error(`AI mapping request failed [${response.status}].`);
  }
  const payload = await response.json();
  const text = payload.output_text
    ?? (payload.output ?? [])
      .flatMap((item: any) => item?.content ?? [])
      .map((part: any) => part?.text ?? "")
      .join("");
  return String(text ?? "");
}

function parseJson(text: string): any {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: "Server configuration is incomplete." }, 500);
  }
  const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: claims } = await anon.auth.getClaims(authHeader.replace("Bearer ", ""));
  if (!claims?.claims) return json({ error: "Unauthorized" }, 401);
  const callerId = claims.claims.sub as string;

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: caller } = await admin.from("profiles").select("role, is_active").eq("id", callerId).maybeSingle();
  if (!caller || caller.role !== "agency_admin" || caller.is_active !== true) return json({ error: "Forbidden" }, 403);

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    return json({ error: "AI mapping is not configured. You may continue with manual column mapping." }, 503);
  }

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }

  try {
    if (body.action === "suggestMapping") {
      const sheets = (body.sheets ?? []).slice(0, 8).map((sheet: any) => ({
        sheetName: String(sheet.sheetName ?? "").slice(0, 120),
        headers: (sheet.headers ?? []).slice(0, 60).map((h: string) => String(h).slice(0, 80)),
        samples: (sheet.samples ?? []).slice(0, 3),
      }));
      const text = await askModel(
        apiKey,
        [
          "You map spreadsheet columns for a Hebrew/English agency CRM import.",
          `Sheet types: leads, clients, contacts, past_projects, notes, unknown.`,
          `Lead column targets: ${LEAD_TARGETS.join(", ")}.`,
          `Past-project column targets: ${PAST_TARGETS.join(", ")}.`,
          "Use 'ignore' when nothing fits and 'note' for free text worth keeping.",
          'Reply with JSON only: {"sheets":[{"sheetName":"","sheetType":"","columns":[{"column":"","target":"","confidence":"high|medium|low"}]}]}',
        ].join("\n"),
        JSON.stringify(sheets),
      );
      const parsed = parseJson(text);
      if (!parsed?.sheets) return json({ sheets: [] });
      return json({ sheets: parsed.sheets });
    }

    if (body.action === "enrichLead") {
      const leadId = String(body.leadId ?? "");
      const { data: lead } = await admin.from("crm_leads").select("*").eq("id", leadId).maybeSingle();
      if (!lead) return json({ error: "Lead not found" }, 404);
      const { data: notes } = await admin.from("contact_notes").select("body, created_at")
        .eq("lead_id", leadId).order("created_at", { ascending: false }).limit(20);
      const text = await askModel(
        apiKey,
        [
          "You are the agency's CRM analyst. Answer in Hebrew.",
          "Produce suggestions only. Never state that anything was approved, priced or scheduled.",
          'Reply with JSON only: {"summary":"","serviceInterest":"","likelyProjectType":"","priority":"high|medium|low","missingInfo":[""],"nextAction":"","followUpDraft":"","tags":[""],"opportunities":[""]}',
        ].join("\n"),
        JSON.stringify({ lead, notes: notes ?? [] }),
      );
      const parsed = parseJson(text);
      if (!parsed) return json({ error: "AI returned an unreadable answer" }, 502);
      const { data: saved } = await admin.from("crm_ai_suggestions").insert({
        lead_id: leadId, kind: "enrichment", payload: parsed, status: "suggested",
      }).select("*").maybeSingle();
      return json({ suggestion: saved, payload: parsed });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    console.error("crm-ai-map failed", error);
    return json({ error: String((error as Error).message).slice(0, 400) }, 500);
  }
});
