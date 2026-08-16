import { useMemo, useState } from "react";
import { PaymentGateDialog } from "../ui/PaymentGateDialog";
import { useAppData, type NewClientInput, type NewProjectInput } from "../../context/AppDataContext";
import { startMeeting } from "../../services/meetingWorkflowApi";
import type { PaymentDecision } from "../../types/domain";

type Props = { onClose: () => void; onStarted: (projectId: string) => void };
type Step = "client-kind" | "client" | "project";

const emptyClient: NewClientInput = { name: "", company: "", email: "", phone: "", notes: "", status: "lead" };
const emptyProject: NewProjectInput = { name: "", summary: "", budgetSignal: "" };
const normalizePhone = (value?: string) => (value ?? "").replace(/\D/g, "");

export function SimpleMeetingWizard({ onClose, onStarted }: Props) {
  const { clients, projects, createClient, createProject } = useAppData();
  const [step, setStep] = useState<Step>("client-kind");
  const [newClient, setNewClient] = useState<NewClientInput>(emptyClient);
  const [newProject, setNewProject] = useState<NewProjectInput>(emptyProject);
  const [clientId, setClientId] = useState("");
  const [query, setQuery] = useState("");
  const [creatingClient, setCreatingClient] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [confirmCreate, setConfirmCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const matches = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("he");
    if (!needle) return clients;
    return clients.filter((client) => [client.name, client.company, client.email, client.phone]
      .some((value) => value?.toLocaleLowerCase("he").includes(needle)));
  }, [clients, query]);
  const duplicate = useMemo(() => clients.find((client) =>
    (newClient.email.trim() && client.email.toLowerCase() === newClient.email.trim().toLowerCase())
    || (normalizePhone(newClient.phone).length >= 7 && normalizePhone(client.phone) === normalizePhone(newClient.phone))), [clients, newClient]);
  const clientProjects = projects.filter((project) => project.clientId === clientId);

  async function createTheClient() {
    if (!newClient.name.trim() || !newClient.company.trim() || !newClient.email.trim()) {
      setError("יש למלא שם איש קשר, שם עסק ואימייל."); return;
    }
    if (duplicate) { setError("נמצא לקוח דומה. בחר אותו או שנה את הפרטים לפני יצירת לקוח חדש."); return; }
    setBusy(true); setError("");
    try { const client = await createClient(newClient); setClientId(client.id); setStep("project"); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function createTheProject(paymentDecision: PaymentDecision) {
    if (!clientId || !newProject.name.trim()) { setError("יש להזין שם פרויקט."); return; }
    setBusy(true); setError("");
    try { const project = await createProject(clientId, newProject, paymentDecision); setConfirmCreate(false); await openMeeting(project.id); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function openMeeting(projectId: string) {
    setBusy(true); setError("");
    try { await startMeeting(projectId); onStarted(projectId); }
    catch (e) { setError((e as Error).message); setBusy(false); }
  }

  return <div className="simple-drawer-backdrop" dir="rtl" role="dialog" aria-modal="true">
    <section className="simple-drawer meeting-wizard">
      <header><div><strong>פתיחת פגישת אפיון</strong><small>לקוח ← פרויקט ← חדר פגישה</small></div><button onClick={onClose} aria-label="סגירה">×</button></header>
      <div className="simple-drawer-body">
        {step === "client-kind" ? <>
          <h2>עם מי נפגשים?</h2>
          <button className="meeting-choice" onClick={() => { setCreatingClient(false); setStep("client"); }}>לקוח קיים<small>חיפוש ובחירה מרשימת הלקוחות</small></button>
          <button className="meeting-choice" onClick={() => { setCreatingClient(true); setStep("client"); }}>לקוח חדש<small>יצירת לקוח והמשך לפרויקט</small></button>
        </> : null}
        {step === "client" && !creatingClient ? <>
          <button className="link-button" onClick={() => setStep("client-kind")}>→ חזרה</button>
          <label>חיפוש לפי שם, עסק, טלפון או אימייל<input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} /></label>
          <div className="meeting-choice-list">{matches.map((client) => <button key={client.id} className="meeting-choice" onClick={() => { setClientId(client.id); setStep("project"); }}><strong>{client.name}</strong><span>{client.company}</span><small>{client.phone || client.email}</small></button>)}</div>
          {!matches.length ? <p className="simple-note">לא נמצאו לקוחות.</p> : null}
        </> : null}
        {step === "client" && creatingClient ? <>
          <button className="link-button" onClick={() => setStep("client-kind")}>→ חזרה</button>
          <label>שם איש קשר<input value={newClient.name} onChange={(e) => setNewClient({ ...newClient, name: e.target.value })} /></label>
          <label>שם העסק<input value={newClient.company} onChange={(e) => setNewClient({ ...newClient, company: e.target.value })} /></label>
          <label>טלפון<input inputMode="tel" value={newClient.phone} onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })} /></label>
          <label>אימייל<input type="email" value={newClient.email} onChange={(e) => setNewClient({ ...newClient, email: e.target.value })} /></label>
          {duplicate ? <div className="duplicate-warning"><strong>נמצא לקוח דומה: {duplicate.name} / {duplicate.company}</strong><button onClick={() => { setClientId(duplicate.id); setStep("project"); }}>בחר לקוח קיים</button></div> : null}
          <button className="primary-button" disabled={busy || Boolean(duplicate)} onClick={() => void createTheClient()}>{busy ? "שומר…" : "צור לקוח והמשך"}</button>
        </> : null}
        {step === "project" ? <>
          <button className="link-button" onClick={() => setStep("client")}>→ חזרה ללקוח</button>
          <h2>בחר פרויקט</h2>
          {clientProjects.map((project) => <button key={project.id} className="meeting-choice" disabled={busy} onClick={() => void openMeeting(project.id)}><strong>{project.name}</strong><small>{project.summary || "ללא תיאור"}</small></button>)}
          <button className="meeting-choice" onClick={() => setCreatingProject(!creatingProject)}><strong>פרויקט חדש</strong><small>צור פרויקט ללקוח שנבחר</small></button>
          {creatingProject ? <div className="meeting-new-project">
            <label>שם הפרויקט<input value={newProject.name} onChange={(e) => setNewProject({ ...newProject, name: e.target.value })} /></label>
            <label>תיאור ראשוני<textarea rows={3} value={newProject.summary} onChange={(e) => setNewProject({ ...newProject, summary: e.target.value })} /></label>
            <label>איתות תקציב<input value={newProject.budgetSignal} onChange={(e) => setNewProject({ ...newProject, budgetSignal: e.target.value })} placeholder="לדוגמה: 20–30 אלף ₪" /></label>
            <button className="primary-button" disabled={busy} onClick={() => {
              if (!newProject.name.trim()) { setError("יש להזין שם פרויקט."); return; }
              setError(""); setConfirmCreate(true);
            }}>{busy ? "פותח פגישה…" : "צור פרויקט ופתח פגישה"}</button>
          </div> : null}
        </> : null}
        {error ? <p className="form-error">{error}</p> : null}
      </div>
    </section>
    <PaymentGateDialog
      open={confirmCreate}
      projectName={newProject.name.trim() || "הפרויקט החדש"}
      busy={busy}
      onChoose={(decision) => void createTheProject(decision)}
      onCancel={() => setConfirmCreate(false)}
    />
  </div>;
}
