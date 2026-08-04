import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { agency } from "../config/app";
import { useAppData } from "../context/AppDataContext";
import { currency, getProjectName } from "../lib/domainHelpers";

const money = (value: number, code: string) => new Intl.NumberFormat("he-IL", {
  style: "currency", currency: code || "ILS", maximumFractionDigits: 0,
}).format(value);

export function PricingMarginPage() {
  const { projects, projectPricing, phasePricing, estimateSummaries } = useAppData();
  const legacyPricing = projectPricing.filter((row) => !estimateSummaries.some((estimate) => estimate.projectId === row.projectId));
  return (
    <>
      <PageHeader title="Pricing / Margin" subtitle="Yaniv sees client price, supplier cost, and margin together. Suppliers never see this page." />
      <section className="card">
        <table>
          <thead>
            <tr>
              <th>Project</th>
              <th>Client price</th>
              <th>Supplier cost</th>
              <th>Margin</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {estimateSummaries.map((estimate) => {
              const clientPrice = estimate.finalFixedPrice ?? estimate.estimatedBudgetMax;
              const margin = clientPrice > 0 ? Math.round(((clientPrice - estimate.internalCost) / clientPrice) * 100) : 0;
              return <tr key={estimate.estimateId}>
                <td>{getProjectName(estimate.projectId, projects)}</td>
                <td>{money(clientPrice, estimate.currency)}{estimate.finalFixedPrice == null && estimate.estimatedBudgetMin !== estimate.estimatedBudgetMax ? ` (${money(estimate.estimatedBudgetMin, estimate.currency)}–${money(estimate.estimatedBudgetMax, estimate.currency)})` : ""}</td>
                <td>{money(estimate.internalCost, estimate.currency)}</td>
                <td><StatusBadge label={`${margin}%`} tone={margin >= agency.marginTargetPercent ? "success" : "danger"} /></td>
                <td>{money(estimate.clientCalculationRate, estimate.currency)} / hour · estimate v{estimate.version}</td>
              </tr>
            })}
            {!estimateSummaries.length && <tr><td colSpan={5}>No project estimates yet.</td></tr>}
          </tbody>
        </table>
      </section>
      {!!legacyPricing.length && <section className="card">
        <h2>Legacy pricing (read-only)</h2>
        <table>
          <thead>
            <tr>
              <th>Phase</th>
              <th>Project</th>
              <th>Client price</th>
              <th>Supplier cost</th>
            </tr>
          </thead>
          <tbody>
            {phasePricing.map((phase) => {
              const pricing = legacyPricing.find((item) => item.id === phase.pricingId);
              if (!pricing) return null;
              return (
                <tr key={phase.id}>
                  <td>{phase.phaseName}</td>
                  <td>{pricing ? getProjectName(pricing.projectId, projects) : "Unknown"}</td>
                  <td>{currency.format(phase.clientPrice)}</td>
                  <td>{currency.format(phase.supplierCost)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>}
    </>
  );
}
