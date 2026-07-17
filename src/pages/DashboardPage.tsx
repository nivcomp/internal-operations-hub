import { useMemo } from "react";
import { PageHeader } from "../components/PageHeader";
import { RulePanel } from "../components/RulePanel";
import { StatCard } from "../components/StatCard";
import { StatusBadge } from "../components/StatusBadge";
import { supplierPayments } from "../data/mockData";
import { canWorkStart, currency, getClient, marginAmount, statusLabels } from "../lib/domainHelpers";
import type { ChangeRequest, Client, Project, TimeEntry } from "../types/domain";
import type { ActivityEntry } from "../App";
import type { ViewKey } from "../views";

type DashboardPageProps = {
  clients: Client[];
  projects: Project[];
  changeRequests: ChangeRequest[];
  timeEntries: TimeEntry[];
  activityEntries: ActivityEntry[];
  onNavigate: (view: ViewKey) => void;
  onProjectSelect: (projectId: string) => void;
};

export function DashboardPage({
  clients,
  projects,
  changeRequests,
  timeEntries,
  activityEntries,
  onNavigate,
  onProjectSelect,
}: DashboardPageProps) {
  const metrics = useMemo(() => {
    const totals = marginAmount();
    return {
      newLeads: clients.filter((client) => client.status === "lead").length,
      waitingPricing: projects.filter((project) => project.status === "waiting_for_agency_pricing").length,
      waitingApproval: projects.filter((project) => project.status === "waiting_for_client_approval").length,
      waitingPayment: projects.filter((project) => project.status === "waiting_for_payment").length,
      activeProjects: projects.filter((project) => ["paid_ready_to_start", "assigned_to_supplier", "in_development"].includes(project.status)).length,
      supplierTimeWaiting: timeEntries.filter((entry) => entry.status === "submitted").length,
      openChanges: changeRequests.filter((request) => request.status !== "declined" && request.status !== "client_approved").length,
      supplierOwed: supplierPayments.reduce((sum, payment) => sum + payment.amountOwed - payment.amountPaid, 0),
      ...totals,
    };
  }, [clients, projects, changeRequests, timeEntries]);

  const projectsNeedingAttention = projects.filter(
    (project) =>
      !canWorkStart(project) ||
      ["waiting_for_agency_pricing", "waiting_for_client_approval"].includes(project.status),
  );

  const marginPercent = metrics.revenue
    ? Math.round((metrics.margin / metrics.revenue) * 100)
    : 0;

  return (
    <>
      <PageHeader
        title="Agency Dashboard"
        subtitle="A control room for Yaniv's clients, scope, pricing, paid hours, suppliers, and delivery risk."
      />

      <p className="section-eyebrow">Priority operations</p>
      <section className="stats-grid stats-grid-primary">
        <StatCard
          label="Waiting for pricing"
          value={metrics.waitingPricing}
          tone={metrics.waitingPricing > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Waiting for client approval"
          value={metrics.waitingApproval}
          tone={metrics.waitingApproval > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Waiting for payment"
          value={metrics.waitingPayment}
          tone={metrics.waitingPayment > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Supplier time waiting"
          value={metrics.supplierTimeWaiting}
          tone={metrics.supplierTimeWaiting > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Active projects"
          value={metrics.activeProjects}
          tone={metrics.activeProjects > 0 ? "success" : "default"}
        />
        <StatCard label="Open change requests" value={metrics.openChanges} />
      </section>

      <section className="card dashboard-attention">
        <h2>Projects needing attention</h2>
        {projectsNeedingAttention.length === 0 ? (
          <p className="muted-text">Nothing is currently blocked. Everything ready to start has moved forward.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Project</th>
                <th>Client</th>
                <th>Status</th>
                <th>Start gate</th>
              </tr>
            </thead>
            <tbody>
              {projectsNeedingAttention.map((project) => (
                <tr key={project.id} className="clickable-row" onClick={() => onProjectSelect(project.id)}>
                  <td>{project.name}</td>
                  <td>{getClient(project, clients)?.company}</td>
                  <td><StatusBadge label={statusLabels[project.status]} tone="warning" /></td>
                  <td>{canWorkStart(project) ? "Ready" : "Blocked until payment or hours"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <div className="two-column dashboard-secondary">
        <section className="card">
          <h2>Recent activity</h2>
          {activityEntries.length === 0 ? (
            <p className="muted-text">Actions you take across the app will appear here.</p>
          ) : (
            <div className="activity-list">
              {activityEntries.slice(0, 6).map((entry) => (
                <div key={entry.id} className="activity-item">
                  <div>
                    <strong>{entry.label}</strong>
                    <p>{entry.detail}</p>
                  </div>
                  <span>{entry.createdAt}</span>
                </div>
              ))}
            </div>
          )}
        </section>
        <section className="card quick-actions">
          <h2>Quick actions</h2>
          <div className="quick-actions-list">
            <button type="button" onClick={() => onNavigate("action-queue")}>Open action queue</button>
            <button type="button" onClick={() => onNavigate("projects")}>Review projects</button>
            <button type="button" onClick={() => onNavigate("payments-hours")}>Payments &amp; hours</button>
            <button type="button" onClick={() => onNavigate("supplier-time")}>Supplier time</button>
            <button type="button" onClick={() => onNavigate("change-requests")}>Change requests</button>
          </div>
        </section>
      </div>

      <section className="financial-overview">
        <div className="financial-overview-header">
          <p className="section-eyebrow">Financial overview</p>
          <span className="muted-text">Blended margin {marginPercent}%</span>
        </div>
        <div className="financial-grid">
          <div className="financial-item">
            <span>Total client revenue</span>
            <strong>{currency.format(metrics.revenue)}</strong>
          </div>
          <div className="financial-item">
            <span>Total supplier cost</span>
            <strong>{currency.format(metrics.cost)}</strong>
          </div>
          <div className="financial-item">
            <span>Estimated margin</span>
            <strong>{currency.format(metrics.margin)}</strong>
          </div>
          <div className="financial-item">
            <span>Owed to suppliers</span>
            <strong>{currency.format(metrics.supplierOwed)}</strong>
          </div>
        </div>
      </section>

      <RulePanel collapsible />
    </>
  );
}
