import { useEffect, useMemo, useState } from "react";
import { useAppData } from "../../context/AppDataContext";
import {
  computeClientBudget, computeHours, computeInternalCost, formatMoney, marginPercent,
  recommendedFixedPrice, selectionFromItems,
} from "../../lib/estimation";
import { fetchProjectEstimation, updateEstimate } from "../../services/estimationApi";
import { estimateStatusLabels, type EstimateBundle, type EstimateStatus, type ProjectEstimate } from "../../types/estimation";
import { onEstimationChanged } from "../../lib/estimationEvents";
import { emptySchedule, formatDate, type ProjectSchedule } from "../../lib/scheduling";
import { buildProjectCommercials } from "../../lib/projectCommercials";
import type { Project } from "../../types/domain";

const emptyBundle: EstimateBundle = { estimates: [], items: [], allocations: [], reviews: [], adjustments: [], scenarios: [] };

const statusOptions: EstimateStatus[] = [
  "draft", "ai_estimate", "waiting_for_supplier_review", "supplier_reviewed",
  "waiting_for_yaniv_review", "client_estimate_visible", "fixed_price_approved",
];

/**
 * Agency-only. One commercial calculation setting per project, plus the agency's
 * scheduling inputs. Saving rolls the computed hours and budget back onto the
 * estimate record so every other view and every AI assistant reads the same numbers.
 */
