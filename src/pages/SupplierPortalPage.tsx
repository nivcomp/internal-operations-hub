import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { useAppData } from "../context/AppDataContext";
import { canWorkStart, currency, getProjectName, statusLabels } from "../lib/domainHelpers";
import type { Project, TimeEntry } from "../types/domain";

type SupplierPortalPageProps = {
  selectedSupplierId?: string;
  projects: Project[];
  timeEntries: TimeEntry[];
};

export function SupplierPortalPage({ selectedSupplierId, projects, timeEntries }: SupplierPortalPageProps) {
  const { fileLinks, projectMessages, scopeItems, scopes, supplierProfiles, suppliers } = useAppData();
  const fallbackSupplier = suppliers.find((supplier) => supplier.status === "approved") ?? suppliers[0];
  const supplier = suppliers.find((item) => item.id === selectedSupplierId) ?? fallbackSupplier;
  const assigned = supplier
    ? projects.filter((project) => project.assignedSupplierIds.includes(supplier.id))
    : [];
  const assignedProjectIds = assigned.map((project) => project.id);
  const supplierVisibleFiles = fileLinks.filter(
    (file) => assignedProjectIds.includes(file.projectId) && file.visibility === "supplier_visible",
  );
  const supplierVisibleMessages = projectMessages.filter(
    (message) => assignedProjectIds.includes(message.projectId) && message.visibility === "supplier_visible",
  );
  const supplierVisibleScopeItems = scopeItems
    .map((item) => {
      const scope = scopes.find((currentScope) => currentScope.id === item.scopeId);
      return { item, scope };
    })
    .filter(({ item, scope }) => item.supplierVisible && scope && assignedProjectIds.includes(scope.projectId));
  const supplierTimeEntries = supplier
    ? timeEntries.filter((entry) => entry.supplierId === supplier.id)
    : [];
  const supplierProfile = supplier
    ? supplierProfiles.find((profile) => profile.supplierId === supplier.id)
    : undefined;
  const approvedTimeEntries = supplierTimeEntries.filter((entry) => entry.status === "approved");
  const nonApprovedTimeEntryCount = supplierTimeEntries.length - approvedTimeEntries.length;
  const approvedHours = approvedTimeEntries.reduce((total, entry) => total + entry.hours, 0);
  const excludedHours = supplierTimeEntries
    .filter((entry) => entry.status !== "approved")
    .reduce((total, entry) => total + entry.hours, 0);
  const estimatedPayableAmount = approvedHours * (supplierProfile?.hourlyRate ?? 0);
  const payableProjects = Array.from(
    approvedTimeEntries.reduce((projectTotals, entry) => {
      projectTotals.set(entry.projectId, (projectTotals.get(entry.projectId) ?? 0) + entry.hours);
      return projectTotals;
    }, new Map<string, number>()),
  );
  return (
    <>
      <PageHeader title="Supplier Portal Placeholder" subtitle="A limited supplier view for assigned work, updates, own time entries, and amount owed." />
      <section className="card">
        <h2>Supplier cannot see client price or margin</h2>
        <p>{selectedSupplierId ? `Viewing as ${supplier?.name}.` : `No supplier selected. Showing fallback supplier ${supplier?.name}.`}</p>
        {assigned.length ? (
          <>
            <p>Supplier-safe project context: assigned project, delivery status, start readiness, and visible work instructions only.</p>
            <table>
              <thead>
                <tr>
                  <th>Assigned project</th>
                  <th>Project status</th>
                  <th>Start rule</th>
                  <th>Visible instruction</th>
                </tr>
              </thead>
              <tbody>
                {assigned.map((project) => (
                  <tr key={project.id}>
                    <td>{project.name}</td>
                    <td>{statusLabels[project.status]}</td>
                    <td>{canWorkStart(project, scopes) ? "Ready to start" : "Blocked until agency approval, payment, or paid hours"}</td>
                    <td>View assigned scope items only</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <p>No assigned projects are visible for this supplier yet.</p>
        )}
      </section>
      <section className="card">
        <h2>Assigned scope items</h2>
        {supplierVisibleScopeItems.length ? (
          <>
            <p>Supplier-safe scope context: parent project status, start readiness, scope version, assigned phase, item details, and acceptance notes only.</p>
            <table>
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Project status</th>
                  <th>Project start rule</th>
                  <th>Scope</th>
                  <th>Phase</th>
                  <th>Item</th>
                  <th>Acceptance</th>
                </tr>
              </thead>
              <tbody>
                {supplierVisibleScopeItems.map(({ item, scope }) => {
                  const project = scope ? projects.find((currentProject) => currentProject.id === scope.projectId) : undefined;
                  return (
                    <tr key={item.id}>
                      <td>{scope ? getProjectName(scope.projectId, projects) : "Project"}</td>
                      <td>{project ? statusLabels[project.status] : "Project not found"}</td>
                      <td>{project ? (canWorkStart(project, scopes) ? "Ready to start" : "Blocked until agency approval, payment, or paid hours") : "Project not found"}</td>
                      <td>{scope ? `v${scope.version} · ${scope.status}` : "Scope"}</td>
                      <td>{item.phase}</td>
                      <td>
                        <strong>{item.title}</strong>
                        <br />
                        {item.description}
                      </td>
                      <td>{item.acceptanceNotes}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        ) : (
          <p>No supplier-visible scope items are assigned to this supplier yet.</p>
        )}
      </section>
      <section className="card">
        <h2>My time entries</h2>
        <p>Supplier-safe time context: approved time is payable; submitted or rejected time is excluded until agency approval.</p>
        <div className="stats-grid">
          <article className="stat-card">
            <span>Total approved hours</span>
            <strong>{approvedHours} hrs</strong>
          </article>
          <article className="stat-card">
            <span>Approved entries</span>
            <strong>{approvedTimeEntries.length}</strong>
          </article>
          <article className="stat-card">
            <span>Awaiting agency approval</span>
            <strong>{nonApprovedTimeEntryCount}</strong>
          </article>
          <article className="stat-card">
            <span>Estimated payable amount</span>
            <strong>{supplierProfile ? currency.format(estimatedPayableAmount) : "Rate missing"}</strong>
          </article>
          <article className="stat-card">
            <span>Submitted or rejected hours excluded</span>
            <strong>{excludedHours} hrs</strong>
          </article>
        </div>
        {payableProjects.length ? (
          <table>
            <thead>
              <tr>
                <th>Payable project</th>
                <th>Approved hours</th>
                <th>Estimated amount</th>
              </tr>
            </thead>
            <tbody>
              {payableProjects.map(([projectId, hours]) => (
                <tr key={projectId}>
                  <td>{getProjectName(projectId, projects)}</td>
                  <td>{hours} hrs</td>
                  <td>{supplierProfile ? currency.format(hours * supplierProfile.hourlyRate) : "Rate missing"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No approved time is payable for this supplier yet.</p>
        )}
        {supplierTimeEntries.length ? (
          <table>
            <thead>
              <tr>
                <th>Project</th>
                <th>Date</th>
                <th>Hours</th>
                <th>Description</th>
                <th>Status</th>
                <th>Approved by</th>
                <th>Payable rule</th>
              </tr>
            </thead>
            <tbody>
              {supplierTimeEntries.map((entry) => (
                <tr key={entry.id}>
                  <td>{getProjectName(entry.projectId, projects)}</td>
                  <td>{entry.date}</td>
                  <td>{entry.hours}</td>
                  <td>{entry.description}</td>
                  <td><StatusBadge label={entry.status} tone={entry.status === "approved" ? "success" : "warning"} /></td>
                  <td>{entry.approvedBy ?? "Awaiting agency approval"}</td>
                  <td>{entry.status === "approved" ? "Payable" : "Not payable until agency approval"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No time entries for this supplier yet.</p>
        )}
      </section>
      <section className="card">
        <h2>Files and links</h2>
        {supplierVisibleFiles.length ? (
          <>
            <p>Supplier-safe file context: parent project status, start readiness, file type, and supplier-visible links only.</p>
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Project</th>
                  <th>Project status</th>
                  <th>Project start rule</th>
                  <th>Type</th>
                  <th>Link</th>
                </tr>
              </thead>
              <tbody>
                {supplierVisibleFiles.map((file) => {
                  const project = assigned.find((item) => item.id === file.projectId);
                  return (
                    <tr key={file.id}>
                      <td>{file.title}</td>
                      <td>{project?.name ?? "Project"}</td>
                      <td>{project ? statusLabels[project.status] : "Project not found"}</td>
                      <td>{project ? (canWorkStart(project, scopes) ? "Ready to start" : "Blocked until agency approval, payment, or paid hours") : "Project not found"}</td>
                      <td>{file.fileType}</td>
                      <td><a href={file.url}>Open</a></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        ) : (
          <p>No supplier-visible files or links are available for this supplier yet.</p>
        )}
      </section>
      <section className="card">
        <h2>Messages</h2>
        {supplierVisibleMessages.length ? (
          <>
            <p>Supplier-safe message context: parent project status, sender role, message body, and date for supplier-visible updates only.</p>
            <table>
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Project status</th>
                  <th>Project start rule</th>
                  <th>From</th>
                  <th>Message</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {supplierVisibleMessages.map((message) => {
                  const project = assigned.find((item) => item.id === message.projectId);
                  return (
                    <tr key={message.id}>
                      <td>{project?.name ?? "Project"}</td>
                      <td>{project ? statusLabels[project.status] : "Project not found"}</td>
                      <td>{project ? (canWorkStart(project, scopes) ? "Ready to start" : "Blocked until agency approval, payment, or paid hours") : "Project not found"}</td>
                      <td>{message.authorRole}</td>
                      <td>{message.body}</td>
                      <td>{message.createdDate}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        ) : (
          <p>No supplier-visible project messages are available for this supplier yet.</p>
        )}
      </section>
    </>
  );
}
