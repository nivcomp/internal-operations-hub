import { useState } from "react";
import { ClientEditDialog } from "../clients/ClientEditDialog";
import { useAppData } from "../../context/AppDataContext";
import { useMode } from "../../context/ModeContext";
import { useCopilot } from "../../context/CopilotContext";
import { currency, formatRate } from "../../lib/domainHelpers";
import {
  clientStatusHe, clientSummaryHe, projectBlockerHe, projectNextActionHe, projectSummaryHe,
  statusHe, supplierStatusHe, supplierSummaryHe,
} from "../../lib/simpleHebrew";
import type { Client, Project, Supplier } from "../../types/domain";

function AskAi({ question }: { question: string }) {
  const copilot = useCopilot();
  return (
    <button
      type="button"
      onClick={() => { copilot.setOpen(true); void copilot.send(question); }}
    >
      שאל את העוזר
    </button>
  );
}

export function SimpleClientCard({ client, onContinue }: { client: Client; onContinue?: () => void }) {
  const [editing, setEditing] = useState(false);
  const { projects } = useAppData();
  const { openAdvanced } = useMode();
  const mine = projects.filter((project) => project.clientId === client.id);
  const waiting = mine.find((project) =>
    ["waiting_for_agency_pricing", "waiting_for_client_approval", "waiting_for_payment"].includes(project.status));

  return (
    <article className="card simple-entity-card">
      <header>
        <div>
          <strong>{client.company}</strong>
          <span className="simple-note">{client.name} · {client.email}</span>
        </div>
        <span className="simple-pill">{clientStatusHe[client.status]}</span>
      </header>
      <p className="simple-summary">{clientSummaryHe({ client, projects })}</p>
      <dl className="simple-facts">
        <div><dt>פרויקטים</dt><dd>{mine.length}</dd></div>
        <div><dt>ממתין</dt><dd>{waiting ? statusHe[waiting.status] : "כלום"}</dd></div>
        <div><dt>גישה</dt><dd>{client.status === "lead" ? "טרם התחיל" : "פעילה"}</dd></div>
      </dl>
      <div className="simple-actions-row">
        <button type="button" className="primary-button" onClick={onContinue}>המשך טיפול</button>
        <AskAi question={`תן לי סיכום קצר בעברית על הלקוח ${client.company}`} />
        <button type="button" onClick={() => openAdvanced("client-detail", { clientId: client.id })}>
          פתח כרטיס מלא
        </button>
        <button type="button" onClick={() => setEditing(true)}>עריכת פרטים</button>
      </div>
      {editing ? <ClientEditDialog client={client} onClose={() => setEditing(false)} /> : null}
    </article>
  );
}

export function SimpleProjectCard({ project, onContinue }: { project: Project; onContinue?: () => void }) {
  const { clients, suppliers, changeRequests, clientPayments, projectSchedules, estimateSummaries } = useAppData();
  const { openAdvanced } = useMode();
  const client = clients.find((item) => item.id === project.clientId);
  const schedule = projectSchedules.find((row) => row.projectId === project.id);
  const estimate = estimateSummaries.find((row) => row.projectId === project.id);
  const assigned = project.assignedSupplierIds
    .map((id) => suppliers.find((s) => s.id === id)?.name)
    .filter(Boolean)
    .join(", ");
  const blocker = projectBlockerHe(project);

  return (
    <article className="card simple-entity-card">
      <header>
        <div>
          <strong>{project.name}</strong>
          <span className="simple-note">{client?.company ?? "—"}</span>
        </div>
        <span className="simple-pill">{statusHe[project.status]}</span>
      </header>
      <p className="simple-summary">
        {projectSummaryHe({ project, client, changeRequests, payments: clientPayments, suppliers })}
      </p>
      <dl className="simple-facts">
        <div>
          <dt>אומדן</dt>
          <dd>
            {estimate?.estimatedBudgetMax
              ? `${currency.format(estimate.estimatedBudgetMin)} – ${currency.format(estimate.estimatedBudgetMax)}`
              : project.budgetSignal || "—"}
          </dd>
        </div>
        <div><dt>תאריך מבוקש</dt><dd>{schedule?.requestedCompletionDate ?? "—"}</dd></div>
        <div><dt>ספק</dt><dd>{assigned || "לא שויך"}</dd></div>
        <div><dt>חסם</dt><dd>{blocker ?? "אין"}</dd></div>
      </dl>
      <p className="simple-next">הפעולה הבאה: {projectNextActionHe(project)}</p>
      <div className="simple-actions-row">
        <button type="button" className="primary-button" onClick={onContinue}>המשך פרויקט</button>
        <AskAi question={`מה מצב הפרויקט ${project.name}? תן סיכום קצר בעברית והמלצה לפעולה הבאה.`} />
        <button type="button" onClick={() => openAdvanced("project-detail", { projectId: project.id })}>
          פתח פרויקט מלא
        </button>
        <button type="button" onClick={() => openAdvanced("project-detail", { projectId: project.id, tab: "chat" })}>
          שיחת הלקוח
        </button>
      </div>
    </article>
  );
}

export function SimpleSupplierCard({ supplier, onContinue }: { supplier: Supplier; onContinue?: () => void }) {
  const { supplierProfiles, projects, timeEntries } = useAppData();
  const { openAdvanced } = useMode();
  const profile = supplierProfiles.find((row) => row.supplierId === supplier.id);
  const assigned = projects.filter((project) => project.assignedSupplierIds.includes(supplier.id));
  const pendingHours = timeEntries.filter((entry) => entry.supplierId === supplier.id && entry.status === "submitted");

  return (
    <article className="card simple-entity-card">
      <header>
        <div>
          <strong>{supplier.name}</strong>
          <span className="simple-note">{supplier.email}</span>
        </div>
        <span className="simple-pill">{supplierStatusHe[supplier.status]}</span>
      </header>
      <p className="simple-summary">{supplierSummaryHe({ supplier, profile, projects, timeEntries })}</p>
      <dl className="simple-facts">
        <div><dt>תחומים</dt><dd>{profile?.mainSkills?.slice(0, 3).join(", ") || "—"}</dd></div>
        <div><dt>זמינות</dt><dd>{profile?.weeklyAvailabilityHours ? `${profile.weeklyAvailabilityHours} ש׳ בשבוע` : "—"}</dd></div>
        <div><dt>תעריף</dt><dd>{profile?.hourlyRate ? formatRate(profile.hourlyRate, profile.currency) : "—"}</dd></div>
        <div><dt>פרויקטים</dt><dd>{assigned.length}</dd></div>
      </dl>
      <p className="simple-next">
        {supplier.status === "pending_review"
          ? "ממתין לאישור שלך"
          : pendingHours.length
            ? `${pendingHours.length} דיווחי שעות לאישור`
            : "אין פעולה פתוחה"}
      </p>
      <div className="simple-actions-row">
        <button type="button" className="primary-button" onClick={onContinue}>המשך טיפול</button>
        <button type="button" onClick={() => openAdvanced("supplier-detail", { supplierId: supplier.id })}>
          פתח כרטיס מלא
        </button>
        <button type="button" onClick={() => openAdvanced("supplier-time", { supplierId: supplier.id })}>
          שעות ושיוך
        </button>
      </div>
    </article>
  );
}
