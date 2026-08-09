import { type FormEvent, useEffect, useState } from "react";
import { MutationKeys, useAppData, type NewClientInput } from "../../context/AppDataContext";
import type { Client } from "../../types/domain";

export function ClientEditDialog({ client, onClose }: { client: Client; onClose: () => void }) {
  const { updateClient, isPending, getError, clearMutationState } = useAppData();
  const [form, setForm] = useState<NewClientInput>({
    name: client.name,
    company: client.company,
    email: client.email,
    phone: client.phone ?? "",
    notes: client.notes,
    status: client.status,
  });
  const [validationError, setValidationError] = useState<string | null>(null);
  const key = MutationKeys.updateClient(client.id);

  useEffect(() => () => clearMutationState(key), [clearMutationState, key]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.name.trim() || !form.company.trim() || !form.email.trim()) {
      setValidationError("שם איש הקשר, שם העסק ואימייל הם שדות חובה.");
      return;
    }
    setValidationError(null);
    await updateClient(client.id, {
      ...form,
      name: form.name.trim(),
      company: form.company.trim(),
      email: form.email.trim(),
      phone: form.phone?.trim(),
      notes: form.notes.trim(),
    });
    onClose();
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="עריכת פרטי לקוח" dir="rtl" onClick={onClose}>
      <section className="modal-card" onClick={(event) => event.stopPropagation()}>
        <header className="modal-head">
          <h2>עריכת פרטי לקוח</h2>
          <button type="button" aria-label="סגירה" onClick={onClose}>×</button>
        </header>
        <form className="form-grid" onSubmit={submit}>
          <label>שם איש קשר *<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
          <label>שם העסק *<input value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} /></label>
          <label>אימייל *<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
          <label>טלפון<input value={form.phone ?? ""} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
          <label>סטטוס<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as Client["status"] })}><option value="lead">ליד</option><option value="active">פעיל</option><option value="paused">מושהה</option></select></label>
          <label className="span-2">הערות<textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
          {(validationError || getError(key)) ? <p className="form-error span-2" role="alert">{validationError ?? getError(key)}</p> : null}
          <div className="form-actions span-2">
            <button type="button" onClick={onClose}>ביטול</button>
            <button className="primary-button" type="submit" disabled={isPending(key)}>{isPending(key) ? "שומר..." : "שמור שינויים"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
