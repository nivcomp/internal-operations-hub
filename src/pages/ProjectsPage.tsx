import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { DataTable, type Column } from "../components/ui/DataTable";
import { EmptyState } from "../components/ui/EmptyState";
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

  const columns: Column<Project>[] = [
    { key: "name", header: "Project", render: (project) => <strong>{project.name}</strong>, sortValue: (project) => project.name },
    { key: "client", header: "Client", render: (project) => getClient(project, clients)?.company ?? "—", sortValue: (project) => getClient(project, clients)?.company ?? "" },
    {
      key: "status",
      header: "Status",
      render: (project) => <StatusBadge label={statusLabels[project.status]} tone={canWorkStart(project, scopes) ? "success" : "warning"} />,
      sortValue: (project) => statusLabels[project.status],
    },
    {
      key: "suppliers",
      header: "Assigned suppliers",
      hideOnMobile: true,
      render: (project) => project.assignedSupplierIds.map((id) => getSupplierName(id, suppliers)).join(", ") || "Not assigned",
    },
    {
      key: "rule",
      header: "Start rule",
      hideOnMobile: true,
      render: (project) => (canWorkStart(project, scopes) ? "Can start" : "Blocked until payment or paid hours"),
    },
  ];

  return (
    <>
      <PageHeader title="Projects" subtitle="Each project tracks status, client, assigned suppliers, budget signal, and whether delivery can start." />
      <section className="card">
        <DataTable
          rows={projects}
          columns={columns}
          rowKey={(project) => project.id}
          searchPlaceholder="Search projects by name, client or status…"
          searchFields={(project) => `${project.name} ${getClient(project, clients)?.company ?? ""} ${statusLabels[project.status]}`}
          onRowClick={(project) => onProjectSelect(project.id)}
          rowActions={(project) => (
            <button type="button" onClick={(event) => { event.stopPropagation(); onProjectSelect(project.id); }}>Open</button>
          )}
          emptyState={<EmptyState title="No projects yet" description="Projects appear here once a client conversation becomes a real project." compact />}
        />
      </section>
    </>
  );
}
