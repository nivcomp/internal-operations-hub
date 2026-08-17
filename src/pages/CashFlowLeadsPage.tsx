import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { EmptyState } from "../components/ui/EmptyState";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import {
  ACCOUNTING_SYSTEM_OPTIONS,
  CASH_FLOW_LEAD_STATUSES,
  deleteCashFlowLead,
  listCashFlowLeads,
  updateCashFlowLead,
  updateCashFlowLeadStatus,
  type CashFlowLead,
  type CashFlowLeadDetailsInput,
  type CashFlowLeadStatus,
} from "../services/cashFlowLeadsApi";

const STATUS_LABELS: Record<CashFlowLeadStatus, string> = {
  new: "חדש",
  contacted: "נוצר קשר",
  qualified: "מתאים",
  not_relevant: "לא רלוונטי",
  converted: "הומר ללקוח",
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type EditField = keyof CashFlowLeadDetailsInput;
type EditErrors = Partial<Record<EditField, string>>;

function leadToEditInput(lead: CashFlowLead): CashFlowLeadDetailsInput {
  return {
    firstName: lead.first_name,
    lastName: lead.last_name,
    companyName: lead.company_name,
    phone: lead.phone ?? "",
    mobilePhone: lead.mobile_phone,
    email: lead.email,
    physicalAddress: lead.physical_address ?? "",
    reasonForCashFlowSoftware: lead.reason_for_cash_flow_software,
    accountingSystem: lead.accounting_system,
    accountingSystemOther: lead.accounting_system_other ?? "",
    notes: lead.notes ?? "",
  };
}

function trimEditInput(input: CashFlowLeadDetailsInput): CashFlowLeadDetailsInput {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key, value.trim()]),
  ) as CashFlowLeadDetailsInput;
}

function validateEdit(input: CashFlowLeadDetailsInput): EditErrors {
  const errors: EditErrors = {};
  const required: Array<[EditField, string]> = [
    ["firstName", "יש להזין שם פרטי."],
    ["lastName", "יש להזין שם משפחה."],
    ["companyName", "יש להזין שם חברה."],
    ["mobilePhone", "יש להזין טלפון סלולרי."],
    ["email", "יש להזין אימייל."],
    ["reasonForCashFlowSoftware", "יש להזין את סיבת הפנייה."],
    ["accountingSystem", "יש לבחור מערכת הנהלת חשבונות."],
  ];
  required.forEach(([field, message]) => {
    if (!input[field]) errors[field] = message;
  });
  if (input.email && !EMAIL_PATTERN.test(input.email)) errors.email = "כתובת האימייל אינה תקינה.";
  if (input.accountingSystem === "אחר" && !input.accountingSystemOther) {
    errors.accountingSystemOther = "יש להזין את שם המערכת.";
  }
  return errors;
}

