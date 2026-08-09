import { useEffect, useMemo, useState } from "react";
import { StatusBadge } from "../StatusBadge";
import { useAppData } from "../../context/AppDataContext";
import {
  computeClientBudget, computeHours, formatHours, formatMoney,
  selectionFromItems, selectionToArray, type Selection,
} from "../../lib/estimation";
import { deleteScenario, fetchProjectEstimation, saveScenario } from "../../services/estimationApi";
import type { EstimateBundle, EstimateScenario, ProjectEstimate } from "../../types/estimation";
import { onEstimationChanged } from "../../lib/estimationEvents";

type Props = {
  projectId: string;
  clientId: string;
  /** Agency preview: interactions are read-only. */
  readOnly?: boolean;
  language?: "he" | "en";
};

const emptyBundle: EstimateBundle = { estimates: [], items: [], allocations: [], reviews: [], adjustments: [], scenarios: [] };

export function BudgetSimulator({ projectId, clientId, readOnly = false, language = "he" }: Props) {
  const c = language === "he" ? {
    title: "בחירת היקף ושעות", loading: "טוען את האומדן…", unavailable: "הסוכנות עדיין לא שיתפה אומדן לפרויקט.",
    intro: "בחרו מה לכלול. טווח השעות מתעדכן יחד עם הבחירה.", effort: "הערכת עבודה", fixed: "מחיר קבוע מאושר",
    priceState: "מצב המחיר", pending: "ייקבע לאחר אישור ההיקף", hoursOnly: "עד לאישור מחיר קבוע מוצגת השפעת הבחירות בשעות בלבד.",
    included: "כלול תמיד", optional: "אפשרויות לבחירה", none: "אין כרגע רכיבים אופציונליים.", include: "להוסיף", feature: "רכיב",
    addedHours: "תוספת שעות", level: "רמה", quantity: "כמות", complexity: "בחירה מתקדמת מוסיפה מורכבות ומגדילה את טווח השעות.",
    excluded: "לא כלול", request: "בקש את השינוי", sending: "שולח…", fixedUnchanged: "המחיר הקבוע המאושר אינו משתנה אוטומטית.",
    scenarios: "התרחישים השמורים שלי", noScenarios: "עדיין לא נשמרו תרחישים.", scenario: "תרחיש", hours: "שעות", saved: "נשמר",
    compare: "השווה", remove: "מחק", scenarioName: "שם התרחיש", notes: "הערות (לא חובה)", save: "שמור תרחיש", saving: "שומר…",
    preview: "מצב תצוגה — השמירה חסומה בזמן כניסת אדמין.",
    approvedSummary: (price: string, delivery?: string | null) => `המחיר הקבוע שאושר הוא ${price}${delivery ? `, עם מסירה ${delivery}` : ""}.`,
    hoursSummary: (range: string) => `לפי הבחירות הנוכחיות נדרשות בערך ${range}. הסכום הכספי יופיע רק לאחר אישור מחיר קבוע.`,
    promoted: "נבחר על ידי הסוכנות",
  } : {
    title: "Scope and hours", loading: "Loading your estimate…", unavailable: "The agency has not shared an estimate for this project yet.",
    intro: "Choose what to include. The hour range updates with your selection.", effort: "Estimated effort", fixed: "Approved fixed price",
    priceState: "Price status", pending: "Set after scope approval", hoursOnly: "Until a fixed price is approved, choices are shown in work hours only.",
    included: "Always included", optional: "Optional choices", none: "There are no optional features yet.", include: "Include", feature: "Feature",
    addedHours: "Added hours", level: "Level", quantity: "Quantity", complexity: "Advanced choices add complexity and increase the estimated hour range.",
    excluded: "Not included", request: "Request this change", sending: "Sending…", fixedUnchanged: "The approved fixed price does not change automatically.",
    scenarios: "My saved scenarios", noScenarios: "No scenarios saved yet.", scenario: "Scenario", hours: "Hours", saved: "Saved",
    compare: "Compare", remove: "Delete", scenarioName: "Scenario name", notes: "Notes (optional)", save: "Save this scenario", saving: "Saving…",
    preview: "Preview mode — saving is disabled while signed in as agency admin.",
    approvedSummary: (price: string, delivery?: string | null) => `The approved fixed price is ${price}${delivery ? `, with delivery ${delivery}` : ""}.`,
    hoursSummary: (range: string) => `The current choices require about ${range}. Money is shown only after a fixed price is approved.`,
    promoted: "selected by agency",
  };
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
  useEffect(() => onEstimationChanged(projectId, () => { void reload(); }), [projectId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setSelection(selectionFromItems(items)); }, [items]);

  if (loading) return <section className="card"><h2>{c.title}</h2><p className="muted-text">{c.loading}</p></section>;
  if (error) return <section className="card"><h2>{c.title}</h2><p className="form-error" role="alert">{error}</p></section>;
  if (!estimate) {
    return (
      <section className="card">
        <h2>{c.title}</h2>
        <p className="muted-text">{c.unavailable}</p>
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
      <h2>{c.title}</h2>
      <p className="muted-text">{c.intro}</p>

      <div className="detail-grid">
        <article className="card subtle">
          <h3>{c.effort}</h3>
          <p className="stat-value">{formatHours(hours.totalMin, hours.totalMax)}</p>
        </article>
        <article className="card subtle">
          <h3>{priceApproved ? c.fixed : c.priceState}</h3>
          <p className="stat-value">{priceApproved ? formatMoney(estimate.final_fixed_price as number, estimate.currency) : c.pending}</p>
          <p className="muted-text">{c.hoursOnly}</p>
        </article>
      </div>

      <p>
        {priceApproved
          ? c.approvedSummary(formatMoney(estimate.final_fixed_price as number, estimate.currency), estimate.delivery_range_label)
          : c.hoursSummary(formatHours(hours.totalMin, hours.totalMax))}
      </p>

      {included.length ? (
        <>
          <h3>{c.included}</h3>
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

      <h3>{c.optional}</h3>
      {optional.length === 0 ? (
        <p className="muted-text">{c.none}</p>
      ) : (
        <table>
          <thead><tr><th>{c.include}</th><th>{c.feature}</th><th>{c.addedHours}</th><th>{c.level}</th><th>{c.quantity}</th></tr></thead>
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
                  <td><strong>+{formatHours(item.estimated_hours_min, item.estimated_hours_max)}</strong></td>
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
      <p className="muted-text">{c.complexity}</p>

      {estimate.fixed_price_exclusions ? (
        <>
          <h3>{c.excluded}</h3>
          <p>{estimate.fixed_price_exclusions}</p>
        </>
      ) : null}

      {changedAfterApproval ? (
        <div className="action-row">
          <button className="primary-button" type="button" disabled={busy || readOnly} onClick={() => void handleRequestChange()}>
            {busy ? c.sending : c.request}
          </button>
          <span className="muted-text">{c.fixedUnchanged}</span>
        </div>
      ) : null}

      <h3>{c.scenarios}</h3>
      {scenarios.length === 0 ? (
        <p className="muted-text">{c.noScenarios}</p>
      ) : (
        <table>
          <thead><tr><th>{c.scenario}</th><th>{c.hours}</th><th>{c.saved}</th><th /></tr></thead>
          <tbody>
            {scenarios.map((scenario) => (
              <tr key={scenario.id}>
                <td><strong>{scenario.name}</strong>{scenario.client_notes ? <><br /><span className="muted-text">{scenario.client_notes}</span></> : null}</td>
                <td>{formatHours(scenario.estimated_hours_min, scenario.estimated_hours_max)}</td>
                <td>{String(scenario.created_at).slice(0, 10)}{scenario.is_promoted ? ` · ${c.promoted}` : ""}</td>
                <td>
                  <div className="action-row compact">
                    <button type="button" onClick={() => void handleLoadScenario(scenario)}>{c.compare}</button>
                    <button type="button" disabled={busy || readOnly} onClick={() => void handleRemoveScenario(scenario.id)}>{c.remove}</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <form className="form-grid" onSubmit={(e) => { e.preventDefault(); void handleSaveScenario(); }}>
        <label>
          {c.scenarioName}
          <input value={scenarioName} onChange={(e) => setScenarioName(e.target.value)} disabled={readOnly} />
        </label>
        <label>
          {c.notes}
          <input value={scenarioNotes} onChange={(e) => setScenarioNotes(e.target.value)} disabled={readOnly} />
        </label>
        <div className="form-actions">
          <button className="primary-button" type="submit" disabled={busy || readOnly || !scenarioName.trim()}>
            {busy ? c.saving : c.save}
          </button>
        </div>
      </form>
      {notice ? <p className="form-success">{notice}</p> : null}
      {readOnly ? <p className="muted-text">{c.preview}</p> : null}
    </section>
  );
}
