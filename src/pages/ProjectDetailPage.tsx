import { type FormEvent, useState } from "react";
import { DetailNav } from "../components/DetailNav";
import { PageHeader } from "../components/PageHeader";
import { ProjectChat } from "../components/ProjectChat";
import ProjectInsights from "../components/ProjectInsights";
import { ProjectTimeline } from "../components/ProjectTimeline";
import { StatusBadge } from "../components/StatusBadge";
import { EstimateControl } from "../components/estimation/EstimateControl";
import { CommercialSettingsPanel } from "../components/project/CommercialSettingsPanel";
import { ProjectControlSummary } from "../components/project/ProjectControlSummary";
import { TargetDateForm } from "../components/project/TargetDateForm";
import { buildProjectCommercials } from "../lib/projectCommercials";
import { EmptyState } from "../components/ui/EmptyState";
import { Tabs, type TabDef } from "../components/ui/Tabs";
import { ProjectDocumentsPanel } from "../components/project/ProjectDocumentsPanel";
import { MeetingWorkspace } from "../components/meeting/MeetingWorkspace";
import { ProposalPanel } from "../components/proposal/ProposalPanel";
import { useNav } from "../context/NavContext";
import {
  MutationKeys,
  useAppData,
  type NewChangeRequestInput,
  type NewClientPaymentInput,
  type NewTimeEntryInput,
} from "../context/AppDataContext";
import {
  canWorkStart, currency, getClient, getPricing, getProjectById, getSupplierName, statusLabels,
} from "../lib/domainHelpers";
import type { ChangeRequest, Client, ClientPayment, Project, TimeEntry } from "../types/domain";

type ProjectDetailPageProps = {
  selectedProjectId?: string;
  clients: Client[];
  projects: Project[];
  changeRequests: ChangeRequest[];
  timeEntries: TimeEntry[];
  clientPayments: ClientPayment[];
  onChangeRequestCreate: (projectId: string, clientId: string, input: NewChangeRequestInput) => Promise<unknown>;
  onChangeRequestStatusChange: (changeRequestId: string, status: "priced" | "client_approved" | "declined") => Promise<unknown>;
  onClientPaymentCreate: (projectId: string, input: NewClientPaymentInput) => Promise<unknown>;
  onPaymentReceived: (paymentId: string) => Promise<unknown>;
  onSupplierAssignmentChange: (projectId: string, supplierId: string, assigned: boolean) => Promise<unknown>;
  onTimeEntryCreate: (projectId: string, input: NewTimeEntryInput) => Promise<unknown>;
  onTimeEntryStatusChange: (timeEntryId: string, status: "approved" | "rejected") => Promise<unknown>;
};

const initialChangeForm: NewChangeRequestInput = { title: "", description: "", agencyPrice: undefined, supplierCost: undefined };
const initialTimeForm: NewTimeEntryInput = { supplierId: "", date: new Date().toISOString().slice(0, 10), hours: 1, description: "" };
const initialPaymentForm: NewClientPaymentInput = { amount: 0, dueDate: "", notes: "" };

type ProjectTab = "overview" | "meeting" | "scope" | "estimate" | "commercial" | "proposal" | "suppliers" | "money" | "changes" | "timeline" | "assistant" | "documents" | "files";