export function CommercialSettingsPanel({ project }: { project: Project }) {
  const { supplierProfiles, projectSchedules, saveProjectSchedule, refreshCommercials, isPending, getError } = useAppData();
  const [bundle, setBundle] = useState<EstimateBundle>(emptyBundle);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const schedule: ProjectSchedule = projectSchedules.find((s) => s.projectId === project.id) ?? emptySchedule(project.id);

  async function reload() {
    setLoading(true);
    try { setBundle(await fetchProjectEstimation(project.id)); }
    finally { setLoading(false); }
  }

  useEffect(() => { void reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [project.id]);
  useEffect(() => onEstimationChanged(project.id, () => { void reload(); }), [project.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const estimate: ProjectEstimate | undefined = useMemo(
    () => bundle.estimates.find((e) => e.status !== "superseded") ?? bundle.estimates[0],
    [bundle.estimates],
  );
  const items = useMemo(
    () => bundle.items.filter((item) => estimate && item.estimate_id === estimate.id),
    [bundle.items, estimate],
  );

  const [form, setForm] = useState({
    client_calculation_rate: 0, currency: "GBP", minimum_billing_unit: 0.25,
    show_hourly_rate_to_client: false, estimated_hours_min: 0, estimated_hours_max: 0,
    estimated_budget_min: 0, estimated_budget_max: 0, final_fixed_price: "",
    target_margin_percent: 40, status: "draft" as EstimateStatus,
  });

  const computed = useMemo(() => {
    if (!estimate) return null;
    const hours = computeHours(estimate, items, selectionFromItems(items));
    const budget = computeClientBudget(estimate, hours, bundle.adjustments);
    const internal = computeInternalCost(estimate, bundle.allocations, hours);
    return { hours, budget, internal, recommended: recommendedFixedPrice(internal.max, estimate.target_margin_percent) };
  }, [estimate, items, bundle.adjustments, bundle.allocations]);

  useEffect(() => {
    if (!estimate) return;
    setForm({
      client_calculation_rate: estimate.client_calculation_rate,
      currency: estimate.currency,
      minimum_billing_unit: estimate.minimum_billing_unit,
      show_hourly_rate_to_client: estimate.show_hourly_rate_to_client,
      estimated_hours_min: computed?.hours.totalMin ?? estimate.estimated_hours_min,
      estimated_hours_max: computed?.hours.totalMax ?? estimate.estimated_hours_max,
      estimated_budget_min: computed?.budget.min ?? estimate.estimated_budget_min,
      estimated_budget_max: computed?.budget.max ?? estimate.estimated_budget_max,
      final_fixed_price: estimate.final_fixed_price == null ? "" : String(estimate.final_fixed_price),
      target_margin_percent: estimate.target_margin_percent,
      status: estimate.status,
    });
  }, [estimate, computed]);

  const [scheduleForm, setScheduleForm] = useState({
    earliestStartDate: "", weeklyCapacityHours: 0, clientResponseDelayDays: 3,
    externalApprovalDelayDays: 0, approvedDeliveryDate: "", supplierAvailabilityConfirmed: false,
    deliveryNotes: "",
  });
  useEffect(() => {
    setScheduleForm({
      earliestStartDate: schedule.earliestStartDate ?? "",
      weeklyCapacityHours: schedule.weeklyCapacityHours,
      clientResponseDelayDays: schedule.clientResponseDelayDays,
      externalApprovalDelayDays: schedule.externalApprovalDelayDays,
      approvedDeliveryDate: schedule.approvedDeliveryDate ?? "",
      supplierAvailabilityConfirmed: schedule.supplierAvailabilityConfirmed,
      deliveryNotes: schedule.deliveryNotes,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedule.projectId, schedule.earliestStartDate, schedule.weeklyCapacityHours, schedule.approvedDeliveryDate, schedule.supplierAvailabilityConfirmed]);

  const commercials = buildProjectCommercials({
    project,
    schedule,
    supplierProfiles,
    summary: {
      projectId: project.id, estimateId: estimate?.id ?? "", version: estimate?.version ?? 1,
      status: estimate?.status ?? "draft", currency: form.currency,
      clientCalculationRate: form.client_calculation_rate, showRateToClient: form.show_hourly_rate_to_client,
      minimumBillingUnit: form.minimum_billing_unit,
      estimatedHoursMin: form.estimated_hours_min, estimatedHoursMax: form.estimated_hours_max,
      estimatedBudgetMin: form.estimated_budget_min, estimatedBudgetMax: form.estimated_budget_max,
      finalFixedPrice: form.final_fixed_price ? Number(form.final_fixed_price) : null,
      targetMarginPercent: form.target_margin_percent,
      clientVisible: estimate?.client_visible ?? false, approvedByYaniv: estimate?.approved_by_yaniv ?? false,
    },
  });

  async function saveCommercial() {
    if (!estimate) return;
    setSaving(true); setNotice(null);
    try {
      const hoursMin = Number(form.estimated_hours_min) || 0;
      const hoursMax = Number(form.estimated_hours_max) || 0;
      const rate = Number(form.client_calculation_rate) || 0;
      await updateEstimate(estimate.id, {
        client_calculation_rate: rate,
        currency: form.currency.toUpperCase(),
        minimum_billing_unit: Number(form.minimum_billing_unit) || 0,
        show_hourly_rate_to_client: form.show_hourly_rate_to_client,
        estimated_hours_min: hoursMin,
        estimated_hours_max: hoursMax,
        // Budget always follows hours × client calculation rate.
        estimated_budget_min: Math.round(hoursMin * rate),
        estimated_budget_max: Math.round(hoursMax * rate),
        target_margin_percent: Number(form.target_margin_percent) || 0,
        status: form.status,
      });
      await reload();
      await refreshCommercials();
      setNotice("Commercial settings saved. All views and AI assistants now use these values.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not save commercial settings.");
    } finally { setSaving(false); }
  }

  async function saveSchedulePlan() {
    const f = commercials.feasibility;
    await saveProjectSchedule(project.id, {
      earliestStartDate: scheduleForm.earliestStartDate || null,
      weeklyCapacityHours: Number(scheduleForm.weeklyCapacityHours) || 0,
      clientResponseDelayDays: Number(scheduleForm.clientResponseDelayDays) || 0,
      externalApprovalDelayDays: Number(scheduleForm.externalApprovalDelayDays) || 0,
      approvedDeliveryDate: scheduleForm.approvedDeliveryDate || null,
      supplierAvailabilityConfirmed: scheduleForm.supplierAvailabilityConfirmed,
      deliveryNotes: scheduleForm.deliveryNotes,
      recommendedDeliveryStart: f.recommendedStart,
      recommendedDeliveryEnd: f.recommendedEnd,
      targetDateStatus: scheduleForm.approvedDeliveryDate ? "approved" : f.status,
      statusReason: f.reasons.join(" ") || f.explanation,
      scopeChangedAfterDateApproval: false,
    }).catch(() => {});
  }

  if (loading) return <section className="card"><h2>Commercial settings</h2><p className="muted-text">Loading…</p></section>;
  if (!estimate) {
    return (
      <section className="card">
        <h2>Commercial settings</h2>
        <p className="muted-text">This project has no estimate yet. Create one in the Estimate tab, then set the client calculation rate here.</p>
      </section>
    );
  }

  const price = form.final_fixed_price ? Number(form.final_fixed_price) : form.estimated_budget_max;
  const margin = computed ? marginPercent(price, computed.internal.max) : 0;

  return (
    <>
      <section className="card form-panel">
        <h2>Commercial settings</h2>
        <p className="form-note">
          The client calculation rate is the rate the system uses to estimate the client budget. It is not the supplier rate.
          Estimated budget = estimated hours × client calculation rate.
        </p>
        <div className="form-grid">
          <label>Client calculation rate
            <input min="0" type="number" value={form.client_calculation_rate}
              onChange={(e) => setForm({ ...form, client_calculation_rate: Number(e.target.value) })} />
          </label>
          <label>Currency
            <input maxLength={3} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
          </label>
          <label>Minimum billing unit (hours)
            <input min="0" step="0.25" type="number" value={form.minimum_billing_unit}
              onChange={(e) => setForm({ ...form, minimum_billing_unit: Number(e.target.value) })} />
          </label>
          <label>Show calculation rate to client
            <select value={form.show_hourly_rate_to_client ? "yes" : "no"}
              onChange={(e) => setForm({ ...form, show_hourly_rate_to_client: e.target.value === "yes" })}>
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </label>
          <label>Estimated hours minimum
            <input min="0" type="number" value={form.estimated_hours_min}
              onChange={(e) => setForm({ ...form, estimated_hours_min: Number(e.target.value) })} />
          </label>
          <label>Estimated hours maximum
            <input min="0" type="number" value={form.estimated_hours_max}
              onChange={(e) => setForm({ ...form, estimated_hours_max: Number(e.target.value) })} />
          </label>
          <label>Estimated budget minimum
            <input readOnly value={Math.round(form.estimated_hours_min * form.client_calculation_rate)} />
          </label>
          <label>Estimated budget maximum
            <input readOnly value={Math.round(form.estimated_hours_max * form.client_calculation_rate)} />
          </label>
          <label>Approved fixed price
            <input readOnly value={estimate.final_fixed_price == null ? "Not approved" : String(estimate.final_fixed_price)} />
          </label>
          <label>Target margin %
            <input min="0" max="95" type="number" value={form.target_margin_percent}
              onChange={(e) => setForm({ ...form, target_margin_percent: Number(e.target.value) })} />
          </label>
          <label>Estimate status
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as EstimateStatus })}>
              {statusOptions.map((s) => <option key={s} value={s}>{estimateStatusLabels[s]}</option>)}
            </select>
          </label>
        </div>
        <p className="form-note">
          A fixed price is only approved through the Estimate tab, which requires your explicit approval.
          Internal comparison — internal cost {computed ? `${formatMoney(computed.internal.min, form.currency)}–${formatMoney(computed.internal.max, form.currency)}` : "n/a"},
          recommended fixed price {computed ? formatMoney(computed.recommended, form.currency) : "n/a"},
          expected margin {margin}% against a {form.target_margin_percent}% target. Supplier cost and margin are never shown to the client.
        </p>
        <div className="form-actions">
          <button className="primary-button" type="button" disabled={saving} onClick={() => void saveCommercial()}>
            {saving ? "Saving…" : "Save commercial settings"}
          </button>
        </div>
        {notice ? <p className="form-success">{notice}</p> : null}
      </section>

      <section className="card form-panel">
        <h2>Delivery planning</h2>
        <p className="form-note">
          Effort hours and calendar duration are separate. Capacity, dependencies, testing, management and expected delays decide the calendar range.
        </p>
        <div className="form-grid">
          <label>Earliest possible start
            <input type="date" value={scheduleForm.earliestStartDate}
              onChange={(e) => setScheduleForm({ ...scheduleForm, earliestStartDate: e.target.value })} />
          </label>
          <label>Weekly capacity override (hours)
            <input min="0" type="number" value={scheduleForm.weeklyCapacityHours}
              onChange={(e) => setScheduleForm({ ...scheduleForm, weeklyCapacityHours: Number(e.target.value) })} />
          </label>
          <label>Expected client-response delay (days)
            <input min="0" type="number" value={scheduleForm.clientResponseDelayDays}
              onChange={(e) => setScheduleForm({ ...scheduleForm, clientResponseDelayDays: Number(e.target.value) })} />
          </label>
          <label>External approval delay (days)
            <input min="0" type="number" value={scheduleForm.externalApprovalDelayDays}
              onChange={(e) => setScheduleForm({ ...scheduleForm, externalApprovalDelayDays: Number(e.target.value) })} />
          </label>
          <label>Approved delivery date (commitment)
            <input type="date" value={scheduleForm.approvedDeliveryDate}
              onChange={(e) => setScheduleForm({ ...scheduleForm, approvedDeliveryDate: e.target.value })} />
          </label>
          <label>Supplier availability confirmed
            <select value={scheduleForm.supplierAvailabilityConfirmed ? "yes" : "no"}
              onChange={(e) => setScheduleForm({ ...scheduleForm, supplierAvailabilityConfirmed: e.target.value === "yes" })}>
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </label>
          <label className="span-2">Delivery notes
            <textarea value={scheduleForm.deliveryNotes}
              onChange={(e) => setScheduleForm({ ...scheduleForm, deliveryNotes: e.target.value })} />
          </label>
        </div>
        <dl className="meta-list">
          <div><dt>Total effort</dt><dd>{commercials.hoursMin}–{commercials.hoursMax} hrs</dd></div>
          <div><dt>Calendar duration</dt><dd>{commercials.feasibility.durationWeeksMin}–{commercials.feasibility.durationWeeksMax} weeks</dd></div>
          <div><dt>Client requested date</dt><dd>{formatDate(schedule.requestedCompletionDate)}</dd></div>
          <div><dt>Agency recommended delivery</dt><dd>{formatDate(commercials.feasibility.recommendedStart)} – {formatDate(commercials.feasibility.recommendedEnd)}</dd></div>
          <div><dt>Approved commitment</dt><dd>{formatDate(schedule.approvedDeliveryDate)}</dd></div>
        </dl>
        <div className="form-actions">
          <button className="primary-button" type="button"
            disabled={isPending(`schedule:save:${project.id}`)}
            onClick={() => void saveSchedulePlan()}>
            {isPending(`schedule:save:${project.id}`) ? "Saving…" : "Save delivery plan"}
          </button>
        </div>
        {getError(`schedule:save:${project.id}`) ? <p className="form-error" role="alert">{getError(`schedule:save:${project.id}`)}</p> : null}
      </section>
    </>
  );
}