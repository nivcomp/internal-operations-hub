import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { MutationKeys, useAppData } from "../context/AppDataContext";
import { currency, getProjectName } from "../lib/domainHelpers";
import type { ChangeRequest, Project } from "../types/domain";

type ChangeRequestsPageProps = {
  changeRequests: ChangeRequest[];
  projects: Project[];
  onStatusChange: (changeRequestId: string, status: "priced" | "client_approved" | "declined") => Promise<unknown>;
};

export function ChangeRequestsPage({ changeRequests, projects, onStatusChange }: ChangeRequestsPageProps) {
  const { isPending } = useAppData();
  const pending = (id: string) => isPending(MutationKeys.updateChangeRequestStatus(id));
  return (
    <>
      <PageHeader title="Change Requests" subtitle="Client requests are reviewed, priced, and approved before they become supplier work." />
      <section className="card">
        <table>
          <thead>
            <tr>
              <th>Request</th>
              <th>Project</th>
              <th>Status</th>
              <th>Agency price</th>
              <th>Supplier cost</th>
              <th>Work rule</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {changeRequests.length === 0 ? (
              <tr><td colSpan={7}><p>No change requests yet. New requests appear here after they are created in a project.</p></td></tr>
            ) : changeRequests.map((request) => (
              <tr key={request.id}>
                <td>{request.title}</td>
                <td>{getProjectName(request.projectId, projects)}</td>
                <td><StatusBadge label={request.status} tone={request.status === "client_approved" ? "success" : "warning"} /></td>
                <td>{request.agencyPrice ? currency.format(request.agencyPrice) : "Needs pricing"}</td>
                <td>{request.supplierCost ? currency.format(request.supplierCost) : "Not estimated"}</td>
                <td>{request.status === "client_approved" ? "Can become work" : "Blocked"}</td>
                <td>
                  <div className="table-actions">
                    {request.status === "agency_review" ? <button type="button" disabled={pending(request.id)} onClick={() => { void onStatusChange(request.id, "priced").catch(() => {}); }}>{pending(request.id) ? "…" : "Mark priced"}</button> : null}
                    {request.status === "priced" ? <button type="button" disabled={pending(request.id)} onClick={() => { void onStatusChange(request.id, "client_approved").catch(() => {}); }}>{pending(request.id) ? "…" : "Client approved"}</button> : null}
                    {request.status !== "declined" && request.status !== "client_approved" ? <button type="button" disabled={pending(request.id)} onClick={() => { void onStatusChange(request.id, "declined").catch(() => {}); }}>{pending(request.id) ? "…" : "Decline"}</button> : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
