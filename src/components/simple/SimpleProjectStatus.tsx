import { useEffect, useState } from "react";
import { useAppData } from "../../context/AppDataContext";
import { canWorkStart } from "../../lib/domainHelpers";
import { loadPublishedProposals } from "../../services/meetingWorkflowApi";
import type { Project } from "../../types/domain";

export type SimpleProjectArea = "discovery" | "pricing" | "execution" | "status";

type Step = { label: string; state: "הושלם" | "ממתין" | "חסר"; detail: string };

export function SimpleProjectStatus({ project, onOpenArea }: { project: Project; onOpenArea: (area: SimpleProjectArea) => void }) {
  const { scopes, estimateSummaries, clientPayments, suppliers, markPaymentReceived } = useAppData();
  const [proposalStatus, setProposalStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const scope = scopes.find((item) => item.projectId === project.id);
  const estimate = estimateSummaries.find((item) => item.projectId === project.id);
  const payment = clientPayments.find((item) => item.projectId === project.id);
  const supplierNames = project.assignedSupplierIds.map((id) => suppliers.find((item) => item.id === id)?.name).filter(Boolean);

  useEffect(() => {
    void loadPublishedProposals(project.id).then((rows) => setProposalStatus(rows[0]?.status ?? null)).catch(() => setProposalStatus(null));
  }, [project.id]);

  const steps: Step[] = [
    { label: "אפיון", state: scope ? (scope.status === "approved" ? "הושלם" : "ממתין") : "חסר", detail: scope ? (scope.status === "approved" ? "היקף העבודה אושר" : "האיפיון קיים וממתין לאישור") : "צריך להשלים אפיון" },
    { label: "מחיר", state: estimate?.approvedByYaniv ? "הושלם" : estimate ? "ממתין" : "חסר", detail: estimate?.approvedByYaniv ? "מחיר סופי אושר" : estimate ? "יש אומדן, צריך לאשר מחיר" : "עדיין אין אומדן" },
    { label: "הצעה", state: proposalStatus ? "הושלם" : estimate?.approvedByYaniv ? "ממתין" : "חסר", detail: proposalStatus ? "הצעה פורסמה ללקוח" : "עדיין לא פורסמה הצעה" },
    { label: "חתימה", state: proposalStatus === "signed" ? "הושלם" : proposalStatus ? "ממתין" : "חסר", detail: proposalStatus === "signed" ? "התקבלה חתימת לקוח" : "ממתינים לחתימה" },
    { label: "תשלום", state: project.paymentGateStatus !== "blocked" || payment?.status === "received" ? "הושלם" : payment ? "ממתין" : "חסר", detail: payment?.status === "received" ? "התשלום התקבל" : payment ? "בקשת תשלום פתוחה" : "לא נפתחה בקשת תשלום" },
    { label: "ספק", state: supplierNames.length ? "הושלם" : "חסר", detail: supplierNames.length ? supplierNames.join(", ") : "טרם שויך ספק" },
  ];

  const next = !scope || scope.status !== "approved"
    ? { label: "המשך אפיון", area: "discovery" as const }
    : !estimate?.approvedByYaniv
      ? { label: "קבע מחיר", area: "pricing" as const }
      : !proposalStatus
        ? { label: "צור הצעה ללקוח", area: "pricing" as const }
        : proposalStatus !== "signed"
          ? { label: "בדוק חתימת לקוח", area: "pricing" as const }
          : payment?.status === "requested"
            ? { label: "סמן תשלום שהתקבל", area: "status" as const }
            : !supplierNames.length
              ? { label: "בחר ספק", area: "execution" as const }
              : { label: canWorkStart(project, scopes) ? "המשך לביצוע" : "בדוק מה חסר", area: "execution" as const };

  async function receivePayment() {
    if (!payment || payment.status !== "requested") return;
    setBusy(true);
    try { await markPaymentReceived(payment.id); } finally { setBusy(false); }
  }

  return (
    <section className="card simple-project-status" dir="rtl">
      <header className="simple-section-heading"><div><p className="eyebrow">סטטוס</p><h2>איפה הפרויקט נמצא?</h2></div></header>
      <div className="simple-status-steps">
        {steps.map((step) => <article key={step.label} className={`status-${step.state === "הושלם" ? "done" : step.state === "ממתין" ? "waiting" : "missing"}`}>
          <span>{step.label}</span><strong>{step.state}</strong><small>{step.detail}</small>
        </article>)}
      </div>
      <div className="simple-status-answers">
        <p><strong>מה חסר?</strong> {steps.filter((item) => item.state !== "הושלם").map((item) => item.label).join(", ") || "דבר מהותי אינו חסר."}</p>
        <p><strong>מי מחכה למי?</strong> {proposalStatus && proposalStatus !== "signed" ? "ממתינים ללקוח לחתימה." : payment?.status === "requested" ? "ממתינים לתשלום מהלקוח." : !supplierNames.length ? "הפרויקט מחכה לבחירת ספק." : "אין כרגע המתנה חיצונית ברורה."}</p>
      </div>
      <div className="simple-next-action">
        <div><strong>הפעולה הבאה</strong><span>{next.label}</span></div>
        {payment?.status === "requested" ? <button type="button" className="primary-button" disabled={busy} onClick={() => void receivePayment()}>{busy ? "שומר…" : "קבל תשלום"}</button>
          : <button type="button" className="primary-button" onClick={() => onOpenArea(next.area)}>{next.label}</button>}
      </div>
    </section>
  );
}
