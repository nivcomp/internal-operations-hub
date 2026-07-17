import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { getProjectName, getSupplierName } from "../lib/domainHelpers";
import type { Project, TimeEntry } from "../types/domain";

type SupplierTimePageProps = {
  projects: Project[];
  timeEntries: TimeEntry[];
  onStatusChange: (timeEntryId: string, status: "approved" | "rejected") => void;
};

export function SupplierTimePage({ projects, timeEntries, onStatusChange }: SupplierTimePageProps) {
  return (
    <>
      <PageHeader title="Supplier Time Entries" subtitle="Submitted time needs Yaniv's approval before it becomes payable or consumes paid hours." />
      <section className="card">
        <table>
          <thead>
            <tr>
              <th>Supplier</th>
              <th>Project</th>
              <th>Date</th>
              <th>Hours</th>
              <th>Status</th>
              <th>Payable rule</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {timeEntries.map((entry) => (
              <tr key={entry.id}>
                <td>{getSupplierName(entry.supplierId)}</td>
                <td>{getProjectName(entry.projectId, projects)}</td>
                <td>{entry.date}</td>
                <td>{entry.hours}</td>
                <td><StatusBadge label={entry.status} tone={entry.status === "approved" ? "success" : "warning"} /></td>
                <td>{entry.status === "approved" ? "Payable" : "Waiting for approval"}</td>
                <td>
                  {entry.status === "submitted" ? (
                    <div className="table-actions">
                      <button type="button" onClick={() => onStatusChange(entry.id, "approved")}>Approve</button>
                      <button type="button" onClick={() => onStatusChange(entry.id, "rejected")}>Reject</button>
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
