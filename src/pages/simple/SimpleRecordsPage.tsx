import { useMemo, useState } from "react";
import { useAppData } from "../../context/AppDataContext";
import { useMode } from "../../context/ModeContext";
import { SimpleClientCard, SimpleProjectCard, SimpleSupplierCard } from "../../components/simple/EntityCards";
import { clientStatusHe, statusHe, supplierStatusHe } from "../../lib/simpleHebrew";

type Kind = "clients" | "projects" | "suppliers";

const titles: Record<Kind, string> = {
  clients: "לקוחות",
  projects: "פרויקטים",
  suppliers: "ספקים",
};

export function SimpleRecordsPage({ kind }: { kind: Kind }) {
  const { clients, projects, suppliers } = useAppData();
  const { openAdvanced } = useMode();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const rows = useMemo(() => {
    const term = query.trim().toLowerCase();
    const match = (text: string) => !term || text.toLowerCase().includes(term);
    if (kind === "clients") {
      return clients.filter((client) => match(`${client.company} ${client.name} ${client.email}`))
        .map((client) => ({ id: client.id, title: client.company, sub: client.name, tag: clientStatusHe[client.status] }));
    }
    if (kind === "suppliers") {
      return suppliers.filter((supplier) => match(`${supplier.name} ${supplier.email}`))
        .map((supplier) => ({ id: supplier.id, title: supplier.name, sub: supplier.email, tag: supplierStatusHe[supplier.status] }));
    }
    return projects.filter((project) => match(project.name))
      .map((project) => ({
        id: project.id,
        title: project.name,
        sub: clients.find((client) => client.id === project.clientId)?.company ?? "—",
        tag: statusHe[project.status],
      }));
  }, [kind, clients, projects, suppliers, query]);

  const activeClient = clients.find((client) => client.id === selected);
  const activeProject = projects.find((project) => project.id === selected);
  const activeSupplier = suppliers.find((supplier) => supplier.id === selected);

  return (
    <div className="simple-page">
      <header className="simple-head">
        <h1>{titles[kind]}</h1>
        <input
          className="simple-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="חיפוש…"
        />
      </header>

      {rows.length === 0 ? (
        <p className="simple-note">אין רשומות להצגה.</p>
      ) : (
        <div className="simple-list">
          {rows.map((row) => (
            <button
              key={row.id}
              type="button"
              className={`card simple-row${selected === row.id ? " active" : ""}`}
              onClick={() => setSelected(selected === row.id ? null : row.id)}
            >
              <span className="simple-row-title">{row.title}</span>
              <span className="simple-note">{row.sub}</span>
              <span className="simple-pill">{row.tag}</span>
            </button>
          ))}
        </div>
      )}

      {kind === "clients" && activeClient ? (
        <SimpleClientCard client={activeClient} onContinue={() => openAdvanced("client-detail", { clientId: activeClient.id })} />
      ) : null}
      {kind === "projects" && activeProject ? (
        <SimpleProjectCard project={activeProject} onContinue={() => openAdvanced("project-detail", { projectId: activeProject.id })} />
      ) : null}
      {kind === "suppliers" && activeSupplier ? (
        <SimpleSupplierCard supplier={activeSupplier} onContinue={() => openAdvanced("supplier-detail", { supplierId: activeSupplier.id })} />
      ) : null}
    </div>
  );
}