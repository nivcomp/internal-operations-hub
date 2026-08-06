import { useEffect, useRef, useState } from "react";
import { ProjectChat } from "../ProjectChat";
import { fetchProjectEstimation, createEstimate, updateEstimate } from "../../services/estimationApi";
import { addTranscript, finishMeeting, loadMeetingWorkspace, saveSection, startMeeting, uploadMeetingSource, type Meeting, type MeetingSource, type SpecificationSection } from "../../services/meetingWorkflowApi";
import { useAppData } from "../../context/AppDataContext";
import { startRecording, type Recorder } from "../../lib/voice";
import { transcribeAudio } from "../../services/copilotApi";
import type { ProjectEstimate } from "../../types/estimation";

type Props = {
  projectId: string; projectName: string; clientName?: string; companyName?: string;
  onSaveExit?: () => void; onFinished?: () => void; onOpenAdvanced?: () => void;
};

const money = (value: number | null | undefined, currency: string) => value == null ? "—" : new Intl.NumberFormat("he-IL", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);

export function MeetingWorkspace({ projectId, projectName, clientName, companyName, onSaveExit, onFinished, onOpenAdvanced }: Props) {
  const { refreshCommercials } = useAppData();
  const [meeting, setMeeting] = useState<Meeting>();
  const [sections, setSections] = useState<SpecificationSection[]>([]);
  const [sources, setSources] = useState<MeetingSource[]>([]);
  const [estimate, setEstimate] = useState<ProjectEstimate>();
  const [rate, setRate] = useState(0);
  const [currency, setCurrency] = useState("ILS");
  const [transcript, setTranscript] = useState("");
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [uploads, setUploads] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<Date>();
  const [finishOpen, setFinishOpen] = useState(false);
  const [error, setError] = useState("");
  const recorder = useRef<Recorder | null>(null);

  async function refresh() {
    const [workspace, estimation] = await Promise.all([loadMeetingWorkspace(projectId), fetchProjectEstimation(projectId)]);
    setMeeting(workspace.meeting); setSections(workspace.sections); setSources(workspace.sources);
    const current = estimation.estimates[0]; setEstimate(current);
    if (current) { setRate(current.client_calculation_rate); setCurrency(current.currency); }
  }
  useEffect(() => { void refresh().catch((e) => setError(e.message)); }, [projectId]);

  async function begin() { setBusy(true); try { await startMeeting(projectId); await refresh(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  async function saveRate() {
    setBusy(true); setError("");
    try {
      const current = (await fetchProjectEstimation(projectId)).estimates[0];
      const patch: Partial<ProjectEstimate> = { client_calculation_rate: rate, currency };
      if (current) {
        patch.estimated_budget_min = current.estimated_hours_min * rate;
        patch.estimated_budget_max = current.estimated_hours_max * rate;
        await updateEstimate(current.id, patch);
      } else await createEstimate(projectId, { ...patch, status: "draft" }, 1);
      await Promise.all([refreshCommercials(), refresh()]); setSavedAt(new Date());
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function saveTranscript() {
    if (!meeting || !transcript.trim()) return;
    setBusy(true); setError("");
    try { await addTranscript(meeting, transcript.trim()); setTranscript(""); await refresh(); setSavedAt(new Date()); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function startVoice() {
    setError("");
    try { recorder.current = await startRecording(); setRecording(true); }
    catch { setError("לא התקבלה הרשאה למיקרופון. אפשר להקליד את התמלול ידנית או לנסות שוב."); }
  }
  async function stopVoice() {
    const active = recorder.current; if (!active) return;
    recorder.current = null; setRecording(false); setTranscribing(true); setError("");
    try { const wav = await active.stop(); const result = await transcribeAudio(wav); if (!result.text?.trim()) throw new Error("לא זוהה דיבור. נסה שוב."); setTranscript(result.text.trim()); }
    catch (e) { setError((e as Error).message); } finally { setTranscribing(false); }
  }
  async function uploadFiles(files: FileList | null) {
    if (!meeting || !files?.length) return;
    for (const file of Array.from(files)) {
      setUploads((current) => ({ ...current, [file.name]: "מעלה…" }));
      try { await uploadMeetingSource(meeting, file); setUploads((current) => ({ ...current, [file.name]: "נשמר" })); }
      catch (e) { setUploads((current) => ({ ...current, [file.name]: `שגיאה: ${(e as Error).message}` })); }
    }
    await refresh(); setSavedAt(new Date());
  }
  async function confirmFinish() {
    if (!meeting) return; setBusy(true);
    try { await finishMeeting(meeting.id); await refresh(); setFinishOpen(false); onFinished?.(); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  if (!meeting) return <section className="card" dir="rtl"><h2>חדר אפיון</h2><p>פתח פגישה ממוקדת לפרויקט הזה.</p><button className="primary-button" disabled={busy} onClick={() => void begin()}>פתח פגישת לקוח</button>{error && <p className="form-error">{error}</p>}</section>;
  const approved = sections.filter((section) => section.status === "approved").length;
  const incomplete = sections.filter((section) => section.status === "incomplete").length;
  const openQuestions = sections.find((section) => section.section_key === "open_questions")?.content.trim() ?? "";

  return <div className="meeting-workspace" dir="rtl">
    <header className="card meeting-head"><div><p className="eyebrow">{companyName || "פגישת לקוח"}</p><h2>חדר אפיון — {projectName}</h2><p>{clientName ? `איש קשר: ${clientName} · ` : ""}מצב: {meeting.status === "active" ? "פגישה פעילה" : "הפגישה הסתיימה"} · התחלה: {new Date(meeting.started_at).toLocaleString("he-IL")}</p><small>{savedAt ? `נשמר לאחרונה ${savedAt.toLocaleTimeString("he-IL")}` : "המידע נשמר ב-Supabase"}</small></div><div className="action-row"><button onClick={() => void refresh().then(() => setSavedAt(new Date()))}>שמור</button>{onSaveExit ? <button onClick={onSaveExit}>שמור וצא</button> : null}{onOpenAdvanced ? <button onClick={onOpenAdvanced}>פתח כלים מתקדמים</button> : null}{meeting.status === "active" ? <button className="primary-button" onClick={() => setFinishOpen(true)}>סיים פגישה</button> : null}</div></header>
    {error && <p className="form-error">{error}</p>}
    <div className="meeting-grid"><main>
      <ProjectChat projectId={projectId} projectName={projectName} agent="agency_control" title="שיחת אפיון חיה" subtitle="העוזר שואל שאלה שימושית אחת בכל פעם. כל שינוי מסחרי מחייב את אישורך." showVisibility suggestions={["סכם את מה שנאמר", "מה חסר לנו?", "שאל על המשתמשים", "מה הסיכונים?", "הצג את התהליך"]} />
      <section className="card"><h3>קול ותמלול</h3><div className="action-row">{!recording ? <button disabled={transcribing} onClick={() => void startVoice()}>🎙️ התחל הקלטה</button> : <button className="danger-button" onClick={() => void stopVoice()}>■ עצור ותמלל</button>} {recording ? <strong className="recording-indicator">מקליט עכשיו…</strong> : null}{transcribing ? <span>מתמלל…</span> : null}</div><label>תמלול לבדיקה לפני שמירה<textarea rows={5} value={transcript} onChange={(e) => setTranscript(e.target.value)} placeholder="התמלול יופיע כאן וניתן לערוך אותו" /></label><button disabled={busy || !transcript.trim()} onClick={() => void saveTranscript()}>אשר ושמור תמלול</button><p className="form-note">קול גולמי אינו נשמר. רק תמלול שאישרת נשמר כמקור לפגישה.</p></section>
      <section className="card"><h3>תמונות וקבצים</h3><label className="button-like">העלה תמונות / PDF / Word<input hidden multiple type="file" accept="image/*,.pdf,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" capture="environment" onChange={(e) => void uploadFiles(e.target.files)} /></label>{Object.entries(uploads).map(([name, status]) => <p key={name}><strong>{name}</strong> — {status}</p>)}<div className="meeting-source-list">{sources.map((source) => <article key={source.id}><strong>{source.title}</strong><span>{source.source_type} · {new Date(source.captured_at).toLocaleString("he-IL")}</span><small>{source.review_status || "נשמר"}</small></article>)}</div></section>
    </main><aside>
      <section className="card"><h3>תמחור פנימי</h3><label>מחיר חישוב לשעה<input type="number" min="0" value={rate || ""} onChange={(e) => setRate(Number(e.target.value))} /></label><label>מטבע<select value={currency} onChange={(e) => setCurrency(e.target.value)}><option>ILS</option><option>GBP</option><option>USD</option><option>EUR</option></select></label><dl className="meeting-pricing-summary"><div><dt>טווח תקציב</dt><dd>{money(estimate?.estimated_budget_min, currency)} – {money(estimate?.estimated_budget_max, currency)}</dd></div><div><dt>עלות פנימית</dt><dd>{money(estimate?.internal_cost, currency)}</dd></div><div><dt>מחיר קבוע</dt><dd>{money(estimate?.final_fixed_price, currency)}</dd></div><div><dt>סטטוס</dt><dd>{estimate?.status ?? "טרם נוצר אומדן"}</dd></div></dl><button className="primary-button" disabled={busy || rate <= 0} onClick={() => void saveRate()}>אשר ושמור תמחור</button>{onOpenAdvanced ? <button onClick={onOpenAdvanced}>פתח בקרת תמחור מלאה</button> : null}<p className="form-note">מקור הנתונים היחיד הוא project_estimates. המידע הפנימי גלוי למנהל בלבד.</p></section>
      <section className="card specification-live"><h3>אפיון חי</h3>{sections.map((section) => <SectionEditor key={section.id} section={section} onSaved={async () => { await refresh(); setSavedAt(new Date()); }} />)}</section>
    </aside></div>
    {finishOpen ? <div className="modal-backdrop"><section className="modal-card meeting-finish" role="dialog" aria-modal="true"><div className="modal-head"><h2>סיכום לפני סיום הפגישה</h2><button onClick={() => setFinishOpen(false)}>×</button></div><dl><div><dt>סעיפים מאושרים</dt><dd>{approved}</dd></div><div><dt>סעיפים חסרים</dt><dd>{incomplete}</dd></div><div><dt>מקורות שנשמרו</dt><dd>{sources.length}</dd></div><div><dt>מצב תמחור</dt><dd>{estimate?.status ?? "לא הוגדר"}</dd></div></dl><p><strong>שאלות פתוחות:</strong> {openQuestions || "לא תועדו"}</p>{incomplete ? <p className="form-error">עדיין חסר מידע בחלק מסעיפי האפיון.</p> : null}<div className="action-row"><button onClick={() => setFinishOpen(false)}>חזרה לפגישה</button>{onSaveExit ? <button onClick={onSaveExit}>שמור וצא בלי לסיים</button> : null}<button className="primary-button" disabled={busy} onClick={() => void confirmFinish()}>אשר וסיים פגישה</button></div></section></div> : null}
  </div>;
}

function SectionEditor({ section, onSaved }: { section: SpecificationSection; onSaved: () => Promise<void> }) {
  const [content, setContent] = useState(section.content); const [open, setOpen] = useState(section.status !== "approved" && Boolean(section.content));
  useEffect(() => setContent(section.content), [section.content]);
  function changeApproved(action: () => void) { if (section.status !== "approved" || window.confirm("הסעיף כבר אושר. להמשיך ולשנות אותו במפורש?")) action(); }
  return <article className="spec-section"><button className="spec-title" onClick={() => setOpen(!open)}><span>{section.title}</span><small>{section.status === "approved" ? "אושר" : section.status === "incomplete" ? "חסר" : section.status === "edited" ? "נערך" : "טיוטת AI"}</small></button>{open && <><textarea rows={4} value={content} onChange={(e) => setContent(e.target.value)} /><div className="action-row compact"><button onClick={() => changeApproved(() => void saveSection(section.id, content, "edited").then(onSaved))}>שמור</button><button onClick={() => changeApproved(() => void saveSection(section.id, content, "approved").then(onSaved))}>אשר</button><button onClick={() => changeApproved(() => void saveSection(section.id, content, "incomplete").then(onSaved))}>סמן כחסר</button></div></>}</article>;
}
