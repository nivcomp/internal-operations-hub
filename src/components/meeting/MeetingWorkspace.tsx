import { useEffect, useState } from "react";
import { ProjectChat } from "../ProjectChat";
import { fetchProjectEstimation, createEstimate, updateEstimate } from "../../services/estimationApi";
import { addTranscript, finishMeeting, loadMeetingWorkspace, saveSection, startMeeting, uploadMeetingSource, type Meeting, type SpecificationSection } from "../../services/meetingWorkflowApi";
import { useAppData } from "../../context/AppDataContext";

export function MeetingWorkspace({ projectId, projectName }: { projectId: string; projectName: string }) {
  const { refreshCommercials } = useAppData();
  const [meeting, setMeeting] = useState<Meeting>();
  const [sections, setSections] = useState<SpecificationSection[]>([]);
  const [rate, setRate] = useState(0);
  const [currency, setCurrency] = useState("ILS");
  const [transcript, setTranscript] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    const [workspace, estimation] = await Promise.all([loadMeetingWorkspace(projectId), fetchProjectEstimation(projectId)]);
    setMeeting(workspace.meeting); setSections(workspace.sections);
    const estimate = estimation.estimates[0]; if (estimate) { setRate(estimate.client_calculation_rate); setCurrency(estimate.currency); }
  }
  useEffect(() => { void refresh().catch((e) => setError(e.message)); }, [projectId]);
  async function begin() { setBusy(true); try { await startMeeting(projectId); await refresh(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  async function saveRate() {
    setBusy(true); try {
      const bundle = await fetchProjectEstimation(projectId); const estimate = bundle.estimates[0];
      if (estimate) await updateEstimate(estimate.id, { client_calculation_rate: rate, currency });
      else await createEstimate(projectId, { client_calculation_rate: rate, currency, status: "draft" }, 1);
      await refreshCommercials();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  if (!meeting) return <section className="card" dir="rtl"><h2>חדר אפיון</h2><p>פתח פגישה ממוקדת לפרויקט הזה.</p><button className="primary-button" disabled={busy} onClick={() => void begin()}>פגישת לקוח חדשה</button>{error && <p className="form-error">{error}</p>}</section>;
  return <div className="meeting-workspace" dir="rtl">
    <header className="card meeting-head"><div><h2>חדר אפיון — {projectName}</h2><p>מצב: {meeting.status === "active" ? "פגישה פעילה" : "הפגישה הסתיימה"}</p></div><div className="action-row"><button onClick={() => void refresh()}>שמירה</button>{meeting.status === "active" && <button onClick={() => void finishMeeting(meeting.id).then(refresh)}>סיום פגישה</button>}</div></header>
    {error && <p className="form-error">{error}</p>}
    <div className="meeting-grid">
      <main>
        <ProjectChat projectId={projectId} projectName={projectName} agent="agency_control" title="שיחת אפיון חיה" subtitle="העוזר שואל שאלה שימושית אחת בכל פעם. כל שינוי מסחרי מחייב אישור שלך." showVisibility suggestions={["סכם את מה שנאמר", "מה חסר לנו?", "שאל על המשתמשים", "מה הסיכונים?", "הצג את התהליך"]} />
        <section className="card"><h3>תמלול וקבצים</h3><textarea rows={4} value={transcript} onChange={(e) => setTranscript(e.target.value)} placeholder="הדבק או ערוך תמלול בעברית או באנגלית"/><div className="action-row"><button disabled={!transcript.trim()} onClick={() => void addTranscript(meeting, transcript).then(() => setTranscript(""))}>שמור תמלול</button><label className="button-like">העלה צילום / PDF / Word<input hidden type="file" accept="image/*,.pdf,.docx" capture="environment" onChange={(e) => { const f=e.target.files?.[0]; if (f) void uploadMeetingSource(meeting,f).catch((x)=>setError(x.message)); }}/></label></div><p className="form-note">קול גולמי אינו נשמר. יש לשמור רק את התמלול שנבדק.</p></section>
      </main>
      <aside>
        <section className="card"><h3>תמחור פנימי</h3><label>מחיר חישוב לשעה<input type="number" min="0" value={rate || ""} onChange={(e)=>setRate(Number(e.target.value))}/></label><label>מטבע<select value={currency} onChange={(e)=>setCurrency(e.target.value)}><option>ILS</option><option>GBP</option><option>USD</option><option>EUR</option></select></label><button className="primary-button" disabled={busy || rate <= 0} onClick={() => void saveRate()}>שמור וחישוב מחדש</button><p className="form-note">המחיר מוסתר מהלקוח כברירת מחדל.</p></section>
        <section className="card specification-live"><h3>אפיון חי</h3>{sections.map((section) => <SectionEditor key={section.id} section={section} onSaved={refresh}/>)}</section>
      </aside>
    </div>
  </div>;
}

function SectionEditor({ section, onSaved }: { section: SpecificationSection; onSaved: () => Promise<void> }) {
  const [content,setContent]=useState(section.content); const [open,setOpen]=useState(section.status !== "approved" && Boolean(section.content));
  useEffect(()=>setContent(section.content),[section.content]);
  return <article className="spec-section"><button className="spec-title" onClick={()=>setOpen(!open)}><span>{section.title}</span><small>{section.status === "approved" ? "אושר" : section.status === "incomplete" ? "חסר" : "טיוטה"}</small></button>{open && <><textarea rows={4} value={content} onChange={(e)=>setContent(e.target.value)}/><div className="action-row compact"><button onClick={()=>void saveSection(section.id,content,"edited").then(onSaved)}>שמור</button><button onClick={()=>void saveSection(section.id,content,"approved").then(onSaved)}>אשר</button><button onClick={()=>void saveSection(section.id,content,"incomplete").then(onSaved)}>סמן כחסר</button></div></>}</article>;
}
