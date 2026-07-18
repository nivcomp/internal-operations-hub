import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { useAppData } from "../context/AppDataContext";
import { currency } from "../lib/domainHelpers";

type SuppliersPageProps = {
  onSupplierSelect: (supplierId: string) => void;
};

export function SuppliersPage({ onSupplierSelect }: SuppliersPageProps) {
  const { suppliers, supplierProfiles } = useAppData();
  return (
    <>
      <PageHeader title="Suppliers" subtitle="Supplier records track capability, availability, cost, and approval status for Yaniv's internal use." />
      <section className="card">
        <table>
          <thead>
            <tr>
              <th>Supplier</th>
              <th>Status</th>
              <th>Timezone</th>
              <th>Skills</th>
              <th>Rate</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((supplier) => {
              const profile = supplierProfiles.find((item) => item.supplierId === supplier.id);
              return (
                <tr key={supplier.id} className="clickable-row" onClick={() => onSupplierSelect(supplier.id)}>
                  <td>{supplier.name}</td>
                  <td><StatusBadge label={supplier.status} tone={supplier.status === "approved" ? "success" : "warning"} /></td>
                  <td>{supplier.timezone}</td>
                  <td>{profile?.mainSkills.join(", ")}</td>
                  <td>{profile ? currency.format(profile.hourlyRate) : "Unknown"}/hr</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </>
  );
}
