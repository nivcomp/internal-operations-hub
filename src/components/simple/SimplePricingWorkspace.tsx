import { useEffect, useMemo, useRef, useState } from "react";
import { useAppData } from "../../context/AppDataContext";
import { useCopilotForm } from "../../context/CopilotContext";
import { onCopilotFormIntent } from "../../lib/copilotForms";
import {
  computeClientBudget, computeHours, computeInternalCost, formatMoney, marginPercent,
  recommendedFixedPrice, selectionFromItems,
} from "../../lib/estimation";
import {
  createEstimate, fetchProjectEstimation, snapshotEstimateVersion, updateEstimate,
} from "../../services/estimationApi";
import type { EstimateBundle, ProjectEstimate } from "../../types/estimation";
import { EstimateControl } from "../estimation/EstimateControl";
import { ProposalPanel } from "../proposal/ProposalPanel";

const emptyBundle: EstimateBundle = { estimates: [], items: [], allocations: [], reviews: [], adjustments: [], scenarios: [] };
const currencyOptions = [
  { value: "ILS", label: "₪ שקל חדש (ברירת מחדל)", mark: "₪" },
  { value: "USD", label: "$ דולר", mark: "$" },
  { value: "GBP", label: "£ פאונד", mark: "£" },
];

export function SimplePricingWorkspace({ projectId }: { projectId: string }) {
  const { refreshCommercials } = useAppData();
  const [bundle, setBundle] = useState<EstimateBundle>(emptyBundle);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [rate, setRate] = useState(0);
  const [finalPrice, setFinalPrice] = useState(0);
  const [currency, setCurrency] = useState("ILS");
  const [proposalOpen, setProposalOpen] = useState(false);
  const rateRef = useRef<HTMLInputElement | null>(null);
  const finalPriceRef = useRef<HTMLInputElement | null>(null);
  const currencyRef = useRef<HTMLSelectElement | null>(null);

  async function reload() {
    const next = await fetchProjectEstimation(projectId);
    setBundle(next);
    const current = next.estimates.find((item) => item.status !== "superseded") ?? next.estimates[0];
    setRate(current?.client_calculation_rate ?? 0);
    setFinalPrice(current?.final_fixed_price ?? current?.recommended_fixed_price ?? 0);
    setCurrency(current?.currency || "ILS");
  }

  useEffect(() => {
    setLoading(true);
    void reload().catch((cause) => setError(cause instanceof Error ? cause.message : "לא הצלחנו לטעון את התמחור."))
      .finally(() => setLoading(false));
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const estimate = bundle.estimates.find((item) => item.status !== "superseded") ?? bundle.estimates[0];
  const items = useMemo(() => estimate ? bundle.items.filter((item) => item.estimate_id === estimate.id) : [], [bundle.items, estimate]);
  const allocations = useMemo(() => estimate ? bundle.allocations.filter((item) => item.estimate_id === estimate.id) : [], [bundle.allocations, estimate]);
  const adjustments = useMemo(() => estimate ? bundle.adjustments.filter((item) => item.estimate_id === estimate.id) : [], [bundle.adjustments, estimate]);
  const reviews = useMemo(() => estimate ? bundle.reviews.filter((item) => item.estimate_id === estimate.id) : [], [bundle.reviews, estimate]);

  const calculations = useMemo(() => {
    if (!estimate) return null;
    const liveEstimate = { ...estimate, currency, client_calculation_rate: Math.max(0, rate) } as ProjectEstimate;
    const hours = computeHours(liveEstimate, items, selectionFromItems(items));
    const budget = computeClientBudget(liveEstimate, hours, adjustments);
    const internal = computeInternalCost(liveEstimate, allocations, hours);
    const recommended = recommendedFixedPrice(internal.max, liveEstimate.target_margin_percent);
    const chosen = finalPrice || liveEstimate.final_fixed_price || recommended;
    const margin = marginPercent(chosen, internal.max);
    const warnings: string[] = [];
    if (budget.min < internal.max) warnings.push("הקצה הנמוך של התקציב נמוך מהעלות הפנימית המרבית.");
    if (margin < liveEstimate.target_margin_percent) warnings.push(`הרווח הצפוי ${margin}% נמוך מיעד של ${liveEstimate.target_margin_percent}%.`);
    if (chosen < recommended) warnings.push("המחיר שנבחר נמוך מהמחיר המומלץ.");
    if (liveEstimate.contingency_percent < 5) warnings.push("רזרבת הסיכון נמוכה מ־5%.");
    if (hours.unassignedMax > 0) warnings.push(`${hours.unassignedMax} שעות ביצוע עדיין אינן משויכות לספק.`);
    if (reviews.some((review) => review.status === "waiting_for_supplier")) warnings.push("ממתינים לבדיקת שעות של ספק.");
    return { liveEstimate, hours, budget, internal, recommended, chosen, margin, warnings };
  }, [estimate, items, allocations, adjustments, reviews, rate, finalPrice, currency]);

  useCopilotForm(`simple-pricing:${projectId}`, estimate && calculations ? {
    formSection: "Simple project pricing",
    fields: [
      { name: "currency", label: "מטבע", filled: Boolean(currency), required: true, value: currency },
      { name: "client_calculation_rate", label: "מחיר חישוב לשעה", filled: rate > 0, required: true, value: String(rate) },
      { name: "final_fixed_price", label: "מחיר סופי קבוע", filled: finalPrice > 0, required: true, value: String(finalPrice) },
    ],
    missing: [...(rate > 0 ? [] : ["לא הוגדר מחיר חישוב לשעה"]), ...(items.length ? [] : ["אין סעיפי עבודה באומדן"])],
    notes: ["All values use the canonical project_estimates record.", "The agency must explicitly approve the final price."],
  } : null);

  useEffect(() => onCopilotFormIntent("*", (intent) => {
    if (intent.kind === "focus") {
      if (intent.field === "currency") currencyRef.current?.focus();
      if (intent.field === "client_calculation_rate") rateRef.current?.focus();
      if (intent.field === "final_fixed_price") finalPriceRef.current?.focus();
      return;
    }
    if (intent.field === "currency") {
      const nextCurrency = String(intent.value).toUpperCase();
      if (currencyOptions.some((option) => option.value === nextCurrency)) setCurrency(nextCurrency);
      return;
    }
    const value = Number(String(intent.value).replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(value)) return;
    if (intent.field === "client_calculation_rate") setRate(value);
    if (intent.field === "final_fixed_price") setFinalPrice(value);
  }), []);

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true); setError(""); setNotice("");
    try {
      await action();
      await Promise.all([reload(), refreshCommercials()]);
      setNotice(success);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "הפעולה נכשלה.");
    } finally { setBusy(false); }
  }

  if (loading) return <section className="card simple-pricing-workspace"><p>טוען תמחור…</p></section>;
  if (!estimate) return (
    <section className="card simple-pricing-workspace" dir="rtl">
      <p className="eyebrow">תמחור והצעה</p>
      <h2>עדיין אין אומדן לפרויקט</h2>
      <p className="simple-note">האומדן יישמר במודל התמחור הקיים של הפרויקט.</p>
      <button type="button" className="primary-button" disabled={busy} onClick={() => void run(
        () => createEstimate(projectId, { status: "draft", currency: "ILS" }, 1),
        "נוצר אומדן ראשוני.",
      )}>צור אומדן ראשוני</button>
      {error ? <p className="form-error">{error}</p> : null}
    </section>
  );
  if (!calculations) return null;

  const { hours, budget, internal, recommended, margin, warnings } = calculations;
  const approved = estimate.approved_by_yaniv && estimate.final_fixed_price != null;
  const currencyMark = currencyOptions.find((option) => option.value === currency)?.mark ?? currency;

  async function saveRate() {
    await run(() => updateEstimate(estimate.id, {
      currency,
      client_calculation_rate: rate,
      estimated_hours_min: hours.totalMin,
      estimated_hours_max: hours.totalMax,
      estimated_budget_min: budget.min,
      estimated_budget_max: budget.max,
      internal_cost: internal.max,
      recommended_fixed_price: recommended,
    }), "מחיר החישוב נשמר והאומדן עודכן.");
  }

  async function approvePrice() {
    const price = finalPrice || recommended;
    await run(async () => {
      await snapshotEstimateVersion(estimate, items, "Fixed price approved in Simple Mode");
      await updateEstimate(estimate.id, {
        currency,
        final_fixed_price: price,
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
    }, "המחיר הסופי אושר ונשמר בגרסת אומדן נעולה.");
  }

  return (
    <div className="simple-workflow-stack" dir="rtl">
      <section className="card simple-pricing-workspace">
        <header className="simple-section-heading">
          <div><p className="eyebrow">תמחור והצעה</p><h2>המספרים החשובים לפרויקט</h2></div>
          <span className={`simple-pill ${approved ? "success" : ""}`}>{approved ? "מחיר מאושר" : "טיוטת תמחור"}</span>
        </header>

        <div className="simple-pricing-rate">
          <label>מטבע
            <select ref={currencyRef} data-copilot-field="currency" value={currency} onChange={(event) => setCurrency(event.target.value)}>
              {currencyOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label>מחיר חישוב לשעה
            <span className="money-input"><input ref={rateRef} data-copilot-field="client_calculation_rate" type="number" min="0" value={rate} onChange={(event) => setRate(Number(event.target.value))} /><b>{currencyMark}</b></span>
          </label>
          <button type="button" disabled={busy || rate <= 0} onClick={() => void saveRate()}>שמור מחיר לשעה</button>
          <p className="simple-note simple-action-note">שינוי המטבע משנה את יחידת התמחור בלבד ואינו ממיר אוטומטית את הסכומים.</p>
        </div>

        <dl className="simple-pricing-facts">
          <div><dt>שעות מוערכות</dt><dd>{hours.totalMin}–{hours.totalMax}</dd></div>
          <div><dt>עלות פנימית</dt><dd>{formatMoney(internal.max, currency)}</dd></div>
          <div><dt>טווח תקציב</dt><dd>{formatMoney(budget.min, currency)}–{formatMoney(budget.max, currency)}</dd></div>
          <div className="recommended"><dt>מחיר מומלץ</dt><dd>{formatMoney(recommended, currency)}</dd></div>
          <div><dt>רווח צפוי</dt><dd>{margin}%</dd></div>
        </dl>

        <section className={`simple-risk-summary ${warnings.length ? "warning" : "success"}`}>
          <strong>סיכונים עיקריים</strong>
          {warnings.length ? <ul>{warnings.slice(0, 4).map((warning) => <li key={warning}>{warning}</li>)}</ul> : <p>לא זוהה כרגע סיכון מסחרי חריג.</p>}
        </section>

        {!approved ? <div className="simple-fixed-price">
          <label>מחיר סופי לפרויקט
            <span className="money-input"><input ref={finalPriceRef} data-copilot-field="final_fixed_price" type="number" min="0" value={finalPrice || recommended} onChange={(event) => setFinalPrice(Number(event.target.value))} /><b>{currencyMark}</b></span>
          </label>
          <button type="button" onClick={() => setFinalPrice(recommended)}>קבל את ההמלצה</button>
          <button type="button" className="primary-button" disabled={busy || (finalPrice || recommended) <= 0} onClick={() => void approvePrice()}>אשר מחיר סופי</button>
        </div> : <div className="simple-next-action">
          <div><strong>המחיר הסופי אושר: {formatMoney(estimate.final_fixed_price ?? recommended, currency)}</strong><span>השלב הבא הוא יצירת הצעה לחתימת הלקוח.</span></div>
          <button type="button" className="primary-button" onClick={() => setProposalOpen(true)}>צור הצעה ללקוח</button>
        </div>}

        {notice ? <p className="form-success">{notice}</p> : null}
        {error ? <p className="form-error">{error}</p> : null}
      </section>

      {proposalOpen ? <ProposalPanel projectId={projectId} mode="admin" /> : null}

      <details className="card simple-advanced-details">
        <summary>הצג פירוט תמחור מתקדם</summary>
        <p className="simple-note">סעיפי עבודה, תפקידים, הקצאות ספקים, מורכבות, באפרים וגרסאות.</p>
        <EstimateControl projectId={projectId} />
      </details>
    </div>
  );
}
