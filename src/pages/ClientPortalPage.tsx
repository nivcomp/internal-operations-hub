import { useEffect, useMemo, useState, type FormEvent } from "react";
import { PageHeader } from "../components/PageHeader";
import { ProjectChat } from "../components/ProjectChat";
import { StatusBadge } from "../components/StatusBadge";
import { BudgetSimulator } from "../components/estimation/BudgetSimulator";
import { MutationKeys, useAppData } from "../context/AppDataContext";
import { useAuth } from "../context/AuthContext";
import { ClientWorkspaceIdentity } from "../components/client/ClientWorkspaceIdentity";
import { TargetDateForm } from "../components/project/TargetDateForm";
import { ProposalPanel } from "../components/proposal/ProposalPanel";
import { ProjectDocumentsPanel } from "../components/project/ProjectDocumentsPanel";
import { PrototypeStudio } from "../components/prototype/PrototypeStudio";
import { getPrototypeFreshness, getProjectSolutionKind } from "../services/prototypeApi";
import { deliverable, guessSolutionKind, type SolutionKind } from "../lib/clientWording";
import { canWorkStart, currency, getClientById, statusLabels } from "../lib/domainHelpers";
import type { ChangeRequest, Client, ClientPayment, HourBank, Project } from "../types/domain";

type ClientPortalPageProps = {
  selectedClientId?: string;
  clients: Client[];
  projects: Project[];
  changeRequests: ChangeRequest[];
  clientPayments: ClientPayment[];
  hourBanks: HourBank[];
  /** True when an agency admin is previewing the portal. */
  isPreview: boolean;
  initialProjectId?: string;
};

type PortalLanguage = "he" | "en";

const requestStatusLabels: Record<PortalLanguage, Record<ChangeRequest["status"], string>> = {
  he: { requested: "בטיפול הצוות", submitted: "בטיפול הצוות", agency_review: "בבדיקה", priced: "תומחר — ממתין להחלטתך", client_approved: "אושר", declined: "נדחה" },
  en: { requested: "With the agency", submitted: "With the agency", agency_review: "With the agency", priced: "Priced — your decision", client_approved: "Approved", declined: "Declined" },
};

const projectStatusHe: Record<Project["status"], string> = {
  lead_started: "התחלנו להכיר את הצורך", discovery_in_progress: "מגדירים את הצורך", waiting_for_agency_pricing: "בהכנת הצעה",
  pricing_set: "ההצעה הוכנה", brief_ready: "הסיכום מוכן", scope_ready: "האפיון מוכן", waiting_for_client_approval: "ממתין לאישור שלך",
  approved_by_client: "אושר על ידך", waiting_for_payment: "ממתין לתשלום", paid_ready_to_start: "מוכן להתחלה",
  assigned_to_supplier: "העבודה שובצה", in_development: "בבנייה", change_requested: "בקשת שינוי התקבלה",
  change_priced: "השינוי תומחר", change_approved: "השינוי אושר", completed: "הושלם",
};

const compactStatusLabels: Record<PortalLanguage, Record<string, string>> = {
  he: { pending: "ממתין", approved: "אושר", rejected: "נדחה", not_due: "טרם נדרש", requested: "נשלחה בקשה", received: "התקבל", overdue: "עבר מועד התשלום" },
  en: { pending: "Pending", approved: "Approved", rejected: "Rejected", not_due: "Not due", requested: "Requested", received: "Received", overdue: "Overdue" },
};

