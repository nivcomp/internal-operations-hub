import { supabase } from "../integrations/supabase/client";
import type { ContactNote, ImportBatch, Lead, LeadStage, PastProjectRecord } from "../types/crm";

type Row = Record<string, any>;

function fail(action: string, error: unknown): never {
  const message = (error as { message?: string })?.message ?? "Unknown error";
  throw new Error(`${action} failed: ${message}`);
}

export function mapLead(row: Row): Lead {
  return {
    id: row.id,
    name: row.name ?? "",
    company: row.company ?? "",
    email: row.email ?? null,
    phone: row.phone ?? null,
    source: row.source ?? null,
    stage: (row.stage ?? "new") as LeadStage,
    status: row.status ?? "open",
    serviceInterest: row.service_interest ?? null,
    estimatedValue: row.estimated_value === null || row.estimated_value === undefined ? null : Number(row.estimated_value),
    currency: row.currency ?? "GBP",
    notes: row.notes ?? "",
    tags: row.tags ?? [],
    nextFollowUpAt: row.next_follow_up_at ?? null,
    lastContactAt: row.last_contact_at ?? null,
    convertedClientId: row.converted_client_id ?? null,
    convertedAt: row.converted_at ?? null,
    archivedAt: row.archived_at ?? null,
    importBatchId: row.import_batch_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapNote(row: Row): ContactNote {
  return {
    id: row.id,
    leadId: row.lead_id ?? null,
    clientId: row.client_id ?? null,
    projectId: row.project_id ?? null,
    body: row.body ?? "",
    noteType: row.note_type ?? "note",
    originalSource: row.original_source ?? null,
    createdAt: row.created_at,
  };
}

export function mapPastProject(row: Row): PastProjectRecord {
  return {
    id: row.id,
    clientId: row.client_id ?? null,
    leadId: row.lead_id ?? null,
    projectName: row.project_name ?? "",
    description: row.description ?? "",
    status: row.status ?? "completed",
    startDate: row.start_date ?? null,
    endDate: row.end_date ?? null,
    value: row.value === null || row.value === undefined ? null : Number(row.value),
    currency: row.currency ?? "GBP",
    technologies: row.technologies ?? [],
    outcome: row.outcome ?? "",
    notes: row.notes ?? "",
    createdAt: row.created_at,
  };
}

export async function fetchLeads(): Promise<Lead[]> {
  const { data, error } = await supabase.from("crm_leads").select("*")
    .is("archived_at", null).order("updated_at", { ascending: false }).limit(2000);
  if (error) fail("fetchLeads", error);
  return (data ?? []).map(mapLead);
}

export async function fetchLeadNotes(leadId: string): Promise<ContactNote[]> {
  const { data, error } = await supabase.from("contact_notes").select("*")
    .eq("lead_id", leadId).order("created_at", { ascending: false }).limit(200);
  if (error) fail("fetchLeadNotes", error);
  return (data ?? []).map(mapNote);
}

export async function fetchClientNotes(clientId: string): Promise<ContactNote[]> {
  const { data, error } = await supabase.from("contact_notes").select("*")
    .eq("client_id", clientId).order("created_at", { ascending: false }).limit(200);
  if (error) fail("fetchClientNotes", error);
  return (data ?? []).map(mapNote);
}

export async function fetchPastProjects(clientId?: string): Promise<PastProjectRecord[]> {
  let query = supabase.from("past_projects").select("*").is("archived_at", null)
    .order("end_date", { ascending: false }).limit(1000);
  if (clientId) query = query.eq("client_id", clientId);
  const { data, error } = await query;
  if (error) fail("fetchPastProjects", error);
  return (data ?? []).map(mapPastProject);
}

export async function fetchImportBatches(): Promise<ImportBatch[]> {
  const { data, error } = await supabase.from("import_batches").select("*")
    .order("imported_at", { ascending: false }).limit(50);
  if (error) fail("fetchImportBatches", error);
  return (data ?? []).map((row) => ({
    id: row.id,
    fileName: row.file_name,
    fileType: row.file_type,
    importedAt: row.imported_at,
    totalRows: row.total_rows ?? 0,
    successfulRows: row.successful_rows ?? 0,
    skippedRows: row.skipped_rows ?? 0,
    failedRows: row.failed_rows ?? 0,
    status: row.status,
  }));
}

export async function createLead(input: {
  name: string; company: string; email?: string; phone?: string; source?: string;
  serviceInterest?: string; estimatedValue?: number | null; notes?: string;
}): Promise<Lead> {
  const email = (input.email ?? "").trim().toLowerCase();
  const digits = (input.phone ?? "").replace(/\D+/g, "");
  const { data, error } = await supabase.from("crm_leads").insert({
    name: input.name.trim(),
    company: input.company.trim(),
    email: email || null,
    email_normalized: email || null,
    phone: input.phone?.trim() || null,
    phone_normalized: digits ? digits.slice(-9) : null,
    source: input.source?.trim() || "manual",
    service_interest: input.serviceInterest?.trim() || null,
    estimated_value: input.estimatedValue ?? null,
    notes: input.notes?.trim() ?? "",
  }).select("*").maybeSingle();
  if (error || !data) fail("createLead", error);
  return mapLead(data);
}

export async function updateLeadStage(id: string, stage: LeadStage): Promise<void> {
  const { error } = await supabase.from("crm_leads").update({ stage }).eq("id", id);
  if (error) fail("updateLeadStage", error);
}

export async function updateLead(id: string, patch: {
  nextFollowUpAt?: string | null; lastContactAt?: string | null; serviceInterest?: string | null;
  estimatedValue?: number | null; status?: string;
}): Promise<void> {
  const payload: Row = {};
  if (patch.nextFollowUpAt !== undefined) payload.next_follow_up_at = patch.nextFollowUpAt || null;
  if (patch.lastContactAt !== undefined) payload.last_contact_at = patch.lastContactAt || null;
  if (patch.serviceInterest !== undefined) payload.service_interest = patch.serviceInterest;
  if (patch.estimatedValue !== undefined) payload.estimated_value = patch.estimatedValue;
  if (patch.status !== undefined) payload.status = patch.status;
  if (!Object.keys(payload).length) return;
  const { error } = await supabase.from("crm_leads")
    .update(payload as never).eq("id", id);
  if (error) fail("updateLead", error);
}

export async function archiveLead(id: string): Promise<void> {
  const { error } = await supabase.from("crm_leads")
    .update({ archived_at: new Date().toISOString(), status: "archived" }).eq("id", id);
  if (error) fail("archiveLead", error);
}

export async function addLeadNote(leadId: string, bodyText: string): Promise<ContactNote> {
  const { data, error } = await supabase.from("contact_notes")
    .insert({ lead_id: leadId, body: bodyText.trim(), note_type: "note" }).select("*").maybeSingle();
  if (error || !data) fail("addLeadNote", error);
  return mapNote(data);
}

/** Turns a lead into a real client record and keeps the history attached. */
export async function convertLeadToClient(lead: Lead): Promise<string> {
  const { data: client, error } = await supabase.from("clients").insert({
    name: lead.name || lead.company,
    company: lead.company || lead.name,
    email: lead.email ?? "",
    phone: lead.phone ?? "",
    notes: lead.notes ?? "",
    status: "lead",
  }).select("id").maybeSingle();
  if (error || !client) fail("convertLeadToClient", error);

  await supabase.from("crm_leads").update({
    converted_client_id: client.id, converted_at: new Date().toISOString(), stage: "won", status: "converted",
  }).eq("id", lead.id);
  await supabase.from("contact_notes").update({ client_id: client.id }).eq("lead_id", lead.id);
  await supabase.from("past_projects").update({ client_id: client.id }).eq("lead_id", lead.id);
  return client.id as string;
}

export type LeadEnrichment = {
  summary: string;
  serviceInterest?: string;
  likelyProjectType?: string;
  priority?: string;
  missingInfo?: string[];
  nextAction?: string;
  followUpDraft?: string;
  tags?: string[];
  opportunities?: string[];
};

export async function enrichLead(leadId: string): Promise<LeadEnrichment> {
  const { data, error } = await supabase.functions.invoke("crm-ai-map", { body: { action: "enrichLead", leadId } });
  if (error) throw new Error(error.message);
  if ((data as any)?.error) throw new Error(String((data as any).error));
  return (data as any).payload as LeadEnrichment;
}
