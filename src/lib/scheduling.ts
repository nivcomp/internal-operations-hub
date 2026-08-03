/**
 * One shared delivery-feasibility model.
 *
 * Effort hours and calendar duration are deliberately separate: hours come from the
 * estimate, calendar time comes from capacity, dependencies, delays and buffers.
 * The same function is mirrored server-side in
 * `supabase/functions/project-chat/schedule.ts` so every AI assistant answers with
 * the same numbers the UI shows.
 */

export type DatePriority = "flexible" | "preferred" | "important" | "critical";

export type TargetDateStatus =
  | "no_date_requested"
  | "under_review"
  | "realistic"
  | "tight"
  | "high_risk"
  | "not_realistic"
  | "approved"
  | "needs_scope_reduction";

export const targetDateStatusLabels: Record<TargetDateStatus, string> = {
  no_date_requested: "No date requested",
  under_review: "Under review",
  realistic: "Realistic",
  tight: "Tight",
  high_risk: "High risk",
  not_realistic: "Not realistic",
  approved: "Approved",
  needs_scope_reduction: "Needs scope reduction",
};

export const targetDateStatusExplanations: Record<TargetDateStatus, string> = {
  no_date_requested: "No completion date has been requested yet.",
  under_review: "The requested date is being reviewed against scope, availability and dependencies.",
  realistic: "The requested date appears achievable with the current scope and planned availability.",
  tight: "The date may be possible, but there is little room for delays.",
  high_risk: "The date is at risk. Any delay or change will push delivery past it.",
  not_realistic: "The current scope is unlikely to be completed by the requested date.",
  approved: "A delivery date has been approved by the agency.",
  needs_scope_reduction: "To meet this date, reduce the scope or deliver the project in phases.",
};

export const datePriorityLabels: Record<DatePriority, string> = {
  flexible: "Flexible",
  preferred: "Preferred",
  important: "Important",
  critical: "Critical",
};

export const REQUESTED_DATE_DISCLAIMER =
  "Your requested completion date will be reviewed against the project scope, supplier availability, dependencies and testing requirements.";

export interface ProjectSchedule {
  id?: string;
  projectId: string;
  requestedCompletionDate: string | null;
  datePriority: DatePriority;
  dateReason: string;
  partialDeliveryOk: boolean;
  phaseOneDate: string | null;
  targetDateStatus: TargetDateStatus;
  statusReason: string;
  earliestStartDate: string | null;
  weeklyCapacityHours: number;
  clientResponseDelayDays: number;
  externalApprovalDelayDays: number;
  recommendedDeliveryStart: string | null;
  recommendedDeliveryEnd: string | null;
  approvedDeliveryDate: string | null;
  supplierAvailabilityConfirmed: boolean;
  scopeChangedAfterDateApproval: boolean;
  deliveryNotes: string;
}

export function emptySchedule(projectId: string): ProjectSchedule {
  return {
    projectId,
    requestedCompletionDate: null,
    datePriority: "flexible",
    dateReason: "",
    partialDeliveryOk: false,
    phaseOneDate: null,
    targetDateStatus: "no_date_requested",
    statusReason: "",
    earliestStartDate: null,
    weeklyCapacityHours: 0,
    clientResponseDelayDays: 3,
    externalApprovalDelayDays: 0,
    recommendedDeliveryStart: null,
    recommendedDeliveryEnd: null,
    approvedDeliveryDate: null,
    supplierAvailabilityConfirmed: false,
    scopeChangedAfterDateApproval: false,
    deliveryNotes: "",
  };
}

export interface CapacityInput {
  /** Weekly hours Yaniv can personally give the project. */
  yanivWeeklyHours: number;
  /** Weekly availability of each supplier assigned to delivery work. */
  supplierWeeklyHours: number[];
  /** Manual override; when > 0 it replaces the derived capacity. */
  overrideWeeklyHours: number;
}

export interface FeasibilityInput {
  totalHoursMin: number;
  totalHoursMax: number;
  yanivHours: number;
  supplierHours: number;
  capacity: CapacityInput;
  earliestStartDate: string | null;
  clientResponseDelayDays: number;
  externalApprovalDelayDays: number;
  requestedCompletionDate: string | null;
  partialDeliveryOk: boolean;
  approvedDeliveryDate: string | null;
  supplierAvailabilityConfirmed: boolean;
  hasUnassignedDeliveryWork: boolean;
  today?: string;
}

export interface Feasibility {
  /** Effort, never calendar time. */
  totalHoursMin: number;
  totalHoursMax: number;
  weeklyCapacityHours: number;
  parallelEfficiency: number;
  durationWeeksMin: number;
  durationWeeksMax: number;
  delayDays: number;
  startDate: string;
  recommendedStart: string | null;
  recommendedEnd: string | null;
  requestedDate: string | null;
  approvedDeliveryDate: string | null;
  slackDays: number | null;
  status: TargetDateStatus;
  explanation: string;
  reasons: string[];
}

const DAY = 86_400_000;

export function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + Math.round(days) * DAY);
}

export function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / DAY);
}

