import { useEffect, useMemo, useState } from "react";
import { StatusBadge } from "../StatusBadge";
import { useAppData } from "../../context/AppDataContext";
import {
  buildWarnings, calendarWeeks, computeClientBudget, computeHours, computeInternalCost,
  formatHours, formatMoney, marginPercent, recommendedFixedPrice, recomputeItemHours,
  selectionFromItems, type Selection,
} from "../../lib/estimation";
import {
  createEstimate, createEstimateItem, deleteEstimateItem, fetchProjectEstimation,
  markScenarioPromoted, replaceRoleAllocations, requestSupplierReviews, snapshotEstimateVersion,
  updateEstimate, updateEstimateItem, updateSupplierReview,
} from "../../services/estimationApi";
import {
  complexityLevels, complexityMultipliers, estimateStatusLabels, responsibleRoles, roleLabels,
  type EstimateBundle, type EstimateItem, type ProjectEstimate,
} from "../../types/estimation";
import { onEstimationChanged } from "../../lib/estimationEvents";

const emptyBundle: EstimateBundle = { estimates: [], items: [], allocations: [], reviews: [], adjustments: [], scenarios: [] };

const newItemDraft = {
  title: "", description: "", project_phase: "delivery", base_hours: 4, quantity: 1,
  complexity_level: "standard", responsible_role: "development", supplier_id: "",
  client_optional: false, client_visible_label: "", max_quantity: 1, option_tier: "standard",
};

