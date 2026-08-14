import { supabase } from "../integrations/supabase/client";

const db = supabase as any;
export type PrototypeKind = "app" | "whatsapp" | "automation";
export type PrototypeBlock = { type: "heading" | "text" | "image" | "input" | "card" | "message" | "status"; label: string; value?: string; sender?: "client" | "bot" };
export type PrototypeAction = { id: string; label: string; targetScreenId?: string; tone?: "primary" | "secondary" | "danger" };
export type PrototypeScreen = { id: string; title: string; subtitle?: string; imagePrompt?: string; blocks: PrototypeBlock[]; actions: PrototypeAction[] };
export type PrototypeContent = {
  theme: { primary: string; accent: string; style: string };
  startScreenId: string;
  screens: PrototypeScreen[];
  dataModel?: Array<{ name: string; purpose: string; fields: string[] }>;
  integrations?: Array<{ name: string; purpose: string; direction: string }>;
  automations?: Array<{ name: string; trigger: string; steps: string[]; outcome: string }>;
};
export type PrototypeVersion = { id: string; prototype_id: string; project_id: string; version: number; status: "draft" | "shared" | "approved" | "superseded"; audience: string; title: string; summary: string; content: PrototypeContent; source_notes: string; created_at: string };
export type ProjectPrototype = { id: string; project_id: string; title: string; prototype_kind: PrototypeKind; created_at: string; updated_at: string; versions: PrototypeVersion[] };
export type PrototypeApproval = { id: string; prototype_version_id: string; decision: "approved" | "changes_requested"; comment: string; approved_by: string; created_at: string };

function fail(error: any, label: string): never { throw new Error(`${label}: ${error?.message || error}`); }

export async function listProjectPrototypes(projectId: string) {
  const [{ data: prototypes, error: pe }, { data: versions, error: ve }, { data: approvals, error: ae }] = await Promise.all([
    db.from("project_prototypes").select("*").eq("project_id", projectId).order("updated_at", { ascending: false }),
    db.from("prototype_versions").select("*").eq("project_id", projectId).order("version", { ascending: false }),
    db.from("prototype_approvals").select("*").eq("project_id", projectId)
      .order("created_at", { ascending: false }).order("id", { ascending: false }),
  ]);
  if (pe) fail(pe, "Load prototypes"); if (ve) fail(ve, "Load prototype versions"); if (ae) fail(ae, "Load prototype approvals");
  return {
    prototypes: (prototypes ?? []).map((prototype: any) => ({ ...prototype, versions: (versions ?? []).filter((version: any) => version.prototype_id === prototype.id) })) as ProjectPrototype[],
    approvals: (approvals ?? []) as PrototypeApproval[],
  };
}

export async function getPrototypeFreshness(projectId: string) {
  const [{ data: versions, error: ve }, { data: messages, error: me }] = await Promise.all([
    db.from("prototype_versions").select("id,created_at,version").eq("project_id", projectId).eq("audience", "client").in("status", ["shared", "approved"]).order("created_at", { ascending: false }).limit(1),
    db.from("chat_messages").select("id,created_at").eq("project_id", projectId).in("sender_type", ["client", "agency_admin"]).order("created_at", { ascending: false }).limit(1),
  ]);
  if (ve) fail(ve, "Load MVP freshness"); if (me) fail(me, "Load conversation freshness");
  const version = versions?.[0]; const message = messages?.[0];
  return {
    hasMvp: Boolean(version),
    isStale: Boolean(version && message && new Date(message.created_at).getTime() > new Date(version.created_at).getTime()),
    version: version?.version as number | undefined,
  };
}

/** Solution type of the project's deliverable, used for jargon-free client wording. */
export async function getProjectSolutionKind(projectId: string): Promise<PrototypeKind | null> {
  const { data } = await db.from("project_prototypes").select("prototype_kind")
    .eq("project_id", projectId).order("updated_at", { ascending: false }).limit(1);
  const kind = data?.[0]?.prototype_kind as PrototypeKind | undefined;
  return kind && ["app", "whatsapp", "automation"].includes(kind) ? kind : null;
}

export async function generatePrototype(input: { projectId: string; prototypeId?: string; kind: PrototypeKind; title?: string; instructions?: string; sourceText?: string }) {
  const { data, error } = await supabase.functions.invoke("project-prototype", { body: { action: "generate", ...input } });
  if (error) fail(error, "Generate prototype"); if (data?.error) fail(data.error, "Generate prototype");
  return data as { prototypeId: string; version: PrototypeVersion };
}

export async function sharePrototype(projectId: string, versionId: string) {
  const { data, error } = await supabase.functions.invoke("project-prototype", { body: { action: "share", projectId, versionId } });
  if (error) fail(error, "Share prototype"); if (data?.error) fail(data.error, "Share prototype"); return data;
}

export async function recordPrototypeDecision(version: PrototypeVersion, decision: "approved" | "changes_requested", comment: string) {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error("Sign in before recording a decision.");
  // Decisions are append-only. A later changes_requested row safely reopens an
  // accidentally approved version while preserving the original approval.
  const { error } = await db.from("prototype_approvals").insert({ prototype_version_id: version.id, project_id: version.project_id, decision, comment: comment.trim(), approved_by: user.user.id });
  if (error) fail(error, "Save prototype decision");
}

