import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { agency } from "../config/app";
import { useAppData } from "../context/AppDataContext";
import { currency, getProjectName } from "../lib/domainHelpers";

export function PricingMarginPage() {
  const { projects, projectPricing, phasePricing } = useAppData();
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
            {projectPricing.map((pricing) => (
              <tr key={pricing.id}>
                <td>{getProjectName(pricing.projectId, projects)}</td>
                <td>{currency.format(pricing.clientPrice)}</td>
                <td>{currency.format(pricing.supplierCostEstimate)}</td>
                <td><StatusBadge label={`${pricing.actualMarginPercent}%`} tone={pricing.actualMarginPercent >= agency.marginTargetPercent ? "success" : "danger"} /></td>
                <td>{pricing.pricingNotes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="card">
        <h2>Phase pricing</h2>
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
              const pricing = projectPricing.find((item) => item.id === phase.pricingId);
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
      </section>
    </>
  );
}
