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
  new: "׳—׳“׳©",
  contacted: "׳ ׳•׳¦׳¨ ׳§׳©׳¨",
  qualified: "׳׳×׳׳™׳",
  not_relevant: "׳׳ ׳¨׳׳•׳•׳ ׳˜׳™",
  converted: "׳”׳•׳׳¨ ׳׳׳§׳•׳—",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("he-IL", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function accountingSystemLabel(lead: CashFlowLead) {
  if (lead.accounting_system !== "׳׳—׳¨") return lead.accounting_system;
  return lead.accounting_system_other ? `׳׳—׳¨ ג€” ${lead.accounting_system_other}` : "׳׳—׳¨";
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
      setError("׳׳ ׳”׳¦׳׳—׳ ׳• ׳׳˜׳¢׳•׳ ׳׳× ׳”׳׳™׳“׳™׳. ׳•׳“׳׳• ׳©׳׳™׳’׳¨׳¦׳™׳™׳× ׳‘׳¡׳™׳¡ ׳”׳ ׳×׳•׳ ׳™׳ ׳”׳•׳—׳׳” ׳•׳ ׳¡׳• ׳©׳•׳‘.");
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
      setError("׳׳ ׳”׳¦׳׳—׳ ׳• ׳׳¢׳“׳›׳ ׳׳× ׳¡׳˜׳˜׳•׳¡ ׳”׳׳™׳“. ׳ ׳¡׳• ׳©׳•׳‘.");
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
        "׳×׳׳¨׳™׳ ׳§׳׳™׳˜׳”": formatDate(lead.created_at),
        "׳©׳ ׳₪׳¨׳˜׳™": lead.first_name,
        "׳©׳ ׳׳©׳₪׳—׳”": lead.last_name,
        "׳©׳ ׳׳׳": `${lead.first_name} ${lead.last_name}`,
        "׳©׳ ׳—׳‘׳¨׳”": lead.company_name,
        "׳˜׳׳₪׳•׳": lead.phone ?? "",
        "׳˜׳׳₪׳•׳ ׳¡׳׳•׳׳¨׳™": lead.mobile_phone,
        "׳׳™׳׳™׳™׳": lead.email,
        "׳›׳×׳•׳‘׳× ׳₪׳™׳–׳™׳×": lead.physical_address ?? "",
        "׳¡׳™׳‘׳× ׳”׳₪׳ ׳™׳™׳”": lead.reason_for_cash_flow_software,
        "׳׳¢׳¨׳›׳× ׳”׳ ׳”׳׳× ׳—׳©׳‘׳•׳ ׳•׳×": lead.accounting_system,
        "׳׳¢׳¨׳›׳× ׳׳—׳¨׳×": lead.accounting_system_other ?? "",
        "׳”׳¢׳¨׳•׳×": lead.notes ?? "",
        "׳׳§׳•׳¨": lead.source,
        "׳¡׳˜׳˜׳•׳¡": STATUS_LABELS[lead.status as CashFlowLeadStatus],
      }));
      const worksheet = XLSX.utils.json_to_sheet(rows);
      worksheet["!cols"] = [
        { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 24 }, { wch: 24 },
        { wch: 16 }, { wch: 18 }, { wch: 28 }, { wch: 30 }, { wch: 45 },
        { wch: 24 }, { wch: 24 }, { wch: 40 }, { wch: 22 }, { wch: 16 },
      ];
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "׳׳™׳“׳™׳ ׳×׳–׳¨׳™׳");
      const date = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(workbook, `amir-cashflow-leads-${date}.xlsx`, { compression: true });
    } catch {
      setExportError("׳׳ ׳”׳¦׳׳—׳ ׳• ׳׳™׳¦׳•׳¨ ׳׳× ׳§׳•׳‘׳¥ ׳”׳׳§׳¡׳. ׳ ׳¡׳• ׳©׳•׳‘.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="cashflow-admin-page" dir="rtl" lang="he">
      <header className="page-header">
        <div>
          <p className="eyebrow">׳ ׳™׳‘ ׳׳—׳©׳‘׳™׳</p>
          <h1>׳׳™׳“׳™׳ ׳×׳–׳¨׳™׳</h1>
          <p>׳׳™׳“׳™׳ ׳©׳”׳×׳§׳‘׳׳• ׳׳˜׳•׳₪׳¡ ׳׳׳™׳¨ ׳×׳–׳¨׳™׳ ׳׳–׳•׳׳ ׳™׳.</p>
        </div>
        <div className="control-note">׳”׳¨׳©׳™׳׳” ׳•׳”׳¡׳˜׳˜׳•׳¡׳™׳ ׳–׳׳™׳ ׳™׳ ׳׳׳ ׳”׳׳™ ׳”׳¡׳•׳›׳ ׳•׳× ׳‘׳׳‘׳“.</div>
      </header>

      {error ? (
        <div className="cashflow-admin-error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => void load()}>׳ ׳¡׳” ׳©׳•׳‘</button>
        </div>
      ) : null}

      {loading ? (
        <section className="card"><p className="muted-text">׳˜׳•׳¢׳ ׳׳™׳“׳™׳ג€¦</p></section>
      ) : leads.length === 0 ? (
        <EmptyState
          title="׳¢׳“׳™׳™׳ ׳׳ ׳”׳×׳§׳‘׳׳• ׳׳™׳“׳™׳"
          description="׳׳™׳“׳™׳ ׳©׳™׳™׳©׳׳—׳• ׳׳”׳¢׳׳•׳“ /amir-cashflow ׳™׳•׳₪׳™׳¢׳• ׳›׳׳."
        />
      ) : (
        <section className="card cashflow-leads-card">
          <div className="cashflow-leads-toolbar">
            <label>
              <span>׳—׳™׳₪׳•׳© ׳‘׳׳™׳“׳™׳</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="׳©׳, ׳—׳‘׳¨׳”, ׳˜׳׳₪׳•׳, ׳׳™׳׳™׳™׳ ׳׳• ׳׳¢׳¨׳›׳×"
              />
            </label>
            <div className="cashflow-leads-toolbar-actions">
              <span>{filteredLeads.length} ׳׳×׳•׳ {leads.length} ׳׳™׳“׳™׳</span>
              <button type="button" onClick={() => void exportAllLeads()} disabled={exporting || leads.length === 0}>
                {exporting ? "׳׳›׳™׳ ׳§׳•׳‘׳¥ג€¦" : "׳”׳•׳¨׳“׳× ׳›׳ ׳”׳׳™׳“׳™׳ ׳׳׳§׳¡׳"}
              </button>
            </div>
          </div>
          {exportError ? <p className="cashflow-export-error" role="alert">{exportError}</p> : null}

          {filteredLeads.length === 0 ? (
            <p className="muted-text">׳׳ ׳ ׳׳¦׳׳• ׳׳™׳“׳™׳ ׳©׳׳×׳׳™׳׳™׳ ׳׳—׳™׳₪׳•׳©.</p>
          ) : (
            <>
              <div className="cashflow-leads-mobile" aria-label="׳¨׳©׳™׳׳× ׳׳™׳“׳™׳">
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
                      ׳”׳×׳§׳©׳¨ ׳¢׳›׳©׳™׳•
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
                      <dt>׳׳¢׳¨׳›׳× ׳”׳ ׳”׳׳× ׳—׳©׳‘׳•׳ ׳•׳×</dt>
                      <dd>{accountingSystemLabel(lead)}</dd>
                    </div>
                    <div>
                      <dt>׳¡׳™׳‘׳× ׳”׳₪׳ ׳™׳™׳”</dt>
                      <dd>{lead.reason_for_cash_flow_software}</dd>
                    </div>
                  </dl>

                  <label className="cashflow-mobile-status">
                    <span>׳¡׳˜׳˜׳•׳¡</span>
                    <select
                      value={lead.status}
                      disabled={updatingId === lead.id}
                      aria-label={`׳¡׳˜׳˜׳•׳¡ ׳׳™׳“ ${lead.first_name} ${lead.last_name}`}
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
                    <th>׳×׳׳¨׳™׳ ׳™׳¦׳™׳¨׳”</th>
                    <th>׳©׳ ׳׳׳</th>
                    <th>׳—׳‘׳¨׳”</th>
                    <th>׳˜׳׳₪׳•׳ ׳¡׳׳•׳׳¨׳™</th>
                    <th>׳׳™׳׳™׳™׳</th>
                    <th>׳׳¢׳¨׳›׳× ׳”׳ ׳”׳׳× ׳—׳©׳‘׳•׳ ׳•׳×</th>
                    <th>׳¡׳™׳‘׳× ׳”׳₪׳ ׳™׳™׳”</th>
                    <th>׳¡׳˜׳˜׳•׳¡</th>
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
                            ׳”׳×׳§׳©׳¨
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
                          aria-label={`׳¡׳˜׳˜׳•׳¡ ׳׳™׳“ ${lead.first_name} ${lead.last_name}`}
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

