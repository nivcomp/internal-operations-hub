import { useState } from "react";
import { StatusBadge } from "../StatusBadge";
import type { ProjectCommercials } from "../../lib/projectCommercials";
import { formatMoney } from "../../lib/estimation";
import {
  deliveryRangeLabel, formatDate, riskTone, targetDateStatusLabels,
} from "../../lib/scheduling";

/**
 * The one summary Yaniv reads before opening anything else. Everything shown here
 * comes from the shared project commercial + schedule records.
 */
export function ProjectControlSummary({
  commercials, assignedSupplierNames, onOpenDetails,
}: {
  commercials: ProjectCommercials;
  assignedSupplierNames: string;
  onOpenDetails?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { feasibility: f, schedule } = commercials;
  const cur = commercials.currency;

  return (
    <section className="card control-summary">
      <div className="control-summary-head">
        <h2>Project control</h2>
        <StatusBadge label={`Date risk: ${targetDateStatusLabels[f.status]}`} tone={riskTone(f.status)} />
      </div>
      <div className="control-summary-grid">
        <div><span>Estimated budget</span><strong>{commercials.hasRate ? `${formatMoney(commercials.budgetMin, cur)}–${formatMoney(commercials.budgetMax, cur)}` : "No calculation rate set"}</strong></div>
        <div><span>Approved fixed price</span><strong>{commercials.approvedFixedPrice != null ? formatMoney(commercials.approvedFixedPrice, cur) : "Not approved"}</strong></div>
        <div><span>Estimated hours</span><strong>{commercials.hoursMax > 0 ? `${commercials.hoursMin}–${commercials.hoursMax} hrs` : "Not estimated"}</strong></div>
        <div><span>Client requested date</span><strong>{formatDate(schedule.requestedCompletionDate)}</strong></div>
        <div><span>Recommended delivery</span><strong>{deliveryRangeLabel(f)}</strong></div>
        <div><span>Approved delivery date</span><strong>{formatDate(schedule.approvedDeliveryDate)}</strong></div>
        <div><span>Assigned supplier</span><strong>{assignedSupplierNames || "None"}</strong></div>
        <div><span>Next action</span><strong>{commercials.nextAction}</strong></div>
      </div>
      <p className="muted-text">{f.explanation}{f.reasons.length ? ` Reason: ${f.reasons[0]}` : ""}</p>
      <div className="action-row">
        <button type="button" onClick={() => setOpen((v) => !v)}>{open ? "Hide details" : "View details"}</button>
        {onOpenDetails ? <button type="button" onClick={onOpenDetails}>Open commercial settings</button> : null}
      </div>
      {open ? (
        <dl className="meta-list">
          <div><dt>Total effort (hours)</dt><dd>{f.totalHoursMin}–{f.totalHoursMax} hrs</dd></div>
          <div><dt>Weekly capacity used</dt><dd>{f.weeklyCapacityHours} h/week (parallel efficiency {Math.round(f.parallelEfficiency * 100)}%)</dd></div>
          <div><dt>Calendar duration</dt><dd>{f.durationWeeksMin}–{f.durationWeeksMax} weeks (effort hours are not calendar time)</dd></div>
          <div><dt>Reserved delay</dt><dd>{f.delayDays} days for client answers and external approvals</dd></div>
          <div><dt>Earliest start</dt><dd>{formatDate(f.startDate)}</dd></div>
          <div><dt>Slack vs requested date</dt><dd>{f.slackDays == null ? "No requested date" : `${f.slackDays} days`}</dd></div>
          <div><dt>Supplier availability</dt><dd>{schedule.supplierAvailabilityConfirmed ? "Confirmed" : "Not confirmed"}</dd></div>
          <div><dt>Risk notes</dt><dd>{f.reasons.length ? f.reasons.join(" ") : "None recorded"}</dd></div>
          {schedule.deliveryNotes ? <div><dt>Delivery notes</dt><dd>{schedule.deliveryNotes}</dd></div> : null}
        </dl>
      ) : null}
    </section>
  );
}