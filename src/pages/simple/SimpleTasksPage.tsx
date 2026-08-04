import { useMemo } from "react";
import { useAppData } from "../../context/AppDataContext";
import { useMode } from "../../context/ModeContext";
import {
  getNeedsPricingItems, getSupplierTimeApprovalItems, getWaitingApprovalItems, getWaitingPaymentItems,
} from "../../lib/actionQueue";
import { projectNextActionHe, statusHe } from "../../lib/simpleHebrew";

export function SimpleTasksPage() {
  const { projects, changeRequests, clientPayments, timeEntries, suppliers } = useAppData();
  const { openAdvanced } = useMode();

  const pricing = useMemo(() => getNeedsPricingItems(projects, changeRequests), [projects, changeRequests]);
  const approval = useMemo(() => getWaitingApprovalItems(projects, changeRequests), [projects, changeRequests]);
  const payment = useMemo(() => getWaitingPaymentItems(projects, clientPayments), [projects, clientPayments]);
  const hours = useMemo(() => getSupplierTimeApprovalItems(timeEntries), [timeEntries]);

  const projectRows = [...pricing, ...approval]
    .filter((item) => item.type === "project")
    .map((item) => (item.type === "project" ? item.project : null))
    .filter(Boolean) as typeof projects;
  const changeRows = [...pricing, ...approval]
    .filter((item) => item.type === "change")
    .map((item) => (item.type === "change" ? item.request : null))
    .filter(Boolean);

  return (
    <div className="simple-page">
      <header className="simple-head"><h1>משימות</h1></header>

      <section className="card simple-card">
        <h2>פרויקטים שמחכים לך</h2>
        {projectRows.length === 0 ? <p className="simple-note">אין פרויקטים ממתינים.</p> : (
          <div className="simple-list">
            {projectRows.map((project) => (
              <button
                key={project.id}
                type="button"
                className="card simple-row"
                onClick={() => openAdvanced("project-detail", { projectId: project.id })}
              >
                <span className="simple-row-title">{project.name}</span>
                <span className="simple-note">{projectNextActionHe(project)}</span>
                <span className="simple-pill">{statusHe[project.status]}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="card simple-card">
        <h2>בקשות שינוי</h2>
        {changeRows.length === 0 ? <p className="simple-note">אין בקשות שינוי פתוחות.</p> : (
          <div className="simple-list">
            {changeRows.map((request) => request ? (
              <button
                key={request.id}
                type="button"
                className="card simple-row"
                onClick={() => openAdvanced("change-requests", { projectId: request.projectId })}
              >
                <span className="simple-row-title">{request.title}</span>
                <span className="simple-note">
                  {projects.find((project) => project.id === request.projectId)?.name ?? "—"}
                </span>
              </button>
            ) : null)}
          </div>
        )}
      </section>

      <section className="card simple-card">
        <h2>שעות ספק לאישור</h2>
        {hours.length === 0 ? <p className="simple-note">אין דיווחי שעות ממתינים.</p> : (
          <div className="simple-list">
            {hours.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className="card simple-row"
                onClick={() => openAdvanced("supplier-time", { supplierId: entry.supplierId })}
              >
                <span className="simple-row-title">
                  {suppliers.find((supplier) => supplier.id === entry.supplierId)?.name ?? "ספק"}
                </span>
                <span className="simple-note">{entry.hours} שעות · {entry.workDate}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="card simple-card">
        <h2>תשלומים ממתינים</h2>
        {payment.length === 0 ? <p className="simple-note">אין תשלומים ממתינים.</p> : (
          <div className="simple-list">
            {payment.map((item) => (
              <button
                key={item.project.id}
                type="button"
                className="card simple-row"
                onClick={() => openAdvanced("payments-hours", { projectId: item.project.id })}
              >
                <span className="simple-row-title">{item.project.name}</span>
                <span className="simple-note">מחכה לתשלום</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}