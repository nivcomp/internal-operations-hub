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
const guidedQuestions: Record<string, string> = {
  project_title: "איך הייתם קוראים לפרויקט במילים שלכם?",
  executive_summary: "אם נסכם במשפט אחד — מה המערכת צריכה להשיג?",
  business_goal: "מה המטרה העסקית החשובה ביותר של הפרויקט?",
  current_process: "איך אתם מבצעים את התהליך הזה היום?",
  desired_process: "איך הייתם רוצים שהתהליך יעבוד לאחר השינוי?",
  users_roles: "מי ישתמש במערכת ומה כל משתמש צריך לעשות?",
  functional_requirements: "אילו פעולות המערכת חייבת לאפשר?",
  nonfunctional_requirements: "יש דרישות מיוחדות למהירות, אבטחה, נגישות או זמינות?",
  integrations: "לאילו מערכות או שירותים צריך להתחבר?",
  data_inputs: "איזה מידע נכנס למערכת ומאיפה הוא מגיע?",
  data_outputs: "אילו תוצאות, דוחות או הודעות המערכת צריכה להפיק?",
  permissions: "מי רשאי לראות, לערוך ולאשר כל סוג מידע?",
  workflow: "מהם השלבים המרכזיים מתחילת התהליך ועד סופו?",
  assumptions: "על אילו הנחות אנחנו מסתמכים כרגע?",
  exclusions: "מה במפורש אינו חלק מהפרויקט?",
  risks: "מה עלול לעכב או לסכן את הפרויקט?",
  dependencies: "במי או במה הפרויקט תלוי כדי להתקדם?",
  open_questions: "אילו שאלות עדיין נשארו פתוחות?",
  acceptance_criteria: "איך נדע שהתוצאה מוכנה ועונה על הצורך?",
};
const questionFor = (section: SpecificationSection) => guidedQuestions[section.section_key] ?? `ספרו לי מה חשוב לדעת בנושא: ${section.title}`;

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
  const [manualOpen, setManualOpen] = useState(false);
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
  async function saveGuidedAnswer(section: SpecificationSection, status: "edited" | "approved") {
    if (!transcript.trim()) return;
    setBusy(true); setError("");
    try {
      await saveSection(section.id, transcript.trim(), status);
      if (meeting) await addTranscript(meeting, `${section.title}: ${transcript.trim()}`, "client");
      setTranscript(""); await refresh(); setSavedAt(new Date());
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
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
  const currentSection = sections.find((section) => section.status === "incomplete")
    ?? sections.find((section) => section.status === "ai_draft");

  return <div className="meeting-workspace" dir="rtl">
    <header className="card meeting-head"><div><p className="eyebrow">{companyName || "פגישת לקוח"}</p><h2>חדר אפיון — {projectName}</h2><p>{clientName ? `איש קשר: ${clientName} · ` : ""}מצב: {meeting.status === "active" ? "פגישה פעילה" : "הפגישה הסתיימה"} · התחלה: {new Date(meeting.started_at).toLocaleString("he-IL")}</p><small>{savedAt ? `נשמר לאחרונה ${savedAt.toLocaleTimeString("he-IL")}` : "המידע נשמר ב-Supabase"}</small></div><div className="action-row"><button onClick={() => void refresh().then(() => setSavedAt(new Date()))}>שמור</button>{onSaveExit ? <button onClick={onSaveExit}>שמור וצא</button> : null}{onOpenAdvanced ? <button onClick={onOpenAdvanced}>פתח כלים מתקדמים</button> : null}{meeting.status === "active" ? <button className="primary-button" onClick={() => setFinishOpen(true)}>סיים פגישה</button> : null}</div></header>
    {error && <p className="form-error">{error}</p>}
    <div className="guided-meeting-layout">
      <main className="card guided-spec-chat">
        <div className="guided-progress"><div><strong>{approved + sections.filter((section) => section.status === "edited").length} מתוך {sections.length} נושאים תועדו</strong><span>{incomplete} עדיין חסרים</span></div><progress max={Math.max(1, sections.length)} value={sections.length - incomplete} /></div>
        {currentSection ? <>
          <div className="guided-bot-message"><span className="guided-avatar">AI</span><div><small>שאלת האפיון הבאה</small><h2>{questionFor(currentSection)}</h2><p>אפשר לענות בחופשיות. אני אשמור את התשובה בסעיף „{currentSection.title}” רק לאחר אישורך.</p></div></div>
          <label className="guided-answer"><span>התשובה שלך</span><textarea autoFocus rows={6} value={transcript} onChange={(e) => setTranscript(e.target.value)} placeholder="כתוב כאן או לחץ על המיקרופון ודבר…" /></label>
          <div className="guided-controls"><div className="action-row">{!recording ? <button disabled={transcribing} onClick={() => void startVoice()}>🎙️ דבר במקום להקליד</button> : <button className="danger-button" onClick={() => void stopVoice()}>■ עצור ותמלל</button>}{recording ? <strong className="recording-indicator">מקשיב…</strong> : null}{transcribing ? <span>מתמלל את התשובה…</span> : null}</div><div className="action-row"><button disabled={busy || !transcript.trim()} onClick={() => void saveGuidedAnswer(currentSection, "edited")}>שמור כטיוטה והמשך</button><button className="primary-button" disabled={busy || !transcript.trim()} onClick={() => void saveGuidedAnswer(currentSection, "approved")}>אשר תשובה והמשך</button></div></div>
          <p className="form-note">הקול הגולמי אינו נשמר. ניתן לערוך את התמלול לפני האישור.</p>
        </> : <div className="guided-complete"><span>✓</span><h2>עברנו על כל שאלות האפיון</h2><p>אפשר לסכם עם עוזר ה־AI, לצרף קבצים או לסיים את הפגישה.</p></div>}
      </main>
      <aside className="guided-summary card"><h3>מצב הפגישה</h3><dl><div><dt>מאושר</dt><dd>{approved}</dd></div><div><dt>חסר</dt><dd>{incomplete}</dd></div><div><dt>מקורות</dt><dd>{sources.length}</dd></div><div><dt>תמחור</dt><dd>{estimate?.status ?? "לא הוגדר"}</dd></div></dl><button onClick={() => setManualOpen((value) => !value)}>{manualOpen ? "הסתר כלים נוספים" : "קבצים, AI ועריכה מתקדמת"}</button></aside>
    </div>
    {manualOpen ? <section className="meeting-advanced-tools">
      <ProjectChat projectId={projectId} projectName={projectName} agent="agency_control" title="שיחה חופשית עם עוזר ה־AI" subtitle="אפשר לבקש סיכום, לזהות מידע חסר או לנסח שאלת המשך. שינויים נשמרים רק לאחר אישורך." showVisibility suggestions={["סכם את מה שנאמר", "מה חסר לנו?", "שאל על המשתמשים", "מה הסיכונים?", "הצע את השאלה הבאה"]} />
      <div className="meeting-grid"><main><section className="card"><h3>תמלול וקבצים</h3><button disabled={busy || !transcript.trim()} onClick={() => void saveTranscript()}>שמור את הטקסט כתמלול כללי</button><label className="button-like">העלה תמונות / PDF / Word<input hidden multiple type="file" accept="image/*,.pdf,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" capture="environment" onChange={(e) => void uploadFiles(e.target.files)} /></label>{Object.entries(uploads).map(([name, status]) => <p key={name}><strong>{name}</strong> — {status}</p>)}<div className="meeting-source-list">{sources.map((source) => <article key={source.id}><strong>{source.title}</strong><span>{source.source_type} · {new Date(source.captured_at).toLocaleString("he-IL")}</span><small>{source.review_status || "נשמר"}</small></article>)}</div></section></main><aside>
        <section className="card"><h3>תמחור פנימי</h3><label>מחיר חישוב לשעה<input type="number" min="0" value={rate || ""} onChange={(e) => setRate(Number(e.target.value))} /></label><label>מטבע<select value={currency} onChange={(e) => setCurrency(e.target.value)}><option>ILS</option><option>GBP</option><option>USD</option><option>EUR</option></select></label><dl className="meeting-pricing-summary"><div><dt>טווח תקציב</dt><dd>{money(estimate?.estimated_budget_min, currency)} – {money(estimate?.estimated_budget_max, currency)}</dd></div><div><dt>עלות פנימית</dt><dd>{money(estimate?.internal_cost, currency)}</dd></div><div><dt>מחיר קבוע</dt><dd>{money(estimate?.final_fixed_price, currency)}</dd></div><div><dt>סטטוס</dt><dd>{estimate?.status ?? "טרם נוצר אומדן"}</dd></div></dl><button className="primary-button" disabled={busy || rate <= 0} onClick={() => void saveRate()}>אשר ושמור תמחור</button>{onOpenAdvanced ? <button onClick={onOpenAdvanced}>פתח בקרת תמחור מלאה</button> : null}</section>
        <section className="card specification-live"><h3>עריכה ידנית מתקדמת</h3>{sections.map((section) => <SectionEditor key={section.id} section={section} onSaved={async () => { await refresh(); setSavedAt(new Date()); }} />)}</section>
      </aside></div>
    </section> : null}
    {finishOpen ? <div className="modal-backdrop"><section className="modal-card meeting-finish" role="dialog" aria-modal="true"><div className="modal-head"><h2>סיכום לפני סיום הפגישה</h2><button onClick={() => setFinishOpen(false)}>×</button></div><dl><div><dt>סעיפים מאושרים</dt><dd>{approved}</dd></div><div><dt>סעיפים חסרים</dt><dd>{incomplete}</dd></div><div><dt>מקורות שנשמרו</dt><dd>{sources.length}</dd></div><div><dt>מצב תמחור</dt><dd>{estimate?.status ?? "לא הוגדר"}</dd></div></dl><p><strong>שאלות פתוחות:</strong> {openQuestions || "לא תועדו"}</p>{incomplete ? <p className="form-error">עדיין חסר מידע בחלק מסעיפי האפיון.</p> : null}<div className="action-row"><button onClick={() => setFinishOpen(false)}>חזרה לפגישה</button>{onSaveExit ? <button onClick={onSaveExit}>שמור וצא בלי לסיים</button> : null}<button className="primary-button" disabled={busy} onClick={() => void confirmFinish()}>אשר וסיים פגישה</button></div></section></div> : null}
  </div>;
}

function SectionEditor({ section, onSaved }: { section: SpecificationSection; onSaved: () => Promise<void> }) {
  const [content, setContent] = useState(section.content); const [open, setOpen] = useState(section.status !== "approved" && Boolean(section.content));
  useEffect(() => setContent(section.content), [section.content]);
  function changeApproved(action: () => void) { if (section.status !== "approved" || window.confirm("הסעיף כבר אושר. להמשיך ולשנות אותו במפורש?")) action(); }
  return <article className="spec-section"><button className="spec-title" onClick={() => setOpen(!open)}><span>{section.title}</span><small>{section.status === "approved" ? "אושר" : section.status === "incomplete" ? "חסר" : section.status === "edited" ? "נערך" : "טיוטת AI"}</small></button>{open && <><textarea rows={4} value={content} onChange={(e) => setContent(e.target.value)} /><div className="action-row compact"><button onClick={() => changeApproved(() => void saveSection(section.id, content, "edited").then(onSaved))}>שמור</button><button onClick={() => changeApproved(() => void saveSection(section.id, content, "approved").then(onSaved))}>אשר</button><button onClick={() => changeApproved(() => void saveSection(section.id, content, "incomplete").then(onSaved))}>סמן כחסר</button></div></>}</article>;
}
