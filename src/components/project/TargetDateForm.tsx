import { useEffect, useState } from "react";
import { useAppData } from "../../context/AppDataContext";
import { StatusBadge } from "../StatusBadge";
import {
  datePriorityLabels, deliveryRangeLabel, emptySchedule, formatDate, REQUESTED_DATE_DISCLAIMER,
  riskTone, targetDateStatusLabels, type DatePriority,
} from "../../lib/scheduling";
import { buildProjectCommercials } from "../../lib/projectCommercials";
import type { Project } from "../../types/domain";

const priorities: DatePriority[] = ["flexible", "preferred", "important", "critical"];

/**
 * Client-facing requested completion date. A requested date is a request, never a
 * commitment: only the agency can approve a delivery date.
 */
export function TargetDateForm({ project, readOnly = false }: { project: Project; readOnly?: boolean }) {
  const { projectSchedules, supplierProfiles, saveProjectSchedule, isPending, getError, getSuccess } = useAppData();
  const schedule = projectSchedules.find((s) => s.projectId === project.id) ?? emptySchedule(project.id);
  const key = `schedule:save:${project.id}`;

  const [form, setForm] = useState({
    requestedCompletionDate: "", datePriority: "flexible" as DatePriority,
    dateReason: "", partialDeliveryOk: false, phaseOneDate: "",
  });

  useEffect(() => {
    setForm({
      requestedCompletionDate: schedule.requestedCompletionDate ?? "",
      datePriority: schedule.datePriority,
      dateReason: schedule.dateReason,
      partialDeliveryOk: schedule.partialDeliveryOk,
      phaseOneDate: schedule.phaseOneDate ?? "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, schedule.requestedCompletionDate, schedule.datePriority, schedule.partialDeliveryOk]);

  const commercials = buildProjectCommercials({ project, schedule, supplierProfiles });
  const status = schedule.approvedDeliveryDate ? "approved" : commercials.feasibility.status;

  async function submit() {
    await saveProjectSchedule(project.id, {
      requestedCompletionDate: form.requestedCompletionDate || null,
      datePriority: form.datePriority,
      dateReason: form.dateReason,
      partialDeliveryOk: form.partialDeliveryOk,
      phaseOneDate: form.phaseOneDate || null,
    }).catch(() => {});
  }

  return (
    <section className="card form-panel">
      <div className="control-summary-head">
        <h2>Target completion date</h2>
        <StatusBadge label={targetDateStatusLabels[status]} tone={riskTone(status)} />
      </div>
      <p className="form-note">{REQUESTED_DATE_DISCLAIMER}</p>

      {readOnly ? (
        <dl className="meta-list">
          <div><dt>Requested date</dt><dd>{formatDate(schedule.requestedCompletionDate)}</dd></div>
          <div><dt>Priority</dt><dd>{datePriorityLabels[schedule.datePriority]}</dd></div>
          <div><dt>Reason</dt><dd>{schedule.dateReason || "Not provided"}</dd></div>
          <div><dt>Partial delivery acceptable</dt><dd>{schedule.partialDeliveryOk ? "Yes" : "No"}</dd></div>
          {schedule.phaseOneDate ? <div><dt>Phase one date</dt><dd>{formatDate(schedule.phaseOneDate)}</dd></div> : null}
        </dl>
      ) : (
        <>
          <div className="form-grid">
            <label>Requested completion date
              <input type="date" value={form.requestedCompletionDate}
                onChange={(e) => setForm({ ...form, requestedCompletionDate: e.target.value })} />
            </label>
            <label>How important is this date?
              <select value={form.datePriority} onChange={(e) => setForm({ ...form, datePriority: e.target.value as DatePriority })}>
                {priorities.map((p) => <option key={p} value={p}>{datePriorityLabels[p]}</option>)}
              </select>
            </label>
            <label>Is a partial delivery acceptable?
              <select value={form.partialDeliveryOk ? "yes" : "no"}
                onChange={(e) => setForm({ ...form, partialDeliveryOk: e.target.value === "yes" })}>
                <option value="no">No</option>
                <option value="yes">Yes — a first useful phase is fine</option>
              </select>
            </label>
            {form.partialDeliveryOk ? (
              <label>Date needed for the first phase
                <input type="date" value={form.phaseOneDate}
                  onChange={(e) => setForm({ ...form, phaseOneDate: e.target.value })} />
              </label>
            ) : null}
            <label className="span-2">Why is this date needed?
              <textarea placeholder="Campaign launch, event, contract deadline…" value={form.dateReason}
                onChange={(e) => setForm({ ...form, dateReason: e.target.value })} />
            </label>
          </div>
          <div className="form-actions">
            <button className="primary-button" type="button" disabled={isPending(key)} onClick={() => void submit()}>
              {isPending(key) ? "Saving…" : "Save requested date"}
            </button>
          </div>
          {getError(key) ? <p className="form-error" role="alert">{getError(key)}</p> : null}
          {getSuccess(key) ? <p className="form-success">{getSuccess(key)}</p> : null}
        </>
      )}

      <dl className="meta-list">
        <div><dt>Current status</dt><dd>{targetDateStatusLabels[status]} — {commercials.feasibility.explanation}</dd></div>
        <div><dt>Estimated delivery range</dt><dd>{deliveryRangeLabel(commercials.feasibility)}</dd></div>
        <div><dt>Confirmed delivery date</dt><dd>{formatDate(schedule.approvedDeliveryDate)}</dd></div>
      </dl>
    </section>
  );
}