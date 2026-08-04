import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

/**
 * Spreadsheet import engine (agency admin only).
 *
 * The browser parses the workbook and sends normalized rows; every decision that
 * touches the database — validation, duplicate matching, merging and writing —
 * happens here, chunk by chunk, so a failed row never stops the batch.
 */

type SheetType = "leads" | "clients" | "contacts" | "past_projects" | "notes" | "unknown";
type Resolution = "create" | "skip" | "merge" | "update" | "review_later";

type Body = {
  action?: "preview" | "createBatch" | "executeChunk" | "finishBatch" | "retryFailed";
  batchId?: string;
  fileName?: string;
  fileType?: string;
  storagePath?: string;
  mapping?: Record<string, unknown>;
  totalRows?: number;
  sheetName?: string;
  sheetType?: SheetType;
  columns?: { column: string; target: string }[];
  rows?: { rowIndex: number; values: Record<string, string> }[];
  resolutions?: Record<string, Resolution>;
  startIndex?: number;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const clean = (v: unknown, max = 2000) => String(v ?? "").replace(/\u0000/g, "").trim().slice(0, max);
const normEmail = (v: unknown) => clean(v, 200).toLowerCase();
const normPhone = (v: unknown) => {
  const digits = clean(v, 40).replace(/\D+/g, "");
  return digits.length > 9 ? digits.slice(-9) : digits;
};
const validEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
const toNumber = (v: unknown) => {
  const n = Number(clean(v, 40).replace(/[^\d.\-]/g, ""));
  return Number.isFinite(n) && n !== 0 ? n : null;
};
const toDate = (v: unknown) => {
  const raw = clean(v, 40);
  if (!raw) return null;
  const iso = /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : null;
  if (iso) return iso;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
};

const STAGES = ["new", "contacted", "qualified", "meeting", "proposal_sent", "negotiation", "won", "lost", "on_hold"];

/** Applies the confirmed column mapping to one raw row. */
function project(values: Record<string, string>, columns: { column: string; target: string }[]) {
  const out: Record<string, string> = {};
  const noteParts: string[] = [];
  for (const { column, target } of columns) {
    const value = clean(values[column] ?? "");
    if (!value || target === "ignore") continue;
    if (target === "note") { noteParts.push(`${column}: ${value}`); continue; }
    out[target] = out[target] ? `${out[target]} | ${value}` : value;
  }
  return { fields: out, extraNotes: noteParts.join("\n") };
}

function leadFromRow(fields: Record<string, string>, extraNotes: string) {
  const email = normEmail(fields.email);
  const stage = STAGES.includes(clean(fields.stage, 40).toLowerCase()) ? clean(fields.stage, 40).toLowerCase() : "new";
  const notes = [clean(fields.notes, 4000), extraNotes].filter(Boolean).join("\n");
  return {
    name: clean(fields.name, 160) || clean(fields.company, 160),
    company: clean(fields.company, 160) || clean(fields.name, 160),
    email: email || null,
    phone: clean(fields.phone, 60) || null,
    email_normalized: email || null,
    phone_normalized: normPhone(fields.phone) || null,
    source: clean(fields.source, 120) || null,
    stage,
    service_interest: clean(fields.service_interest, 300) || null,
    estimated_value: toNumber(fields.estimated_value),
    currency: clean(fields.currency, 8) || "GBP",
    notes,
    tags: clean(fields.tags, 300) ? clean(fields.tags, 300).split(/[,;|]/).map((t) => t.trim()).filter(Boolean) : [],
    next_follow_up_at: toDate(fields.next_follow_up_at),
    last_contact_at: toDate(fields.last_contact_at),
  };
}

function pastProjectFromRow(fields: Record<string, string>, extraNotes: string) {
  return {
    project_name: clean(fields.project_name, 200) || clean(fields.company, 200) || "פרויקט מיובא",
    description: clean(fields.description, 4000),
    status: clean(fields.status, 60) || "completed",
    start_date: toDate(fields.start_date),
    end_date: toDate(fields.end_date),
    value: toNumber(fields.value ?? fields.estimated_value),
    currency: clean(fields.currency, 8) || "GBP",
    technologies: clean(fields.technologies, 300) ? clean(fields.technologies, 300).split(/[,;|]/).map((t) => t.trim()).filter(Boolean) : [],
    outcome: clean(fields.outcome, 1000),
    notes: [clean(fields.notes, 2000), extraNotes].filter(Boolean).join("\n"),
    company: clean(fields.company, 200),
  };
}

type Existing = {
  clients: { id: string; name: string; company: string; email: string; phone: string }[];
  leads: { id: string; name: string; company: string; email_normalized: string | null; phone_normalized: string | null }[];
};

async function loadExisting(admin: any): Promise<Existing> {
  const [{ data: clients }, { data: leads }] = await Promise.all([
    admin.from("clients").select("id, name, company, email, phone").limit(5000),
    admin.from("crm_leads").select("id, name, company, email_normalized, phone_normalized").is("archived_at", null).limit(20000),
  ]);
  return { clients: clients ?? [], leads: leads ?? [] };
}

function findMatch(existing: Existing, candidate: { email: string; phone: string; company: string; name: string }) {
  if (candidate.email) {
    const client = existing.clients.find((c) => normEmail(c.email) === candidate.email);
    if (client) return { reason: "email", matchType: "client", matchId: client.id, matchLabel: client.company || client.name };
    const lead = existing.leads.find((l) => (l.email_normalized ?? "") === candidate.email);
    if (lead) return { reason: "email", matchType: "lead", matchId: lead.id, matchLabel: lead.company || lead.name };
  }
  if (candidate.phone) {
    const client = existing.clients.find((c) => normPhone(c.phone) === candidate.phone);
    if (client) return { reason: "phone", matchType: "client", matchId: client.id, matchLabel: client.company || client.name };
    const lead = existing.leads.find((l) => (l.phone_normalized ?? "") === candidate.phone);
    if (lead) return { reason: "phone", matchType: "lead", matchId: lead.id, matchLabel: lead.company || lead.name };
  }
  const company = candidate.company.toLowerCase();
  if (company.length > 2) {
    const client = existing.clients.find((c) => clean(c.company).toLowerCase() === company);
    if (client) return { reason: "company", matchType: "client", matchId: client.id, matchLabel: client.company };
    const lead = existing.leads.find((l) => clean(l.company).toLowerCase() === company);
    if (lead) return { reason: "company", matchType: "lead", matchId: lead.id, matchLabel: lead.company };
  }
  const name = candidate.name.toLowerCase();
  if (name.length > 2) {
    const lead = existing.leads.find((l) => clean(l.name).toLowerCase() === name);
    if (lead) return { reason: "name", matchType: "lead", matchId: lead.id, matchLabel: lead.name };
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const anon = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: claimsData, error: claimsError } = await anon.auth.getClaims(authHeader.replace("Bearer ", ""));
  if (claimsError || !claimsData?.claims) return json({ error: "Unauthorized" }, 401);
  const callerId = claimsData.claims.sub as string;

  const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: caller } = await admin.from("profiles").select("role, is_active").eq("id", callerId).maybeSingle();
  if (!caller || caller.role !== "agency_admin" || caller.is_active !== true) return json({ error: "Forbidden" }, 403);

  let body: Body;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }

  try {
    // ---------------------------------------------------------------- preview
    if (body.action === "preview") {
      const columns = body.columns ?? [];
      const rows = (body.rows ?? []).slice(0, 20000);
      const sheetType = body.sheetType ?? "leads";
      const existing = await loadExisting(admin);
      const duplicates: any[] = [];
      const invalidEmails: number[] = [];
      const invalidPhones: number[] = [];
      const missingRequired: number[] = [];
      let notesToAppend = 0;
      let toCreate = 0;

      for (const row of rows) {
        const { fields, extraNotes } = project(row.values, columns);
        if (extraNotes) notesToAppend += 1;
        if (sheetType === "past_projects") {
          if (!clean(fields.project_name) && !clean(fields.company)) missingRequired.push(row.rowIndex);
          else toCreate += 1;
          continue;
        }
        const email = normEmail(fields.email);
        const phone = normPhone(fields.phone);
        if (fields.email && !validEmail(email)) invalidEmails.push(row.rowIndex);
        if (fields.phone && phone.length < 7) invalidPhones.push(row.rowIndex);
        if (!clean(fields.name) && !clean(fields.company)) { missingRequired.push(row.rowIndex); continue; }
        const match = findMatch(existing, {
          email: validEmail(email) ? email : "",
          phone,
          company: clean(fields.company),
          name: clean(fields.name),
        });
        if (match) duplicates.push({ rowIndex: row.rowIndex, ...match });
        else toCreate += 1;
      }

      return json({
        preview: {
          sheetName: body.sheetName ?? "",
          sheetType,
          toCreate,
          toUpdate: duplicates.length,
          duplicates: duplicates.slice(0, 500),
          invalidEmails: invalidEmails.slice(0, 500),
          invalidPhones: invalidPhones.slice(0, 500),
          missingRequired: missingRequired.slice(0, 500),
          ignoredColumns: columns.filter((c) => c.target === "ignore").map((c) => c.column),
          notesToAppend,
        },
      });
    }

    // ----------------------------------------------------------- create batch
    if (body.action === "createBatch") {
      const { data, error } = await admin.from("import_batches").insert({
        file_name: clean(body.fileName, 300) || "import",
        file_type: clean(body.fileType, 40) || "xlsx",
        storage_path: clean(body.storagePath, 400) || null,
        imported_by: callerId,
        total_rows: Number(body.totalRows ?? 0),
        mapping_json: body.mapping ?? {},
        status: "running",
      }).select("*").maybeSingle();
      if (error) throw new Error(error.message);
      return json({ batch: data });
    }

    // ---------------------------------------------------------- execute chunk
    if (body.action === "executeChunk") {
      const batchId = clean(body.batchId, 64);
      if (!batchId) return json({ error: "Missing batch id" }, 400);
      const columns = body.columns ?? [];
      const sheetType = body.sheetType ?? "leads";
      const sheetName = clean(body.sheetName, 200);
      const rows = (body.rows ?? []).slice(0, 500);
      const resolutions = body.resolutions ?? {};
      const existing = await loadExisting(admin);

      let created = 0, updated = 0, skipped = 0, failed = 0;
      const errors: { rowIndex: number; message: string }[] = [];

      for (const row of rows) {
        const resolution: Resolution = resolutions[String(row.rowIndex)] ?? "create";
        const auditRow = {
          batch_id: batchId,
          sheet_name: sheetName,
          sheet_type: sheetType,
          row_index: row.rowIndex,
          raw: row.values,
          resolution,
          status: "pending" as string,
          target_table: null as string | null,
          target_id: null as string | null,
          error: null as string | null,
        };

        try {
          const { fields, extraNotes } = project(row.values, columns);

          if (resolution === "skip" || resolution === "review_later") {
            skipped += 1;
            auditRow.status = resolution === "skip" ? "skipped" : "review_later";
          } else if (sheetType === "past_projects") {
            const record = pastProjectFromRow(fields, extraNotes);
            const client = existing.clients.find((c) => clean(c.company).toLowerCase() === record.company.toLowerCase());
            const { company: _company, ...insertable } = record;
            const { data, error } = await admin.from("past_projects").insert({
              ...insertable,
              client_id: client?.id ?? null,
              import_batch_id: batchId,
              source_row_id: `${sheetName}:${row.rowIndex}`,
            }).select("id").maybeSingle();
            if (error) throw new Error(error.message);
            created += 1;
            auditRow.status = "created";
            auditRow.target_table = "past_projects";
            auditRow.target_id = data?.id ?? null;
          } else {
            const lead = leadFromRow(fields, extraNotes);
            if (!lead.name && !lead.company) throw new Error("שורה ללא שם או חברה");
            const match = (resolution === "merge" || resolution === "update")
              ? findMatch(existing, {
                  email: lead.email_normalized ?? "",
                  phone: lead.phone_normalized ?? "",
                  company: lead.company,
                  name: lead.name,
                })
              : null;

            if (match && match.matchType === "lead") {
              const { data: current } = await admin.from("crm_leads").select("*").eq("id", match.matchId).maybeSingle();
              const patch: Record<string, unknown> = {};
              // Never overwrite a filled contact field; only fill the gaps.
              if (!current?.email && lead.email) { patch.email = lead.email; patch.email_normalized = lead.email_normalized; }
              if (!current?.phone && lead.phone) { patch.phone = lead.phone; patch.phone_normalized = lead.phone_normalized; }
              if (!current?.service_interest && lead.service_interest) patch.service_interest = lead.service_interest;
              if (!current?.estimated_value && lead.estimated_value) patch.estimated_value = lead.estimated_value;
              if (!current?.source && lead.source) patch.source = lead.source;
              const mergedTags = Array.from(new Set([...(current?.tags ?? []), ...lead.tags]));
              if (mergedTags.length !== (current?.tags ?? []).length) patch.tags = mergedTags;
              if (Object.keys(patch).length) await admin.from("crm_leads").update(patch).eq("id", match.matchId);
              if (lead.notes) {
                await admin.from("contact_notes").insert({
                  lead_id: match.matchId, body: lead.notes, note_type: "imported",
                  original_source: sheetName, created_by: callerId, import_batch_id: batchId,
                });
              }
              updated += 1;
              auditRow.status = "updated";
              auditRow.target_table = "crm_leads";
              auditRow.target_id = match.matchId;
            } else if (match && match.matchType === "client") {
              if (lead.notes || extraNotes) {
                await admin.from("contact_notes").insert({
                  client_id: match.matchId, body: lead.notes || extraNotes, note_type: "imported",
                  original_source: sheetName, created_by: callerId, import_batch_id: batchId,
                });
              }
              updated += 1;
              auditRow.status = "updated";
              auditRow.target_table = "clients";
              auditRow.target_id = match.matchId;
            } else {
              const { data, error } = await admin.from("crm_leads").insert({
                ...lead,
                owner_profile_id: callerId,
                import_batch_id: batchId,
                source_row_id: `${sheetName}:${row.rowIndex}`,
              }).select("id, name, company, email_normalized, phone_normalized").maybeSingle();
              if (error) throw new Error(error.message);
              if (data) existing.leads.push(data as any);
              created += 1;
              auditRow.status = "created";
              auditRow.target_table = "crm_leads";
              auditRow.target_id = data?.id ?? null;
            }
          }
        } catch (rowError) {
          failed += 1;
          auditRow.status = "failed";
          auditRow.error = String((rowError as Error).message).slice(0, 400);
          errors.push({ rowIndex: row.rowIndex, message: auditRow.error });
        }

        await admin.from("import_rows").upsert(auditRow, { onConflict: "batch_id,sheet_name,row_index" });
      }

      const { data: batch } = await admin.from("import_batches").select("*").eq("id", batchId).maybeSingle();
      await admin.from("import_batches").update({
        successful_rows: Number(batch?.successful_rows ?? 0) + created + updated,
        skipped_rows: Number(batch?.skipped_rows ?? 0) + skipped,
        failed_rows: Number(batch?.failed_rows ?? 0) + failed,
      }).eq("id", batchId);

      return json({ created, updated, skipped, failed, errors });
    }

    // ----------------------------------------------------------- finish batch
    if (body.action === "finishBatch") {
      const batchId = clean(body.batchId, 64);
      if (!batchId) return json({ error: "Missing batch id" }, 400);
      const { data: batch } = await admin.from("import_batches").select("*").eq("id", batchId).maybeSingle();
      await admin.from("import_batches").update({ status: "completed" }).eq("id", batchId);
      await admin.from("activity_logs").insert({
        label: "ייבוא נתונים",
        detail: `יובאו ${batch?.successful_rows ?? 0} רשומות מתוך ${batch?.total_rows ?? 0} בקובץ ${batch?.file_name ?? ""}`,
      });
      return json({ batch: { ...batch, status: "completed" } });
    }

    // ------------------------------------------------------------ retry rows
    if (body.action === "retryFailed") {
      const batchId = clean(body.batchId, 64);
      if (!batchId) return json({ error: "Missing batch id" }, 400);
      const { data } = await admin.from("import_rows")
        .select("sheet_name, sheet_type, row_index, raw").eq("batch_id", batchId).eq("status", "failed").limit(500);
      return json({ rows: (data ?? []).map((r: any) => ({ rowIndex: r.row_index, values: r.raw, sheetName: r.sheet_name, sheetType: r.sheet_type })) });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    console.error("crm-import failed", error);
    return json({ error: String((error as Error).message).slice(0, 400) }, 500);
  }
});
