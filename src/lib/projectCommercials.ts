import type { Project, SupplierProfile } from "../types/domain";
import type { EstimateSummary } from "../services/scheduleApi";
import {
  computeFeasibility, emptySchedule, nextScheduleAction, type Feasibility, type ProjectSchedule,
} from "./scheduling";

export interface ProjectCommercials {
  schedule: ProjectSchedule;
  summary: EstimateSummary | undefined;
  currency: string;
  hoursMin: number;
  hoursMax: number;
  budgetMin: number;
  budgetMax: number;
  approvedFixedPrice: number | null;
  feasibility: Feasibility;
  nextAction: string;
  hasRate: boolean;
}

/**
 * The single place the app turns stored estimate + schedule records into the
 * numbers every view shows. Nothing here invents values: hours and rate come from
 * the project's estimate, dates from the project's schedule record.
 */
export function buildProjectCommercials(args: {
  project: Project;
  schedule?: ProjectSchedule;
  summary?: EstimateSummary;
  supplierProfiles: SupplierProfile[];
  /** Live totals from an open estimate view, when available. */
  liveHours?: { min: number; max: number };
  liveBudget?: { min: number; max: number };
  supplierHours?: number;
  yanivHours?: number;
  hasUnassignedDeliveryWork?: boolean;
}): ProjectCommercials {
  const { project, supplierProfiles } = args;
  const schedule = args.schedule ?? emptySchedule(project.id);
  const summary = args.summary;
  const rate = summary?.clientCalculationRate ?? 0;

  const hoursMin = args.liveHours?.min ?? summary?.estimatedHoursMin ?? 0;
  const hoursMax = args.liveHours?.max ?? summary?.estimatedHoursMax ?? 0;

  // Budget always follows hours × client calculation rate unless a stored budget exists.
  const derivedMin = Math.round(hoursMin * rate);
  const derivedMax = Math.round(hoursMax * rate);
  const budgetMin = args.liveBudget?.min ?? (summary?.estimatedBudgetMin || derivedMin);
  const budgetMax = args.liveBudget?.max ?? (summary?.estimatedBudgetMax || derivedMax);

  const supplierWeeklyHours = project.assignedSupplierIds
    .map((id) => supplierProfiles.find((p) => p.supplierId === id)?.weeklyAvailabilityHours ?? 0)
    .filter((hours) => hours > 0);

  const feasibility = computeFeasibility({
    totalHoursMin: hoursMin,
    totalHoursMax: hoursMax,
    yanivHours: args.yanivHours ?? 0,
    supplierHours: args.supplierHours ?? Math.max(0, hoursMax - (args.yanivHours ?? 0)),
    capacity: {
      yanivWeeklyHours: 8,
      supplierWeeklyHours,
      overrideWeeklyHours: schedule.weeklyCapacityHours,
    },
    earliestStartDate: schedule.earliestStartDate,
    clientResponseDelayDays: schedule.clientResponseDelayDays,
    externalApprovalDelayDays: schedule.externalApprovalDelayDays,
    requestedCompletionDate: schedule.requestedCompletionDate,
    partialDeliveryOk: schedule.partialDeliveryOk,
    approvedDeliveryDate: schedule.approvedDeliveryDate,
    supplierAvailabilityConfirmed: schedule.supplierAvailabilityConfirmed,
    hasUnassignedDeliveryWork: args.hasUnassignedDeliveryWork ?? project.assignedSupplierIds.length === 0,
  });

  return {
    schedule,
    summary,
    currency: summary?.currency ?? "GBP",
    hoursMin,
    hoursMax,
    budgetMin,
    budgetMax,
    approvedFixedPrice: summary?.approvedByYaniv ? summary.finalFixedPrice : null,
    feasibility,
    nextAction: nextScheduleAction(feasibility, schedule),
    hasRate: rate > 0,
  };
}

export function needsScheduleAttention(c: ProjectCommercials, project: Project): boolean {
  const active = !["completed", "lead_started"].includes(project.status);
  if (c.schedule.scopeChangedAfterDateApproval) return true;
  if (!c.schedule.requestedCompletionDate && active) return true;
  if (["tight", "high_risk", "not_realistic", "needs_scope_reduction", "under_review"].includes(c.feasibility.status)) return true;
  if (c.schedule.approvedDeliveryDate && !c.schedule.supplierAvailabilityConfirmed) return true;
  if (!c.hasRate && active) return true;
  return false;
}