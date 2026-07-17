import type { ReactNode } from "react";
import { PageHeader } from "../components/PageHeader";
import { StatCard } from "../components/StatCard";
import { StatusBadge } from "../components/StatusBadge";
import {
  getBlockedProjects,
  getNeedsPricingItems,
  getReadyToStartProjects,
  getSupplierTimeApprovalItems,
  getWaitingApprovalItems,
  getWaitingPaymentItems,
} from "../lib/actionQueue";
import { currency, getClient, getProjectById, getProjectName, getSupplierName, statusLabels } from "../lib/domainHelpers";
import type { ActivityEntry } from "../App";
import { scopes } from "../data/mockData";
import type { ChangeRequest, Client, ClientPayment, HourBank, Project, TimeEntry } from "../types/domain";

type ActionQueuePageProps = {
  clients: Client[];
  projects: Project[];
  changeRequests: ChangeRequest[];
  timeEntries: TimeEntry[];
  clientPayments: ClientPayment[];
  hourBanks: HourBank[];
  activityEntries: ActivityEntry[];
  onProjectSelect: (projectId: string) => void;
  onClientSelect: (clientId: string) => void;
  onPaymentReceived: (paymentId: string) => void;
  onTimeEntryStatusChange: (timeEntryId: string, status: "approved" | "rejected") => void;
  onChangeRequestStatusChange: (changeRequestId: string, status: "priced" | "client_approved" | "declined") => void;
  onResetSession: () => void;
};

function clientLabel(project: Project, clients: Client[]) {
  return getClient(project, clients)?.company ?? "Unknown client";
}

function QueueSection({ title, children, emptyText }: { title: string; children: ReactNode; emptyText: string }) {
  return (
    <section className="card queue-section">
      <h2>{title}</h2>
      {children || <p>{emptyText}</p>}
    </section>
  );
}

