import { useMemo } from "react";
import { PageHeader } from "../components/PageHeader";
import { RulePanel } from "../components/RulePanel";
import { StatCard } from "../components/StatCard";
import { StatusBadge } from "../components/StatusBadge";
import { supplierPayments } from "../data/mockData";
import { canWorkStart, currency, getClient, marginAmount, statusLabels } from "../lib/domainHelpers";
import type { ChangeRequest, Client, Project, TimeEntry } from "../types/domain";

type DashboardPageProps = {
  clients: Client[];
  projects: Project[];
  changeRequests: ChangeRequest[];
  timeEntries: TimeEntry[];
};

export function DashboardPage({ clients, projects, changeRequests, timeEntries }: DashboardPageProps) {
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
  }, []);

  return (
    <>
      <PageHeader title="Agency Dashboard" subtitle="A control room for Yaniv's clients, scope, pricing, paid hours, suppliers, and delivery risk." />
      <section className="stats-grid">
        <StatCard label="New client leads" value={metrics.newLeads} />
        <StatCard label="Waiting for pricing" value={metrics.waitingPricing} tone="warning" />
        <StatCard label="Waiting for client approval" value={metrics.waitingApproval} tone="warning" />
        <StatCard label="Waiting for payment" value={metrics.waitingPayment} tone="warning" />
        <StatCard label="Active projects" value={metrics.activeProjects} tone="success" />
        <StatCard label="Supplier time waiting" value={metrics.supplierTimeWaiting} tone="warning" />
        <StatCard label="Open change requests" value={metrics.openChanges} />
        <StatCard label="Total client revenue" value={currency.format(metrics.revenue)} />
        <StatCard label="Total supplier cost" value={currency.format(metrics.cost)} />
        <StatCard label="Estimated margin" value={currency.format(metrics.margin)} note={`${Math.round((metrics.margin / metrics.revenue) * 100)}% blended`} tone="success" />
        <StatCard label="Owed to suppliers" value={currency.format(metrics.supplierOwed)} />
      </section>
      <div className="two-column">
        <section className="card">
          <h2>Projects needing Yaniv</h2>
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
              {projects
                .filter((project) => !canWorkStart(project) || ["waiting_for_agency_pricing", "waiting_for_client_approval"].includes(project.status))
                .map((project) => (
                  <tr key={project.id}>
                    <td>{project.name}</td>
                    <td>{getClient(project, clients)?.company}</td>
                    <td><StatusBadge label={statusLabels[project.status]} tone="warning" /></td>
                    <td>{canWorkStart(project) ? "Ready" : "Blocked until payment or hours"}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </section>
        <RulePanel />
      </div>
    </>
  );
}