export function formatDate(value: string | null | undefined): string {
  const d = toDate(value ?? null);
  if (!d) return "Not set";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** Parallel work never scales linearly — more people means more coordination. */
export function parallelEfficiency(supplierCount: number): number {
  if (supplierCount <= 1) return 1;
  if (supplierCount === 2) return 0.85;
  return 0.75;
}

export function weeklyCapacity(capacity: CapacityInput): { hours: number; efficiency: number } {
  if (capacity.overrideWeeklyHours > 0) {
    return { hours: capacity.overrideWeeklyHours, efficiency: 1 };
  }
  const suppliers = capacity.supplierWeeklyHours.filter((hours) => hours > 0);
  const efficiency = parallelEfficiency(suppliers.length);
  const supplierCapacity = suppliers.reduce((sum, hours) => sum + hours, 0) * efficiency;
  const yaniv = capacity.yanivWeeklyHours > 0 ? capacity.yanivWeeklyHours : 8;
  const hours = supplierCapacity + yaniv;
  return { hours: Math.max(hours, 4), efficiency };
}

export function computeFeasibility(input: FeasibilityInput): Feasibility {
  const { hours: capacityHours, efficiency } = weeklyCapacity(input.capacity);
  const durationWeeksMin = Math.max(1, Math.ceil(input.totalHoursMin / capacityHours));
  const durationWeeksMax = Math.max(durationWeeksMin, Math.ceil(input.totalHoursMax / capacityHours));
  const delayDays = Math.max(0, input.clientResponseDelayDays) + Math.max(0, input.externalApprovalDelayDays);

  const today = toDate(input.today ?? null) ?? new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  const earliest = toDate(input.earliestStartDate);
  const startDate = earliest && earliest.getTime() > today.getTime() ? earliest : today;

  const recommendedStart = addDays(startDate, durationWeeksMin * 7 + delayDays);
  const recommendedEnd = addDays(startDate, durationWeeksMax * 7 + delayDays);

  const requested = toDate(input.requestedCompletionDate);
  const approved = toDate(input.approvedDeliveryDate);

  const reasons: string[] = [];
  if (input.hasUnassignedDeliveryWork) reasons.push("Delivery work is not assigned to a supplier yet.");
  if (!input.supplierAvailabilityConfirmed && input.supplierHours > 0) {
    reasons.push("Supplier availability has not been confirmed.");
  }
  if (input.capacity.overrideWeeklyHours <= 0 && !input.capacity.supplierWeeklyHours.some((h) => h > 0) && input.supplierHours > 0) {
    reasons.push("No supplier weekly availability is recorded, so capacity is an assumption.");
  }
  if (delayDays > 0) reasons.push(`${delayDays} day(s) reserved for client answers and external approvals.`);

  let status: TargetDateStatus;
  let slackDays: number | null = null;

  if (approved) {
    status = "approved";
  } else if (!requested) {
    status = "no_date_requested";
  } else {
    slackDays = daysBetween(recommendedEnd, requested);
    if (slackDays >= 7) status = "realistic";
    else if (slackDays >= 0) status = "tight";
    else if (slackDays >= -14) status = "high_risk";
    else status = input.partialDeliveryOk ? "needs_scope_reduction" : "not_realistic";
  }

  if (status === "realistic" && reasons.length >= 2) status = "tight";

  const explanation = targetDateStatusExplanations[status];

  return {
    totalHoursMin: Math.round(input.totalHoursMin),
    totalHoursMax: Math.round(input.totalHoursMax),
    weeklyCapacityHours: Math.round(capacityHours * 10) / 10,
    parallelEfficiency: efficiency,
    durationWeeksMin,
    durationWeeksMax,
    delayDays,
    startDate: toIso(startDate),
    recommendedStart: toIso(recommendedStart),
    recommendedEnd: toIso(recommendedEnd),
    requestedDate: input.requestedCompletionDate ?? null,
    approvedDeliveryDate: input.approvedDeliveryDate ?? null,
    slackDays,
    status,
    explanation,
    reasons,
  };
}

export function riskTone(status: TargetDateStatus): "neutral" | "success" | "warning" | "danger" | "info" {
  switch (status) {
    case "realistic": return "success";
    case "approved": return "success";
    case "tight": return "warning";
    case "high_risk": return "warning";
    case "not_realistic": return "danger";
    case "needs_scope_reduction": return "danger";
    case "under_review": return "info";
    default: return "neutral";
  }
}

export function deliveryRangeLabel(feasibility: Feasibility): string {
  if (!feasibility.recommendedStart || !feasibility.recommendedEnd) return "Not calculated";
  return `${formatDate(feasibility.recommendedStart)} – ${formatDate(feasibility.recommendedEnd)}`;
}

/** The single next action Yaniv should take on schedule for this project. */
export function nextScheduleAction(feasibility: Feasibility, schedule: ProjectSchedule): string {
  if (schedule.scopeChangedAfterDateApproval) return "Scope changed after the date was approved — review budget and schedule.";
  switch (feasibility.status) {
    case "no_date_requested": return "Ask the client for a requested completion date.";
    case "under_review": return "Review the requested date and set a recommended delivery range.";
    case "realistic": return "Approve the delivery range with the client.";
    case "tight": return "Confirm supplier availability before committing to the date.";
    case "high_risk": return "Review scope reduction or assign another supplier.";
    case "not_realistic": return "Tell the client the date is not achievable and propose a realistic range.";
    case "needs_scope_reduction": return "Propose a phased delivery or a reduced first phase.";
    case "approved": return schedule.supplierAvailabilityConfirmed ? "Delivery commitment is in place." : "Confirm supplier availability against the approved date.";
    default: return "Review the project schedule.";
  }
}