const portalDetailsCopy = {
  he: {
    noClientPage: "מרחב הלקוח", noClientSubtitle: "הפרויקטים, האישורים והבקשות שלך במקום אחד.",
    noClientTitle: "החשבון עדיין לא מחובר ללקוח", noClientText: "פנו לצוות כדי להשלים את החיבור לחשבון הלקוח שלכם.",
    noProjectTitle: "עדיין אין פרויקט ללקוח הזה", noProjectText: "לאחר שהצוות יפתח את הפרויקט הראשון, הוא יופיע כאן עם האפיון, האישורים והתשלומים.",
    chatSuggestions: ["מה עוד צריך ממני?", "הצג לי את תהליך הפרויקט", "סכם את מה שסיכמנו עד עכשיו"],
    safety: "העוזר עונה רק על שאלות שקשורות לפרויקט הזה. השיחה נשמרת וזמינה לצוות שמלווה את הפרויקט.",
    approvalsTitle: "אישורים", approvalsEmpty: "אין כרגע דבר שממתין לאישור שלך.", scope: "אפיון", status: "מצב", notes: "הערות", approved: "אושר בתאריך", pending: "ממתין", saving: "שומר…", approve: "אישור", decline: "דחייה",
    approvedScope: "האפיון המאושר", approvedScopeEmpty: "עדיין אין אפיון מאושר.", version: "גרסה", phase: "שלב", item: "פריט", acceptance: "איך נדע שזה עובד",
    payments: "בקשות תשלום", paymentsEmpty: "לא נשלחה בקשת תשלום לפרויקט הזה.", amount: "סכום", due: "לתשלום עד", notSet: "לא נקבע",
    paidHours: "בנק שעות", paidHoursEmpty: "אין כרגע יתרת שעות שנרכשה.", purchased: "נרכשו", used: "נוצלו", remaining: "נותרו", expiry: "תוקף", hoursSuffix: "שעות", noExpiry: "ללא הגבלת תוקף",
    changes: "בקשות שינוי", changesEmpty: "עדיין אין בקשות שינוי. אפשר לבקש שינוי בטופס למטה.", request: "בקשה", price: "מחיר", awaitingPricing: "ממתין לתמחור",
    changeQuestion: "מה תרצו לשנות?", details: "פרטים", sending: "שולח…", submitChange: "שליחת בקשת שינוי", changeHelp: "הצוות בודק ומתמחר כל בקשה לפני שהיא הופכת לעבודה.",
    files: "קבצים", filesEmpty: "עדיין לא שותפו איתך קבצים.", messages: "הודעות", messagesEmpty: "עדיין אין הודעות.", you: "אתם", agency: "הצוות", sendAgency: "שליחת הודעה לצוות", sendMessage: "שליחת הודעה",
  },
  en: {
    noClientPage: "Client workspace", noClientSubtitle: "Your projects, approvals and requests in one place.",
    noClientTitle: "No client workspace available", noClientText: "This account is not linked to a client record yet. Ask the agency to complete your access.",
    noProjectTitle: "No project exists for this client", noProjectText: "Once the agency creates your first project it will appear here with scope, approvals and payment status.",
    chatSuggestions: ["What else do you need from me?", "Show me the project flow", "Summarise what we agreed so far"],
    safety: "This assistant only answers questions about this project. The conversation is recorded and available to the team supporting the project.",
    approvalsTitle: "Approvals", approvalsEmpty: "Nothing needs your approval right now.", scope: "Scope", status: "Status", notes: "Notes", approved: "Approved", pending: "Pending", saving: "Saving…", approve: "Approve", decline: "Decline",
    approvedScope: "Approved scope", approvedScopeEmpty: "No scope has been approved yet.", version: "Version", phase: "Phase", item: "Item", acceptance: "Acceptance",
    payments: "Payment requests", paymentsEmpty: "No payment has been requested for this project.", amount: "Amount", due: "Due", notSet: "Not set",
    paidHours: "Paid hours", paidHoursEmpty: "You do not have a paid-hour balance.", purchased: "Purchased", used: "Used", remaining: "Remaining", expiry: "Expiry", hoursSuffix: "hrs", noExpiry: "No expiry",
    changes: "Change requests", changesEmpty: "No change requests yet. Use the form below to ask for a change.", request: "Request", price: "Price", awaitingPricing: "Awaiting pricing",
    changeQuestion: "What would you like to change?", details: "Details", sending: "Sending…", submitChange: "Submit change request", changeHelp: "The agency reviews and prices every request before it becomes work.",
    files: "Files", filesEmpty: "No files have been shared with you yet.", messages: "Messages", messagesEmpty: "No messages yet.", you: "You", agency: "Agency", sendAgency: "Send a message to the agency", sendMessage: "Send message",
  },
} as const;

