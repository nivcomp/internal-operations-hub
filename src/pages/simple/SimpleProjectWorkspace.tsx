import { useState } from "react";
import { MeetingWorkspace } from "../../components/meeting/MeetingWorkspace";
import { SimplePricingWorkspace } from "../../components/simple/SimplePricingWorkspace";
import { SimpleProjectStatus, type SimpleProjectArea } from "../../components/simple/SimpleProjectStatus";
import { SimpleSupplierHandoffWorkspace } from "../../components/simple/SimpleSupplierHandoffWorkspace";
import { useAppData } from "../../context/AppDataContext";
import { useCopilotScreen } from "../../context/CopilotContext";
import { useMode } from "../../context/ModeContext";
import type { Project } from "../../types/domain";

const areas: Array<{ key: SimpleProjectArea; label: string }> = [
  { key: "discovery", label: "אפיון" },
  { key: "pricing", label: "תמחור והצעה" },
  { key: "execution", label: "ביצוע וספק" },
  { key: "status", label: "סטטוס" },
];

export function SimpleProjectWorkspace({ project, onBack, onOpenSupplier }: { project: Project; onBack: () => void; onOpenSupplier: (supplierId: string) => void }) {
  const { clients } = useAppData();
  const { openAdvanced } = useMode();
  const [area, setArea] = useState<SimpleProjectArea>("status");
  const client = clients.find((item) => item.id === project.clientId);

  useCopilotScreen({
    page: "project-detail",
    label: `${project.name} · ${areas.find((item) => item.key === area)?.label}`,
    entityType: "project",
    entityId: project.id,
    projectId: project.id,
  });

  return <div className="simple-project-workspace" dir="rtl">
    <header className="simple-project-head">
      <button type="button" className="ghost-button" onClick={onBack}>→ חזרה לפרויקטים</button>
      <div><p className="eyebrow">{client?.company || "פרויקט"}</p><h1>{project.name}</h1><p>{project.summary || "כל שלבי הפרויקט במקום אחד."}</p></div>
      <button type="button" onClick={() => openAdvanced("project-detail", { projectId: project.id })}>פרטים מתקדמים</button>
    </header>

    <nav className="simple-project-nav" aria-label="שלבי הפרויקט">
      {areas.map((item) => <button key={item.key} type="button" className={area === item.key ? "active" : ""} onClick={() => setArea(item.key)}>{item.label}</button>)}
    </nav>

    {area === "status" ? <SimpleProjectStatus project={project} onOpenArea={setArea} /> : null}
    {area === "discovery" ? <>
      <section className="card simple-origin-conversation">
        <div><p className="eyebrow">שיחת ההיכרות המקורית</p><h2>כל השיחה שהובילה לפרויקט נשמרה כאן</h2><p>הודעות הליד הועברו לאותו פרויקט. בתוך השיחה אפשר לעבור במפורש להתחלה ולא לאבד את ההקשר.</p></div>
      </section>
      <MeetingWorkspace projectId={project.id} projectName={project.name} clientName={client?.name} companyName={client?.company} />
    </> : null}
    {area === "pricing" ? <SimplePricingWorkspace projectId={project.id} /> : null}
    {area === "execution" ? <SimpleSupplierHandoffWorkspace project={project} onOpenSupplier={onOpenSupplier} /> : null}

    <details className="card simple-advanced-details">
      <summary>פרטים מתקדמים</summary>
      <p>הגדרות מסחריות ותאריכים, תשלומים, בקשות שינוי, ציר זמן, מסמכים, קבצים, החלטות וכלי אומדן טכניים נשארו זמינים במערכת המתקדמת.</p>
      <div className="simple-actions-row">
        <button type="button" onClick={() => openAdvanced("project-detail", { projectId: project.id })}>פתח את מרכז הפרויקט המלא</button>
        <button type="button" onClick={() => openAdvanced("payments-hours", { projectId: project.id })}>תשלומים ובנק שעות</button>
        <button type="button" onClick={() => openAdvanced("change-requests", { projectId: project.id })}>בקשות שינוי</button>
      </div>
    </details>
  </div>;
}
