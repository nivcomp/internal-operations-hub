import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { useAppData } from "../context/AppDataContext";
import { canWorkStart, getClient, getSupplierName, statusLabels } from "../lib/domainHelpers";
import type { Client, Project } from "../types/domain";

type ProjectsPageProps = {
  clients: Client[];
  projects: Project[];
  onProjectSelect: (projectId: string) => void;
};

export function ProjectsPage({ clients, projects, onProjectSelect }: ProjectsPageProps) {
  const { scopes, suppliers } = useAppData();
  return (
    <>
      <PageHeader title="Projects" subtitle="Each project tracks status, client, assigned suppliers, budget signal, and whether delivery can start." />
      <section className="card">
        <table>
          <thead>
            <tr>
              <th>Project</th>
              <th>Client</th>
              <th>Status</th>
              <th>Assigned suppliers</th>
              <th>Start rule</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => (
              <tr key={project.id} className="clickable-row" onClick={() => onProjectSelect(project.id)}>
                <td>{project.name}</td>
                <td>{getClient(project, clients)?.company}</td>
                <td><StatusBadge label={statusLabels[project.status]} tone={canWorkStart(project, scopes) ? "success" : "warning"} /></td>
                <td>{project.assignedSupplierIds.map((supplierId) => getSupplierName(supplierId, suppliers)).join(", ") || "Not assigned"}</td>
                <td>{canWorkStart(project, scopes) ? "Can start" : "Blocked until payment or paid hours"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
