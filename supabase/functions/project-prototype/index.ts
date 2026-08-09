import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { callModel, DEFAULT_MODEL, parseJsonOutput } from "../_shared/model.ts";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json" },
});
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

type PrototypeKind = "app" | "whatsapp" | "automation";
type PrototypeContent = {
  theme: { primary: string; accent: string; style: string };
  startScreenId: string;
  dataModel?: Array<{ name: string; purpose: string; fields: string[] }>;
  integrations?: Array<{ name: string; purpose: string; direction: string }>;
  automations?: Array<{ name: string; trigger: string; steps: string[]; outcome: string }>;
  screens: Array<{
    id: string; title: string; subtitle?: string; imagePrompt?: string;
    blocks: Array<{ type: "heading" | "text" | "image" | "input" | "card" | "message" | "status"; label: string; value?: string; sender?: "client" | "bot" }>;
    actions: Array<{ id: string; label: string; targetScreenId?: string; tone?: "primary" | "secondary" | "danger" }>;
  }>;
};

function sanitize(raw: PrototypeContent): PrototypeContent {
  const screens = Array.isArray(raw?.screens) ? raw.screens.slice(0, 12).map((screen, index) => ({
    id: String(screen?.id || `screen-${index + 1}`).slice(0, 60),
    title: String(screen?.title || `Screen ${index + 1}`).slice(0, 120),
    subtitle: String(screen?.subtitle || "").slice(0, 300),
    imagePrompt: String(screen?.imagePrompt || "").slice(0, 500),
    blocks: (Array.isArray(screen?.blocks) ? screen.blocks : []).slice(0, 16).map((block) => ({
      type: (["heading","text","image","input","card","message","status"].includes(block?.type) ? block.type : "text") as any,
      label: String(block?.label || "").slice(0, 300), value: String(block?.value || "").slice(0, 600),
      sender: block?.sender === "client" ? "client" as const : "bot" as const,
    })),
    actions: (Array.isArray(screen?.actions) ? screen.actions : []).slice(0, 8).map((action, actionIndex) => ({
      id: String(action?.id || `action-${actionIndex + 1}`).slice(0, 60), label: String(action?.label || "Continue").slice(0, 100),
      targetScreenId: action?.targetScreenId ? String(action.targetScreenId).slice(0, 60) : undefined,
      tone: (["primary","secondary","danger"].includes(action?.tone) ? action.tone : "primary") as any,
    })),
  })) : [];
  if (!screens.length) throw new Error("The AI did not create any prototype screens.");
  const ids = new Set(screens.map((screen) => screen.id));
  for (const screen of screens) for (const action of screen.actions) if (action.targetScreenId && !ids.has(action.targetScreenId)) delete action.targetScreenId;
  return {
    theme: { primary: String(raw?.theme?.primary || "#0f766e").slice(0, 20), accent: String(raw?.theme?.accent || "#dff5ef").slice(0, 20), style: String(raw?.theme?.style || "clean").slice(0, 60) },
    startScreenId: ids.has(raw?.startScreenId) ? raw.startScreenId : screens[0].id,
    screens,
    dataModel: (Array.isArray(raw?.dataModel) ? raw.dataModel : []).slice(0, 20).map((entity) => ({
      name: String(entity?.name || "Entity").slice(0, 100), purpose: String(entity?.purpose || "").slice(0, 400),
      fields: (Array.isArray(entity?.fields) ? entity.fields : []).slice(0, 30).map((field) => String(field).slice(0, 120)),
    })),
    integrations: (Array.isArray(raw?.integrations) ? raw.integrations : []).slice(0, 20).map((integration) => ({
      name: String(integration?.name || "Integration").slice(0, 100), purpose: String(integration?.purpose || "").slice(0, 400),
      direction: String(integration?.direction || "two-way").slice(0, 80),
    })),
    automations: (Array.isArray(raw?.automations) ? raw.automations : []).slice(0, 20).map((automation) => ({
      name: String(automation?.name || "Automation").slice(0, 100), trigger: String(automation?.trigger || "").slice(0, 300),
      steps: (Array.isArray(automation?.steps) ? automation.steps : []).slice(0, 20).map((step) => String(step).slice(0, 300)),
      outcome: String(automation?.outcome || "").slice(0, 400),
    })),
  };
}

