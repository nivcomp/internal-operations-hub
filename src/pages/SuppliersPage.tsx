import { useRef, useState, type FormEvent } from "react";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { MutationKeys, useAppData, type NewSupplierInput } from "../context/AppDataContext";
import { formatRate, supplierStatusLabels } from "../lib/domainHelpers";

type SuppliersPageProps = {
  onSupplierSelect: (supplierId: string) => void;
};

const emptyForm = {
  name: "",
  email: "",
  phone: "",
  country: "",
  timezone: "",
  status: "pending_review" as NewSupplierInput["status"],
  mainSkills: "",
  hourlyRate: "",
  currency: "ILS",
  weeklyAvailabilityHours: "",
  notes: "",
};

export function SuppliersPage({ onSupplierSelect }: SuppliersPageProps) {
  const { suppliers, supplierProfiles, createSupplier, isPending, getError, getSuccess } = useAppData();
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const key = MutationKeys.createSupplier;
  const saving = isPending(key);
  const error = formError ?? getError(key);
  const success = getSuccess(key);

  function openForm() {
    setShowForm(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  function set<K extends keyof typeof emptyForm>(field: K, value: (typeof emptyForm)[K]) {
    setFormError(null);
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    if (!form.name.trim() || !form.email.trim()) {
      setFormError("Supplier name and email are required.");
      return;
    }
    setFormError(null);
    try {
      const persisted = await createSupplier({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        country: form.country.trim(),
        timezone: form.timezone.trim(),
        status: form.status,
        mainSkills: form.mainSkills.split(",").map((s) => s.trim()).filter(Boolean),
        hourlyRate: Number(form.hourlyRate) || 0,
        currency: form.currency.trim() || "ILS",
        weeklyAvailabilityHours: Number(form.weeklyAvailabilityHours) || 0,
        notes: form.notes.trim(),
      });
      // Only clear the form once the row is safely persisted.
      setForm(emptyForm);
      setShowForm(false);
      onSupplierSelect(persisted.id);
    } catch {
      // Values are preserved so Yaniv can retry without retyping.
    }
  }

  return (
    <>
      <PageHeader title="Suppliers" subtitle="Supplier records track capability, availability, cost, and approval status for Yaniv's internal use." />

      <div className="action-row page-action-row">
        <button className="primary-button" type="button" onClick={openForm}>Add supplier</button>
      </div>

      <section className="card">
        <h2>Supplier list</h2>
        {suppliers.length === 0 ? (
          <div className="empty-state inline-empty-state">
            <h3>No suppliers yet</h3>
            <p>Add your first supplier so you can assign delivery work and invite them to the supplier portal.</p>
            <button className="primary-button" type="button" onClick={openForm}>Add your first supplier</button>
          </div>
        ) : (
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
                    <td>
                      <StatusBadge
                        label={supplierStatusLabels[supplier.status]}
                        tone={supplier.status === "approved" ? "success" : "warning"}
                      />
                    </td>
                    <td>{supplier.timezone || "Not set"}</td>
                    <td>{profile?.mainSkills.join(", ") || "Not set"}</td>
                    <td>{profile ? `${formatRate(profile.hourlyRate, profile.currency)}/hr` : "Unknown"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {showForm ? (
        <div ref={formRef}>
          <section className="card form-panel">
            <h2>Add supplier</h2>
            <form className="form-grid" onSubmit={handleSubmit}>
              <label>
                Supplier name
                <input required value={form.name} onChange={(e) => set("name", e.target.value)} />
              </label>
              <label>
                Email
                <input type="email" required value={form.email} onChange={(e) => set("email", e.target.value)} />
              </label>
              <label>
                Phone
                <input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
              </label>
              <label>
                Country
                <input value={form.country} onChange={(e) => set("country", e.target.value)} />
              </label>
              <label>
                Timezone
                <input placeholder="Europe/London" value={form.timezone} onChange={(e) => set("timezone", e.target.value)} />
              </label>
              <label>
                Status
                <select value={form.status} onChange={(e) => set("status", e.target.value as NewSupplierInput["status"])}>
                  <option value="pending_review">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="inactive">Paused</option>
                </select>
              </label>
              <label className="span-2">
                Main skills (comma separated)
                <input value={form.mainSkills} onChange={(e) => set("mainSkills", e.target.value)} />
              </label>
              <label>
                Hourly rate
                <input type="number" min="0" step="1" value={form.hourlyRate} onChange={(e) => set("hourlyRate", e.target.value)} />
              </label>
              <label>
                Currency
                <select value={form.currency} onChange={(e) => set("currency", e.target.value)}>
                  <option value="ILS">ILS</option>
                  <option value="USD">USD</option>
                  <option value="GBP">GBP</option>
                </select>
              </label>
              <label>
                Weekly availability (hours)
                <input type="number" min="0" step="1" value={form.weeklyAvailabilityHours} onChange={(e) => set("weeklyAvailabilityHours", e.target.value)} />
              </label>
              <label className="span-2">
                Internal notes
                <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} />
              </label>
              <div className="form-actions">
                <button className="primary-button" type="submit" disabled={saving}>
                  {saving ? "Saving…" : "Create supplier"}
                </button>
                <button type="button" onClick={() => setShowForm(false)} disabled={saving}>Cancel</button>
              </div>
              {error ? <p className="form-error" role="alert">{error}</p> : null}
              {success && !error ? <p className="form-success">{success}</p> : null}
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
