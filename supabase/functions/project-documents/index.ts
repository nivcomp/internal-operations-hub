import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { callModel, DEFAULT_MODEL } from "../_shared/model.ts";

// Agency-only structured document generation from an existing project's data.
// Read-only: it never writes scope, pricing or approvals.

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const DOC_TYPES: Record<string, string> = {
  project_brief: "Project Brief",
  functional_spec: "Functional Specification",
  technical_spec: "Technical Specification",
  supplier_brief: "Supplier Brief (no client price, no margin, no internal notes)",
  client_proposal: "Client Proposal (client-safe, no internal cost or margin)",
  internal_planning: "Internal Planning Document",
  implementation_checklist: "Implementation Checklist",
  meeting_summary: "Meeting Summary",
  change_request: "Change Request Document",
};

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
    .from("profiles").select("role, is_active").eq("id", userId).maybeSingle();
  if (!profile || profile.is_active === false || profile.role !== "agency_admin") {
    return json({ error: "Forbidden" }, 403);
  }

  let body: { projectId?: string; docType?: string; language?: string; notes?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }

  const projectId = String(body.projectId ?? "");
  const docType = String(body.docType ?? "");
  const language = String(body.language ?? "English").slice(0, 40);
  if (!projectId) return json({ error: "projectId is required." }, 400);
  if (!DOC_TYPES[docType]) return json({ error: "Unknown document type." }, 400);

  const [project, brief, schedule, estimate, requirements, assumptions, questions, conversationSummary] =
    await Promise.all([
      admin.from("projects").select("*").eq("id", projectId).maybeSingle(),
      admin.from("project_briefs").select("*").eq("project_id", projectId).maybeSingle(),
      admin.from("project_schedule").select("*").eq("project_id", projectId).maybeSingle(),
      admin.from("project_estimates").select("*").eq("project_id", projectId)
        .order("version", { ascending: false }).limit(1).maybeSingle(),
      admin.from("project_requirements").select("title, detail, category, status").eq("project_id", projectId).limit(100),
      admin.from("project_assumptions").select("body, kind, status").eq("project_id", projectId).limit(100),
      admin.from("project_questions").select("question, answer, status").eq("project_id", projectId).limit(100),
      admin.from("ai_project_summaries").select("summary, audience_role").eq("project_id", projectId).limit(5),
    ]);

  if (!project.data) return json({ error: "Project not found." }, 404);

  let items: unknown[] = [];
  if (estimate.data?.id) {
    const { data } = await admin.from("estimate_items")
      .select("project_phase, title, description, estimated_hours_min, estimated_hours_max, responsible_role, client_visible, acceptance_criteria")
      .eq("estimate_id", estimate.data.id).order("sort_order");
    items = data ?? [];
  }

  const supplierFacing = docType === "supplier_brief";
  const clientFacing = docType === "client_proposal";
  const estimateContext = estimate.data
    ? {
        version: estimate.data.version,
        hours: [estimate.data.estimated_hours_min, estimate.data.estimated_hours_max],
        budget: supplierFacing ? "hidden" : [estimate.data.estimated_budget_min, estimate.data.estimated_budget_max],
        currency: estimate.data.currency,
        internalCost: supplierFacing || clientFacing ? "hidden" : estimate.data.internal_cost,
        margin: supplierFacing || clientFacing ? "hidden" : estimate.data.target_margin_percent,
        clientVisible: estimate.data.client_visible,
      }
    : null;

  const context = JSON.stringify({
    project: { name: project.data.name, status: project.data.status, summary: project.data.summary },
    brief: brief.data ?? null,
    schedule: schedule.data ?? null,
    estimate: estimateContext,
    items,
    requirements: requirements.data ?? [],
    assumptions: assumptions.data ?? [],
    openQuestions: questions.data ?? [],
    aiSummaries: conversationSummary.data ?? [],
    notes: String(body.notes ?? "").slice(0, 1000),
  }).slice(0, 30000);

  const guard = supplierFacing
    ? "This document goes to a SUPPLIER. Never include client price, agency margin, internal cost or internal notes."
    : clientFacing
      ? "This document goes to the CLIENT. Never include internal cost, supplier cost or margin."
      : "This is an internal agency document.";

  const text = await callModel([
    {
      role: "system",
      content: `You write precise agency delivery documents. Produce a "${DOC_TYPES[docType]}" in ${language}.
${guard}
Use ONLY the supplied project data. Never invent prices, hours, dates or commitments; if something is unknown write "Not yet defined".
Output clean Markdown with clear headings, short paragraphs and bullet lists. No preamble, no code fences.`,
    },
    { role: "user", content: `PROJECT DATA (JSON):\n${context}` },
  ], { maxOutputTokens: 6000 });

  await admin.from("ai_sessions").insert({
    project_id: projectId, kind: `document:${docType}`,
    prompt: `${DOC_TYPES[docType]} (${language})`, output: text.slice(0, 20000),
    metadata: { model: DEFAULT_MODEL, language, docType },
  });

  const audience = supplierFacing ? "supplier" : clientFacing ? "client" : "agency";
  const { data: latest } = await admin.from("project_documents")
    .select("version").eq("project_id", projectId).eq("document_type", docType)
    .order("version", { ascending: false }).limit(1).maybeSingle();
  await admin.from("project_documents").insert({
    project_id: projectId,
    document_type: docType,
    audience,
    language,
    version: (latest?.version ?? 0) + 1,
    status: "draft",
    markdown: text,
    created_by: userId,
  });

  return json({ ok: true, docType, language, markdown: text });
});
