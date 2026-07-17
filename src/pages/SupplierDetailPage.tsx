import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { supplierProfiles } from "../data/mockData";
import { canWorkStart, currency, getProjectName, getSupplierById } from "../lib/domainHelpers";
import type { Project, TimeEntry } from "../types/domain";

type SupplierDetailPageProps = {
  selectedSupplierId?: string;
  projects: Project[];
  timeEntries: TimeEntry[];
  onSupplierPortalOpen: (supplierId: string) => void;
};

export function SupplierDetailPage({ selectedSupplierId, projects, timeEntries, onSupplierPortalOpen }: SupplierDetailPageProps) {
  const supplier = selectedSupplierId ? getSupplierById(selectedSupplierId) : undefined;

  if (!supplier) {
    return (
      <>
        <PageHeader title="Supplier Detail" subtitle="Select a supplier from the Suppliers page to inspect assigned work, time, and visibility rules." />
        <section className="empty-state">
          <h2>No supplier selected</h2>
          <p>Open the Suppliers page and choose a supplier row.</p>
        </section>
      </>
    );
  }

  const profile = supplierProfiles.find((item) => item.supplierId === supplier.id);
  const entries = timeEntries.filter((entry) => entry.supplierId === supplier.id);
  const assignedProjects = projects.filter((project) => project.assignedSupplierIds.includes(supplier.id));

  return (
    <>
      <PageHeader title="Supplier Detail" subtitle="Supplier-facing data stays limited to assigned work, instructions, time, and amount owed." />
      <section className="detail-grid">
        <article className="card">
          <h2>{supplier.name}</h2>
          <p>{supplier.email}</p>
          <dl className="meta-list">
            <div><dt>Country</dt><dd>{supplier.country}</dd></div>
            <div><dt>Timezone</dt><dd>{supplier.timezone}</dd></div>
            <div><dt>Availability</dt><dd>{profile?.weeklyAvailabilityHours} hrs/week</dd></div>
            <div><dt>Agency cost rate</dt><dd>{profile ? currency.format(profile.hourlyRate) : "Unknown"}/hr</dd></div>
          </dl>
        </article>
        <article className="card warning-card">
          <h2>Supplier visibility rule</h2>
          <p>Supplier portal excludes client price, margin, and internal agency notes.</p>
          <div className="action-row">
            <button className="primary-button" type="button" onClick={() => onSupplierPortalOpen(supplier.id)}>
              Open supplier portal
            </button>
          </div>
        </article>
      </section>
      <section className="card">
        <h2>Assigned projects</h2>
        {assignedProjects.length ? (
          <table>
            <thead>
              <tr>
                <th>Project</th>
                <th>Status</th>
                <th>Start rule</th>
                <th>Visible instruction</th>
              </tr>
            </thead>
            <tbody>
              {assignedProjects.map((project) => (
                <tr key={project.id}>
                  <td>{project.name}</td>
                  <td><StatusBadge label={project.status} tone={canWorkStart(project) ? "success" : "warning"} /></td>
                  <td>{canWorkStart(project) ? "Ready" : "Blocked by agency gate"}</td>
                  <td>Assigned scope and work updates only</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No projects assigned to this supplier in the current local session.</p>
        )}
      </section>
      <section className="card">
        <h2>Time entries</h2>
        <table>
          <thead>
            <tr>
              <th>Project</th>
              <th>Date</th>
              <th>Hours</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td>{getProjectName(entry.projectId, projects)}</td>
                <td>{entry.date}</td>
                <td>{entry.hours}</td>
                <td><StatusBadge label={entry.status} tone={entry.status === "approved" ? "success" : "warning"} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