export function ProjectDetailPage({
  selectedProjectId, clients, projects, changeRequests, timeEntries, clientPayments,
  onChangeRequestCreate, onChangeRequestStatusChange, onClientPaymentCreate, onPaymentReceived,
  onSupplierAssignmentChange, onTimeEntryCreate, onTimeEntryStatusChange,
}: ProjectDetailPageProps) {
  const {
    scopes, scopeItems, projectBriefs, projectPricing, fileLinks, decisionLogs, suppliers, supplierProfiles,
    projectSchedules, estimateSummaries,
    isPending, getError, getSuccess,
  } = useAppData();
  const [changeForm, setChangeForm] = useState<NewChangeRequestInput>(initialChangeForm);
  const [timeForm, setTimeForm] = useState<NewTimeEntryInput>(initialTimeForm);
  const [paymentForm, setPaymentForm] = useState<NewClientPaymentInput>(initialPaymentForm);
  const [supplierToAssign, setSupplierToAssign] = useState("");
  const [tab, setTab] = useState<ProjectTab>(() => {
    const requestedProject = window.sessionStorage.getItem("open-project-meeting");
    if (requestedProject && requestedProject === selectedProjectId) {
      window.sessionStorage.removeItem("open-project-meeting");
      return "meeting";
    }
    return "overview";
  });
  const nav = useNav();
  const project = selectedProjectId ? getProjectById(selectedProjectId, projects) : undefined;

  if (!project) {
    return (
      <>
        <PageHeader title="Project Detail" subtitle="Select a project from the Projects page or a Client Detail page to open its command center." />
        <EmptyState
          title="No project selected"
          description="Open a project to inspect its summary, payment gate, scope, suppliers, changes, files and decisions."
          action={{ label: "Browse projects", onClick: () => nav.navigate("projects") }}
          secondaryAction={{ label: "Back to dashboard", onClick: () => nav.navigate("dashboard") }}
        />
      </>
    );
  }

  const activeProject = project;
  const changeKey = MutationKeys.createChangeRequest(activeProject.id);
  const timeKey = MutationKeys.createTimeEntry(activeProject.id);
  const paymentKey = MutationKeys.createClientPayment(activeProject.id);
  const client = getClient(activeProject, clients);
  const pricing = getPricing(activeProject.id, projectPricing);
  const scope = scopes.find((item) => item.projectId === activeProject.id);
  const brief = projectBriefs.find((item) => item.projectId === activeProject.id);
  const items = scope ? scopeItems.filter((item) => item.scopeId === scope.id) : [];
  const payment = clientPayments.find((item) => item.projectId === activeProject.id);
  const projectChanges = changeRequests.filter((request) => request.projectId === activeProject.id);
  const projectTimeEntries = timeEntries.filter((entry) => entry.projectId === activeProject.id);
  const projectFiles = fileLinks.filter((file) => file.projectId === activeProject.id);
  const projectDecisions = decisionLogs.filter((decision) => decision.projectId === activeProject.id);
  const approvedSuppliers = suppliers.filter((supplier) => supplier.status === "approved");
  const assignableSuppliers = approvedSuppliers.filter((supplier) => !activeProject.assignedSupplierIds.includes(supplier.id));
  const approvedSupplierRows = approvedSuppliers.map((supplier) => ({
    supplier,
    profile: supplierProfiles.find((item) => item.supplierId === supplier.id),
    assigned: activeProject.assignedSupplierIds.includes(supplier.id),
  }));
  const ready = canWorkStart(activeProject, scopes);

  async function handleChangeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending(changeKey)) return;
    if (!client || !changeForm.title.trim() || !changeForm.description.trim()) return;
    try {
      await onChangeRequestCreate(activeProject.id, client.id, {
        title: changeForm.title.trim(),
        description: changeForm.description.trim(),
        agencyPrice: changeForm.agencyPrice,
        supplierCost: changeForm.supplierCost,
      });
      setChangeForm(initialChangeForm);
    } catch { /* keep form values */ }
  }

  async function handleTimeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending(timeKey)) return;
    if (!timeForm.supplierId || !timeForm.description.trim() || timeForm.hours <= 0) return;
    try {
      await onTimeEntryCreate(activeProject.id, { ...timeForm, description: timeForm.description.trim() });
      setTimeForm({ ...initialTimeForm, supplierId: timeForm.supplierId });
    } catch { /* keep form values */ }
  }

  async function handlePaymentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending(paymentKey)) return;
    if (paymentForm.amount <= 0) return;
    try {
      await onClientPaymentCreate(activeProject.id, {
        amount: paymentForm.amount,
        dueDate: paymentForm.dueDate || undefined,
        notes: paymentForm.notes.trim(),
      });
      setPaymentForm(initialPaymentForm);
    } catch { /* keep form values */ }
  }

  async function handleSupplierAssign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supplierToAssign) return;
    const key = MutationKeys.updateProjectSupplierAssignment(activeProject.id, supplierToAssign);
    if (isPending(key)) return;
    try {
      await onSupplierAssignmentChange(activeProject.id, supplierToAssign, true);
      setSupplierToAssign("");
    } catch { /* keep selection */ }
  }

  function assignmentPending(supplierId: string) {
    return isPending(MutationKeys.updateProjectSupplierAssignment(activeProject.id, supplierId));
  }
  function paymentReceivePending(paymentId: string) {
    return isPending(MutationKeys.markPaymentReceived(paymentId));
  }
  function timeStatusPending(id: string) {
    return isPending(MutationKeys.updateTimeEntryStatus(id));
  }
  function crStatusPending(id: string) {
    return isPending(MutationKeys.updateChangeRequestStatus(id));
  }

  const pendingChanges = projectChanges.filter((request) => request.status !== "client_approved" && request.status !== "declined").length;
  const pendingTime = projectTimeEntries.filter((entry) => entry.status === "submitted").length;
  const tabs: TabDef<ProjectTab>[] = [
    { key: "overview", label: "סקירה" },
    { key: "meeting", label: "אפיון ושיחה" },
    { key: "scope", label: "היקף", badge: items.length || undefined },
    { key: "estimate", label: "תמחור" },
    { key: "proposal", label: "הצעה ואישור" },
    { key: "suppliers", label: "ביצוע", badge: activeProject.assignedSupplierIds.length || undefined, attention: pendingTime > 0 || pendingChanges > 0 },
  ];
  const secondaryTabs: { key: ProjectTab; label: string }[] = [
    { key: "commercial", label: "הגדרות מסחריות ותאריכים" },
    { key: "money", label: "תשלומים" },
    { key: "changes", label: "בקשות שינוי" },
    { key: "timeline", label: "ציר זמן" },
    { key: "assistant", label: "עוזר אדמין" },
    { key: "documents", label: "מסמכים" },
    { key: "files", label: "קבצים והחלטות" },
  ];
  const estimateSummary = estimateSummaries.find((item) => item.projectId === activeProject.id);
  const commercials = buildProjectCommercials({
    project: activeProject,
    schedule: projectSchedules.find((s) => s.projectId === activeProject.id),
    summary: estimateSummary,
    supplierProfiles,
  });
  const displayMoney = (amount: number | null | undefined) => amount == null
    ? "לא הוגדר"
    : new Intl.NumberFormat("he-IL", { style: "currency", currency: estimateSummary?.currency ?? "ILS", maximumFractionDigits: 0 }).format(amount);
  const siblingIndex = projects.findIndex((item) => item.id === activeProject.id);
  const previousProject = siblingIndex > 0 ? projects[siblingIndex - 1] : undefined;
  const nextProject = siblingIndex >= 0 && siblingIndex < projects.length - 1 ? projects[siblingIndex + 1] : undefined;

  return (
    <>
      <DetailNav
        crumbs={[
          { label: "Projects", view: "projects" },
          ...(client ? [{ label: client.company, onClick: () => nav.openClient(client.id) }] : []),
          { label: activeProject.name },
        ]}
        siblings={{
          position: siblingIndex >= 0 ? `${siblingIndex + 1} of ${projects.length}` : undefined,
          previous: previousProject ? { label: previousProject.name, onClick: () => nav.openProject(previousProject.id) } : undefined,
          next: nextProject ? { label: nextProject.name, onClick: () => nav.openProject(nextProject.id) } : undefined,
        }}
      />
      <PageHeader title={activeProject.name} subtitle={`${client?.company ?? "ללא לקוח"} · ${statusLabels[activeProject.status]} · ${ready ? "מוכן להתחלה" : "ממתין לתנאי התחלה"}`} />
      <div className="project-command-bar">
        <button type="button" className="primary-button" onClick={() => client && nav.openClientPortal(client.id)} disabled={!client}>צפה בדיוק במה שהלקוח רואה</button>
        <label>כלים נוספים
          <select value={secondaryTabs.some((item) => item.key === tab) ? tab : ""} onChange={(event) => event.target.value && setTab(event.target.value as ProjectTab)}>
            <option value="">בחר כלי</option>
            {secondaryTabs.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
          </select>
        </label>
      </div>
      <Tabs tabs={tabs} active={tab} onChange={setTab} ariaLabel="Project workspace sections" />
      {tab === "meeting" ? <MeetingWorkspace projectId={activeProject.id} projectName={activeProject.name} /> : null}
      {tab === "proposal" ? <ProposalPanel projectId={activeProject.id} mode="admin" /> : null}
      {tab === "overview" || tab === "commercial" ? (
        <ProjectControlSummary
          commercials={commercials}
          assignedSupplierNames={activeProject.assignedSupplierIds.map((id) => getSupplierName(id, suppliers)).join(", ")}
          onOpenDetails={tab === "overview" ? () => setTab("commercial") : undefined}
        />
      ) : null}
      {tab === "overview" || tab === "estimate" ? (
        <section className="pricing-visibility-grid">
          <article className="card client-visible-card">
            <p className="eyebrow">מה הלקוח רואה</p>
            <h2>{estimateSummary?.clientVisible ? "האומדן פורסם ללקוח" : "האומדן עדיין פנימי"}</h2>
            {estimateSummary?.clientVisible ? (
              <dl className="meta-list">
                <div><dt>הערכת שעות</dt><dd>{estimateSummary.estimatedHoursMin}–{estimateSummary.estimatedHoursMax} שעות</dd></div>
                <div><dt>{estimateSummary.approvedByYaniv && estimateSummary.finalFixedPrice != null ? "מחיר קבוע מאושר" : "טווח מחיר ללקוח"}</dt><dd>{estimateSummary.approvedByYaniv && estimateSummary.finalFixedPrice != null ? displayMoney(estimateSummary.finalFixedPrice) : `${displayMoney(estimateSummary.estimatedBudgetMin)}–${displayMoney(estimateSummary.estimatedBudgetMax)}`}</dd></div>
                <div><dt>גרסה</dt><dd>v{estimateSummary.version}</dd></div>
                <div><dt>סטטוס</dt><dd>{estimateSummary.status}</dd></div>
              </dl>
            ) : <p className="muted-text">הלקוח אינו רואה כרגע שעות או מחיר. כדי לשתף, יש לפרסם את האומדן מתוך מסך התמחור.</p>}
            <button type="button" onClick={() => client && nav.openClientPortal(client.id)} disabled={!client}>פתח תצוגת לקוח</button>
          </article>
          <article className="card internal-only-card">
            <p className="eyebrow">פנימי בלבד · לא נחשף ללקוח</p>
            <h2>חישוב ורווחיות</h2>
            <dl className="meta-list">
              <div><dt>מחיר חישוב לשעה</dt><dd>{displayMoney(estimateSummary?.clientCalculationRate)}</dd></div>
              <div><dt>עלות פנימית</dt><dd>{displayMoney(estimateSummary?.internalCost)}</dd></div>
              <div><dt>עלות ספק משוערת</dt><dd>{pricing ? currency.format(pricing.supplierCostEstimate) : "לא הוגדרה"}</dd></div>
              <div><dt>יעד רווח</dt><dd>{estimateSummary ? `${estimateSummary.targetMarginPercent}%` : "לא הוגדר"}</dd></div>
            </dl>
          </article>
        </section>
      ) : null}
      {tab === "commercial" ? (
        <>
          <CommercialSettingsPanel project={activeProject} />
          <TargetDateForm project={activeProject} readOnly />
        </>
      ) : null}
      {tab === "assistant" ? (
        <>
          <ProjectChat
        projectId={activeProject.id}
        projectName={activeProject.name}
        agent="agency_control"
        title="Agency Control"
        subtitle="Ask for summaries, drafts, risks and briefings. Anything that changes scope, price, assignment, approval, payment or readiness is returned as a proposed action for you to apply."
        showVisibility
        suggestions={[
          "Summarize what the client wants.",
          "What information is still missing?",
          "Create a draft scope.",
          "Prepare a supplier briefing.",
          "Show me the project flow.",
        ]}
      />
          <ProjectInsights projectId={activeProject.id} role="agency_admin" allowModeSwitch />
        </>
      ) : null}
      {tab === "overview" || tab === "money" ? (
        <>
      <section className="detail-grid">
        <article className="card">
          <h2>{activeProject.name}</h2>
          <p>{activeProject.summary}</p>
          <dl className="meta-list">
            <div><dt>Client</dt><dd>{client?.company}</dd></div>
            <div><dt>Status</dt><dd><StatusBadge label={statusLabels[activeProject.status]} tone="warning" /></dd></div>
            <div><dt>Start gate</dt><dd>{ready ? "Ready" : "Blocked until approved scope and payment or paid hours"}</dd></div>
            <div><dt>Assigned</dt><dd>{activeProject.assignedSupplierIds.map((supplierId) => getSupplierName(supplierId, suppliers)).join(", ") || "No supplier assigned"}</dd></div>
          </dl>
        </article>
        <article className="card warning-card">
          <h2>Payment gate</h2>
          <p>{ready ? "Work may start because scope is approved and payment is received or paid hours are available." : "Work remains blocked until scope is approved and payment is received or paid hours are available."}</p>
          <dl className="meta-list">
            <div><dt>Gate</dt><dd>{activeProject.paymentGateStatus}</dd></div>
            <div><dt>Payment</dt><dd>{payment?.status ?? "Not due"}</dd></div>
            <div><dt>Amount</dt><dd>{payment ? currency.format(payment.amount) : "Not set"}</dd></div>
          </dl>
          {payment && payment.status !== "received" ? (
            <div className="action-row">
              <button
                className="primary-button"
                type="button"
                disabled={paymentReceivePending(payment.id)}
                onClick={() => { void onPaymentReceived(payment.id).catch(() => {}); }}
              >
                {paymentReceivePending(payment.id) ? "Saving…" : "Mark payment received"}
              </button>
              {getError(MutationKeys.markPaymentReceived(payment.id)) ? (
                <p className="form-error" role="alert">{getError(MutationKeys.markPaymentReceived(payment.id))}</p>
              ) : null}
            </div>
          ) : null}
        </article>
      </section>
        </>
      ) : null}
      {tab === "money" && !payment ? (
        <section className="card form-panel">
          <h2>Create payment request</h2>
          <form className="form-grid" onSubmit={handlePaymentSubmit}>
            <label>Amount<input min="1" type="number" value={paymentForm.amount || ""} onChange={(e) => setPaymentForm({ ...paymentForm, amount: Number(e.target.value) })} /></label>
            <label>Due date optional<input type="date" value={paymentForm.dueDate ?? ""} onChange={(e) => setPaymentForm({ ...paymentForm, dueDate: e.target.value })} /></label>
            <label className="span-2">Notes<textarea value={paymentForm.notes} onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })} /></label>
            <p className="form-note">The payment request is saved to the database. Work remains blocked until Yaniv marks the payment received.</p>
            <div className="form-actions">
              <button className="primary-button" type="submit" disabled={isPending(paymentKey)}>
                {isPending(paymentKey) ? "Saving…" : "Create payment request"}
              </button>
            </div>
            {getError(paymentKey) ? <p className="form-error" role="alert">{getError(paymentKey)}</p> : null}
            {getSuccess(paymentKey) && !getError(paymentKey) ? <p className="form-success">{getSuccess(paymentKey)}</p> : null}
          </form>
        </section>
      ) : null}
      {tab === "overview" ? (
        <>
      <section className="detail-grid">
        <article className="card">
          <h2>Brief</h2>
          {brief ? (
            <>
              <p>{brief.problemStatement}</p>
              <h3>Goals</h3><ul>{brief.goals.map((g) => <li key={g}>{g}</li>)}</ul>
              <h3>Constraints</h3><ul>{brief.constraints.map((c) => <li key={c}>{c}</li>)}</ul>
            </>
          ) : <p>No brief has been drafted for this project yet.</p>}
        </article>
        <article className="card">
          <h2>Agency pricing separation</h2>
          <dl className="meta-list">
            <div><dt>Client price</dt><dd>{pricing ? currency.format(pricing.clientPrice) : "Not set"}</dd></div>
            <div><dt>Supplier cost</dt><dd>{pricing ? currency.format(pricing.supplierCostEstimate) : "Not set"}</dd></div>
            <div><dt>Margin</dt><dd>{pricing ? `${pricing.actualMarginPercent}%` : "Not set"}</dd></div>
            <div><dt>Internal note</dt><dd>{pricing?.pricingNotes ?? "Pricing not set"}</dd></div>
          </dl>
        </article>
      </section>
      <section className="card">
        <h2>Client details</h2>
        <dl className="meta-list">
          <div><dt>Company</dt><dd>{client?.company}</dd></div>
          <div><dt>Contact</dt><dd>{client?.name}</dd></div>
          <div><dt>Email</dt><dd>{client?.email}</dd></div>
          <div><dt>Phone</dt><dd>{client?.phone ?? "Not set"}</dd></div>
        </dl>
      </section>
        </>
      ) : null}
      {tab === "changes" ? (
      <section className="card form-panel">
        <h2>Add change request</h2>
        <form className="form-grid" onSubmit={handleChangeSubmit}>
          <label>Title<input value={changeForm.title} onChange={(e) => setChangeForm({ ...changeForm, title: e.target.value })} /></label>
          <label>Agency price optional<input min="0" type="number" value={changeForm.agencyPrice ?? ""} onChange={(e) => setChangeForm({ ...changeForm, agencyPrice: e.target.value ? Number(e.target.value) : undefined })} /></label>
          <label>Supplier cost optional<input min="0" type="number" value={changeForm.supplierCost ?? ""} onChange={(e) => setChangeForm({ ...changeForm, supplierCost: e.target.value ? Number(e.target.value) : undefined })} /></label>
          <label className="span-2">Description<textarea value={changeForm.description} onChange={(e) => setChangeForm({ ...changeForm, description: e.target.value })} /></label>
          <p className="form-note">New change requests start in agency review. If prices are empty, they remain visibly unpriced.</p>
          <div className="form-actions">
            <button className="primary-button" type="submit" disabled={isPending(changeKey)}>
              {isPending(changeKey) ? "Saving…" : "Add change request"}
            </button>
          </div>
          {getError(changeKey) ? <p className="form-error" role="alert">{getError(changeKey)}</p> : null}
          {getSuccess(changeKey) && !getError(changeKey) ? <p className="form-success">{getSuccess(changeKey)}</p> : null}
        </form>
      </section>
      ) : null}
      {tab === "scope" ? (
      <section className="card">
        <h2>Scope and scope items</h2>
        {scope ? (
          <>
            <p>{scope.clientFacingSummary}</p>
            <table>
              <thead><tr><th>Item</th><th>Phase</th><th>Client visible</th><th>Supplier visible</th></tr></thead>
              <tbody>{items.map((item) => (
                <tr key={item.id}>
                  <td>{item.title}</td><td>{item.phase}</td>
                  <td>{item.clientVisible ? "Yes" : "No"}</td><td>{item.supplierVisible ? "Yes" : "No"}</td>
                </tr>
              ))}</tbody>
            </table>
          </>
        ) : <p>No scope has been created for this project yet.</p>}
      </section>
      ) : null}
      {tab === "suppliers" ? (
        <>
      <section className="detail-grid">
        <article className="card">
          <h2>Assigned suppliers</h2>
          {activeProject.assignedSupplierIds.length ? (
            <table>
              <thead><tr><th>Supplier</th><th>Status</th><th>Skills</th><th>Actions</th></tr></thead>
              <tbody>
                {activeProject.assignedSupplierIds.map((supplierId) => {
                  const supplier = suppliers.find((item) => item.id === supplierId);
                  const profile = supplierProfiles.find((item) => item.supplierId === supplierId);
                  return (
                    <tr key={supplierId}>
                      <td>{supplier?.name ?? getSupplierName(supplierId, suppliers)}</td>
                      <td>{supplier?.status ?? "Unknown"}</td>
                      <td>{profile?.mainSkills.join(", ") ?? "Not set"}</td>
                      <td>
                        <button
                          type="button"
                          disabled={assignmentPending(supplierId)}
                          onClick={() => { void onSupplierAssignmentChange(activeProject.id, supplierId, false).catch(() => {}); }}
                        >{assignmentPending(supplierId) ? "…" : "Remove"}</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : <p>No supplier assigned yet.</p>}
          <form className="inline-form" onSubmit={handleSupplierAssign}>
            <label>Assign approved supplier
              <select value={supplierToAssign} onChange={(e) => setSupplierToAssign(e.target.value)}>
                <option value="">Select supplier</option>
                {assignableSuppliers.map((supplier) => {
                  const profile = supplierProfiles.find((item) => item.supplierId === supplier.id);
                  return <option key={supplier.id} value={supplier.id}>{supplier.name}{profile ? ` - ${profile.mainSkills.join(", ")}` : ""}</option>;
                })}
              </select>
            </label>
            <button type="submit" disabled={!supplierToAssign || assignmentPending(supplierToAssign)}>
              {assignmentPending(supplierToAssign) ? "Saving…" : "Assign"}
            </button>
          </form>
          {supplierToAssign && getError(MutationKeys.updateProjectSupplierAssignment(activeProject.id, supplierToAssign))
            ? <p className="form-error" role="alert">{getError(MutationKeys.updateProjectSupplierAssignment(activeProject.id, supplierToAssign))}</p>
            : null}
          <h3>Approved supplier pool</h3>
          {approvedSupplierRows.length ? (
            <table>
              <thead><tr><th>Supplier</th><th>Skills</th><th>Weekly availability</th><th>Assignment</th><th>Action</th></tr></thead>
              <tbody>
                {approvedSupplierRows.map(({ supplier, profile, assigned }) => (
                  <tr key={supplier.id}>
                    <td>{supplier.name}</td>
                    <td>{profile?.mainSkills.join(", ") ?? "Not set"}</td>
                    <td>{profile ? `${profile.weeklyAvailabilityHours}h` : "Not set"}</td>
                    <td><StatusBadge label={assigned ? "Assigned" : "Available"} tone={assigned ? "success" : "neutral"} /></td>
                    <td>
                      {assigned
                        ? <button
                            type="button"
                            disabled={assignmentPending(supplier.id)}
                            onClick={() => { void onSupplierAssignmentChange(activeProject.id, supplier.id, false).catch(() => {}); }}
                          >{assignmentPending(supplier.id) ? "…" : "Remove"}</button>
                        : <button
                            type="button"
                            disabled={assignmentPending(supplier.id)}
                            onClick={() => { void onSupplierAssignmentChange(activeProject.id, supplier.id, true).catch(() => {}); }}
                          >{assignmentPending(supplier.id) ? "…" : "Assign"}</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p>No approved suppliers are available for assignment yet.</p>}
          <p className="form-note">Only agency-approved suppliers can be assigned.</p>
        </article>
        <article className="card">
          <h2>Supplier time entries</h2>
          {projectTimeEntries.length ? (
            <table>
              <thead><tr><th>Supplier</th><th>Hours</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {projectTimeEntries.map((entry) => (
                  <tr key={entry.id}>
                    <td>{getSupplierName(entry.supplierId, suppliers)}</td>
                    <td>{entry.hours}</td>
                    <td><StatusBadge label={entry.status} tone={entry.status === "approved" ? "success" : "warning"} /></td>
                    <td>
                      {entry.status === "submitted" ? (
                        <div className="table-actions">
                          <button
                            type="button"
                            disabled={timeStatusPending(entry.id)}
                            onClick={() => { void onTimeEntryStatusChange(entry.id, "approved").catch(() => {}); }}
                          >{timeStatusPending(entry.id) ? "…" : "Approve"}</button>
                          <button
                            type="button"
                            disabled={timeStatusPending(entry.id)}
                            onClick={() => { void onTimeEntryStatusChange(entry.id, "rejected").catch(() => {}); }}
                          >{timeStatusPending(entry.id) ? "…" : "Reject"}</button>
                        </div>
                      ) : (entry.status === "approved" ? "Payable" : "Not payable")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p>No supplier time has been logged for this project.</p>}
        </article>
      </section>
      <section className="card form-panel">
        <h2>Add supplier time entry</h2>
        <form className="form-grid" onSubmit={handleTimeSubmit}>
          <label>Supplier
            <select value={timeForm.supplierId} onChange={(e) => setTimeForm({ ...timeForm, supplierId: e.target.value })}>
              <option value="">Select supplier</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label>Date<input type="date" value={timeForm.date} onChange={(e) => setTimeForm({ ...timeForm, date: e.target.value })} /></label>
          <label>Hours<input min="0.25" step="0.25" type="number" value={timeForm.hours} onChange={(e) => setTimeForm({ ...timeForm, hours: Number(e.target.value) })} /></label>
          <label className="span-2">Description<textarea value={timeForm.description} onChange={(e) => setTimeForm({ ...timeForm, description: e.target.value })} /></label>
          <p className="form-note">New time entries are submitted first. They are not payable until Yaniv approves them.</p>
          <div className="form-actions">
            <button className="primary-button" type="submit" disabled={isPending(timeKey)}>
              {isPending(timeKey) ? "Saving…" : "Add submitted time"}
            </button>
          </div>
          {getError(timeKey) ? <p className="form-error" role="alert">{getError(timeKey)}</p> : null}
          {getSuccess(timeKey) && !getError(timeKey) ? <p className="form-success">{getSuccess(timeKey)}</p> : null}
        </form>
      </section>
        </>
      ) : null}
      {tab === "changes" ? (
      <section className="card">
        <h2>Change requests</h2>
        {projectChanges.length ? (
          <table>
            <thead><tr><th>Request</th><th>Status</th><th>Agency price</th><th>Supplier cost</th><th>Work rule</th><th>Actions</th></tr></thead>
            <tbody>
              {projectChanges.map((request) => (
                <tr key={request.id}>
                  <td>{request.title}</td>
                  <td><StatusBadge label={request.status} tone={request.status === "client_approved" ? "success" : "warning"} /></td>
                  <td>{request.agencyPrice ? currency.format(request.agencyPrice) : "Needs pricing"}</td>
                  <td>{request.supplierCost ? currency.format(request.supplierCost) : "Not estimated"}</td>
                  <td>{request.status === "client_approved" ? "Can become work" : "Blocked until priced and approved"}</td>
                  <td>
                    <div className="table-actions">
                      {request.status === "agency_review" ? <button type="button" disabled={crStatusPending(request.id)} onClick={() => { void onChangeRequestStatusChange(request.id, "priced").catch(() => {}); }}>{crStatusPending(request.id) ? "…" : "Mark priced"}</button> : null}
                      {request.status === "priced" ? <button type="button" disabled={crStatusPending(request.id)} onClick={() => { void onChangeRequestStatusChange(request.id, "client_approved").catch(() => {}); }}>{crStatusPending(request.id) ? "…" : "Client approved"}</button> : null}
                      {request.status !== "declined" && request.status !== "client_approved" ? <button type="button" disabled={crStatusPending(request.id)} onClick={() => { void onChangeRequestStatusChange(request.id, "declined").catch(() => {}); }}>{crStatusPending(request.id) ? "…" : "Decline"}</button> : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p>No change requests for this project.</p>}
      </section>
      ) : null}
      {tab === "estimate" ? (
        <>
          <EstimateControl projectId={project.id} />
          <details className="advanced-commercial-details">
            <summary>הגדרות מסחריות ותאריכים מתקדמות</summary>
            <CommercialSettingsPanel project={activeProject} />
            <TargetDateForm project={activeProject} readOnly />
          </details>
        </>
      ) : null}
      {tab === "documents" ? <ProjectDocumentsPanel projectId={project.id} /> : null}
      {tab === "timeline" ? (
        <ProjectTimeline
          project={activeProject}
          changeRequests={changeRequests}
          clientPayments={clientPayments}
          timeEntries={timeEntries}
        />
      ) : null}
      {tab === "files" ? (
      <section className="detail-grid">
        <article className="card">
          <h2>Files and links</h2>
          {projectFiles.length ? projectFiles.map((f) => <p key={f.id}>{f.title} - {f.visibility}</p>) : <p>No files or links attached yet.</p>}
        </article>
        <article className="card">
          <h2>Decision log</h2>
          {projectDecisions.length ? projectDecisions.map((d) => <p key={d.id}>{d.decision} {d.impact}</p>) : <p>No decisions logged yet.</p>}
        </article>
      </section>
      ) : null}
    </>
  );
}
