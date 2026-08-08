import { useEffect, useState } from "react";
import { ProjectChat } from "../ProjectChat";
import { fetchProjectEstimation } from "../../services/estimationApi";
import { addTranscript, finishMeeting, loadMeetingWorkspace, saveSection, startMeeting, uploadMeetingSource, type Meeting, type MeetingHourBank, type MeetingSource, type MeetingTimeCharge, type SpecificationSection } from "../../services/meetingWorkflowApi";
import type { ProjectEstimate } from "../../types/estimation";
import { ProjectDocumentsPanel } from "../project/ProjectDocumentsPanel";
import { PrototypeStudio } from "../prototype/PrototypeStudio";
import { createProjectContinuationLink } from "../../services/registrationApi";
import { copyToClipboard } from "../../services/accessApi";

type Props = {
  projectId: string; projectName: string; clientName?: string; companyName?: string;
  onSaveExit?: () => void; onFinished?: () => void; onOpenAdvanced?: () => void;
};

const money = (value: number | null | undefined, currency: string) => value == null ? "—" : new Intl.NumberFormat("he-IL", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
const formatDuration = (milliseconds: number) => {
  const totalMinutes = Math.max(0, Math.floor(milliseconds / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours ? `${hours} שעות ו-${minutes} דקות` : `${minutes} דקות`;
};

export function MeetingWorkspace({ projectId, projectName, clientName, companyName, onSaveExit, onFinished }: Props) {
  const [meeting, setMeeting] = useState<Meeting>();
  const [sections, setSections] = useState<SpecificationSection[]>([]);
  const [sources, setSources] = useState<MeetingSource[]>([]);
  const [hourBanks, setHourBanks] = useState<MeetingHourBank[]>([]);
  const [meetingCharge, setMeetingCharge] = useState<MeetingTimeCharge | null>(null);
  const [estimate, setEstimate] = useState<ProjectEstimate>();
  const [transcript, setTranscript] = useState("");
  const [uploads, setUploads] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<Date>();
  const [finishOpen, setFinishOpen] = useState(false);
  const [billableHours, setBillableHours] = useState(0);
  const [selectedBankId, setSelectedBankId] = useState("");
  const [now, setNow] = useState(Date.now());
  const [manualOpen, setManualOpen] = useState(false);
  const [documentsOpen, setDocumentsOpen] = useState(false);
  const [error, setError] = useState("");
  const [clientLink, setClientLink] = useState<string | null>(null);
  const [linkState, setLinkState] = useState<"idle" | "loading" | "copied" | "error">("idle");
  const [linkEmail, setLinkEmail] = useState("");
  const [needsEmail, setNeedsEmail] = useState(false);

  async function shareClientLink(email?: string) {
    setLinkState("loading");
    try {
      const result = await createProjectContinuationLink({ projectId, email: email?.trim() || undefined });
      setNeedsEmail(false);
      setClientLink(result.link);
      await copyToClipboard(result.link);
      setLinkState("copied");
    } catch (cause) {
      if (cause instanceof Error && cause.message === "missing_client_email") {
        setNeedsEmail(true);
        setLinkState("idle");
        return;
      }
      setLinkState("error");
    }
  }

  async function refresh() {
    const [workspace, estimation] = await Promise.all([loadMeetingWorkspace(projectId), fetchProjectEstimation(projectId)]);
    setMeeting(workspace.meeting); setMeetingCharge(workspace.meetingCharge); setSections(workspace.sections); setSources(workspace.sources); setHourBanks(workspace.hourBanks);
    const current = estimation.estimates[0]; setEstimate(current);
  }
  useEffect(() => { void refresh().catch((e) => setError(e.message)); }, [projectId]);
  useEffect(() => {
    if (meeting?.status !== "active") return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [meeting?.status]);

  async function begin() { setBusy(true); try { await startMeeting(projectId); await refresh(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  async function saveTranscript() {
    if (!meeting || !transcript.trim()) return;
    setBusy(true); setError("");
    try { await addTranscript(meeting, transcript.trim()); setTranscript(""); await refresh(); setSavedAt(new Date()); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
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
  function openFinish() {
    if (!meeting) return;
    const elapsedMinutes = Math.max(0, (Date.now() - new Date(meeting.started_at).getTime()) / 60000);
    setBillableHours(Math.ceil(elapsedMinutes / 15) * 0.25);
    setSelectedBankId(hourBanks.find((bank) => bank.project_id === projectId)?.id ?? hourBanks[0]?.id ?? "");
    setFinishOpen(true);
  }
  async function confirmFinish() {
    if (!meeting) return; setBusy(true);
    try { await finishMeeting(meeting.id, billableHours, selectedBankId || undefined); await refresh(); setFinishOpen(false); onFinished?.(); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  if (!meeting) return <section className="card" dir="rtl"><h2>חדר אפיון</h2><p>פתח פגישה ממוקדת לפרויקט הזה.</p><button className="primary-button" disabled={busy} onClick={() => void begin()}>פתח פגישת לקוח</button>{error && <p className="form-error">{error}</p>}</section>;
  const approved = sections.filter((section) => section.status === "approved").length;
  const incomplete = sections.filter((section) => section.status === "incomplete").length;
  const openQuestions = sections.find((section) => section.section_key === "open_questions")?.content.trim() ?? "";
  const meetingEnd = meeting.ended_at ? new Date(meeting.ended_at).getTime() : now;
  const elapsed = Math.max(0, meetingEnd - new Date(meeting.started_at).getTime());
  const selectedBank = hourBanks.find((bank) => bank.id === selectedBankId);

  return <div className="meeting-workspace" dir="rtl">
    <header className="card meeting-head"><div><p className="eyebrow">{companyName || "פגישת לקוח"}</p><h2>חדר אפיון — {projectName}</h2><p>{clientName ? `איש קשר: ${clientName} · ` : ""}מצב: {meeting.status === "active" ? "פגישה פעילה" : "הפגישה הסתיימה"}</p><div className="meeting-time-strip"><span><small>התחלה</small><strong>{new Date(meeting.started_at).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}</strong></span><span><small>{meeting.ended_at ? "סיום" : "זמן חי"}</small><strong>{meeting.ended_at ? new Date(meeting.ended_at).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }) : "● פעיל"}</strong></span><span><small>משך הפגישה</small><strong>{formatDuration(elapsed)}</strong></span>{meetingCharge ? <span><small>שעות אפיון</small><strong>{meetingCharge.billable_hours}</strong></span> : null}</div><small>{savedAt ? `נשמר לאחרונה ${savedAt.toLocaleTimeString("he-IL")}` : "המידע נשמר ב-Supabase"}</small></div><div className="action-row"><button onClick={() => void refresh().then(() => setSavedAt(new Date()))}>שמור</button><button onClick={() => setDocumentsOpen((value) => !value)}>מסמכי הפרויקט</button><button onClick={() => void shareClientLink()} disabled={linkState === "loading"}>{linkState === "loading" ? "מכין לינק…" : linkState === "copied" ? "הלינק הועתק" : "לינק ללקוח להמשך אפיון"}</button>{onSaveExit ? <button onClick={onSaveExit}>שמור וצא</button> : null}{meeting.status === "active" ? <button className="primary-button" onClick={openFinish}>סיים פגישה</button> : null}</div>{linkState === "error" ? <p className="form-error">לא הצלחנו להפיק לינק הרשמה ללקוח. ודא שההרשמה הציבורית ללקוחות פעילה.</p> : null}{clientLink ? <div className="meeting-client-link"><small>הלקוח נרשם עם המייל שלו וסיסמה, וממשיך את האפיון לבד:</small><input readOnly dir="ltr" value={clientLink} onFocus={(event) => event.currentTarget.select()} /><div className="action-row"><button onClick={() => void copyToClipboard(clientLink).then(() => setLinkState("copied"))}>העתק לינק</button><a className="button-link" href={clientLink} target="_blank" rel="noreferrer">פתח</a><a className="button-link" href={`https://wa.me/?text=${encodeURIComponent(`היי, זה הלינק להמשך האפיון של הפרויקט: ${clientLink}`)}`} target="_blank" rel="noreferrer">שלח ב‑WhatsApp</a></div></div> : null}</header>
    {error && <p className="form-error">{error}</p>}
    {documentsOpen ? <ProjectDocumentsPanel projectId={projectId} simple /> : null}
    <div className="guided-meeting-layout">
      <main className="meeting-chat-primary"><ProjectChat projectId={projectId} projectName={projectName} agent="project_guide" title="בואו נאפיין את הפרויקט יחד" subtitle="ספרו לי בחופשיות מה צריך. אשאל, אציע רעיונות ואציג תרשימים וסקיצות תוך כדי השיחה." suggestions={["בוא נתחיל", "הצג את התהליך שהבנת", "צור סקיצה למסכים"]} /></main>
      <aside className="guided-summary card"><h3>מצב הפרויקט בלייב</h3><dl><div><dt>מאושר</dt><dd>{approved}</dd></div><div><dt>עוד לבדיקה</dt><dd>{incomplete}</dd></div><div><dt>חומרים</dt><dd>{sources.length}</dd></div></dl><section className="client-safe-estimate"><h4>אומדן משותף</h4>{estimate?.client_visible ? <><p><strong>{estimate.estimated_hours_min}–{estimate.estimated_hours_max}</strong> שעות</p><p><strong>{money(estimate.estimated_budget_min, estimate.currency)}–{money(estimate.estimated_budget_max, estimate.currency)}</strong></p>{estimate.final_fixed_price && estimate.approved_by_yaniv ? <p>מחיר קבוע מאושר: <strong>{money(estimate.final_fixed_price, estimate.currency)}</strong></p> : <small>טווח הערכה בלבד, עד לאישור מחיר קבוע.</small>}</> : <p className="form-note">האומדן יוצג כאן רק לאחר אישור לשיתוף עם הלקוח.</p>}</section><button onClick={() => setManualOpen((value) => !value)}>{manualOpen ? "הסתר חומרים" : "קבצים וחומרי הפגישה"}</button></aside>
    </div>
    <PrototypeStudio projectId={projectId} projectName={projectName} simple />
    {manualOpen ? <section className="meeting-advanced-tools">
      <div className="meeting-grid"><main><section className="card"><h3>תמלול וקבצים</h3><textarea rows={4} value={transcript} onChange={(e) => setTranscript(e.target.value)} placeholder="הדבק תמלול כללי נוסף…"/><button disabled={busy || !transcript.trim()} onClick={() => void saveTranscript()}>שמור את הטקסט כתמלול כללי</button><label className="button-like">העלה תמונות / PDF / Word<input hidden multiple type="file" accept="image/*,.pdf,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" capture="environment" onChange={(e) => void uploadFiles(e.target.files)} /></label>{Object.entries(uploads).map(([name, status]) => <p key={name}><strong>{name}</strong> — {status}</p>)}<div className="meeting-source-list">{sources.map((source) => <article key={source.id}><strong>{source.title}</strong><span>{source.source_type} · {new Date(source.captured_at).toLocaleString("he-IL")}</span><small>{source.review_status || "נשמר"}</small></article>)}</div></section></main><aside>
        <section className="card specification-live"><h3>עריכה ידנית מתקדמת</h3>{sections.map((section) => <SectionEditor key={section.id} section={section} onSaved={async () => { await refresh(); setSavedAt(new Date()); }} />)}</section>
      </aside></div>
    </section> : null}
    {finishOpen ? <div className="modal-backdrop"><section className="modal-card meeting-finish" role="dialog" aria-modal="true"><div className="modal-head"><h2>סיכום וחיוב זמן האפיון</h2><button onClick={() => setFinishOpen(false)}>×</button></div><dl><div><dt>התחלה</dt><dd>{new Date(meeting.started_at).toLocaleString("he-IL")}</dd></div><div><dt>משך בפועל</dt><dd>{formatDuration(elapsed)}</dd></div><div><dt>סעיפים מאושרים</dt><dd>{approved}</dd></div><div><dt>סעיפים חסרים</dt><dd>{incomplete}</dd></div></dl><div className="form-grid"><label>שעות אפיון לחיוב<input type="number" min="0" step="0.25" value={billableHours} onChange={(event) => setBillableHours(Number(event.target.value))} /></label><label>בנק שעות<select value={selectedBankId} onChange={(event) => setSelectedBankId(event.target.value)}><option value="">לסיים ללא הורדה מבנק</option>{hourBanks.map((bank) => <option key={bank.id} value={bank.id}>{bank.project_id ? "בנק הפרויקט" : "בנק הלקוח"} — נותרו {bank.hours_remaining} שעות</option>)}</select></label></div>{selectedBank && billableHours > selectedBank.hours_remaining ? <p className="form-error">אין מספיק שעות בבנק שנבחר.</p> : null}{!selectedBankId && billableHours > 0 ? <p className="form-note">הפגישה תירשם עם שעות לחיוב, אך לא תופחת מבנק עד להסדרה.</p> : null}<p><strong>שאלות פתוחות:</strong> {openQuestions || "לא תועדו"}</p>{incomplete ? <p className="form-error">עדיין חסר מידע בחלק מסעיפי האפיון.</p> : null}<div className="action-row"><button onClick={() => setFinishOpen(false)}>חזרה לפגישה</button>{onSaveExit ? <button onClick={onSaveExit}>שמור וצא בלי לסיים</button> : null}<button className="primary-button" disabled={busy || billableHours < 0 || Boolean(selectedBank && billableHours > selectedBank.hours_remaining)} onClick={() => void confirmFinish()}>אשר, רשום שעות וסיים</button></div></section></div> : null}
  </div>;
}

function SectionEditor({ section, onSaved }: { section: SpecificationSection; onSaved: () => Promise<void> }) {
  const [content, setContent] = useState(section.content); const [open, setOpen] = useState(section.status !== "approved" && Boolean(section.content));
  useEffect(() => setContent(section.content), [section.content]);
  function changeApproved(action: () => void) { if (section.status !== "approved" || window.confirm("הסעיף כבר אושר. להמשיך ולשנות אותו במפורש?")) action(); }
  return <article className="spec-section"><button className="spec-title" onClick={() => setOpen(!open)}><span>{section.title}</span><small>{section.status === "approved" ? "אושר" : section.status === "incomplete" ? "חסר" : section.status === "edited" ? "נערך" : "טיוטת AI"}</small></button>{open && <><textarea rows={4} value={content} onChange={(e) => setContent(e.target.value)} /><div className="action-row compact"><button onClick={() => changeApproved(() => void saveSection(section.id, content, "edited").then(onSaved))}>שמור</button><button onClick={() => changeApproved(() => void saveSection(section.id, content, "approved").then(onSaved))}>אשר</button><button onClick={() => changeApproved(() => void saveSection(section.id, content, "incomplete").then(onSaved))}>סמן כחסר</button></div></>}</article>;
}