const portalCopy = {
  he: {
    workspace: "הפורטל שלי", subtitle: "הפרויקט, ההחלטות והשלב הבא במקום אחד.", project: "פרויקט",
    status: "מצב הפרויקט", ready: "מוכנים להתחיל", waiting: "ממתינים לאישור, תשלום או בנק שעות",
    requests: "בקשות פתוחות", approvals: "ממתינים לאישור שלך", estimate: "הערכת הפרויקט",
    estimatePending: "האומדן יופיע לאחר שהסוכנות תאשר לשתף אותו.", hours: "שעות", budget: "תקציב משוער",
    fixedPrice: "מחיר קבוע מאושר", next: "מה השלב הבא?", chatTitle: "שיחה על הפרויקט",
    price: "מחיר", pricePending: "יוצג לאחר אישור מחיר קבוע", overviewTab: "מצב הפרויקט", specTab: "מה ביקשתי",
    chatTab: "שיחה ושינויים", fullScreen: "מסך מלא", exitFullScreen: "צא ממסך מלא",
    approvedSpec: "סיכום מאושר", building: "מה אנחנו בונים", specPending: "הסיכום עדיין בבדיקה אצלנו ויופיע כאן ברגע שיאושר.",
    version: "גרסה", acceptance: "איך נדע שזה עובד",
    refreshMvpPlaceholder: "לדוגמה: רוצה שגם יישלח לי מייל אחרי כל פנייה", sendRefresh: "שלח את הבקשה",
    refreshSent: "הבקשה נשמרה. נעבור עליה ונשלח לך עדכון.",
    chatSubtitle: "אפשר לשאול, לבקש דוגמה או סקיצה ולראות כאן את התוצרים המעודכנים מהשיחה.",
    preview: "תצוגת אדמין של מה שהלקוח רשאי לראות. שליחת הודעות בשם הלקוח חסומה.",
    details: "מסמכים, הצעה ופרטים נוספים", stages: ["מבינים מה צריך", "אישור והצעה", "בנייה", "מסירה"],
  },
  en: {
    workspace: "My portal", subtitle: "Your project, decisions and next step in one place.", project: "Project",
    status: "Project status", ready: "Ready to start", waiting: "Waiting for approval, payment or paid hours",
    requests: "Open requests", approvals: "Waiting for your approval", estimate: "Project estimate",
    estimatePending: "The estimate will appear after the agency approves it for sharing.", hours: "Hours", budget: "Estimated budget",
    fixedPrice: "Approved fixed price", next: "What happens next?", chatTitle: "Project conversation",
    price: "Price", pricePending: "Shown after a fixed price is approved", overviewTab: "Project status", specTab: "What I asked for",
    chatTab: "Conversation & changes", fullScreen: "Full screen", exitFullScreen: "Exit full screen",
    approvedSpec: "Approved summary", building: "What we are building", specPending: "The summary is still being reviewed and will appear here once it is approved.",
    version: "Version", acceptance: "How we know it works",
    refreshMvpPlaceholder: "For example: also send me an email after every enquiry", sendRefresh: "Send my request",
    refreshSent: "Your request was saved. We will review it and send you an update.",
    chatSubtitle: "Ask questions, request examples or sketches, and see the latest conversation outputs here.",
    preview: "Agency preview of what this client may see. Sending as the client is disabled.",
    details: "Documents, proposal and more details", stages: ["Understanding the need", "Approval & proposal", "Building", "Handoff"],
  },
} as const;

function projectStage(status: Project["status"]) {
  if (["lead_started", "discovery_in_progress", "waiting_for_agency_pricing", "pricing_set", "brief_ready", "scope_ready"].includes(status)) return 0;
  if (["waiting_for_client_approval", "approved_by_client", "waiting_for_payment", "paid_ready_to_start"].includes(status)) return 1;
  if (["assigned_to_supplier", "in_development", "change_requested", "change_priced", "change_approved"].includes(status)) return 2;
  return 3;
}

