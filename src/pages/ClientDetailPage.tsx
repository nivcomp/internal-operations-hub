import { type FormEvent, useState } from "react";
import type { NewProjectInput } from "../App";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { canWorkStart, currency, getClientById, getProjectsForClient, statusLabels } from "../lib/domainHelpers";
import type { ChangeRequest, Client, ClientPayment, HourBank, Project } from "../types/domain";

type ClientDetailPageProps = {
  selectedClientId?: string;
  clients: Client[];
  projects: Project[];
  changeRequests: ChangeRequest[];
  clientPayments: ClientPayment[];
  hourBanks: HourBank[];
  onProjectCreate: (clientId: string, input: NewProjectInput) => void;
  onProjectSelect: (projectId: string) => void;
  onClientPortalOpen: (clientId: string) => void;
};

function getWaitingOn(projectStatus: string, paymentStatus?: string) {
  if (projectStatus === "waiting_for_agency_pricing") return "Yaniv";
  if (projectStatus === "waiting_for_client_approval") return "Client";
  if (projectStatus === "waiting_for_payment" || paymentStatus === "requested" || paymentStatus === "overdue") return "Payment";
  return "Active monitoring";
}

const initialProjectForm: NewProjectInput = {
  name: "",
  summary: "",
  budgetSignal: "",
};

export function ClientDetailPage({
  selectedClientId,
  clients,
  projects,
  changeRequests,
  clientPayments,
  hourBanks,
  onProjectCreate,
  onProjectSelect,
  onClientPortalOpen,
}: ClientDetailPageProps) {
  const [projectForm, setProjectForm] = useState<NewProjectInput>(initialProjectForm);
  const client = selectedClientId ? getClientById(selectedClientId, clients) : undefined;

  if (!client) {
    return (
      <>
        <PageHeader title="Client Detail" subtitle="Select a client from the Clients page to inspect projects, payments, hour banks, and open requests." />
        <section className="empty-state">
          <h2>No client selected</h2>
          <p>Open the Clients page and choose a client row.</p>
        </section>
      </>
    );
  }

  const activeClient = client;
  const clientProjects = getProjectsForClient(activeClient.id, projects);
  const clientProjectIds = clientProjects.map((project) => project.id);
  const clientHourBanks = hourBanks.filter((bank) => bank.clientId === activeClient.id);
  const openChangeRequests = changeRequests.filter(
    (request) => clientProjectIds.includes(request.projectId) && request.status !== "declined" && request.status !== "client_approved",
  );

  function handleProjectSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!projectForm.name.trim() || !projectForm.summary.trim()) return;
    onProjectCreate(activeClient.id, {
      name: projectForm.name.trim(),
      summary: projectForm.summary.trim(),
      budgetSignal: projectForm.budgetSignal.trim() || "Unknown",
    });
    setProjectForm(initialProjectForm);
  }

  return (
    <>
      <PageHeader title="Client Detail" subtitle="A focused client workspace for Yaniv to see project state, blockers, payments, paid hours, and requests." />
      <section className="detail-grid">
        <article className="card">
          <h2>{activeClient.company}</h2>
          <dl className="meta-list">
            <div><dt>Contact</dt><dd>{activeClient.name}</dd></div>
            <div><dt>Email</dt><dd>{activeClient.email}</dd></div>
            <div><dt>Phone</dt><dd>{activeClient.phone ?? "Not set"}</dd></div>
            <div><dt>Status</dt><dd><StatusBadge label={activeClient.status} tone={activeClient.status === "lead" ? "warning" : "success"} /></dd></div>
          </dl>
        </article>
        <article className="card">
          <h2>Notes</h2>
          <p>{activeClient.notes}</p>
          <div className="action-row">
            <button className="primary-button" type="button" onClick={() => onClientPortalOpen(activeClient.id)}>
              Open client portal
            </button>
          </div>
        </article>
      </section>

      <section className="card">
        <h2>Projects</h2>
        <table>
          <thead>
            <tr>
              <th>Project</th>
              <th>Status</th>
              <th>Payment</th>
              <th>Start gate</th>
              <th>Waiting on</th>
            </tr>
          </thead>
          <tbody>
            {clientProjects.map((project) => {
              const payment = clientPayments.find((item) => item.projectId === project.id);
              return (
                <tr key={project.id} className="clickable-row" onClick={() => onProjectSelect(project.id)}>
                  <td>{project.name}</td>
                  <td><StatusBadge label={statusLabels[project.status]} tone={canWorkStart(project) ? "success" : "warning"} /></td>
                  <td>{payment?.status ?? "Not due"}</td>
                  <td>{canWorkStart(project) ? "Ready" : "Blocked"}</td>
                  <td>{getWaitingOn(project.status, payment?.status)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="card form-panel">
        <h2>Create project for this client</h2>
        <form className="form-grid" onSubmit={handleProjectSubmit}>
          <label>
            Project name
            <input value={projectForm.name} onChange={(event) => setProjectForm({ ...projectForm, name: event.target.value })} />
          </label>
          <label>
            Budget signal
            <input value={projectForm.budgetSignal} onChange={(event) => setProjectForm({ ...projectForm, budgetSignal: event.target.value })} />
          </label>
          <label className="span-2">
            Summary
            <textarea value={projectForm.summary} onChange={(event) => setProjectForm({ ...projectForm, summary: event.target.value })} />
          </label>
          <div className="form-actions">
            <button className="primary-button" type="submit">Create and open project</button>
          </div>
        </form>
      </section>

      <section className="detail-grid">
        <article className="card">
          <h2>Payments</h2>
          <table>
            <thead>
              <tr>
                <th>Project</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {clientPayments
                .filter((payment) => clientProjectIds.includes(payment.projectId))
                .map((payment) => {
                  const project = clientProjects.find((item) => item.id === payment.projectId);
                  return (
                    <tr key={payment.id}>
                      <td>{project?.name}</td>
                      <td>{currency.format(payment.amount)}</td>
                      <td><StatusBadge label={payment.status} tone={payment.status === "received" ? "success" : "warning"} /></td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </article>
        <article className="card">
          <h2>Hour banks</h2>
          {clientHourBanks.length ? (
            <table>
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Purchased</th>
                  <th>Remaining</th>
                </tr>
              </thead>
              <tbody>
                {clientHourBanks.map((bank) => {
                  const project = clientProjects.find((item) => item.id === bank.projectId);
                  return (
                    <tr key={bank.id}>
                      <td>{project?.name ?? "General"}</td>
                      <td>{bank.hoursPurchased} hrs</td>
                      <td>{bank.hoursRemaining} hrs</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p>No paid hour bank for this client yet.</p>
          )}
        </article>
      </section>

      <section className="card">
        <h2>Open change requests</h2>
        {openChangeRequests.length ? (
          <table>
            <thead>
              <tr>
                <th>Request</th>
                <th>Project</th>
                <th>Status</th>
                <th>Rule</th>
              </tr>
            </thead>
            <tbody>
              {openChangeRequests.map((request) => {
                const project = clientProjects.find((item) => item.id === request.projectId);
                return (
                  <tr key={request.id}>
                    <td>{request.title}</td>
                    <td>{project?.name}</td>
                    <td><StatusBadge label={request.status} tone="warning" /></td>
                    <td>Needs agency pricing and client approval before work starts</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p>No open change requests for this client.</p>
        )}
      </section>
    </>
  );
}
