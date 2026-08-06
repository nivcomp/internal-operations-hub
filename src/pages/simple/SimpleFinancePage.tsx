import { useMemo } from "react";
import { useAppData } from "../../context/AppDataContext";
import { useMode } from "../../context/ModeContext";
import { currency } from "../../lib/domainHelpers";

export function SimpleFinancePage() {
  const { projects, estimateSummaries, supplierPayments, clientPayments } = useAppData();
  const { openAdvanced } = useMode();

  const totals = useMemo(() => {
    const revenue = estimateSummaries.reduce((sum, estimate) => sum + (estimate.finalFixedPrice ?? estimate.estimatedBudgetMax), 0);
    const cost = estimateSummaries.reduce((sum, estimate) => sum + estimate.internalCost, 0);
    return { revenue, cost, margin: revenue - cost };
  }, [estimateSummaries]);
  const owed = supplierPayments.reduce((sum, payment) => sum + payment.amountOwed - payment.amountPaid, 0);
  const waiting = clientPayments.filter((payment) => payment.status !== "received");

  return (
    <div className="simple-page">
      <header className="simple-head"><h1>כספים</h1></header>

      <section className="simple-money-grid">
        <div className="card simple-money"><span>הכנסה מלקוחות</span><strong>{currency.format(totals.revenue)}</strong></div>
        <div className="card simple-money"><span>עלות ספקים</span><strong>{currency.format(totals.cost)}</strong></div>
        <div className="card simple-money"><span>רווח משוער</span><strong>{currency.format(totals.margin)}</strong></div>
        <div className="card simple-money"><span>חוב לספקים</span><strong>{currency.format(owed)}</strong></div>
      </section>

      <section className="card simple-card">
        <h2>תשלומים ממתינים</h2>
        {waiting.length === 0 ? <p className="simple-note">אין תשלומים פתוחים.</p> : (
          <div className="simple-list">
            {waiting.map((payment) => (
              <button
                key={payment.id}
                type="button"
                className="card simple-row"
                onClick={() => openAdvanced("payments-hours", { projectId: payment.projectId })}
              >
                <span className="simple-row-title">
                  {projects.find((project) => project.id === payment.projectId)?.name ?? "פרויקט"}
                </span>
                <span className="simple-note">{currency.format(payment.amount)}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <div className="simple-actions-row">
        <button type="button" onClick={() => openAdvanced("pricing-margin")}>פתח תמחור ורווחיות מלא</button>
        <button type="button" onClick={() => openAdvanced("payments-hours")}>פתח תשלומים ובנק שעות</button>
      </div>
    </div>
  );
}