export function EstimateControl({ projectId }: { projectId: string }) {
  const { suppliers, supplierProfiles } = useAppData();
  const [bundle, setBundle] = useState<EstimateBundle>(emptyBundle);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ ...newItemDraft });

  async function reload(keepActive = true) {
    setLoading(true);
    try {
      const next = await fetchProjectEstimation(projectId);
      setBundle(next);
      if (!keepActive || !next.estimates.some((e) => e.id === activeId)) {
        setActiveId(next.estimates.find((e) => e.status !== "superseded")?.id ?? next.estimates[0]?.id ?? null);
      }
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load estimation data.");
    } finally { setLoading(false); }
  }

  useEffect(() => { void reload(false); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [projectId]);
  useEffect(() => onEstimationChanged(projectId, () => { void reload(); }), [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const estimate: ProjectEstimate | undefined = bundle.estimates.find((e) => e.id === activeId);
  const items = useMemo(
    () => bundle.items.filter((item) => estimate && item.estimate_id === estimate.id),
    [bundle.items, estimate],
  );
  const reviews = useMemo(
    () => bundle.reviews.filter((r) => estimate && r.estimate_id === estimate.id),
    [bundle.reviews, estimate],
  );
  const selection: Selection = useMemo(() => selectionFromItems(items), [items]);

  async function run(fn: () => Promise<unknown>, message?: string) {
    setBusy(true); setNotice(null);
    try { await fn(); await reload(); if (message) setNotice(message); }
    catch (e) { setNotice(e instanceof Error ? e.message : "Action failed."); }
    finally { setBusy(false); }
  }

  if (loading) return <section className="card"><h2>Estimate control</h2><p className="muted-text">Loading estimation data…</p></section>;
  if (error) return <section className="card"><h2>Estimate control</h2><p className="form-error" role="alert">{error}</p></section>;

  if (!estimate) {
    return (
      <section className="card">
        <h2>Estimate control</h2>
        <p className="muted-text">No estimate exists for this project yet.</p>
        <div className="action-row">
          <button className="primary-button" type="button" disabled={busy}
            onClick={() => void run(() => createEstimate(projectId, { status: "draft" }, 1), "Estimate created.")}>
            {busy ? "Creating…" : "Create first estimate"}
          </button>
        </div>
        {notice ? <p className="form-success">{notice}</p> : null}
      </section>
    );
  }

  const est = estimate;
  const hours = computeHours(est, items, selection);
  const budget = computeClientBudget(est, hours, bundle.adjustments.filter((a) => a.estimate_id === est.id));
  const allocations = bundle.allocations.filter((a) => a.estimate_id === est.id);
  const internal = computeInternalCost(est, allocations, hours);
  const recommended = recommendedFixedPrice(internal.max, est.target_margin_percent);
  const price = est.final_fixed_price ?? budget.max;
  const warnings = buildWarnings({ estimate: est, budget, internal, recommended, hours, reviews, items });
  const supplierCapacity = items
    .map((item) => item.supplier_id)
    .filter((id, index, all): id is string => !!id && all.indexOf(id) === index)
    .reduce((total, id) => total + (supplierProfiles.find((p) => p.supplierId === id)?.weeklyAvailabilityHours ?? 0), 0);
  const weeks = calendarWeeks(hours, supplierCapacity + 10);

  function patchEstimate(patch: Partial<ProjectEstimate>) {
    void run(() => updateEstimate(est.id, patch));
  }

  function deriveAllocations() {
    const rows = new Map<string, { role: string; supplier_id: string | null; min: number; max: number; rate: number }>();
    for (const item of items) {
      const key = `${item.responsible_role}|${item.supplier_id ?? ""}`;
      const unitMin = item.estimated_hours_min;
      const unitMax = item.estimated_hours_max;
      const rate = item.supplier_id
        ? supplierProfiles.find((p) => p.supplierId === item.supplier_id)?.hourlyRate ?? 0
        : est.yaniv_internal_hourly_cost;
      const prev = rows.get(key) ?? { role: item.responsible_role, supplier_id: item.supplier_id, min: 0, max: 0, rate };
      rows.set(key, { ...prev, min: prev.min + unitMin, max: prev.max + unitMax, rate });
    }
    return [...rows.values()].map((row) => ({
      role: row.role,
      supplier_id: row.supplier_id,
      estimated_hours_min: row.min,
      estimated_hours_max: row.max,
      internal_hourly_cost: row.rate,
      calculated_internal_cost_min: row.min * row.rate,
      calculated_internal_cost_max: row.max * row.rate,
      notes: "",
    }));
  }

  async function handleAddItem() {
    if (!draft.title.trim()) { setNotice("A work item needs a title."); return; }
    const multiplier = complexityMultipliers[draft.complexity_level] ?? 1;
    const base = { ...draft, complexity_multiplier: multiplier };
    const min = Number(base.base_hours) * Number(base.quantity) * multiplier;
    await run(() => createEstimateItem(est.id, {
      title: draft.title.trim(),
      description: draft.description.trim(),
      project_phase: draft.project_phase,
      base_hours: Number(draft.base_hours),
      quantity: Number(draft.quantity),
      complexity_level: draft.complexity_level,
      complexity_multiplier: multiplier,
      estimated_hours_min: Math.round(min * 100) / 100,
      estimated_hours_max: Math.round(min * 1.2 * 100) / 100,
      responsible_role: draft.responsible_role,
      supplier_id: draft.supplier_id || null,
      client_optional: draft.client_optional,
      client_visible_label: draft.client_visible_label.trim() || draft.title.trim(),
      max_quantity: Number(draft.max_quantity) || 1,
      option_tier: draft.option_tier,
      sort_order: items.length,
    } as any), "Work item added.");
    setDraft({ ...newItemDraft });
  }

  return (
    <section className="card">
      <h2>Estimate control</h2>
      <div className="filter-row">
        <label className="inline-label">
          Version
          <select value={est.id} onChange={(e) => setActiveId(e.target.value)}>
            {bundle.estimates.map((item) => (
              <option key={item.id} value={item.id}>v{item.version} · {estimateStatusLabels[item.status]}</option>
            ))}
          </select>
        </label>
        <StatusBadge label={estimateStatusLabels[est.status]} tone={est.approved_by_yaniv ? "success" : "warning"} />
      </div>

      <div className="detail-grid">
        <article className="card subtle">
          <h3>Client estimate</h3>
          <p className="stat-value">{formatMoney(budget.min, est.currency)} – {formatMoney(budget.max, est.currency)}</p>
          <p className="muted-text">{formatHours(hours.totalMin, hours.totalMax)} effort · calendar {weeks.min}–{weeks.max} weeks</p>
        </article>
        <article className="card subtle">
          <h3>Internal cost</h3>
          <p className="stat-value">{formatMoney(internal.min, est.currency)} – {formatMoney(internal.max, est.currency)}</p>
          <p className="muted-text">
            Supplier {formatMoney(internal.supplierMax, est.currency)} · Yaniv {formatMoney(internal.yanivMax, est.currency)} · external {formatMoney(internal.external, est.currency)}
          </p>
        </article>
        <article className="card subtle">
          <h3>Margin</h3>
          <p className="stat-value">{marginPercent(price, internal.max)}%</p>
          <p className="muted-text">Target {est.target_margin_percent}% · recommended fixed price {formatMoney(recommended, est.currency)}</p>
        </article>
      </div>

      {warnings.length ? (
        <article className="card warning-card">
          <h3>Pricing warnings</h3>
          <ul className="link-list">{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
        </article>
      ) : null}

      <h3>Hours by role</h3>
      <table>
        <thead><tr><th>Role</th><th>Hours</th></tr></thead>
        <tbody>
          {hours.byRole.map((row) => (
            <tr key={row.role}><td>{roleLabels[row.role] ?? row.role}</td><td>{row.min}–{row.max} hrs</td></tr>
          ))}
          <tr><td><strong>Yaniv total</strong></td><td>{hours.yanivMin}–{hours.yanivMax} hrs</td></tr>
          <tr><td><strong>Supplier total</strong></td><td>{hours.supplierMin}–{hours.supplierMax} hrs</td></tr>
          <tr><td>Management / testing / risk / contingency</td><td>{hours.managementMax} / {hours.testingMax} / {hours.riskMax} / {hours.contingencyMax} hrs</td></tr>
          <tr><td>Unassigned delivery work</td><td>{hours.unassignedMin}–{hours.unassignedMax} hrs</td></tr>
        </tbody>
      </table>

      <h3>Work items</h3>
      {items.length === 0 ? <p className="muted-text">No work items yet.</p> : (
        <table>
          <thead><tr><th>Item</th><th>Role</th><th>Supplier</th><th>Hours</th><th>Client option</th><th /></tr></thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>
                  <strong>{item.title}</strong>
                  {item.ai_generated && <span className="ai-item-flag">AI estimate</span>}
                  <br /><span className="muted-text">{item.project_phase} · {item.complexity_level}</span>
                </td>
                <td>
                  <select value={item.responsible_role} disabled={busy}
                    onChange={(e) => void run(() => updateEstimateItem(item.id, { responsible_role: e.target.value }))}>
                    {responsibleRoles.map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}
                  </select>
                </td>
                <td>
                  <select value={item.supplier_id ?? ""} disabled={busy}
                    onChange={(e) => void run(() => updateEstimateItem(item.id, { supplier_id: e.target.value || null }))}>
                    <option value="">Unassigned</option>
                    {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
                  </select>
                </td>
                <td>
                  <input type="number" min={0} step="0.25" defaultValue={item.estimated_hours_min} style={{ width: "4.5rem" }}
                    onBlur={(e) => void run(() => updateEstimateItem(item.id, { estimated_hours_min: Number(e.target.value) }))} />
                  {" – "}
                  <input type="number" min={0} step="0.25" defaultValue={item.estimated_hours_max} style={{ width: "4.5rem" }}
                    onBlur={(e) => void run(() => updateEstimateItem(item.id, { estimated_hours_max: Number(e.target.value) }))} />
                </td>
                <td>
                  <label className="inline-label">
                    <input type="checkbox" checked={item.client_optional} disabled={busy}
                      onChange={(e) => void run(() => updateEstimateItem(item.id, { client_optional: e.target.checked }))} />
                    optional
                  </label>
                </td>
                <td>
                  <div className="action-row compact">
                    <button type="button" disabled={busy} onClick={() => {
                      const next = recomputeItemHours(item as EstimateItem);
                      void run(() => updateEstimateItem(item.id, { estimated_hours_min: next.min, estimated_hours_max: next.max }));
                    }}>Recalculate</button>
                    <button type="button" disabled={busy} onClick={() => void run(() => deleteEstimateItem(item.id), "Item removed.")}>Remove</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <form className="form-grid" onSubmit={(e) => { e.preventDefault(); void handleAddItem(); }}>
        <label>Title *<input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label>
        <label>Phase<input value={draft.project_phase} onChange={(e) => setDraft({ ...draft, project_phase: e.target.value })} /></label>
        <label>Base hours<input type="number" min={0} step="0.25" value={draft.base_hours} onChange={(e) => setDraft({ ...draft, base_hours: Number(e.target.value) })} /></label>
        <label>Quantity<input type="number" min={1} value={draft.quantity} onChange={(e) => setDraft({ ...draft, quantity: Number(e.target.value) })} /></label>
        <label>Complexity
          <select value={draft.complexity_level} onChange={(e) => setDraft({ ...draft, complexity_level: e.target.value })}>
            {complexityLevels.map((level) => <option key={level} value={level}>{level}</option>)}
          </select>
        </label>
        <label>Responsible role
          <select value={draft.responsible_role} onChange={(e) => setDraft({ ...draft, responsible_role: e.target.value })}>
            {responsibleRoles.map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}
          </select>
        </label>
        <label>Supplier
          <select value={draft.supplier_id} onChange={(e) => setDraft({ ...draft, supplier_id: e.target.value })}>
            <option value="">Unassigned</option>
            {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
          </select>
        </label>
        <label>Client label<input value={draft.client_visible_label} onChange={(e) => setDraft({ ...draft, client_visible_label: e.target.value })} /></label>
        <label>Option tier
          <select value={draft.option_tier} onChange={(e) => setDraft({ ...draft, option_tier: e.target.value })}>
            <option value="basic">basic</option><option value="standard">standard</option><option value="advanced">advanced</option>
          </select>
        </label>
        <label>Max quantity<input type="number" min={1} value={draft.max_quantity} onChange={(e) => setDraft({ ...draft, max_quantity: Number(e.target.value) })} /></label>
        <label className="inline-label">
          <input type="checkbox" checked={draft.client_optional} onChange={(e) => setDraft({ ...draft, client_optional: e.target.checked })} />
          Client can choose this
        </label>
        <label className="span-2">Description<textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></label>
        <div className="form-actions">
          <button className="primary-button" type="submit" disabled={busy}>{busy ? "Saving…" : "Add work item"}</button>
        </div>
      </form>

      <h3>Commercial settings</h3>
      <div className="form-grid">
        <label>Client calculation rate
          <input type="number" min={0} defaultValue={est.client_calculation_rate}
            onBlur={(e) => patchEstimate({ client_calculation_rate: Number(e.target.value) })} />
        </label>
        <label>Currency
          <input defaultValue={est.currency} onBlur={(e) => patchEstimate({ currency: e.target.value || "GBP" })} />
        </label>
        <label>Yaniv internal hourly cost
          <input type="number" min={0} defaultValue={est.yaniv_internal_hourly_cost}
            onBlur={(e) => patchEstimate({ yaniv_internal_hourly_cost: Number(e.target.value) })} />
        </label>
        <label>External / licence costs
          <input type="number" min={0} defaultValue={est.external_costs}
            onBlur={(e) => patchEstimate({ external_costs: Number(e.target.value) })} />
        </label>
        <label>Target margin %
          <input type="number" min={0} max={95} defaultValue={est.target_margin_percent}
            onBlur={(e) => patchEstimate({ target_margin_percent: Number(e.target.value) })} />
        </label>
        <label>Risk buffer %
          <input type="number" min={0} defaultValue={est.risk_buffer_percent} onBlur={(e) => patchEstimate({ risk_buffer_percent: Number(e.target.value) })} />
        </label>
        <label>Management buffer %
          <input type="number" min={0} defaultValue={est.management_buffer_percent} onBlur={(e) => patchEstimate({ management_buffer_percent: Number(e.target.value) })} />
        </label>
        <label>Testing buffer %
          <input type="number" min={0} defaultValue={est.testing_buffer_percent} onBlur={(e) => patchEstimate({ testing_buffer_percent: Number(e.target.value) })} />
        </label>
        <label>Contingency %
          <input type="number" min={0} defaultValue={est.contingency_percent} onBlur={(e) => patchEstimate({ contingency_percent: Number(e.target.value) })} />
        </label>
        <label>Rounding increment
          <input type="number" min={0} defaultValue={est.estimate_rounding_increment} onBlur={(e) => patchEstimate({ estimate_rounding_increment: Number(e.target.value) })} />
        </label>
        <label className="inline-label">
          <input type="checkbox" checked={est.show_hourly_rate_to_client}
            onChange={(e) => patchEstimate({ show_hourly_rate_to_client: e.target.checked })} />
          Show the hourly calculation rate to the client
        </label>
        <label className="inline-label">
          <input type="checkbox" checked={est.client_visible} onChange={(e) => patchEstimate({ client_visible: e.target.checked })} />
          Publish this estimate range to the client
        </label>
      </div>

      <h3>Supplier review</h3>
      {reviews.length === 0 ? <p className="muted-text">No supplier review has been requested yet.</p> : (
        <table>
          <thead><tr><th>Item</th><th>Supplier</th><th>Agency hours</th><th>Supplier hours</th><th>Quote</th><th>Status</th><th /></tr></thead>
          <tbody>
            {reviews.map((review) => {
              const item = items.find((i) => i.id === review.item_id);
              const supplier = suppliers.find((s) => s.id === review.supplier_id);
              return (
                <tr key={review.id}>
                  <td>{item?.title ?? "Item"}{review.assumptions ? <><br /><span className="muted-text">{review.assumptions}</span></> : null}</td>
                  <td>{supplier?.name ?? "Supplier"}</td>
                  <td>{item ? `${item.estimated_hours_min}–${item.estimated_hours_max}` : "—"}</td>
                  <td>{review.suggested_hours_min ?? "—"}–{review.suggested_hours_max ?? "—"}</td>
                  <td>{review.fixed_quote != null ? formatMoney(review.fixed_quote, est.currency) : "—"}</td>
                  <td><StatusBadge label={review.status} tone={review.status === "accepted_by_yaniv" ? "success" : review.status === "rejected_by_yaniv" ? "danger" : "warning"} /></td>
                  <td>
                    <div className="action-row compact">
                      <button type="button" disabled={busy} onClick={() => void run(async () => {
                        if (item && review.suggested_hours_min != null && review.suggested_hours_max != null) {
                          await updateEstimateItem(item.id, {
                            estimated_hours_min: review.suggested_hours_min,
                            estimated_hours_max: review.suggested_hours_max,
                          });
                        }
                        await updateSupplierReview(review.id, { status: "accepted_by_yaniv" });
                      }, "Supplier change accepted.")}>Accept</button>
                      <button type="button" disabled={busy}
                        onClick={() => void run(() => updateSupplierReview(review.id, { status: "rejected_by_yaniv" }), "Supplier change rejected.")}>Reject</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <h3>Client scenarios</h3>
      {bundle.scenarios.filter((s) => s.estimate_id === est.id).length === 0 ? (
        <p className="muted-text">The client has not saved any scenario yet.</p>
      ) : (
        <table>
          <thead><tr><th>Scenario</th><th>Hours</th><th>Budget</th><th /></tr></thead>
          <tbody>
            {bundle.scenarios.filter((s) => s.estimate_id === est.id).map((scenario) => (
              <tr key={scenario.id}>
                <td>{scenario.name}{scenario.is_promoted ? " · active" : ""}</td>
                <td>{formatHours(scenario.estimated_hours_min, scenario.estimated_hours_max)}</td>
                <td>{formatMoney(scenario.estimated_budget_min, est.currency)} – {formatMoney(scenario.estimated_budget_max, est.currency)}</td>
                <td>
                  <button type="button" disabled={busy} onClick={() => void run(async () => {
                    for (const entry of scenario.selections ?? []) {
                      const item = items.find((i) => i.id === entry.itemId);
                      if (item && item.client_optional) {
                        await updateEstimateItem(item.id, { selected_by_client: entry.selected, quantity: entry.quantity });
                      }
                    }
                    await markScenarioPromoted(scenario.id);
                  }, "Scenario promoted to the active estimate.")}>Promote</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3>Fixed-price approval</h3>
      <div className="form-grid">
        <label>Final fixed price
          <input type="number" min={0} defaultValue={est.final_fixed_price ?? recommended}
            onBlur={(e) => patchEstimate({ final_fixed_price: Number(e.target.value) })} />
        </label>
        <label>Estimate valid until
          <input type="date" defaultValue={est.validity_date ?? ""} onBlur={(e) => patchEstimate({ validity_date: e.target.value || null })} />
        </label>
        <label>Delivery range shown to the client
          <input defaultValue={est.delivery_range_label} onBlur={(e) => patchEstimate({ delivery_range_label: e.target.value })} />
        </label>
        <label>Payment milestones
          <input defaultValue={est.payment_milestones} onBlur={(e) => patchEstimate({ payment_milestones: e.target.value })} />
        </label>
        <label className="span-2">Included scope
          <textarea defaultValue={est.fixed_price_scope} onBlur={(e) => patchEstimate({ fixed_price_scope: e.target.value })} />
        </label>
        <label className="span-2">Exclusions
          <textarea defaultValue={est.fixed_price_exclusions} onBlur={(e) => patchEstimate({ fixed_price_exclusions: e.target.value })} />
        </label>
        <label className="span-2">Change-request rule
          <textarea defaultValue={est.change_request_rule} onBlur={(e) => patchEstimate({ change_request_rule: e.target.value })} />
        </label>
      </div>

      <div className="action-row">
        <button type="button" disabled={busy}
          onClick={() => void run(() => replaceRoleAllocations(est.id, deriveAllocations()), "Internal cost model rebuilt from work items.")}>
          Rebuild internal cost model
        </button>
        <button type="button" disabled={busy}
          onClick={() => void run(async () => {
            await requestSupplierReviews(est.id, items as EstimateItem[]);
            await updateEstimate(est.id, { status: "waiting_for_supplier_review" });
          }, "Supplier review requested.")}>
          Request supplier review
        </button>
        <button type="button" disabled={busy}
          onClick={() => void run(() => updateEstimate(est.id, {
            client_visible: true,
            status: "client_estimate_visible",
            estimated_hours_min: hours.totalMin,
            estimated_hours_max: hours.totalMax,
            estimated_budget_min: budget.min,
            estimated_budget_max: budget.max,
            internal_cost: internal.max,
            recommended_fixed_price: recommended,
          }), "Estimated range published to the client.")}>
          Publish estimate range
        </button>
        <button className="primary-button" type="button" disabled={busy}
          onClick={() => void run(async () => {
            const finalPrice = est.final_fixed_price ?? recommended;
            await snapshotEstimateVersion(est, items as EstimateItem[], "Fixed price approved");
            await updateEstimate(est.id, {
              final_fixed_price: finalPrice,
              approved_by_yaniv: true,
              client_visible: true,
              status: "fixed_price_approved",
              internal_cost: internal.max,
              recommended_fixed_price: recommended,
              estimated_hours_min: hours.totalMin,
              estimated_hours_max: hours.totalMax,
              estimated_budget_min: budget.min,
              estimated_budget_max: budget.max,
            });
          }, "Fixed price approved and the version was snapshotted.")}>
          Approve fixed price
        </button>
        <button type="button" disabled={busy}
          onClick={() => void run(async () => {
            await snapshotEstimateVersion(est, items as EstimateItem[], "Superseded by a new version");
            await updateEstimate(est.id, { status: "superseded", client_visible: false });
            const created = await createEstimate(projectId, {
              status: "draft",
              currency: est.currency,
              client_calculation_rate: est.client_calculation_rate,
              show_hourly_rate_to_client: est.show_hourly_rate_to_client,
              target_margin_percent: est.target_margin_percent,
              risk_buffer_percent: est.risk_buffer_percent,
              management_buffer_percent: est.management_buffer_percent,
              testing_buffer_percent: est.testing_buffer_percent,
              contingency_percent: est.contingency_percent,
              yaniv_internal_hourly_cost: est.yaniv_internal_hourly_cost,
            }, est.version + 1);
            for (const item of items) {
              const { id, estimate_id, ...rest } = item as any;
              await createEstimateItem(created.id, rest);
            }
            setActiveId(created.id);
          }, "New estimate version created.")}>
          New version
        </button>
      </div>
      {notice ? <p className="form-success">{notice}</p> : null}
    </section>
  );
}