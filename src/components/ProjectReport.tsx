import { useMemo } from "react";
import type { ProjectView } from "../services/projectViewApi";
import { buildProjectFlow } from "../lib/projectFlow";
import { ProjectFlowStatic } from "./ProjectFlowDiagram";

export type ReportMode = "client" | "internal" | "supplier";

const money = (value: number, currency: string) =>
  `${currency} ${Math.round(Number(value ?? 0)).toLocaleString()}`;

const hours = (value: number) => `${Math.round(Number(value ?? 0))}h`;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="report-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="muted small">{text}</p>;
}

/**
 * Printable project report. The report can only render what the loader already
 * filtered for the viewing role, so a client report can never leak supplier cost
 * and a supplier report can never leak client price.
 */
export default function ProjectReport({
  view,
  mode,
  onClose,
}: {
  view: ProjectView;
  mode: ReportMode;
  onClose?: () => void;
}) {
  const graph = useMemo(() => buildProjectFlow(view), [view]);
  const est = view.estimate;
  const currency = est?.currency ?? "ILS";
  const generated = new Date(view.generatedAt);

  const included = view.items.filter((i) => !i.client_optional);
  const optional = view.items.filter((i) => i.client_optional);

  const title =
    mode === "client" ? "Project proposal" : mode === "supplier" ? "Supplier work brief" : "Internal project report";

  return (
    <div className="report-root">
      <div className="report-toolbar no-print">
        <strong>{title}</strong>
        <div className="flow-actions">
          <button type="button" className="btn-primary" onClick={() => window.print()}>Print / Save as PDF</button>
          {onClose ? <button type="button" className="btn-ghost" onClick={onClose}>Close</button> : null}
        </div>
      </div>

      <article className="report-page print-root">
        <header className="report-header">
          <div>
            <h1>{view.project.name}</h1>
            <p className="muted">
              {title}
              {mode !== "supplier" && (view.clientCompany || view.clientName)
                ? ` · ${view.clientCompany || view.clientName}`
                : ""}
            </p>
          </div>
          <div className="report-meta">
            <div>Generated {generated.toLocaleDateString()} {generated.toLocaleTimeString()}</div>
            <div>Prepared by the agency</div>
            {est ? <div>Estimate version {est.version} · {est.status.replace(/_/g, " ")}</div> : null}
            {mode === "internal" ? <div className="report-confidential">Internal — not for client or supplier</div> : null}
          </div>
        </header>

        <Section title="Project goal">
          <p>{view.project.summary || "No summary recorded yet."}</p>
          {view.scopes[0]?.client_facing_summary && mode !== "supplier" ? (
            <p>{view.scopes[0].client_facing_summary}</p>
          ) : null}
        </Section>

        {mode === "supplier" ? (
          <Section title="Your assigned work">
            {view.items.length === 0 ? (
              <Empty text="No work items are assigned to you on this project yet." />
            ) : (
              <table className="report-table">
                <thead>
                  <tr><th>Item</th><th>Phase</th><th>Effort</th><th>Acceptance criteria</th></tr>
                </thead>
                <tbody>
                  {view.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.title}</strong>
                        {item.description ? <div className="muted small">{item.description}</div> : null}
                      </td>
                      <td>{item.project_phase}</td>
                      <td>{hours(item.estimated_hours_min)}–{hours(item.estimated_hours_max)}</td>
                      <td className="small">{item.acceptance_criteria || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>
        ) : (
          <Section title="What is included">
            {included.length === 0 ? (
              <Empty text="No deliverables have been defined yet." />
            ) : (
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Deliverable</th>
                    <th>Phase</th>
                    <th>Effort</th>
                    {mode === "internal" ? <th>Responsible</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {included.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.title}</strong>
                        {item.description ? <div className="muted small">{item.description}</div> : null}
                      </td>
                      <td>{item.project_phase}</td>
                      <td>{hours(item.estimated_hours_min)}–{hours(item.estimated_hours_max)}</td>
                      {mode === "internal" ? (
                        <td className="small">
                          {item.responsible_role}
                          {item.supplier_id ? ` · ${view.suppliers.find((s) => s.id === item.supplier_id)?.name ?? "supplier"}` : ""}
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>
        )}

        {mode !== "supplier" && optional.length > 0 ? (
          <Section title="Optional add-ons">
            <ul>
              {optional.map((item) => (
                <li key={item.id}>
                  <strong>{item.title}</strong>
                  {item.selected_by_client ? " (selected)" : " (not selected)"}
                  {item.description ? <div className="muted small">{item.description}</div> : null}
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        {view.assumptions.length > 0 ? (
          <Section title="Assumptions">
            <ul>{view.assumptions.map((a: any) => <li key={a.id}>{a.body}</li>)}</ul>
          </Section>
        ) : null}

        {mode !== "supplier" && est?.fixed_price_exclusions ? (
          <Section title="Exclusions">
            <p>{est.fixed_price_exclusions}</p>
          </Section>
        ) : null}

        {mode === "client" && est ? (
          <Section title="Investment">
            {est.final_fixed_price != null && est.approved_by_yaniv ? (
              <p className="report-price">Fixed price: {money(est.final_fixed_price, currency)}</p>
            ) : (
              <p className="report-price">
                Estimated range: {money(est.estimated_budget_min, currency)} – {money(est.estimated_budget_max, currency)}
              </p>
            )}
            <p className="muted small">
              Estimated effort {hours(est.estimated_hours_min)}–{hours(est.estimated_hours_max)}.
              {est.validity_date ? ` Valid until ${est.validity_date}.` : ""}
            </p>
            {est.payment_milestones ? <p><strong>Payment milestones:</strong> {est.payment_milestones}</p> : null}
            {est.change_request_rule ? <p><strong>Changes:</strong> {est.change_request_rule}</p> : null}
          </Section>
        ) : null}

        {mode === "internal" && est ? (
          <>
            <Section title="Commercial summary (internal)">
              <table className="report-table">
                <tbody>
                  <tr><td>Effort</td><td>{hours(est.estimated_hours_min)} – {hours(est.estimated_hours_max)}</td></tr>
                  <tr><td>Client budget range</td><td>{money(est.estimated_budget_min, currency)} – {money(est.estimated_budget_max, currency)}</td></tr>
                  <tr><td>Internal cost</td><td>{money(est.internal_cost, currency)}</td></tr>
                  <tr><td>External costs</td><td>{money(est.external_costs, currency)}</td></tr>
                  <tr><td>Recommended fixed price</td><td>{money(est.recommended_fixed_price, currency)}</td></tr>
                  <tr><td>Final fixed price</td><td>{est.final_fixed_price != null ? money(est.final_fixed_price, currency) : "Not set"}</td></tr>
                  <tr><td>Target margin</td><td>{est.target_margin_percent}%</td></tr>
                  <tr>
                    <td>Buffers</td>
                    <td>risk {est.risk_buffer_percent}% · management {est.management_buffer_percent}% · testing {est.testing_buffer_percent}% · contingency {est.contingency_percent}%</td>
                  </tr>
                </tbody>
              </table>
            </Section>
            {view.allocations.length > 0 ? (
              <Section title="Role and supplier costs (internal)">
                <table className="report-table">
                  <thead><tr><th>Role</th><th>Supplier</th><th>Hours</th><th>Cost</th></tr></thead>
                  <tbody>
                    {view.allocations.map((a) => (
                      <tr key={a.id}>
                        <td>{a.role}</td>
                        <td>{view.suppliers.find((s) => s.id === a.supplier_id)?.name ?? "In-house"}</td>
                        <td>{hours(a.estimated_hours_min)}–{hours(a.estimated_hours_max)}</td>
                        <td>{money(a.calculated_internal_cost_min, currency)} – {money(a.calculated_internal_cost_max, currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Section>
            ) : null}
            {view.reviews.length > 0 ? (
              <Section title="Supplier reviews (internal)">
                <ul>
                  {view.reviews.map((r) => (
                    <li key={r.id}>
                      <strong>{view.suppliers.find((s) => s.id === r.supplier_id)?.name ?? "Supplier"}</strong>
                      {" — "}{r.status.replace(/_/g, " ")}
                      {r.suggested_hours_min != null ? ` · suggested ${hours(r.suggested_hours_min)}–${hours(r.suggested_hours_max ?? r.suggested_hours_min)}` : ""}
                      {r.fixed_quote != null ? ` · quote ${money(r.fixed_quote, currency)}` : ""}
                      {r.delivery_risk ? <div className="muted small">Risk: {r.delivery_risk}</div> : null}
                    </li>
                  ))}
                </ul>
              </Section>
            ) : null}
          </>
        ) : null}

        <Section title="Timeline and delivery">
          <p>
            {est?.delivery_range_label
              || (est?.delivery_start_date ? `${est.delivery_start_date} → ${est.delivery_end_date ?? "to be confirmed"}` : "Delivery window to be confirmed.")}
          </p>
        </Section>

        <Section title="Approval and status">
          <p>
            Project status: <strong>{view.project.status.replace(/_/g, " ")}</strong>
            {mode !== "supplier" ? <> · Payment gate: <strong>{view.project.payment_gate_status.replace(/_/g, " ")}</strong></> : null}
          </p>
          {view.approvals.length > 0 ? (
            <ul>
              {view.approvals.map((a: any) => (
                <li key={a.id}>{a.approver_role.replace(/_/g, " ")}: {a.status}{a.approved_date ? ` (${a.approved_date})` : ""}</li>
              ))}
            </ul>
          ) : <Empty text="No approvals recorded yet." />}
        </Section>

        {mode !== "supplier" && view.changeRequests.length > 0 ? (
          <Section title="Change requests">
            <table className="report-table">
              <thead>
                <tr>
                  <th>Request</th><th>Status</th><th>Client price</th>
                  {mode === "internal" ? <th>Supplier cost</th> : null}
                </tr>
              </thead>
              <tbody>
                {view.changeRequests.map((cr: any) => (
                  <tr key={cr.id}>
                    <td><strong>{cr.title}</strong><div className="muted small">{cr.description}</div></td>
                    <td>{cr.status.replace(/_/g, " ")}</td>
                    <td>{cr.agency_price != null ? money(cr.agency_price, currency) : "Not priced"}</td>
                    {mode === "internal" ? <td>{cr.supplier_cost != null ? money(cr.supplier_cost, currency) : "—"}</td> : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        ) : null}

        <Section title="Project flow">
          <div className="report-diagram">
            <ProjectFlowStatic graph={graph} maxWidth={700} />
          </div>
        </Section>

        <footer className="report-footer">
          {mode === "internal"
            ? "Internal document. Contains cost and margin data — do not share with clients or suppliers."
            : mode === "supplier"
              ? "Supplier brief. Contains scope and effort only — no client pricing."
              : "This proposal reflects the currently approved scope. Anything outside it is handled as a priced change request."}
        </footer>
      </article>
    </div>
  );
}
