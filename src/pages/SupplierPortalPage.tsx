import { useState, type FormEvent } from "react";
import { PageHeader } from "../components/PageHeader";
import { ProjectChat } from "../components/ProjectChat";
import ProjectInsights from "../components/ProjectInsights";
import { StatusBadge } from "../components/StatusBadge";
import { SupplierEstimateReview } from "../components/estimation/SupplierEstimateReview";
import { MutationKeys, useAppData } from "../context/AppDataContext";
import { formatDate } from "../lib/scheduling";
import { canWorkStart, formatRate, getProjectName, statusLabels } from "../lib/domainHelpers";
import type { Project, TimeEntry } from "../types/domain";

type SupplierPortalPageProps = {
  selectedSupplierId?: string;
  projects: Project[];
  timeEntries: TimeEntry[];
  /** True when an agency admin is previewing the portal. */
  isPreview: boolean;
};

const todayIso = () => new Date().toISOString().slice(0, 10);

export function SupplierPortalPage({ selectedSupplierId, projects, timeEntries, isPreview }: SupplierPortalPageProps) {
  const {
    fileLinks, projectMessages, scopeItems, scopes, supplierProfiles, suppliers, projectSchedules,
    createTimeEntry, updateTimeEntry, createProjectMessage, isPending, getError,
  } = useAppData();

  const supplier = suppliers.find((item) => item.id === selectedSupplierId);
  const [logForm, setLogForm] = useState({ projectId: "", date: todayIso(), hours: "", description: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ date: "", hours: "", description: "" });
  const [messageForm, setMessageForm] = useState({ projectId: "", body: "" });
  const [chatProjectId, setChatProjectId] = useState<string>("");

  if (!supplier) {
    return (
      <>
        <PageHeader title="Supplier Workspace" subtitle="Assigned work, your time entries and what you are owed." />
        <section className="empty-state">
          <h2>No supplier workspace available</h2>
          <p>This account is not linked to a supplier record yet. Ask the agency to complete your access.</p>
        </section>
      </>
    );
  }

  const assigned = projects.filter((project) => project.assignedSupplierIds.includes(supplier.id));
  const assignedIds = assigned.map((project) => project.id);
  const profile = supplierProfiles.find((item) => item.supplierId === supplier.id);
  const myEntries = timeEntries
    .filter((entry) => entry.supplierId === supplier.id)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date));
  const approvedEntries = myEntries.filter((entry) => entry.status === "approved");
  const approvedHours = approvedEntries.reduce((total, entry) => total + entry.hours, 0);
  const waitingHours = myEntries.filter((e) => e.status !== "approved").reduce((t, e) => t + e.hours, 0);
  const rate = profile?.hourlyRate ?? 0;

  const files = fileLinks.filter((f) => assignedIds.includes(f.projectId) && f.visibility === "supplier_visible");
  const messages = projectMessages
    .filter((m) => assignedIds.includes(m.projectId) && m.visibility === "supplier_visible")
    .slice()
    .sort((a, b) => a.createdDate.localeCompare(b.createdDate));
  const items = scopeItems
    .map((item) => ({ item, scope: scopes.find((s) => s.id === item.scopeId) }))
    .filter(({ item, scope }) => item.supplierVisible && scope && assignedIds.includes(scope.projectId));

  const logKey = MutationKeys.createTimeEntry(logForm.projectId || "none");
  const messageKey = MutationKeys.createProjectMessage(messageForm.projectId || "none");

  async function handleLog(event: FormEvent) {
    event.preventDefault();
    const hours = Number(logForm.hours);
    if (!logForm.projectId || !Number.isFinite(hours) || hours <= 0 || isPending(logKey)) return;
    try {
      await createTimeEntry(logForm.projectId, {
        supplierId: supplier!.id,
        date: logForm.date,
        hours,
        description: logForm.description.trim(),
      });
      setLogForm({ projectId: logForm.projectId, date: todayIso(), hours: "", description: "" });
    } catch { /* values kept for retry */ }
  }

  function startEdit(entry: TimeEntry) {
    setEditingId(entry.id);
    setEditForm({ date: entry.date, hours: String(entry.hours), description: entry.description });
  }

  async function saveEdit(entryId: string) {
    const hours = Number(editForm.hours);
    if (!Number.isFinite(hours) || hours <= 0) return;
    try {
      await updateTimeEntry(entryId, { date: editForm.date, hours, description: editForm.description.trim() });
      setEditingId(null);
    } catch { /* keep the editor open for retry */ }
  }

  async function handleMessage(event: FormEvent) {
    event.preventDefault();
    if (!messageForm.projectId || !messageForm.body.trim() || isPending(messageKey)) return;
    try {
      await createProjectMessage(messageForm.projectId, messageForm.body.trim(), "supplier_visible", "supplier");
      setMessageForm({ projectId: messageForm.projectId, body: "" });
    } catch { /* value kept for retry */ }
  }

  return (
    <>
      <PageHeader
        title={`${supplier.name} workspace`}
        subtitle={isPreview
          ? "Agency preview of exactly what this supplier can see. Client price and margin are never shown."
          : "Your assigned work, time entries and payment status."}
      />

      <section className="stats-grid">
        <article className="stat-card"><span>Assigned projects</span><strong>{assigned.length}</strong></article>
        <article className="stat-card"><span>Approved hours</span><strong>{approvedHours} hrs</strong></article>
        <article className="stat-card"><span>Hours awaiting approval</span><strong>{waitingHours} hrs</strong></article>
        <article className="stat-card">
          <span>Approved value</span>
          <strong>{profile ? formatRate(approvedHours * rate, profile.currency) : "Rate not set"}</strong>
        </article>
      </section>

      <section className="card">
        <h2>Assigned work</h2>
        {assigned.length === 0 ? (
          <p className="muted-text">You have no assigned projects yet. The agency will assign work here.</p>
        ) : (
          <table>
            <thead><tr><th>Project</th><th>Status</th><th>Can I start?</th><th>Agency delivery target</th></tr></thead>
            <tbody>
              {assigned.map((project) => {
                const schedule = projectSchedules.find((s) => s.projectId === project.id);
                return (
                <tr key={project.id}>
                  <td>{project.name}</td>
                  <td><StatusBadge label={statusLabels[project.status]} tone={canWorkStart(project, scopes) ? "success" : "warning"} /></td>
                  <td>{canWorkStart(project, scopes) ? "Yes — approved and funded" : "Not yet — waiting on the agency"}</td>
                  <td>{formatDate(schedule?.approvedDeliveryDate ?? schedule?.recommendedDeliveryEnd ?? null)}</td>
                </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {assigned.length > 0 && (() => {
        const chatProject = assigned.find((p) => p.id === chatProjectId) ?? assigned[0];
        return (
          <>
            {assigned.length > 1 && (
              <div className="filter-row">
                <label className="inline-label">
                  Work Assistant project
                  <select value={chatProject.id} onChange={(event) => setChatProjectId(event.target.value)}>
                    {assigned.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </label>
              </div>
            )}
            <ProjectChat
              projectId={chatProject.id}
              projectName={chatProject.name}
              agent="work_assistant"
              title="Work Assistant"
              subtitle="Ask about your assigned work, acceptance criteria, blockers and time. Client price and margin are never part of this workspace."
              readOnly={isPreview}
              readOnlyReason="Preview mode — you are still signed in as agency admin, so sending as the supplier is disabled."
              suggestions={["Explain the acceptance criteria", "Draft my progress report", "Show me the project flow"]}
              safetyNotice="This assistant only covers your assigned work on this project. Conversations are recorded and monitored by the agency, and fair-use limits apply."
            />
            <ProjectInsights projectId={chatProject.id} role="supplier" supplierId={supplier.id} />
          </>
        );
      })()}

      <SupplierEstimateReview supplierId={supplier.id} readOnly={isPreview} />
      <section className="card">
        <h2>Delivery instructions</h2>
        {items.length === 0 ? (
          <p className="muted-text">No scope items have been shared with you yet.</p>
        ) : (
          <table>
            <thead><tr><th>Project</th><th>Phase</th><th>Item</th><th>Acceptance</th></tr></thead>
            <tbody>
              {items.map(({ item, scope }) => (
                <tr key={item.id}>
                  <td>{scope ? getProjectName(scope.projectId, projects) : "Project"}</td>
                  <td>{item.phase}</td>
                  <td><strong>{item.title}</strong><br />{item.description}</td>
                  <td>{item.acceptanceNotes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card">
        <h2>Log time</h2>
        {assigned.length === 0 ? (
          <p className="muted-text">You can log time once a project is assigned to you.</p>
        ) : (
          <form className="form-grid" onSubmit={handleLog}>
            <label>
              Project
              <select value={logForm.projectId} onChange={(e) => setLogForm({ ...logForm, projectId: e.target.value })}>
                <option value="">Select a project…</option>
                {assigned.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
              </select>
            </label>
            <label>
              Date
              <input type="date" value={logForm.date} onChange={(e) => setLogForm({ ...logForm, date: e.target.value })} />
            </label>
            <label>
              Hours
              <input type="number" min="0.25" step="0.25" value={logForm.hours} onChange={(e) => setLogForm({ ...logForm, hours: e.target.value })} />
            </label>
            <label className="span-2">
              What did you work on?
              <textarea value={logForm.description} onChange={(e) => setLogForm({ ...logForm, description: e.target.value })} />
            </label>
            <div className="form-actions">
              <button className="primary-button" type="submit" disabled={isPending(logKey)}>
                {isPending(logKey) ? "Saving…" : "Submit time entry"}
              </button>
            </div>
            {getError(logKey) ? <p className="form-error" role="alert">{getError(logKey)}</p> : null}
          </form>
        )}
      </section>

      <section className="card">
        <h2>My time entries</h2>
        {myEntries.length === 0 ? (
          <p className="muted-text">No time logged yet.</p>
        ) : (
          <table>
            <thead><tr><th>Project</th><th>Date</th><th>Hours</th><th>Description</th><th>Status</th><th /></tr></thead>
            <tbody>
              {myEntries.map((entry) => {
                const key = MutationKeys.updateTimeEntry(entry.id);
                const editable = entry.status !== "approved";
                if (editingId === entry.id) {
                  return (
                    <tr key={entry.id}>
                      <td>{getProjectName(entry.projectId, projects)}</td>
                      <td><input type="date" value={editForm.date} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} /></td>
                      <td><input type="number" min="0.25" step="0.25" value={editForm.hours} onChange={(e) => setEditForm({ ...editForm, hours: e.target.value })} /></td>
                      <td><input value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} /></td>
                      <td><StatusBadge label={entry.status} tone="warning" /></td>
                      <td>
                        <div className="action-row compact">
                          <button type="button" disabled={isPending(key)} onClick={() => void saveEdit(entry.id)}>
                            {isPending(key) ? "Saving…" : "Save"}
                          </button>
                          <button type="button" onClick={() => setEditingId(null)}>Cancel</button>
                          {getError(key) ? <span className="form-error">{getError(key)}</span> : null}
                        </div>
                      </td>
                    </tr>
                  );
                }
                return (
                  <tr key={entry.id}>
                    <td>{getProjectName(entry.projectId, projects)}</td>
                    <td>{entry.date}</td>
                    <td>{entry.hours}</td>
                    <td>{entry.description}</td>
                    <td><StatusBadge label={entry.status} tone={entry.status === "approved" ? "success" : entry.status === "rejected" ? "danger" : "warning"} /></td>
                    <td>{editable ? <button type="button" onClick={() => startEdit(entry)}>Edit</button> : "Locked"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <p className="muted-text">Approved time becomes payable. Entries can be edited until the agency approves them.</p>
      </section>

      <section className="card">
        <h2>Files and links</h2>
        {files.length === 0 ? (
          <p className="muted-text">No files have been shared with you yet.</p>
        ) : (
          <ul className="link-list">
            {files.map((file) => (
              <li key={file.id}>
                <a href={file.url} target="_blank" rel="noreferrer">{file.title}</a>
                <span className="muted-text"> · {getProjectName(file.projectId, projects)} · {file.fileType}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2>Messages</h2>
        {messages.length === 0 ? (
          <p className="muted-text">No messages yet.</p>
        ) : (
          <div className="message-list">
            {messages.map((message) => (
              <div key={message.id} className="message-item">
                <div>
                  <strong>{message.authorRole === "supplier" ? "You" : "Agency"} · {getProjectName(message.projectId, projects)}</strong>
                  <p>{message.body}</p>
                </div>
                <span>{message.createdDate}</span>
              </div>
            ))}
          </div>
        )}
        {assigned.length ? (
          <form className="form-grid" onSubmit={handleMessage}>
            <label>
              Project
              <select value={messageForm.projectId} onChange={(e) => setMessageForm({ ...messageForm, projectId: e.target.value })}>
                <option value="">Select a project…</option>
                {assigned.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
              </select>
            </label>
            <label className="span-2">
              Message to the agency
              <textarea value={messageForm.body} onChange={(e) => setMessageForm({ ...messageForm, body: e.target.value })} />
            </label>
            <div className="form-actions">
              <button className="primary-button" type="submit" disabled={isPending(messageKey)}>
                {isPending(messageKey) ? "Sending…" : "Send message"}
              </button>
            </div>
            {getError(messageKey) ? <p className="form-error" role="alert">{getError(messageKey)}</p> : null}
          </form>
        ) : null}
      </section>
    </>
  );
}