export function ClientPortalPage({
  selectedClientId, clients, projects, changeRequests, clientPayments, hourBanks, isPreview, initialProjectId,
}: ClientPortalPageProps) {
  const { profile } = useAuth();
  const {
    approvals, estimateSummaries, fileLinks, projectMessages, scopeItems, scopes,
    submitClientChangeRequest, updateApprovalStatus, updateChangeRequestStatus, createProjectMessage,
    isPending, getError, getSuccess,
  } = useAppData();

  const client = selectedClientId ? getClientById(selectedClientId, clients) : undefined;
  const clientProjects = useMemo(
    () => (client ? projects.filter((project) => project.clientId === client.id) : []),
    [client, projects],
  );
  const clientProjectIds = clientProjects.map((project) => project.id);

  const [activeProjectId, setActiveProjectId] = useState<string | undefined>(initialProjectId);
  const [language, setLanguage] = useState<PortalLanguage>(() => {
    const saved = window.localStorage.getItem("client-portal-language");
    return saved === "en" || saved === "he" ? saved : (navigator.language.toLowerCase().startsWith("he") ? "he" : "en");
  });
  const project = clientProjects.find((item) => item.id === activeProjectId) ?? clientProjects[0];

  function changeLanguage(next: PortalLanguage) {
    setLanguage(next);
    window.localStorage.setItem("client-portal-language", next);
  }

  const [requestForm, setRequestForm] = useState({ title: "", description: "" });
  const [messageBody, setMessageBody] = useState("");
  const [mvpRefreshNotes, setMvpRefreshNotes] = useState("");
  const [mvpRefreshSent, setMvpRefreshSent] = useState(false);
  const [mvpFreshness, setMvpFreshness] = useState({ hasMvp: false, isStale: false, version: undefined as number | undefined });
  const [focusMode, setFocusMode] = useState<"overview" | "spec" | "mvp" | "chat">("overview");
  const [fullScreen, setFullScreen] = useState(false);
  const [solutionKind, setSolutionKind] = useState<SolutionKind | null>(null);

  useEffect(() => {
    if (!project) { setSolutionKind(null); return; }
    let active = true;
    void getProjectSolutionKind(project.id)
      .then((kind) => { if (active) setSolutionKind(kind); })
      .catch(() => { if (active) setSolutionKind(null); });
    return () => { active = false; };
  }, [project?.id]);

  /** What the client actually gets, in their own words (no jargon). */
  const thing = deliverable(solutionKind ?? guessSolutionKind(project?.name, project?.summary), language);
  const deliverableCopy = language === "he" ? {
    mvpTab: thing.name,
    refreshMvp: `רוצה שנעדכן את ${thing.short}?`,
    refreshMvpHelp: "כתוב במילים שלך מה השתנה או מה חסר, ונחזור אליך עם גרסה מעודכנת.",
    mvpStale: `סיפרת לנו דברים חדשים מאז הגרסה האחרונה של ${thing.short}.`,
    finishAndRefresh: `סיימתי להסביר — עדכנו את ${thing.short}`,
  } : {
    mvpTab: thing.name,
    refreshMvp: `Want us to update ${thing.short}?`,
    refreshMvpHelp: "Tell us in your own words what changed or what is missing, and we will send you an updated version.",
    mvpStale: `You told us new things since the last version of ${thing.short}.`,
    finishAndRefresh: `I’m done explaining — please update ${thing.short}`,
  };
  const t = { ...portalCopy[language], ...deliverableCopy };
  const d = portalDetailsCopy[language];

  useEffect(() => {
    if (!project || (focusMode !== "chat" && focusMode !== "mvp")) return;
    void getPrototypeFreshness(project.id).then(setMvpFreshness).catch(() => setMvpFreshness({ hasMvp: false, isStale: false, version: undefined }));
  }, [focusMode, project]);

  if (!client) {
    return (
      <>
        <PageHeader title={d.noClientPage} subtitle={d.noClientSubtitle} />
        <section className="empty-state">
          <h2>{d.noClientTitle}</h2>
          <p>{d.noClientText}</p>
        </section>
      </>
    );
  }

  if (!project) {
    return (
      <>
        <PageHeader title={`${client.company} · ${d.noClientPage}`} subtitle={d.noClientSubtitle} />
        <section className="empty-state">
          <h2>{d.noProjectTitle}</h2>
          <p>{d.noProjectText}</p>
        </section>
      </>
    );
  }

  const approvalsForProject = approvals.filter((approval) => approval.projectId === project.id);
  const pendingApprovals = approvalsForProject.filter(
    (approval) => approval.status === "pending" && approval.approverRole === "client",
  );
  const estimate = estimateSummaries.find((item) => item.projectId === project.id && item.clientVisible);
  const currentStage = projectStage(project.status);
  const paymentsForProject = clientPayments.filter((payment) => payment.projectId === project.id);
  const banks = hourBanks.filter((bank) => bank.clientId === client.id && (!bank.projectId || bank.projectId === project.id));
  const requests = changeRequests.filter((request) => request.projectId === project.id);
  const files = fileLinks.filter((file) => file.projectId === project.id && file.visibility === "client_visible");
  const messages = projectMessages
    .filter((message) => message.projectId === project.id && message.visibility === "client_visible")
    .slice()
    .sort((a, b) => a.createdDate.localeCompare(b.createdDate));
  const approvedScopes = scopes.filter((scope) => scope.projectId === project.id && scope.status === "approved");
  const visibleScopeItems = scopeItems.filter(
    (item) => item.clientVisible && scopes.some((scope) => scope.id === item.scopeId && scope.projectId === project.id),
  );

  const requestKey = MutationKeys.submitClientChangeRequest(project.id);
  const messageKey = MutationKeys.createProjectMessage(project.id);

  async function handleRequestSubmit(event: FormEvent) {
    event.preventDefault();
    if (!requestForm.title.trim() || isPending(requestKey)) return;
    try {
      await submitClientChangeRequest(project.id, client!.id, {
        title: requestForm.title.trim(),
        description: requestForm.description.trim(),
      });
      setRequestForm({ title: "", description: "" });
    } catch { /* values kept for retry */ }
  }

  async function handleMessageSubmit(event: FormEvent) {
    event.preventDefault();
    if (!messageBody.trim() || isPending(messageKey)) return;
    try {
      await createProjectMessage(project.id, messageBody.trim(), "client_visible", "client");
      setMessageBody("");
    } catch { /* value kept for retry */ }
  }

  async function handleMvpRefreshRequest(event: FormEvent) {
    event.preventDefault();
    if (!mvpRefreshNotes.trim() || isPending(requestKey) || isPreview) return;
    try {
      await submitClientChangeRequest(project.id, client!.id, {
        title: language === "he" ? `בקשת עדכון ל${thing.short}` : `Update request for ${thing.short}`,
        description: mvpRefreshNotes.trim(),
      });
      setMvpRefreshNotes("");
      setMvpRefreshSent(true);
      setMvpFreshness((current) => ({ ...current, isStale: true }));
    } catch { /* notes kept for retry */ }
  }

  return (
    <div className={`client-portal-shell${fullScreen ? " portal-focus-fullscreen" : ""}`} dir={language === "he" ? "rtl" : "ltr"}>
      <PageHeader
        title={`${client.company} · ${t.workspace}`}
        subtitle={isPreview ? t.preview : t.subtitle}
      />

      <ClientWorkspaceIdentity
        language={language}
        clientName={client.name || profile?.fullName || client.email}
        company={client.company}
        email={isPreview ? client.email : profile?.email || client.email}
        projectName={project.name}
        preview={isPreview}
      />

      <div className="portal-language-switch" role="group" aria-label="Portal language">
        <button type="button" className={language === "he" ? "primary-button" : "ghost-button"} onClick={() => changeLanguage("he")}>עברית</button>
        <button type="button" className={language === "en" ? "primary-button" : "ghost-button"} onClick={() => changeLanguage("en")}>English</button>
      </div>

      <div className="portal-focus-toolbar" role="tablist" aria-label={t.workspace}>
        <button type="button" className={focusMode === "overview" ? "active" : ""} onClick={() => setFocusMode("overview")}>{t.overviewTab}</button>
        <button type="button" className={focusMode === "spec" ? "active" : ""} onClick={() => setFocusMode("spec")}>{t.specTab}</button>
        <button type="button" className={focusMode === "mvp" ? "active" : ""} onClick={() => setFocusMode("mvp")}>{t.mvpTab}</button>
        <button type="button" className={focusMode === "chat" ? "active" : ""} onClick={() => setFocusMode("chat")}>{t.chatTab}</button>
        <button type="button" className="portal-fullscreen-toggle" onClick={() => setFullScreen((value) => !value)}>{fullScreen ? t.exitFullScreen : t.fullScreen}</button>
      </div>

      {clientProjects.length > 1 ? (
        <div className="filter-row">
          <label className="inline-label">
            {t.project}
            <select value={project.id} onChange={(event) => setActiveProjectId(event.target.value)}>
              {clientProjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
        </div>
      ) : null}

      {focusMode === "overview" ? <section className="card portal-overview">
        <p className="eyebrow">{t.status}</p>
        <h2>{project.name}</h2>
        <p className="muted-text">{project.summary}</p>
        <div className="portal-progress" aria-label={t.status}>
          {t.stages.map((label, index) => (
            <div key={label} className={`portal-progress-step${index < currentStage ? " done" : index === currentStage ? " active" : ""}`}>
              <span>{index < currentStage ? "✓" : index + 1}</span><strong>{label}</strong>
            </div>
          ))}
        </div>
        <dl className="meta-list portal-summary-grid">
          <div><dt>{t.status}</dt><dd><StatusBadge label={language === "he" ? projectStatusHe[project.status] : statusLabels[project.status]} tone={canWorkStart(project, scopes) ? "success" : "warning"} /></dd></div>
          <div><dt>{t.next}</dt><dd>{canWorkStart(project, scopes) ? t.ready : t.waiting}</dd></div>
          <div><dt>{t.requests}</dt><dd>{requests.filter((r) => r.status !== "declined" && r.status !== "client_approved").length}</dd></div>
          <div><dt>{t.approvals}</dt><dd>{pendingApprovals.length}</dd></div>
        </dl>
      </section> : null}

      {focusMode === "overview" ? <section className="card portal-estimate-card">
        <h2>{t.estimate}</h2>
        {!estimate ? <p className="muted-text">{t.estimatePending}</p> : (
          <div className="portal-estimate-values">
            <div><span>{t.hours}</span><strong>{estimate.estimatedHoursMin}–{estimate.estimatedHoursMax}</strong></div>
            <div><span>{estimate.finalFixedPrice && estimate.approvedByYaniv ? t.fixedPrice : t.price}</span><strong>{estimate.finalFixedPrice && estimate.approvedByYaniv ? new Intl.NumberFormat(language === "he" ? "he-IL" : "en-GB", { style: "currency", currency: estimate.currency, maximumFractionDigits: 0 }).format(estimate.finalFixedPrice) : t.pricePending}</strong></div>
          </div>
        )}
      </section> : null}

      {focusMode === "chat" ? <><ProjectChat
        projectId={project.id}
        projectName={project.name}
        agent="project_guide"
        title={t.chatTitle}
        subtitle={t.chatSubtitle}
        readOnly={isPreview}
        readOnlyReason="Preview mode — you are still signed in as agency admin, so sending as the client is disabled."
        suggestions={[...d.chatSuggestions]}
        safetyNotice={d.safety}
        language={language}
        clientSafe
      />
      {mvpFreshness.hasMvp && mvpFreshness.isStale ? <section className="card portal-mvp-stale" role="status">
        <strong>{t.mvpStale}</strong>
        <p>{t.refreshMvpHelp}</p>
        <button className="primary-button" type="button" disabled={isPreview} onClick={() => setFocusMode("mvp")}>{t.finishAndRefresh}</button>
      </section> : null}</> : null}

      {focusMode === "mvp" ? <>
        <PrototypeStudio projectId={project.id} projectName={project.name} readOnly clientMode={!isPreview} language={language} />
        <section className="card portal-mvp-refresh">
          <h2>{t.refreshMvp}</h2>
          <p className="muted-text">{t.refreshMvpHelp}</p>
          <form onSubmit={(event) => void handleMvpRefreshRequest(event)}>
            <textarea rows={3} value={mvpRefreshNotes} disabled={isPreview} placeholder={t.refreshMvpPlaceholder} onChange={(event) => { setMvpRefreshNotes(event.target.value); setMvpRefreshSent(false); }} />
            <div className="action-row">
              <button className="primary-button" type="submit" disabled={isPreview || isPending(requestKey) || !mvpRefreshNotes.trim()}>{isPending(requestKey) ? "…" : t.sendRefresh}</button>
            </div>
          </form>
          {mvpRefreshSent ? <p className="form-success">{t.refreshSent}</p> : null}
          {getError(requestKey) ? <p className="form-error">{getError(requestKey)}</p> : null}
        </section>
      </> : null}

      {focusMode === "spec" ? <section className="card portal-spec-focus">
        <p className="eyebrow">{t.approvedSpec}</p>
        <h2>{t.building}</h2>
        {approvedScopes.length ? approvedScopes.map((item) => <article key={item.id}><h3>{t.version} {item.version}</h3><p>{item.clientFacingSummary}</p></article>) : <p className="muted-text">{t.specPending}</p>}
        {visibleScopeItems.length ? <div className="portal-spec-cards">{visibleScopeItems.map((item) => <article key={item.id}><span>{item.phase}</span><h3>{item.title}</h3><p>{item.description}</p>{item.acceptanceNotes ? <small>{t.acceptance}: {item.acceptanceNotes}</small> : null}</article>)}</div> : null}
        <BudgetSimulator projectId={project.id} clientId={client.id} readOnly={isPreview} language={language} />
      </section> : null}

      {!fullScreen ? <details className="portal-details">
        <summary>{t.details}</summary>
        <div className="portal-details-body">
      <ProjectDocumentsPanel projectId={project.id} readOnly />

      <ProposalPanel projectId={project.id} mode="client" readOnly={isPreview} />

      <TargetDateForm project={project} readOnly={isPreview} />
      <section className="card">
        <h2>{d.approvalsTitle}</h2>
        {approvalsForProject.length === 0 ? (
          <p className="muted-text">{d.approvalsEmpty}</p>
        ) : (
          <table>
            <thead>
              <tr><th>{d.scope}</th><th>{d.status}</th><th>{d.notes}</th><th>{d.approved}</th><th /></tr>
            </thead>
            <tbody>
              {approvalsForProject.map((approval) => {
                const scope = scopes.find((item) => item.id === approval.scopeId);
                const key = MutationKeys.updateApprovalStatus(approval.id);
                const decidable = approval.status === "pending" && approval.approverRole === "client";
                return (
                  <tr key={approval.id}>
                    <td>{scope ? `v${scope.version}` : d.scope}</td>
                    <td><StatusBadge label={compactStatusLabels[language][approval.status] ?? approval.status} tone={approval.status === "approved" ? "success" : approval.status === "rejected" ? "danger" : "warning"} /></td>
                    <td>{approval.notes || "—"}</td>
                    <td>{approval.approvedDate ?? d.pending}</td>
                    <td>
                      {decidable ? (
                        <div className="action-row compact">
                          <button type="button" disabled={isPending(key)} onClick={() => void updateApprovalStatus(approval.id, "approved")}>
                            {isPending(key) ? d.saving : d.approve}
                          </button>
                          <button type="button" disabled={isPending(key)} onClick={() => void updateApprovalStatus(approval.id, "rejected")}>
                            {d.decline}
                          </button>
                          {getError(key) ? <span className="form-error">{getError(key)}</span> : null}
                        </div>
                      ) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="card">
        <h2>{d.approvedScope}</h2>
        {approvedScopes.length === 0 ? (
          <p className="muted-text">{d.approvedScopeEmpty}</p>
        ) : (
          approvedScopes.map((scope) => (
            <div key={scope.id} className="scope-block">
              <h3>{d.version} {scope.version}</h3>
              <p>{scope.clientFacingSummary}</p>
            </div>
          ))
        )}
        {visibleScopeItems.length ? (
          <table>
            <thead><tr><th>{d.phase}</th><th>{d.item}</th><th>{d.acceptance}</th></tr></thead>
            <tbody>
              {visibleScopeItems.map((item) => (
                <tr key={item.id}>
                  <td>{item.phase}</td>
                  <td><strong>{item.title}</strong><br />{item.description}</td>
                  <td>{item.acceptanceNotes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>

      <section className="detail-grid">
        <article className="card">
          <h2>{d.payments}</h2>
          {paymentsForProject.length === 0 ? (
            <p className="muted-text">{d.paymentsEmpty}</p>
          ) : (
            <table>
              <thead><tr><th>{d.amount}</th><th>{d.status}</th><th>{d.due}</th><th>{d.notes}</th></tr></thead>
              <tbody>
                {paymentsForProject.map((payment) => (
                  <tr key={payment.id}>
                    <td>{currency.format(payment.amount)}</td>
                    <td><StatusBadge label={compactStatusLabels[language][payment.status] ?? payment.status} tone={payment.status === "received" ? "success" : "warning"} /></td>
                    <td>{payment.dueDate ?? d.notSet}</td>
                    <td>{payment.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </article>
        <article className="card">
          <h2>{d.paidHours}</h2>
          {banks.length === 0 ? (
            <p className="muted-text">{d.paidHoursEmpty}</p>
          ) : (
            <table>
              <thead><tr><th>{d.purchased}</th><th>{d.used}</th><th>{d.remaining}</th><th>{d.expiry}</th></tr></thead>
              <tbody>
                {banks.map((bank) => (
                  <tr key={bank.id}>
                    <td>{bank.hoursPurchased} {d.hoursSuffix}</td>
                    <td>{bank.hoursUsed} {d.hoursSuffix}</td>
                    <td>{bank.hoursRemaining} {d.hoursSuffix}</td>
                    <td>{bank.expiryDate ?? d.noExpiry}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </article>
      </section>

      <section className="card">
        <h2>{d.changes}</h2>
        {requests.length === 0 ? (
          <p className="muted-text">{d.changesEmpty}</p>
        ) : (
          <table>
            <thead><tr><th>{d.request}</th><th>{d.status}</th><th>{d.price}</th><th /></tr></thead>
            <tbody>
              {requests.map((request) => {
                const key = MutationKeys.updateChangeRequestStatus(request.id);
                return (
                  <tr key={request.id}>
                    <td><strong>{request.title}</strong><br />{request.description}</td>
                    <td><StatusBadge label={requestStatusLabels[language][request.status]} tone={request.status === "client_approved" ? "success" : request.status === "declined" ? "danger" : "warning"} /></td>
                    <td>{request.agencyPrice != null ? currency.format(request.agencyPrice) : d.awaitingPricing}</td>
                    <td>
                      {request.status === "priced" ? (
                        <div className="action-row compact">
                          <button type="button" disabled={isPending(key)} onClick={() => void updateChangeRequestStatus(request.id, "client_approved")}>
                            {isPending(key) ? d.saving : d.approve}
                          </button>
                          <button type="button" disabled={isPending(key)} onClick={() => void updateChangeRequestStatus(request.id, "declined")}>
                            {d.decline}
                          </button>
                          {getError(key) ? <span className="form-error">{getError(key)}</span> : null}
                        </div>
                      ) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        <form className="form-grid" onSubmit={handleRequestSubmit}>
          <label className="span-2">
            {d.changeQuestion}
            <input value={requestForm.title} onChange={(e) => setRequestForm({ ...requestForm, title: e.target.value })} />
          </label>
          <label className="span-2">
            {d.details}
            <textarea value={requestForm.description} onChange={(e) => setRequestForm({ ...requestForm, description: e.target.value })} />
          </label>
          <div className="form-actions">
            <button className="primary-button" type="submit" disabled={isPending(requestKey)}>
              {isPending(requestKey) ? d.sending : d.submitChange}
            </button>
          </div>
          {getError(requestKey) ? <p className="form-error" role="alert">{getError(requestKey)}</p> : null}
          {getSuccess(requestKey) && !getError(requestKey) ? <p className="form-success">{getSuccess(requestKey)}</p> : null}
        </form>
        <p className="muted-text">{d.changeHelp}</p>
      </section>

      <section className="card">
        <h2>{d.files}</h2>
        {files.length === 0 ? (
          <p className="muted-text">{d.filesEmpty}</p>
        ) : (
          <ul className="link-list">
            {files.map((file) => (
              <li key={file.id}>
                <a href={file.url} target="_blank" rel="noreferrer">{file.title}</a>
                <span className="muted-text"> · {file.fileType}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2>{d.messages}</h2>
        {messages.length === 0 ? (
          <p className="muted-text">{d.messagesEmpty}</p>
        ) : (
          <div className="message-list">
            {messages.map((message) => (
              <div key={message.id} className="message-item">
                <div><strong>{message.authorRole === "client" ? d.you : d.agency}</strong><p>{message.body}</p></div>
                <span>{message.createdDate}</span>
              </div>
            ))}
          </div>
        )}
        <form className="form-grid" onSubmit={handleMessageSubmit}>
          <label className="span-2">
            {d.sendAgency}
            <textarea value={messageBody} onChange={(e) => setMessageBody(e.target.value)} />
          </label>
          <div className="form-actions">
            <button className="primary-button" type="submit" disabled={isPending(messageKey)}>
              {isPending(messageKey) ? d.sending : d.sendMessage}
            </button>
          </div>
          {getError(messageKey) ? <p className="form-error" role="alert">{getError(messageKey)}</p> : null}
        </form>
      </section>
        </div>
      </details> : null}
    </div>
  );
}
