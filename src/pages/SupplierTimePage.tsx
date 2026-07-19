import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { MutationKeys, useAppData } from "../context/AppDataContext";
import { getProjectName, getSupplierName } from "../lib/domainHelpers";
import type { Project, TimeEntry } from "../types/domain";

type SupplierTimePageProps = {
  projects: Project[];
  timeEntries: TimeEntry[];
  onStatusChange: (timeEntryId: string, status: "approved" | "rejected") => Promise<unknown>;
};

export function SupplierTimePage({ projects, timeEntries, onStatusChange }: SupplierTimePageProps) {
  const { suppliers, isPending } = useAppData();
  const pending = (id: string) => isPending(MutationKeys.updateTimeEntryStatus(id));
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
            {timeEntries.length === 0 ? (
              <tr><td colSpan={7}><p>No supplier time submitted yet.</p></td></tr>
            ) : timeEntries.map((entry) => (
              <tr key={entry.id}>
                <td>{getSupplierName(entry.supplierId, suppliers)}</td>
                <td>{getProjectName(entry.projectId, projects)}</td>
                <td>{entry.date}</td>
                <td>{entry.hours}</td>
                <td><StatusBadge label={entry.status} tone={entry.status === "approved" ? "success" : "warning"} /></td>
                <td>{entry.status === "approved" ? "Payable" : "Waiting for approval"}</td>
                <td>
                  {entry.status === "submitted" ? (
                    <div className="table-actions">
                      <button type="button" disabled={pending(entry.id)} onClick={() => { void onStatusChange(entry.id, "approved").catch(() => {}); }}>{pending(entry.id) ? "…" : "Approve"}</button>
                      <button type="button" disabled={pending(entry.id)} onClick={() => { void onStatusChange(entry.id, "rejected").catch(() => {}); }}>{pending(entry.id) ? "…" : "Reject"}</button>
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
