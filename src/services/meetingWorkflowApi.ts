import { supabase } from "../integrations/supabase/client";

const db = supabase as any;
export const SPEC_SECTIONS = [
  ["project_title", "שם הפרויקט"], ["executive_summary", "תקציר מנהלים"], ["business_goal", "מטרה עסקית"],
  ["current_process", "התהליך הקיים"], ["desired_process", "התהליך הרצוי"], ["users_roles", "משתמשים ותפקידים"],
  ["functional_requirements", "דרישות פונקציונליות"], ["nonfunctional_requirements", "דרישות לא פונקציונליות"],
  ["integrations", "אינטגרציות"], ["data_inputs", "קלטי מידע"], ["data_outputs", "פלטי מידע"],
  ["permissions", "הרשאות"], ["workflow", "תהליך עבודה"], ["project_phases", "שלבי הפרויקט"],
  ["assumptions", "הנחות"], ["exclusions", "מחוץ לתכולה"], ["risks", "סיכונים"],
  ["dependencies", "תלויות"], ["open_questions", "שאלות פתוחות"], ["acceptance_criteria", "קריטריוני קבלה"],
  ["test_plan", "תוכנית בדיקות"], ["deployment", "דרישות פריסה"], ["training", "הדרכה"],
  ["support", "תמיכה"], ["delivery_range", "טווח מסירה"],
] as const;

export type Meeting = { id: string; project_id: string; status: string; language: "he" | "en"; started_at: string; ended_at: string | null };
export type SpecificationSection = { id: string; project_id: string; section_key: string; title: string; content: string; status: "ai_draft" | "edited" | "approved" | "incomplete"; client_visible: boolean; sort_order: number };
export type MeetingSource = { id: string; meeting_id: string; project_id: string; source_type: string; title: string; transcript?: string | null; storage_path?: string | null; mime_type?: string | null; review_status?: string | null; captured_at: string };

function assert(error: any, label: string) { if (error) throw new Error(`${label}: ${error.message}`); }

export async function loadMeetingWorkspace(projectId: string) {
  const [{ data: meetings, error: me }, { data: sections, error: se }, { data: sources, error: so }] = await Promise.all([
    db.from("client_meetings").select("*").eq("project_id", projectId).order("started_at", { ascending: false }).limit(1),
    db.from("specification_sections").select("*").eq("project_id", projectId).order("sort_order"),
    db.from("meeting_sources").select("*").eq("project_id", projectId).order("captured_at", { ascending: false }),
  ]);
  assert(me, "Load meeting"); assert(se, "Load specification"); assert(so, "Load sources");
  return { meeting: meetings?.[0] as Meeting | undefined, sections: (sections ?? []) as SpecificationSection[], sources: (sources ?? []) as MeetingSource[] };
}

export async function startMeeting(projectId: string, language: "he" | "en" = "he") {
  const { data: existing } = await db.from("client_meetings").select("*").eq("project_id", projectId).eq("status", "active").maybeSingle();
  let meeting = existing;
  if (!meeting) {
    const result = await db.from("client_meetings").insert({ project_id: projectId, language, status: "active", title: language === "he" ? "פגישת אפיון" : "Discovery meeting" }).select().single();
    assert(result.error, "Start meeting"); meeting = result.data;
  }
  const rows = SPEC_SECTIONS.map(([section_key, title], sort_order) => ({ project_id: projectId, meeting_id: meeting.id, section_key, title, sort_order, status: "incomplete" }));
  const seeded = await db.from("specification_sections").upsert(rows, { onConflict: "project_id,section_key", ignoreDuplicates: true });
  assert(seeded.error, "Prepare specification");
  return meeting as Meeting;
}

export async function saveSection(id: string, content: string, status: SpecificationSection["status"]) {
  const patch: any = { content, status };
  if (status === "approved") { patch.approved_at = new Date().toISOString(); }
  else { patch.approved_at = null; patch.approved_by = null; }
  const { error } = await db.from("specification_sections").update(patch).eq("id", id);
  assert(error, "Save specification section");
}

export async function finishMeeting(id: string) {
  const { error } = await db.from("client_meetings").update({ status: "completed", ended_at: new Date().toISOString() }).eq("id", id);
  assert(error, "Finish meeting");
}

export async function addTranscript(meeting: Meeting, transcript: string, speaker = "client") {
  const { error } = await db.from("meeting_sources").insert({ meeting_id: meeting.id, project_id: meeting.project_id, source_type: "transcript", title: "Meeting transcript", transcript, speaker, review_status: "reviewed" });
  assert(error, "Save transcript");
}

export async function uploadMeetingSource(meeting: Meeting, file: File) {
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${meeting.project_id}/${meeting.id}/${crypto.randomUUID()}-${safe}`;
  const upload = await supabase.storage.from("meeting-sources").upload(path, file, { upsert: false, contentType: file.type });
  assert(upload.error, "Upload meeting file");
  const kind = file.type.startsWith("image/") ? "image" : file.type === "application/pdf" ? "pdf" : "word";
  const result = await db.from("meeting_sources").insert({ meeting_id: meeting.id, project_id: meeting.project_id, source_type: kind, title: file.name, storage_path: path, mime_type: file.type, ai_derived: false });
  assert(result.error, "Link meeting file");
}

export async function invokeProjectWorkflow(action: string, projectId: string, payload: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke("project-workflow", { body: { action, projectId, ...payload } });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function loadPublishedProposals(projectId: string) {
  const { data, error } = await db.from("proposal_versions").select("*").eq("project_id", projectId).in("status", ["published","viewed","signed","superseded"]).order("version", { ascending: false });
  assert(error, "Load proposals"); return data ?? [];
}
