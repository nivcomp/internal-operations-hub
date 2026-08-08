import { useMemo, useState, type FormEvent } from "react";
import { PageHeader } from "../components/PageHeader";
import { ProjectChat } from "../components/ProjectChat";
import ProjectInsights from "../components/ProjectInsights";
import { StatusBadge } from "../components/StatusBadge";
import { BudgetSimulator } from "../components/estimation/BudgetSimulator";
import { MutationKeys, useAppData } from "../context/AppDataContext";
import { TargetDateForm } from "../components/project/TargetDateForm";
import { ProposalPanel } from "../components/proposal/ProposalPanel";
import { ProjectDocumentsPanel } from "../components/project/ProjectDocumentsPanel";
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
};

const requestStatusLabels: Record<ChangeRequest["status"], string> = {
  requested: "With the agency",
  submitted: "With the agency",
  agency_review: "With the agency",
  priced: "Priced — your decision",
  client_approved: "Approved",
  declined: "Declined",
};

export function ClientPortalPage({
  selectedClientId, clients, projects, changeRequests, clientPayments, hourBanks, isPreview,
}: ClientPortalPageProps) {
  const {
    approvals, fileLinks, projectMessages, scopeItems, scopes,
    submitClientChangeRequest, updateApprovalStatus, updateChangeRequestStatus, createProjectMessage,
    isPending, getError, getSuccess,
  } = useAppData();

  const client = selectedClientId ? getClientById(selectedClientId, clients) : undefined;
  const clientProjects = useMemo(
    () => (client ? projects.filter((project) => project.clientId === client.id) : []),
    [client, projects],
  );
  const clientProjectIds = clientProjects.map((project) => project.id);

  const [activeProjectId, setActiveProjectId] = useState<string | undefined>();
  const project = clientProjects.find((item) => item.id === activeProjectId) ?? clientProjects[0];

  const [requestForm, setRequestForm] = useState({ title: "", description: "" });
  const [messageBody, setMessageBody] = useState("");

  if (!client) {
    return (
      <>
        <PageHeader title="Client Workspace" subtitle="Your projects, approvals, payments and requests in one place." />
        <section className="empty-state">
          <h2>No client workspace available</h2>
          <p>This account is not linked to a client record yet. Ask the agency to complete your access.</p>
        </section>
      </>
    );
  }

  if (!project) {
    return (
      <>
        <PageHeader title={`${client.company} workspace`} subtitle="Your projects, approvals, payments and requests in one place." />
        <section className="empty-state">
          <h2>No project exists for this client</h2>
          <p>Once the agency creates your first project it will appear here with scope, approvals and payment status.</p>
        </section>
      </>
    );
  }

  const approvalsForProject = approvals.filter((approval) => approval.projectId === project.id);
  const pendingApprovals = approvalsForProject.filter(
    (approval) => approval.status === "pending" && approval.approverRole === "client",
  );
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

  return (
    <>
      <PageHeader
        title={`${client.company} workspace`}
        subtitle={isPreview ? "Agency preview of exactly what this client can see." : "Your projects, approvals, payments and requests in one place."}
      />

      {clientProjects.length > 1 ? (
        <div className="filter-row">
          <label className="inline-label">
            Project
            <select value={project.id} onChange={(event) => setActiveProjectId(event.target.value)}>
              {clientProjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
        </div>
      ) : null}

      <section className="card">
        <h2>{project.name}</h2>
        <p className="muted-text">{project.summary}</p>
        <dl className="meta-list">
          <div><dt>Status</dt><dd><StatusBadge label={statusLabels[project.status]} tone={canWorkStart(project, scopes) ? "success" : "warning"} /></dd></div>
          <div><dt>Work readiness</dt><dd>{canWorkStart(project, scopes) ? "Ready to start" : "Waiting for approval, payment or paid hours"}</dd></div>
          <div><dt>Open requests</dt><dd>{requests.filter((r) => r.status !== "declined" && r.status !== "client_approved").length}</dd></div>
          <div><dt>Pending approvals</dt><dd>{pendingApprovals.length}</dd></div>
        </dl>
      </section>

      <ProjectChat
        projectId={project.id}
        projectName={project.name}
        agent="project_guide"
        title="Project Guide"
        subtitle="Explain what you need in your own words. The guide asks one question at a time and builds a draft for the agency to review."
        readOnly={isPreview}
        readOnlyReason="Preview mode — you are still signed in as agency admin, so sending as the client is disabled."
        suggestions={["Start a new project", "מה חסר כדי להתקדם?", "Show me the project flow", "Summarise what we agreed so far"]}
        safetyNotice="This assistant only answers questions about this project. Conversations are recorded and monitored by the agency, and fair-use limits apply."
      />

      <ProjectInsights projectId={project.id} role="client" />

      <ProjectDocumentsPanel projectId={project.id} readOnly />

      <ProposalPanel projectId={project.id} mode="client" readOnly={isPreview} />

      <BudgetSimulator projectId={project.id} clientId={client.id} readOnly={isPreview} />
      <TargetDateForm project={project} readOnly={isPreview} />
      <section className="card">
        <h2>Approvals</h2>
        {approvalsForProject.length === 0 ? (
          <p className="muted-text">Nothing needs your approval right now.</p>
        ) : (
          <table>
            <thead>
              <tr><th>Scope</th><th>Status</th><th>Notes</th><th>Approved</th><th /></tr>
            </thead>
            <tbody>
              {approvalsForProject.map((approval) => {
                const scope = scopes.find((item) => item.id === approval.scopeId);
                const key = MutationKeys.updateApprovalStatus(approval.id);
                const decidable = approval.status === "pending" && approval.approverRole === "client";
                return (
                  <tr key={approval.id}>
                    <td>{scope ? `v${scope.version}` : "Scope"}</td>
                    <td><StatusBadge label={approval.status} tone={approval.status === "approved" ? "success" : approval.status === "rejected" ? "danger" : "warning"} /></td>
                    <td>{approval.notes || "—"}</td>
                    <td>{approval.approvedDate ?? "Pending"}</td>
                    <td>
                      {decidable ? (
                        <div className="action-row compact">
                          <button type="button" disabled={isPending(key)} onClick={() => void updateApprovalStatus(approval.id, "approved")}>
                            {isPending(key) ? "Saving…" : "Approve"}
                          </button>
                          <button type="button" disabled={isPending(key)} onClick={() => void updateApprovalStatus(approval.id, "rejected")}>
                            Decline
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
        <h2>Approved scope</h2>
        {approvedScopes.length === 0 ? (
          <p className="muted-text">No scope has been approved yet.</p>
        ) : (
          approvedScopes.map((scope) => (
            <div key={scope.id} className="scope-block">
              <h3>Version {scope.version}</h3>
              <p>{scope.clientFacingSummary}</p>
            </div>
          ))
        )}
        {visibleScopeItems.length ? (
          <table>
            <thead><tr><th>Phase</th><th>Item</th><th>Acceptance</th></tr></thead>
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
          <h2>Payment requests</h2>
          {paymentsForProject.length === 0 ? (
            <p className="muted-text">No payment has been requested for this project.</p>
          ) : (
            <table>
              <thead><tr><th>Amount</th><th>Status</th><th>Due</th><th>Notes</th></tr></thead>
              <tbody>
                {paymentsForProject.map((payment) => (
                  <tr key={payment.id}>
                    <td>{currency.format(payment.amount)}</td>
                    <td><StatusBadge label={payment.status} tone={payment.status === "received" ? "success" : "warning"} /></td>
                    <td>{payment.dueDate ?? "Not set"}</td>
                    <td>{payment.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </article>
        <article className="card">
          <h2>Paid hours</h2>
          {banks.length === 0 ? (
            <p className="muted-text">You do not have a paid-hour balance.</p>
          ) : (
            <table>
              <thead><tr><th>Purchased</th><th>Used</th><th>Remaining</th><th>Expiry</th></tr></thead>
              <tbody>
                {banks.map((bank) => (
                  <tr key={bank.id}>
                    <td>{bank.hoursPurchased} hrs</td>
                    <td>{bank.hoursUsed} hrs</td>
                    <td>{bank.hoursRemaining} hrs</td>
                    <td>{bank.expiryDate ?? "No expiry"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </article>
      </section>

      <section className="card">
        <h2>Change requests</h2>
        {requests.length === 0 ? (
          <p className="muted-text">No change requests yet. Use the form below to ask for a change.</p>
        ) : (
          <table>
            <thead><tr><th>Request</th><th>Status</th><th>Price</th><th /></tr></thead>
            <tbody>
              {requests.map((request) => {
                const key = MutationKeys.updateChangeRequestStatus(request.id);
                return (
                  <tr key={request.id}>
                    <td><strong>{request.title}</strong><br />{request.description}</td>
                    <td><StatusBadge label={requestStatusLabels[request.status]} tone={request.status === "client_approved" ? "success" : request.status === "declined" ? "danger" : "warning"} /></td>
                    <td>{request.agencyPrice != null ? currency.format(request.agencyPrice) : "Awaiting pricing"}</td>
                    <td>
                      {request.status === "priced" ? (
                        <div className="action-row compact">
                          <button type="button" disabled={isPending(key)} onClick={() => void updateChangeRequestStatus(request.id, "client_approved")}>
                            {isPending(key) ? "Saving…" : "Approve"}
                          </button>
                          <button type="button" disabled={isPending(key)} onClick={() => void updateChangeRequestStatus(request.id, "declined")}>
                            Decline
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
            What would you like to change?
            <input value={requestForm.title} onChange={(e) => setRequestForm({ ...requestForm, title: e.target.value })} />
          </label>
          <label className="span-2">
            Details
            <textarea value={requestForm.description} onChange={(e) => setRequestForm({ ...requestForm, description: e.target.value })} />
          </label>
          <div className="form-actions">
            <button className="primary-button" type="submit" disabled={isPending(requestKey)}>
              {isPending(requestKey) ? "Sending…" : "Submit change request"}
            </button>
          </div>
          {getError(requestKey) ? <p className="form-error" role="alert">{getError(requestKey)}</p> : null}
          {getSuccess(requestKey) && !getError(requestKey) ? <p className="form-success">{getSuccess(requestKey)}</p> : null}
        </form>
        <p className="muted-text">The agency reviews and prices every request before it becomes work.</p>
      </section>

      <section className="card">
        <h2>Files</h2>
        {files.length === 0 ? (
          <p className="muted-text">No files have been shared with you yet.</p>
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
        <h2>Messages</h2>
        {messages.length === 0 ? (
          <p className="muted-text">No messages yet.</p>
        ) : (
          <div className="message-list">
            {messages.map((message) => (
              <div key={message.id} className="message-item">
                <div><strong>{message.authorRole === "client" ? "You" : "Agency"}</strong><p>{message.body}</p></div>
                <span>{message.createdDate}</span>
              </div>
            ))}
          </div>
        )}
        <form className="form-grid" onSubmit={handleMessageSubmit}>
          <label className="span-2">
            Send a message to the agency
            <textarea value={messageBody} onChange={(e) => setMessageBody(e.target.value)} />
          </label>
          <div className="form-actions">
            <button className="primary-button" type="submit" disabled={isPending(messageKey)}>
              {isPending(messageKey) ? "Sending…" : "Send message"}
            </button>
          </div>
          {getError(messageKey) ? <p className="form-error" role="alert">{getError(messageKey)}</p> : null}
        </form>
      </section>
    </>
  );
}