export function ActionQueuePage({
  clients,
  projects,
  changeRequests,
  timeEntries,
  clientPayments,
  hourBanks,
  activityEntries,
  onProjectSelect,
  onClientSelect,
  onPaymentReceived,
  onTimeEntryStatusChange,
  onChangeRequestStatusChange,
  onResetSession,
}: ActionQueuePageProps) {
  const needsPricing = getNeedsPricingItems(projects, changeRequests);
  const waitingApproval = getWaitingApprovalItems(projects, changeRequests);
  const waitingPayment = getWaitingPaymentItems(projects, clientPayments);
  const supplierTimeApprovals = getSupplierTimeApprovalItems(timeEntries);
  const blockedProjects = getBlockedProjects(projects);
  const readyProjects = getReadyToStartProjects(projects, scopes);

  return (
    <>
      <PageHeader title="Action Queue" subtitle="Yaniv's daily control screen for pricing, approvals, payments, supplier time, blocked work, and ready work." />
      <section className="card reset-panel">
        <div>
          <h2>Local session controls</h2>
          <p>Reset restores the mock seed data and clears current selections. It does not touch any backend.</p>
        </div>
        <button type="button" onClick={onResetSession}>Reset local session</button>
      </section>
      <section className="stats-grid">
        <StatCard label="Needs pricing" value={needsPricing.length} tone={needsPricing.length ? "warning" : "default"} />
        <StatCard label="Client approval" value={waitingApproval.length} tone={waitingApproval.length ? "warning" : "default"} />
        <StatCard label="Waiting payment" value={waitingPayment.length} tone={waitingPayment.length ? "warning" : "default"} />
        <StatCard label="Time approvals" value={supplierTimeApprovals.length} tone={supplierTimeApprovals.length ? "warning" : "default"} />
        <StatCard label="Blocked projects" value={blockedProjects.length} tone={blockedProjects.length ? "warning" : "default"} />
        <StatCard label="Ready to start" value={readyProjects.length} tone="success" />
      </section>

      <QueueSection title="Needs Yaniv Pricing" emptyText="No pricing work waiting right now.">
        {needsPricing.length ? (
          <table>
            <thead>
              <tr>
                <th>Project / client</th>
                <th>Needs pricing</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {needsPricing.map((item) => {
                const project = item.type === "project" ? item.project : getProjectById(item.changeRequest.projectId, projects);
                if (!project) return null;
                return (
                  <tr key={`${item.type}-${item.type === "project" ? item.project.id : item.changeRequest.id}`}>
                    <td>{project.name}<br /><span className="muted-text">{clientLabel(project, clients)}</span></td>
                    <td>{item.type === "project" ? "Project price needs setting" : item.changeRequest.title}</td>
                    <td><StatusBadge label={item.type === "project" ? statusLabels[project.status] : item.changeRequest.status} tone="warning" /></td>
                    <td>
                      <div className="table-actions">
                        <button type="button" onClick={() => onProjectSelect(project.id)}>Open project</button>
                        <button type="button" onClick={() => onClientSelect(project.clientId)}>Open client</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : null}
      </QueueSection>

      <QueueSection title="Waiting for Client Approval" emptyText="No client approvals waiting right now.">
        {waitingApproval.length ? (
          <table>
            <thead>
              <tr>
                <th>Project / client</th>
                <th>Needs approval</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {waitingApproval.map((item) => {
                const project = item.type === "project" ? item.project : getProjectById(item.changeRequest.projectId, projects);
                if (!project) return null;
                return (
                  <tr key={`${item.type}-${item.type === "project" ? item.project.id : item.changeRequest.id}`}>
                    <td>{project.name}<br /><span className="muted-text">{clientLabel(project, clients)}</span></td>
                    <td>{item.type === "project" ? "Project scope approval" : item.changeRequest.title}</td>
                    <td><StatusBadge label={item.type === "project" ? statusLabels[project.status] : item.changeRequest.status} tone="warning" /></td>
                    <td>
                      <div className="table-actions">
                        <button type="button" onClick={() => onProjectSelect(project.id)}>Open project</button>
                        <button type="button" onClick={() => onClientSelect(project.clientId)}>Open client</button>
                        {item.type === "change_request" ? (
                          <button type="button" onClick={() => onChangeRequestStatusChange(item.changeRequest.id, "client_approved")}>Mark client approved</button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : null}
      </QueueSection>

      <QueueSection title="Waiting for Payment" emptyText="No payment items waiting right now.">
        {waitingPayment.length ? (
          <table>
            <thead>
              <tr>
                <th>Project / client</th>
                <th>Amount</th>
                <th>Payment status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {waitingPayment.map((item, index) => {
                const project = item.type === "project" ? item.project : item.project;
                const payment = item.type === "project" ? item.payment : item.payment;
                if (!project) return null;
                return (
                  <tr key={`${item.type}-${project.id}-${payment?.id ?? index}`}>
                    <td>{project.name}<br /><span className="muted-text">{clientLabel(project, clients)}</span></td>
                    <td>{payment ? currency.format(payment.amount) : "Not set"}</td>
                    <td><StatusBadge label={payment?.status ?? statusLabels[project.status]} tone="warning" /></td>
                    <td>{payment && payment.status !== "received" ? <button type="button" onClick={() => onPaymentReceived(payment.id)}>Mark payment received</button> : <button type="button" onClick={() => onProjectSelect(project.id)}>Open project</button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : null}
      </QueueSection>

      <QueueSection title="Supplier Time Waiting Approval" emptyText="No supplier time waiting for approval.">
        {supplierTimeApprovals.length ? (
          <table>
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Project</th>
                <th>Hours</th>
                <th>Description</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {supplierTimeApprovals.map((entry) => (
                <tr key={entry.id}>
                  <td>{getSupplierName(entry.supplierId)}</td>
                  <td>{getProjectName(entry.projectId, projects)}</td>
                  <td>{entry.hours}</td>
                  <td>{entry.description}</td>
                  <td>
                    <div className="table-actions">
                      <button type="button" onClick={() => onTimeEntryStatusChange(entry.id, "approved")}>Approve</button>
                      <button type="button" onClick={() => onTimeEntryStatusChange(entry.id, "rejected")}>Reject</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </QueueSection>

      <section className="detail-grid">
        <QueueSection title="Blocked Work" emptyText="No blocked projects.">
          {blockedProjects.length ? (
            <table>
              <thead>
                <tr>
                  <th>Project / client</th>
                  <th>Reason</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {blockedProjects.map((project) => {
                  const hasHourBank = hourBanks.some((bank) => bank.clientId === project.clientId && bank.hoursRemaining > 0);
                  return (
                    <tr key={project.id}>
                      <td>{project.name}<br /><span className="muted-text">{clientLabel(project, clients)}</span></td>
                      <td>{hasHourBank ? "Payment gate still blocked despite available client hours" : "Payment not received or no hour bank available"}</td>
                      <td><button type="button" onClick={() => onProjectSelect(project.id)}>Open project</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : null}
        </QueueSection>

        <QueueSection title="Ready to Start" emptyText="No projects ready to start.">
          {readyProjects.length ? (
            <table>
              <thead>
                <tr>
                  <th>Project / client</th>
                  <th>Assigned suppliers</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {readyProjects.map((project) => (
                  <tr key={project.id}>
                    <td>{project.name}<br /><span className="muted-text">{clientLabel(project, clients)}</span></td>
                    <td>{project.assignedSupplierIds.map((supplierId) => getSupplierName(supplierId)).join(", ") || "No supplier assigned"}</td>
                    <td><button type="button" onClick={() => onProjectSelect(project.id)}>Open project</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </QueueSection>
      </section>

      <section className="rule-panel">
        <strong>Agency control rules</strong>
        <ul>
          <li>Work cannot start before payment is received or paid hours are available.</li>
          <li>Supplier time is not payable before Yaniv approves it.</li>
          <li>Change requests do not become work before pricing and client approval.</li>
          <li>AI can suggest later, but Yaniv remains the decision maker.</li>
        </ul>
      </section>

      <section className="card">
        <h2>Recent Activity</h2>
        {activityEntries.length ? (
          <div className="activity-list">
            {activityEntries.slice(0, 8).map((entry) => (
              <article className="activity-item" key={entry.id}>
                <div>
                  <strong>{entry.label}</strong>
                  <p>{entry.detail}</p>
                </div>
                <span>{entry.createdAt}</span>
              </article>
            ))}
          </div>
        ) : (
          <p>No local activity recorded yet. Use a workflow action to start the session trail.</p>
        )}
      </section>
    </>
  );
}
