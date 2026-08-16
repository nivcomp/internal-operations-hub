import { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState } from "../components/ui/EmptyState";
import {
  CASH_FLOW_LEAD_STATUSES,
  listCashFlowLeads,
  updateCashFlowLeadStatus,
  type CashFlowLead,
  type CashFlowLeadStatus,
} from "../services/cashFlowLeadsApi";

const STATUS_LABELS: Record<CashFlowLeadStatus, string> = {
  new: "חדש",
  contacted: "נוצר קשר",
  qualified: "מתאים",
  not_relevant: "לא רלוונטי",
  converted: "הומר ללקוח",
};

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
                    </tr>
                  ))}
                </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}
