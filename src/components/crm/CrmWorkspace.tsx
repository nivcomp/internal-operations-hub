import { useEffect, useMemo, useState } from "react";
import {
  addLeadNote, archiveLead, convertLeadToClient, createLead, enrichLead, fetchImportBatches,
  fetchLeadNotes, fetchLeads, searchContactNotes, updateLead, updateLeadStage, type LeadEnrichment,
} from "../../services/crmApi";
import { CallLogger } from "./CallLogger";
import { ImportWizard } from "../import/ImportWizard";
import { LEAD_STAGES, type ContactNote, type ImportBatch, type Lead, type LeadStage } from "../../types/crm";

export const STAGE_LABELS_HE: Record<LeadStage, string> = {
  new: "חדש",
  contacted: "יצרנו קשר",
  qualified: "מתאים",
  meeting: "פגישה",
  proposal_sent: "הצעה נשלחה",
  negotiation: "משא ומתן",
  won: "נסגר בהצלחה",
  lost: "לא יצא לפועל",
  on_hold: "בהמתנה",
};

type Props = {
  onClientSelect?: (clientId: string) => void;
  onCreateProject?: (clientId: string) => void;
};

/** Hebrew lead pipeline shared by Simple Mode and the full system. */
export function CrmWorkspace({ onClientSelect, onCreateProject }: Props) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<LeadStage | "all">("all");
  const [view, setView] = useState<"board" | "list">("board");
  const [importOpen, setImportOpen] = useState(false);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [notes, setNotes] = useState<ContactNote[]>([]);
  const [noteDraft, setNoteDraft] = useState("");
  const [enrichment, setEnrichment] = useState<LeadEnrichment | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const [form, setForm] = useState({ name: "", company: "", email: "", phone: "", serviceInterest: "" });
  const [noteMatches, setNoteMatches] = useState<ContactNote[]>([]);

  async function reload() {
    setLoading(true);
    try {
      const [leadRows, batchRows] = await Promise.all([fetchLeads(), fetchImportBatches()]);
      setLeads(leadRows);
      setBatches(batchRows);
      setError(null);
    } catch (loadError) {
      setError((loadError as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void reload(); }, []);

  // Smart search also looks inside the saved call history.
  useEffect(() => {
    const term = search.trim();
    if (term.length < 2) { setNoteMatches([]); return; }
    const timer = window.setTimeout(() => {
      void searchContactNotes(term).then(setNoteMatches).catch(() => setNoteMatches([]));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!selected) { setNotes([]); setEnrichment(null); return; }
    void fetchLeadNotes(selected.id).then(setNotes).catch(() => setNotes([]));
  }, [selected?.id]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const noteLeadIds = new Set(noteMatches.map((note) => note.leadId).filter(Boolean) as string[]);
    return leads.filter((lead) => {
      if (stageFilter !== "all" && lead.stage !== stageFilter) return false;
      if (!term) return true;
      if (noteLeadIds.has(lead.id)) return true;
      return [lead.name, lead.company, lead.email, lead.phone, lead.serviceInterest]
        .some((value) => String(value ?? "").toLowerCase().includes(term));
    });
  }, [leads, search, stageFilter, noteMatches]);

  const staleCount = useMemo(() => leads.filter((lead) =>
    !["won", "lost"].includes(lead.stage)
    && Date.now() - new Date(lead.lastContactAt ?? lead.updatedAt).getTime() > 14 * 24 * 3600 * 1000).length, [leads]);

  async function withBusy(label: string, action: () => Promise<void>) {
    setBusy(label);
    setError(null);
    try { await action(); } catch (actionError) { setError((actionError as Error).message); } finally { setBusy(null); }
  }

  async function handleConvert(lead: Lead) {
    await withBusy("ממיר ללקוח…", async () => {
      const clientId = await convertLeadToClient(lead);
      await reload();
      setSelected(null);
      onClientSelect?.(clientId);
    });
  }

  return (
    <div className="simple-page" dir="rtl">
      <header className="simple-head">
        <p className="eyebrow">צנרת מכירות</p>
        <h1>{leads.length} לידים במעקב</h1>
        <p className="simple-note">
          {staleCount ? `${staleCount} לידים ללא מגע מעל שבועיים.` : "אין לידים תקועים."}
          {batches.length ? ` ייבוא אחרון: ${batches[0].fileName} (${batches[0].successfulRows} רשומות).` : ""}
        </p>
      </header>

      <div className="crm-toolbar">
        <input placeholder="חפש לפי שם, חברה, מייל או טלפון" value={search} onChange={(event) => setSearch(event.target.value)} />
        <select value={stageFilter} onChange={(event) => setStageFilter(event.target.value as LeadStage | "all")}>
          <option value="all">כל השלבים</option>
          {LEAD_STAGES.map((stage) => <option key={stage} value={stage}>{STAGE_LABELS_HE[stage]}</option>)}
        </select>
        <button type="button" className="ghost-button" onClick={() => setView(view === "board" ? "list" : "board")}>
          {view === "board" ? "תצוגת רשימה" : "תצוגת צנרת"}
        </button>
        <button type="button" className="ghost-button" onClick={() => setNewLeadOpen((open) => !open)}>ליד חדש</button>
        <button type="button" className="primary-button" onClick={() => setImportOpen(true)}>ייבוא Excel / CSV</button>
      </div>

      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {busy ? <p className="simple-note">{busy}</p> : null}
      {loading ? <p className="simple-note">טוען…</p> : null}

      {newLeadOpen ? (
        <section className="card form-panel">
          <h2>ליד חדש</h2>
          <div className="form-grid">
            <label>שם<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label>חברה<input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></label>
            <label>אימייל<input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
            <label>טלפון<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
            <label className="span-2">תחום עניין<input value={form.serviceInterest} onChange={(e) => setForm({ ...form, serviceInterest: e.target.value })} /></label>
            <div className="form-actions">
              <button
                type="button"
                className="primary-button"
                disabled={!form.name.trim() && !form.company.trim()}
                onClick={() => void withBusy("שומר…", async () => {
                  await createLead(form);
                  setForm({ name: "", company: "", email: "", phone: "", serviceInterest: "" });
                  setNewLeadOpen(false);
                  await reload();
                })}
              >
                שמור ליד
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {view === "board" ? (
        <section className="crm-board">
          {LEAD_STAGES.map((stage) => {
            const stageLeads = filtered.filter((lead) => lead.stage === stage);
            return (
              <div key={stage} className="crm-column">
                <header><strong>{STAGE_LABELS_HE[stage]}</strong><span>{stageLeads.length}</span></header>
                {stageLeads.map((lead) => (
                  <button key={lead.id} type="button" className="card crm-lead-card" onClick={() => setSelected(lead)}>
                    <strong>{lead.company || lead.name}</strong>
                    <span className="simple-note">{lead.name}{lead.serviceInterest ? ` · ${lead.serviceInterest}` : ""}</span>
                    {lead.nextFollowUpAt ? <em>מעקב: {lead.nextFollowUpAt}</em> : null}
                  </button>
                ))}
                {stageLeads.length === 0 ? <p className="simple-note">ריק</p> : null}
              </div>
            );
          })}
        </section>
      ) : (
        <section className="crm-mobile-list">
          {filtered.map((lead) => {
            const match = noteMatches.find((note) => note.leadId === lead.id);
            return (
              <article key={lead.id} className="card crm-mobile-card">
                <button type="button" className="crm-mobile-main" onClick={() => setSelected(lead)}>
                  <strong>{lead.company || lead.name || "—"}</strong>
                  <span className="simple-note">
                    {lead.name || "—"} · {STAGE_LABELS_HE[lead.stage]}
                    {lead.serviceInterest ? ` · ${lead.serviceInterest}` : ""}
                  </span>
                  {lead.nextFollowUpAt ? <em>מעקב: {lead.nextFollowUpAt}</em> : null}
                  {match ? <em className="crm-match">נמצא בהיסטוריית שיחות: {match.body.slice(0, 70)}…</em> : null}
                </button>
                <div className="crm-mobile-actions">
                  {lead.phone ? (
                    <a className="primary-button crm-call-button" href={`tel:${lead.phone.replace(/[^\d+]/g, "")}`}>
                      📞 {lead.phone}
                    </a>
                  ) : <span className="simple-note">ללא טלפון</span>}
                  <button type="button" className="ghost-button" onClick={() => setSelected(lead)}>🎙️ תעד שיחה</button>
                </div>
              </article>
            );
          })}
          {filtered.length === 0 && !loading ? <p className="simple-note">אין לידים שתואמים לסינון.</p> : null}
        </section>
      )}

      {selected ? (
        <div className="simple-drawer-backdrop" role="dialog" aria-modal="true" dir="rtl" onClick={() => setSelected(null)}>
          <aside className="simple-drawer" onClick={(event) => event.stopPropagation()}>
            <header>
              <div>
                <strong>{selected.company || selected.name}</strong>
                <span className="simple-note">{selected.email ?? "ללא מייל"} · {selected.phone ?? "ללא טלפון"}</span>
              </div>
              <button type="button" onClick={() => setSelected(null)}>×</button>
            </header>
            <div className="simple-drawer-body">
              <label>
                שלב
                <select
                  value={selected.stage}
                  onChange={(event) => void withBusy("מעדכן…", async () => {
                    const stage = event.target.value as LeadStage;
                    await updateLeadStage(selected.id, stage);
                    setSelected({ ...selected, stage });
                    await reload();
                  })}
                >
                  {LEAD_STAGES.map((stage) => <option key={stage} value={stage}>{STAGE_LABELS_HE[stage]}</option>)}
                </select>
              </label>
              <label>
                מעקב הבא
                <input
                  type="date"
                  value={selected.nextFollowUpAt ?? ""}
                  onChange={(event) => void withBusy("מעדכן…", async () => {
                    await updateLead(selected.id, { nextFollowUpAt: event.target.value || null });
                    setSelected({ ...selected, nextFollowUpAt: event.target.value || null });
                    await reload();
                  })}
                />
              </label>
              {selected.notes ? <p className="simple-note">{selected.notes}</p> : null}

              <label>
                הערה מהירה
                <textarea value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} rows={3} />
              </label>
              <button
                type="button"
                className="ghost-button"
                disabled={!noteDraft.trim()}
                onClick={() => void withBusy("שומר הערה…", async () => {
                  const note = await addLeadNote(selected.id, noteDraft);
                  setNotes([note, ...notes]);
                  setNoteDraft("");
                  await updateLead(selected.id, { lastContactAt: new Date().toISOString().slice(0, 10) });
                })}
              >
                הוסף הערה
              </button>

              <ul className="crm-notes">
                {notes.map((note) => (
                  <li key={note.id}>
                    <span className="simple-note">{note.createdAt.slice(0, 10)}{note.originalSource ? ` · ${note.originalSource}` : ""}</span>
                    <p>{note.body}</p>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                className="ghost-button"
                onClick={() => void withBusy("ה-AI מנתח…", async () => setEnrichment(await enrichLead(selected.id)))}
              >
                בקש ניתוח AI
              </button>
              {enrichment ? (
                <div className="card crm-suggestion">
                  <p><strong>הצעה של ה-AI</strong> — דורש אישור שלך, שום דבר לא נשמר אוטומטית.</p>
                  <p>{enrichment.summary}</p>
                  {enrichment.nextAction ? <p>פעולה מומלצת: {enrichment.nextAction}</p> : null}
                  {enrichment.followUpDraft ? <p className="simple-note">טיוטת מעקב: {enrichment.followUpDraft}</p> : null}
                  {enrichment.missingInfo?.length ? <p className="simple-note">חסר: {enrichment.missingInfo.join(", ")}</p> : null}
                </div>
              ) : null}

              <div className="form-actions">
                {selected.convertedClientId ? (
                  <>
                    <button type="button" className="ghost-button" onClick={() => onClientSelect?.(selected.convertedClientId!)}>
                      פתח את הלקוח
                    </button>
                    <button type="button" className="primary-button" onClick={() => onCreateProject?.(selected.convertedClientId!)}>
                      פתח פרויקט
                    </button>
                  </>
                ) : (
                  <button type="button" className="primary-button" onClick={() => void handleConvert(selected)}>
                    המר ללקוח
                  </button>
                )}
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => void withBusy("מארכב…", async () => {
                    await archiveLead(selected.id);
                    setSelected(null);
                    await reload();
                  })}
                >
                  ארכב
                </button>
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      {importOpen ? <ImportWizard onClose={() => setImportOpen(false)} onImported={() => void reload()} /> : null}
    </div>
  );
}