async function loadDurableClientConversation(projectId: string) {
  const { data: conversation } = await admin.from("project_conversations")
    .select("id").eq("project_id", projectId).eq("kind", "client_agency").maybeSingle();
  if (!conversation) return { memory: "", recent: [] as any[] };
  const [{ data: messages }, { data: stored }] = await Promise.all([
    admin.from("chat_messages").select("sender_type,body,structured_payload,created_at")
      .eq("conversation_id", conversation.id).in("visibility", ["client_agency", "shared_all"])
      .order("created_at", { ascending: true }).limit(1000),
    admin.from("ai_project_summaries").select("id,summary,covered_message_count")
      .eq("project_id", projectId).eq("conversation_id", conversation.id).eq("audience_role", "client").maybeSingle(),
  ]);
  const history = messages ?? [];
  const recentCount = 30;
  const targetCovered = Math.max(0, history.length - recentCount);
  const validStored = String(stored?.summary || "").startsWith("[MEMORY_V2]");
  let covered = validStored ? Math.min(Number(stored?.covered_message_count || 0), targetCovered) : 0;
  let memory = validStored ? String(stored?.summary || "") : "[MEMORY_V2]\n";
  while (covered < targetCovered) {
    const end = Math.min(covered + 40, targetCovered);
    const transcript = history.slice(covered, end)
      .map((message: any) => `${message.sender_type}: ${String(message.body || "").replace(/\s+/g, " ").slice(0, 1200)}`)
      .join("\n");
    const merged = await callModel([
      { role: "system", content: "Maintain a durable, client-safe project memory for future MVP generation. Preserve every requirement, decision, user, screen, workflow, integration, automation, constraint, example, open question and contradiction. Never add facts, internal pricing, supplier data or secrets. Merge the existing memory and new messages. Return concise plain text with stable headings." },
      { role: "user", content: `EXISTING MEMORY:\n${memory.slice(0, 12000)}\n\nNEW MESSAGES:\n${transcript}` },
    ], { maxOutputTokens: 2400 });
    memory = `[MEMORY_V2]\n${merged.slice(0, 12000)}`;
    covered = end;
  }
  if (targetCovered > 0 && (!validStored || covered !== Number(stored?.covered_message_count || 0))) {
    const row = { project_id: projectId, conversation_id: conversation.id, audience_role: "client", summary: memory, covered_message_count: covered, last_message_at: history[covered - 1]?.created_at ?? null };
    if (stored?.id) await admin.from("ai_project_summaries").update(row).eq("id", stored.id);
    else await admin.from("ai_project_summaries").insert(row);
  }
  return {
    memory: targetCovered ? memory : "",
    recent: history.slice(-recentCount).map((message: any) => ({
      sender_type: message.sender_type,
      body: String(message.body || "").slice(0, 700),
      created_at: message.created_at,
    })),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
  const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
  const { data: claims } = await anon.auth.getClaims(authHeader.replace("Bearer ", ""));
  const userId = claims?.claims?.sub as string | undefined;
  const { data: profile } = userId ? await admin.from("profiles").select("role,is_active").eq("id", userId).maybeSingle() : { data: null };
  if (!userId || !profile || profile.is_active === false || profile.role !== "agency_admin") return json({ error: "Forbidden" }, 403);

  let body: { action?: string; projectId?: string; prototypeId?: string; kind?: PrototypeKind; title?: string; instructions?: string; sourceText?: string; versionId?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const projectId = String(body.projectId || "");
  if (!projectId) return json({ error: "projectId is required" }, 400);

  if (body.action === "share") {
    const { data, error } = await admin.from("prototype_versions").update({ status: "shared", audience: "client" })
      .eq("id", String(body.versionId || "")).eq("project_id", projectId).eq("status", "draft").select().single();
    return error ? json({ error: error.message }, 400) : json({ version: data });
  }

  const kind: PrototypeKind = ["app","whatsapp","automation"].includes(String(body.kind)) ? body.kind as PrototypeKind : "app";
  const [project, sections, conversation, sources, changeRequests] = await Promise.all([
    admin.from("projects").select("id,name,summary,status").eq("id", projectId).maybeSingle(),
    admin.from("specification_sections").select("title,content,status").eq("project_id", projectId).in("status", ["approved","edited"]).limit(40),
    loadDurableClientConversation(projectId),
    admin.from("meeting_sources").select("title,source_type,transcript,review_status").eq("project_id", projectId).order("captured_at", { ascending: false }).limit(20),
    admin.from("change_requests").select("title,description,status,delivery_impact,created_at").eq("project_id", projectId).neq("status", "declined").order("created_at", { ascending: false }).limit(20),
  ]);
  if (!project.data) return json({ error: "Project not found" }, 404);

  let prototypeId = String(body.prototypeId || "");
  let previous: unknown = null;
  if (prototypeId) {
    const { data } = await admin.from("prototype_versions").select("content,version,summary").eq("prototype_id", prototypeId).order("version", { ascending: false }).limit(1).maybeSingle();
    previous = data;
  }
  const context = JSON.stringify({
    project: project.data, specification: sections.data ?? [], conversationMemory: conversation.memory,
    activeChangeRequests: (changeRequests.data ?? []).reverse(),
    recentConversation: conversation.recent, meetingSources: sources.data ?? [], suppliedText: String(body.sourceText || "").slice(0, 18000), previous,
    revisionInstructions: String(body.instructions || "").slice(0, 3000),
  }).slice(0, 30000);
  const raw = await callModel([
    { role: "system", content: `Create a detailed, client-safe interactive ${kind} prototype in Hebrew unless the source is clearly English. Use only supplied facts. Never include price, supplier cost, internal cost, margin, secrets or executable code. Return JSON only with this schema: {"title":string,"summary":string,"theme":{"primary":"#hex","accent":"#hex","style":string},"startScreenId":string,"screens":[{"id":string,"title":string,"subtitle":string,"imagePrompt":string,"blocks":[{"type":"heading|text|image|input|card|message|status","label":string,"value":string,"sender":"client|bot"}],"actions":[{"id":string,"label":string,"targetScreenId":string,"tone":"primary|secondary|danger"}]}],"dataModel":[{"name":string,"purpose":string,"fields":[string]}],"integrations":[{"name":string,"purpose":string,"direction":string}],"automations":[{"name":string,"trigger":string,"steps":[string],"outcome":string}]}. Create 4-8 screens. Describe only data entities, integrations and automations that are supported by the supplied scope; use empty arrays when none are known. For WhatsApp, include success, missing-information and fallback-to-human scenarios as separate screens. For apps, include realistic buttons, empty/error/success states and clear navigation. All targetScreenId values must reference an existing screen id.` },
    { role: "user", content: context },
  ], { maxOutputTokens: 7000 });
  const parsed = parseJsonOutput<any>(raw);
  if (!parsed) return json({ error: "AI returned invalid prototype JSON" }, 502);
  const content = sanitize(parsed);

  if (!prototypeId) {
    const { data, error } = await admin.from("project_prototypes").insert({ project_id: projectId, title: String(body.title || parsed.title || project.data.name).slice(0, 160), prototype_kind: kind, created_by: userId }).select().single();
    if (error || !data) return json({ error: error?.message || "Could not create prototype" }, 500);
    prototypeId = data.id;
  }
  const { data: latest } = await admin.from("prototype_versions").select("version").eq("prototype_id", prototypeId).order("version", { ascending: false }).limit(1).maybeSingle();
  const { data: version, error } = await admin.from("prototype_versions").insert({
    prototype_id: prototypeId, project_id: projectId, version: (latest?.version ?? 0) + 1, status: "shared", audience: "client",
    title: String(parsed.title || body.title || project.data.name).slice(0, 160), summary: String(parsed.summary || "").slice(0, 1200),
    content, source_notes: String(body.instructions || body.sourceText || "").slice(0, 4000), created_by: userId,
  }).select().single();
  if (error || !version) return json({ error: error?.message || "Could not save prototype version" }, 500);
  await admin.from("ai_sessions").insert({ project_id: projectId, kind: `prototype:${kind}`, prompt: String(body.instructions || "Generate prototype").slice(0, 1000), output: JSON.stringify(content).slice(0, 20000), metadata: { model: DEFAULT_MODEL, prototypeId, version: version.version } });
  return json({ prototypeId, version });
});

