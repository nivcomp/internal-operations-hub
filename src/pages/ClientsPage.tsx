import { type FormEvent, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { MutationKeys, useAppData, type NewClientInput } from "../context/AppDataContext";
import type { Client } from "../types/domain";

type ClientsPageProps = {
  clients: Client[];
  onClientCreate: (input: NewClientInput) => Promise<unknown>;
  onClientSelect: (clientId: string) => void;
};

const initialForm: NewClientInput = {
  name: "",
  company: "",
  email: "",
  phone: "",
  notes: "",
  status: "lead",
};

export function ClientsPage({ clients, onClientCreate, onClientSelect }: ClientsPageProps) {
  const [form, setForm] = useState<NewClientInput>(initialForm);
  const { isPending, getError, getSuccess } = useAppData();
  const key = MutationKeys.createClient;
  const saving = isPending(key);
  const error = getError(key);
  const success = getSuccess(key);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    if (!form.name.trim() || !form.company.trim() || !form.email.trim()) return;
    try {
      await onClientCreate({
        ...form,
        name: form.name.trim(),
        company: form.company.trim(),
        email: form.email.trim(),
        phone: form.phone?.trim(),
        notes: form.notes.trim(),
      });
      setForm(initialForm);
    } catch {
      // Provider recorded the error; keep the form values so the user can retry.
    }
  }

  return (
    <>
      <PageHeader title="Clients" subtitle="Client records are operational notes, not public account pages." />
      <section className="card form-panel">
        <h2>Add lead or client</h2>
        <form className="form-grid" onSubmit={handleSubmit}>
          <label>
            Name
            <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </label>
          <label>
            Company
            <input value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} />
          </label>
          <label>
            Email
            <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          </label>
          <label>
            Phone
            <input value={form.phone ?? ""} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
          </label>
          <label>
            Status
            <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as NewClientInput["status"] })}>
              <option value="lead">Lead</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
            </select>
          </label>
          <label className="span-2">
            Notes
            <textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
          </label>
          <div className="form-actions">
            <button className="primary-button" type="submit" disabled={saving}>
              {saving ? "Saving…" : "Add and open client"}
            </button>
          </div>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          {success && !error ? <p className="form-success">{success}</p> : null}
        </form>
      </section>
      <section className="card">
        <table>
          <thead>
            <tr>
              <th>Client</th>
              <th>Company</th>
              <th>Status</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((client) => (
              <tr key={client.id} className="clickable-row" onClick={() => onClientSelect(client.id)}>
                <td>{client.name}</td>
                <td>{client.company}</td>
                <td><StatusBadge label={client.status} tone={client.status === "lead" ? "warning" : "success"} /></td>
                <td>{client.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
