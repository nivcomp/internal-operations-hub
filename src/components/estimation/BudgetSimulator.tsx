import { useEffect, useMemo, useState } from "react";
import { StatusBadge } from "../StatusBadge";
import { useAppData } from "../../context/AppDataContext";
import {
  computeClientBudget, computeHours, formatHours, formatMoney,
  selectionFromItems, selectionToArray, type Selection,
} from "../../lib/estimation";
import { deleteScenario, fetchProjectEstimation, saveScenario } from "../../services/estimationApi";
import type { EstimateBundle, EstimateScenario, ProjectEstimate } from "../../types/estimation";

type Props = {
  projectId: string;
  clientId: string;
  /** Agency preview: interactions are read-only. */
  readOnly?: boolean;
};

const emptyBundle: EstimateBundle = { estimates: [], items: [], allocations: [], reviews: [], adjustments: [], scenarios: [] };

export function BudgetSimulator({ projectId, clientId, readOnly = false }: Props) {
  const { submitClientChangeRequest } = useAppData();
  const [bundle, setBundle] = useState<EstimateBundle>(emptyBundle);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection>(new Map());
  const [scenarioName, setScenarioName] = useState("");
  const [scenarioNotes, setScenarioNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const estimate: ProjectEstimate | undefined = useMemo(
    () => bundle.estimates.find((e) => e.client_visible && e.status !== "superseded"),
    [bundle.estimates],
  );
  const items = useMemo(
    () => bundle.items.filter((item) => estimate && item.estimate_id === estimate.id && item.client_visible),
    [bundle.items, estimate],
  );
  const adjustments = useMemo(
    () => bundle.adjustments.filter((a) => estimate && a.estimate_id === estimate.id && a.client_visible),
    [bundle.adjustments, estimate],
  );

  async function reload() {
    setLoading(true);
    try {
      const next = await fetchProjectEstimation(projectId);
      setBundle(next);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your estimate.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [projectId]);
  useEffect(() => { setSelection(selectionFromItems(items)); }, [items]);

  if (loading) return <section className="card"><h2>Budget simulator</h2><p className="muted-text">Loading your estimate…</p></section>;
  if (error) return <section className="card"><h2>Budget simulator</h2><p className="form-error" role="alert">{error}</p></section>;
  if (!estimate) {
    return (
      <section className="card">
        <h2>Budget simulator</h2>
        <p className="muted-text">The agency has not shared an estimate for this project yet.</p>
      </section>
    );
  }

  const hours = computeHours(estimate, items, selection);
  const budget = computeClientBudget(estimate, hours, adjustments);
  const priceApproved = estimate.approved_by_yaniv && estimate.final_fixed_price != null;
  const baseline = selectionFromItems(items);
  const changedAfterApproval = priceApproved && items.some((item) => {
    const a = baseline.get(item.id); const b = selection.get(item.id);
    return a && b && (a.selected !== b.selected || a.quantity !== b.quantity);
  });
  const scenarios = bundle.scenarios.filter((s) => s.estimate_id === estimate.id);

  const optional = items.filter((item) => item.client_optional);
  const included = items.filter((item) => !item.client_optional);

  function setItem(itemId: string, patch: Partial<{ selected: boolean; quantity: number }>) {
    if (readOnly) return;
    setSelection((prev) => {
      const next = new Map(prev);
      const current = next.get(itemId) ?? { selected: true, quantity: 1 };
      next.set(itemId, { ...current, ...patch });
      return next;
    });
  }

  async function handleSaveScenario() {
    if (readOnly || !scenarioName.trim() || !estimate) return;
    setBusy(true); setNotice(null);
    try {
      await saveScenario({
        estimate_id: estimate.id,
        project_id: projectId,
        name: scenarioName.trim(),
        client_notes: scenarioNotes.trim(),
        selections: selectionToArray(selection) as any,
        estimated_hours_min: hours.totalMin,
        estimated_hours_max: hours.totalMax,
        estimated_budget_min: budget.min,
        estimated_budget_max: budget.max,
      });
      setScenarioName(""); setScenarioNotes("");
      setNotice("Scenario saved.");
      await reload();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not save the scenario.");
    } finally { setBusy(false); }
  }

  async function handleLoadScenario(scenario: EstimateScenario) {
    const next = new Map(selection);
    for (const entry of (scenario.selections ?? [])) {
      if (next.has(entry.itemId)) next.set(entry.itemId, { selected: entry.selected, quantity: entry.quantity });
    }
    setSelection(next);
  }

  async function handleRemoveScenario(id: string) {
    if (readOnly) return;
    setBusy(true);
    try { await deleteScenario(id); await reload(); }
    catch (e) { setNotice(e instanceof Error ? e.message : "Could not delete the scenario."); }
    finally { setBusy(false); }
  }

  async function handleRequestChange() {
    if (readOnly) return;
    setBusy(true); setNotice(null);
    const changes = items
      .filter((item) => {
        const a = baseline.get(item.id); const b = selection.get(item.id);
        return a && b && (a.selected !== b.selected || a.quantity !== b.quantity);
      })
      .map((item) => {
        const b = selection.get(item.id)!;
        return `${item.client_visible_label || item.title}: ${b.selected ? `include (qty ${b.quantity})` : "remove"}`;
      });
    try {
      await submitClientChangeRequest(projectId, clientId, {
        title: "Change to the approved scope",
        description: `The client changed selections after the fixed price was approved.\n${changes.join("\n")}\nNew estimated range: ${formatHours(hours.totalMin, hours.totalMax)}.`,
      });
      setNotice("A change request was created. The agency will review and price it — the approved fixed price is unchanged.");
      setSelection(selectionFromItems(items));
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not create the change request.");
    } finally { setBusy(false); }
  }

  return (
    <section className="card">
      <h2>Budget simulator</h2>
      <p className="muted-text">
        Choose what you want included. The estimate updates as you change your selection.
      </p>

      <div className="detail-grid">
        <article className="card subtle">
          <h3>Estimated effort</h3>
          <p className="stat-value">{formatHours(hours.totalMin, hours.totalMax)}</p>
        </article>
        <article className="card subtle">
          <h3>{priceApproved ? "Approved fixed price" : "Estimated budget"}</h3>
          <p className="stat-value">
            {priceApproved
              ? formatMoney(estimate.final_fixed_price as number, estimate.currency)
              : `${formatMoney(budget.min, estimate.currency)} – ${formatMoney(budget.max, estimate.currency)}`}
          </p>
          {estimate.show_hourly_rate_to_client ? (
            <p className="muted-text">
              Calculated at {formatMoney(estimate.client_calculation_rate, estimate.currency)} per hour. This is an
              estimation rate only — it is not necessarily the final billing model.
            </p>
          ) : null}
        </article>
      </div>

      <p>
        {priceApproved
          ? `Your approved fixed price is ${formatMoney(estimate.final_fixed_price as number, estimate.currency)}${estimate.delivery_range_label ? `, with delivery ${estimate.delivery_range_label}` : ""}.`
          : `Based on your current choices, the project is estimated at ${formatHours(hours.totalMin, hours.totalMax)} and an estimated budget of ${formatMoney(budget.min, estimate.currency)}–${formatMoney(budget.max, estimate.currency)}. This is an initial estimate and is not a final quotation.`}
      </p>

      {included.length ? (
        <>
          <h3>Always included</h3>
          <ul className="link-list">
            {included.map((item) => (
              <li key={item.id}>
                <strong>{item.client_visible_label || item.title}</strong>
                {item.client_visible_description ? <span className="muted-text"> · {item.client_visible_description}</span> : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <h3>Optional choices</h3>
      {optional.length === 0 ? (
        <p className="muted-text">There are no optional features in this estimate.</p>
      ) : (
        <table>
          <thead><tr><th>Include</th><th>Feature</th><th>Level</th><th>Quantity</th></tr></thead>
          <tbody>
            {optional.map((item) => {
              const sel = selection.get(item.id) ?? { selected: false, quantity: 1 };
              return (
                <tr key={item.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={sel.selected}
                      disabled={readOnly}
                      aria-label={`Include ${item.client_visible_label || item.title}`}
                      onChange={(e) => setItem(item.id, { selected: e.target.checked })}
                    />
                  </td>
                  <td>
                    <strong>{item.client_visible_label || item.title}</strong>
                    {item.client_visible_description ? <><br />{item.client_visible_description}</> : null}
                  </td>
                  <td>
                    <StatusBadge
                      label={item.option_tier}
                      tone={item.option_tier === "advanced" ? "warning" : item.option_tier === "basic" ? "neutral" : "info"}
                    />
                  </td>
                  <td>
                    <input
                      type="number" min={1} max={item.max_quantity || 1} value={sel.quantity}
                      disabled={readOnly || (item.max_quantity || 1) <= 1}
                      aria-label={`Quantity for ${item.client_visible_label || item.title}`}
                      onChange={(e) => setItem(item.id, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                      style={{ width: "5rem" }}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <p className="muted-text">Advanced choices add complexity and increase the estimated hour range.</p>

      {estimate.fixed_price_exclusions ? (
        <>
          <h3>Not included</h3>
          <p>{estimate.fixed_price_exclusions}</p>
        </>
      ) : null}

      {changedAfterApproval ? (
        <div className="action-row">
          <button className="primary-button" type="button" disabled={busy || readOnly} onClick={() => void handleRequestChange()}>
            {busy ? "Sending…" : "Request this change"}
          </button>
          <span className="muted-text">The approved fixed price does not change automatically.</span>
        </div>
      ) : null}

      <h3>Your saved scenarios</h3>
      {scenarios.length === 0 ? (
        <p className="muted-text">No scenarios saved yet.</p>
      ) : (
        <table>
          <thead><tr><th>Scenario</th><th>Hours</th><th>Budget</th><th>Saved</th><th /></tr></thead>
          <tbody>
            {scenarios.map((scenario) => (
              <tr key={scenario.id}>
                <td><strong>{scenario.name}</strong>{scenario.client_notes ? <><br /><span className="muted-text">{scenario.client_notes}</span></> : null}</td>
                <td>{formatHours(scenario.estimated_hours_min, scenario.estimated_hours_max)}</td>
                <td>{formatMoney(scenario.estimated_budget_min, estimate.currency)} – {formatMoney(scenario.estimated_budget_max, estimate.currency)}</td>
                <td>{String(scenario.created_at).slice(0, 10)}{scenario.is_promoted ? " · selected by agency" : ""}</td>
                <td>
                  <div className="action-row compact">
                    <button type="button" onClick={() => void handleLoadScenario(scenario)}>Compare</button>
                    <button type="button" disabled={busy || readOnly} onClick={() => void handleRemoveScenario(scenario.id)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <form className="form-grid" onSubmit={(e) => { e.preventDefault(); void handleSaveScenario(); }}>
        <label>
          Scenario name
          <input value={scenarioName} onChange={(e) => setScenarioName(e.target.value)} disabled={readOnly} />
        </label>
        <label>
          Notes (optional)
          <input value={scenarioNotes} onChange={(e) => setScenarioNotes(e.target.value)} disabled={readOnly} />
        </label>
        <div className="form-actions">
          <button className="primary-button" type="submit" disabled={busy || readOnly || !scenarioName.trim()}>
            {busy ? "Saving…" : "Save this scenario"}
          </button>
        </div>
      </form>
      {notice ? <p className="form-success">{notice}</p> : null}
      {readOnly ? <p className="muted-text">Preview mode — saving is disabled while signed in as agency admin.</p> : null}
    </section>
  );
}