function EditFieldError({ id, message }: { id: string; message?: string }) {
  return message ? <span id={id} className="cashflow-edit-field-error" role="alert">{message}</span> : null;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("he-IL", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function accountingSystemLabel(lead: CashFlowLead) {
  if (lead.accounting_system !== "אחר") return lead.accounting_system;
  return lead.accounting_system_other ? `אחר — ${lead.accounting_system_other}` : "אחר";
}

function phoneHref(value: string) {
  const normalized = value.trim().replace(/(?!^\+)[^\d]/g, "");
  return `tel:${normalized}`;
}

export function CashFlowLeadsPage() {
  const [leads, setLeads] = useState<CashFlowLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [editingLead, setEditingLead] = useState<CashFlowLead | null>(null);
  const [editForm, setEditForm] = useState<CashFlowLeadDetailsInput | null>(null);
  const [editErrors, setEditErrors] = useState<EditErrors>({});
  const [editSaving, setEditSaving] = useState(false);
  const [editSubmitError, setEditSubmitError] = useState<string | null>(null);
  const [deletingLead, setDeletingLead] = useState<CashFlowLead | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setLeads(await listCashFlowLeads());
      setError(null);
    } catch {
      setError("לא הצלחנו לטעון את הלידים. ודאו שמיגרציית בסיס הנתונים הוחלה ונסו שוב.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filteredLeads = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("he");
    if (!needle) return leads;
    return leads.filter((lead) => [
      lead.first_name,
      lead.last_name,
      lead.company_name,
      lead.mobile_phone,
      lead.email,
      lead.accounting_system,
      lead.accounting_system_other ?? "",
      lead.reason_for_cash_flow_software,
    ].join(" ").toLocaleLowerCase("he").includes(needle));
  }, [leads, search]);

  async function changeStatus(lead: CashFlowLead, status: CashFlowLeadStatus) {
    if (lead.status === status || updatingId) return;
    setUpdatingId(lead.id);
    setError(null);
    try {
      const updated = await updateCashFlowLeadStatus(lead.id, status);
      setLeads((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch {
      setError("לא הצלחנו לעדכן את סטטוס הליד. נסו שוב.");
    } finally {
      setUpdatingId(null);
    }
  }

  function openEdit(lead: CashFlowLead) {
    setEditingLead(lead);
    setEditForm(leadToEditInput(lead));
    setEditErrors({});
    setEditSubmitError(null);
    setActionMessage(null);
  }

  function closeEdit() {
    if (editSaving) return;
    setEditingLead(null);
    setEditForm(null);
    setEditErrors({});
    setEditSubmitError(null);
  }

  function updateEdit(field: EditField, value: string) {
    setEditForm((current) => current ? { ...current, [field]: value } : current);
    setEditErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingLead || !editForm || editSaving) return;
    const trimmed = trimEditInput(editForm);
    const nextErrors = validateEdit(trimmed);
    setEditForm(trimmed);
    setEditErrors(nextErrors);
    setEditSubmitError(null);
    if (Object.keys(nextErrors).length > 0) return;

    setEditSaving(true);
    try {
      const updated = await updateCashFlowLead(editingLead.id, trimmed);
      setLeads((current) => current.map((lead) => lead.id === updated.id ? updated : lead));
      setEditingLead(null);
      setEditForm(null);
      setActionMessage(`הפרטים של ${updated.first_name} ${updated.last_name} עודכנו בהצלחה.`);
    } catch {
      setEditSubmitError("לא הצלחנו לשמור את השינויים. נסו שוב.");
    } finally {
      setEditSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deletingLead || deleteBusy) return;
    const lead = deletingLead;
    setDeleteBusy(true);
    setError(null);
    try {
      await deleteCashFlowLead(lead.id);
      setLeads((current) => current.filter((item) => item.id !== lead.id));
      setDeletingLead(null);
      setActionMessage(`הליד של ${lead.first_name} ${lead.last_name} נמחק.`);
    } catch {
      setDeletingLead(null);
      setError("לא הצלחנו למחוק את הליד. נסו שוב.");
    } finally {
      setDeleteBusy(false);
    }
  }

  async function exportAllLeads() {
    if (leads.length === 0 || exporting) return;
    setExporting(true);
    setExportError(null);
    try {
      const XLSX = await import("xlsx");
      const rows = leads.map((lead) => ({
        "תאריך קליטה": formatDate(lead.created_at),
        "שם פרטי": lead.first_name,
        "שם משפחה": lead.last_name,
        "שם מלא": `${lead.first_name} ${lead.last_name}`,
        "שם חברה": lead.company_name,
        "טלפון": lead.phone ?? "",
        "טלפון סלולרי": lead.mobile_phone,
        "אימייל": lead.email,
        "כתובת פיזית": lead.physical_address ?? "",
        "סיבת הפנייה": lead.reason_for_cash_flow_software,
        "מערכת הנהלת חשבונות": lead.accounting_system,
        "מערכת אחרת": lead.accounting_system_other ?? "",
        "הערות": lead.notes ?? "",
        "מקור": lead.source,
        "סטטוס": STATUS_LABELS[lead.status as CashFlowLeadStatus],
      }));
      const worksheet = XLSX.utils.json_to_sheet(rows);
      worksheet["!cols"] = [
        { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 24 }, { wch: 24 },
        { wch: 16 }, { wch: 18 }, { wch: 28 }, { wch: 30 }, { wch: 45 },
        { wch: 24 }, { wch: 24 }, { wch: 40 }, { wch: 22 }, { wch: 16 },
      ];
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "לידים תזרים");
      const date = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(workbook, `amir-cashflow-leads-${date}.xlsx`, { compression: true });
    } catch {
      setExportError("לא הצלחנו ליצור את קובץ האקסל. נסו שוב.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="cashflow-admin-page" dir="rtl" lang="he">
      <header className="page-header">
        <div>
          <p className="eyebrow">ניב מחשבים</p>
          <h1>לידים תזרים</h1>
          <p>לידים שהתקבלו מטופס אמיר תזרים מזומנים.</p>
        </div>
        <div className="control-note">הרשימה והסטטוסים זמינים למנהלי הסוכנות בלבד.</div>
      </header>

      {actionMessage ? <div className="cashflow-admin-success" role="status">{actionMessage}</div> : null}

      {error ? (
        <div className="cashflow-admin-error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => void load()}>נסה שוב</button>
        </div>
      ) : null}

      {loading ? (
        <section className="card"><p className="muted-text">טוען לידים…</p></section>
      ) : leads.length === 0 ? (
        <EmptyState
          title="עדיין לא התקבלו לידים"
          description="לידים שיישלחו מהעמוד /amir-cashflow יופיעו כאן."
        />
      ) : (
        <section className="card cashflow-leads-card">
          <div className="cashflow-leads-toolbar">
            <label>
              <span>חיפוש בלידים</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="שם, חברה, טלפון, אימייל או מערכת"
              />
            </label>
            <div className="cashflow-leads-toolbar-actions">
              <span>{filteredLeads.length} מתוך {leads.length} לידים</span>
              <button type="button" onClick={() => void exportAllLeads()} disabled={exporting || leads.length === 0}>
                {exporting ? "מכין קובץ…" : "הורדת כל הלידים לאקסל"}
              </button>
            </div>
          </div>
          {exportError ? <p className="cashflow-export-error" role="alert">{exportError}</p> : null}

          {filteredLeads.length === 0 ? (
            <p className="muted-text">לא נמצאו לידים שמתאימים לחיפוש.</p>
          ) : (
            <>
              <div className="cashflow-leads-mobile" aria-label="רשימת לידים">
              {filteredLeads.map((lead) => (
                <article className="cashflow-lead-mobile-card" key={lead.id}>
                  <div className="cashflow-lead-mobile-heading">
                    <div>
                      <strong>{lead.first_name} {lead.last_name}</strong>
                      <span>{lead.company_name}</span>
                    </div>
                    <time dateTime={lead.created_at}>{formatDate(lead.created_at)}</time>
                  </div>

                  <div className="cashflow-lead-contact-actions">
                    <a className="cashflow-call-button" href={phoneHref(lead.mobile_phone)}>
                      התקשר עכשיו
                    </a>
                    <a className="cashflow-phone-link" href={phoneHref(lead.mobile_phone)} dir="ltr">
                      {lead.mobile_phone}
                    </a>
                    <a className="cashflow-email-link" href={`mailto:${lead.email}`} dir="ltr">
                      {lead.email}
                    </a>
                  </div>

                  <dl className="cashflow-lead-mobile-details">
                    <div>
                      <dt>מערכת הנהלת חשבונות</dt>
                      <dd>{accountingSystemLabel(lead)}</dd>
                    </div>
                    <div>
                      <dt>סיבת הפנייה</dt>
                      <dd>{lead.reason_for_cash_flow_software}</dd>
                    </div>
                  </dl>

                  <label className="cashflow-mobile-status">
                    <span>סטטוס</span>
                    <select
                      value={lead.status}
                      disabled={updatingId === lead.id}
                      aria-label={`סטטוס ליד ${lead.first_name} ${lead.last_name}`}
                      onChange={(event) => void changeStatus(lead, event.target.value as CashFlowLeadStatus)}
                    >
                      {CASH_FLOW_LEAD_STATUSES.map((status) => (
                        <option key={status} value={status}>{STATUS_LABELS[status]}</option>
                      ))}
                    </select>
                  </label>

                  <div className="cashflow-lead-management-actions">
                    <button type="button" onClick={() => openEdit(lead)}>עריכת ליד</button>
                    <button type="button" className="danger-link" onClick={() => setDeletingLead(lead)}>מחיקת ליד</button>
                  </div>
                </article>
              ))}
              </div>

              <div className="table-scroll cashflow-leads-desktop">
                <table>
                <thead>
                  <tr>
                    <th>תאריך יצירה</th>
                    <th>שם מלא</th>
                    <th>חברה</th>
                    <th>טלפון סלולרי</th>
                    <th>אימייל</th>
                    <th>מערכת הנהלת חשבונות</th>
                    <th>סיבת הפנייה</th>
                    <th>סטטוס</th>
                    <th>פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map((lead) => (
                    <tr key={lead.id}>
                      <td><time dateTime={lead.created_at}>{formatDate(lead.created_at)}</time></td>
                      <td><strong>{lead.first_name} {lead.last_name}</strong></td>
                      <td>{lead.company_name}</td>
                      <td>
                        <div className="cashflow-table-phone">
                          <a href={phoneHref(lead.mobile_phone)} dir="ltr">{lead.mobile_phone}</a>
                          <a className="cashflow-call-button cashflow-call-button-compact" href={phoneHref(lead.mobile_phone)}>
                            התקשר
                          </a>
                        </div>
                      </td>
                      <td dir="ltr"><a href={`mailto:${lead.email}`}>{lead.email}</a></td>
                      <td>{accountingSystemLabel(lead)}</td>
                      <td className="cashflow-reason-cell">{lead.reason_for_cash_flow_software}</td>
                      <td>
                        <select
                          value={lead.status}
                          disabled={updatingId === lead.id}
                          aria-label={`סטטוס ליד ${lead.first_name} ${lead.last_name}`}
                          onChange={(event) => void changeStatus(lead, event.target.value as CashFlowLeadStatus)}
                        >
                          {CASH_FLOW_LEAD_STATUSES.map((status) => (
                            <option key={status} value={status}>{STATUS_LABELS[status]}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <div className="cashflow-lead-table-actions">
                          <button type="button" onClick={() => openEdit(lead)}>עריכה</button>
                          <button type="button" className="danger-link" onClick={() => setDeletingLead(lead)}>מחיקה</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}

      {editingLead && editForm ? (
        <div className="dialog-backdrop cashflow-edit-backdrop" role="presentation" onClick={closeEdit}>
          <section
            className="cashflow-edit-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cashflow-edit-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="cashflow-edit-dialog-header">
              <div>
                <p className="eyebrow">עריכת ליד</p>
                <h2 id="cashflow-edit-title">{editingLead.first_name} {editingLead.last_name}</h2>
              </div>
              <button type="button" className="cashflow-edit-close" onClick={closeEdit} disabled={editSaving} aria-label="סגירת חלון העריכה">×</button>
            </header>

            <form className="form-grid cashflow-edit-form" onSubmit={(event) => void saveEdit(event)} noValidate>
              <label>
                שם פרטי <b aria-hidden>*</b>
                <input value={editForm.firstName} onChange={(event) => updateEdit("firstName", event.target.value)} required aria-invalid={Boolean(editErrors.firstName)} />
                <EditFieldError id="edit-first-name-error" message={editErrors.firstName} />
              </label>
              <label>
                שם משפחה <b aria-hidden>*</b>
                <input value={editForm.lastName} onChange={(event) => updateEdit("lastName", event.target.value)} required aria-invalid={Boolean(editErrors.lastName)} />
                <EditFieldError id="edit-last-name-error" message={editErrors.lastName} />
              </label>
              <label className="span-2">
                שם חברה <b aria-hidden>*</b>
                <input value={editForm.companyName} onChange={(event) => updateEdit("companyName", event.target.value)} required aria-invalid={Boolean(editErrors.companyName)} />
                <EditFieldError id="edit-company-error" message={editErrors.companyName} />
              </label>
              <label>
                טלפון
                <input type="tel" dir="ltr" value={editForm.phone} onChange={(event) => updateEdit("phone", event.target.value)} />
              </label>
              <label>
                טלפון סלולרי <b aria-hidden>*</b>
                <input type="tel" dir="ltr" value={editForm.mobilePhone} onChange={(event) => updateEdit("mobilePhone", event.target.value)} required aria-invalid={Boolean(editErrors.mobilePhone)} />
                <EditFieldError id="edit-mobile-error" message={editErrors.mobilePhone} />
              </label>
              <label>
                אימייל <b aria-hidden>*</b>
                <input type="email" dir="ltr" value={editForm.email} onChange={(event) => updateEdit("email", event.target.value)} required aria-invalid={Boolean(editErrors.email)} />
                <EditFieldError id="edit-email-error" message={editErrors.email} />
              </label>
              <label>
                כתובת פיזית
                <input value={editForm.physicalAddress} onChange={(event) => updateEdit("physicalAddress", event.target.value)} />
              </label>
              <label className="span-2">
                למה מחפשים תוכנת תזרים? <b aria-hidden>*</b>
                <textarea rows={4} value={editForm.reasonForCashFlowSoftware} onChange={(event) => updateEdit("reasonForCashFlowSoftware", event.target.value)} required aria-invalid={Boolean(editErrors.reasonForCashFlowSoftware)} />
                <EditFieldError id="edit-reason-error" message={editErrors.reasonForCashFlowSoftware} />
              </label>
              <label className="span-2">
                מערכת הנהלת חשבונות <b aria-hidden>*</b>
                <select
                  value={editForm.accountingSystem}
                  onChange={(event) => {
                    updateEdit("accountingSystem", event.target.value);
                    if (event.target.value !== "אחר") updateEdit("accountingSystemOther", "");
                  }}
                  required
                  aria-invalid={Boolean(editErrors.accountingSystem)}
                >
                  <option value="">בחרו מערכת</option>
                  {ACCOUNTING_SYSTEM_OPTIONS.map((system) => <option key={system} value={system}>{system}</option>)}
                </select>
                <EditFieldError id="edit-accounting-error" message={editErrors.accountingSystem} />
              </label>
              {editForm.accountingSystem === "אחר" ? (
                <label className="span-2">
                  שם המערכת <b aria-hidden>*</b>
                  <input value={editForm.accountingSystemOther} onChange={(event) => updateEdit("accountingSystemOther", event.target.value)} required aria-invalid={Boolean(editErrors.accountingSystemOther)} />
                  <EditFieldError id="edit-accounting-other-error" message={editErrors.accountingSystemOther} />
                </label>
              ) : null}
              <label className="span-2">
                הערות נוספות
                <textarea rows={3} value={editForm.notes} onChange={(event) => updateEdit("notes", event.target.value)} />
              </label>

              {editSubmitError ? <p className="cashflow-edit-submit-error span-2" role="alert">{editSubmitError}</p> : null}
              <div className="cashflow-edit-actions span-2">
                <button type="button" onClick={closeEdit} disabled={editSaving}>ביטול</button>
                <button type="submit" className="primary-button" disabled={editSaving}>{editSaving ? "שומר שינויים…" : "שמירת שינויים"}</button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(deletingLead)}
        title="מחיקת ליד"
        description={deletingLead ? `האם למחוק לצמיתות את הליד של ${deletingLead.first_name} ${deletingLead.last_name} מחברת ${deletingLead.company_name}? לא ניתן לבטל פעולה זו.` : ""}
        confirmLabel="כן, למחוק את הליד"
        cancelLabel="ביטול"
        busyLabel="מוחק…"
        busy={deleteBusy}
        onConfirm={() => void confirmDelete()}
        onCancel={() => { if (!deleteBusy) setDeletingLead(null); }}
      />
    </div>
  );
}
