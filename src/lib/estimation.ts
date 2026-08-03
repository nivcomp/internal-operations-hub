import type {
  EstimateAdjustment,
  EstimateItem,
  EstimateRoleAllocation,
  EstimateSupplierReview,
  ProjectEstimate,
  ScenarioSelection,
} from "../types/estimation";

/** Per-unit hours so client quantity changes scale correctly. */
export function perUnitHours(item: EstimateItem): { min: number; max: number } {
  const qty = item.quantity > 0 ? item.quantity : 1;
  if (item.estimated_hours_min > 0 || item.estimated_hours_max > 0) {
    return { min: item.estimated_hours_min / qty, max: item.estimated_hours_max / qty };
  }
  const factor = (item.complexity_multiplier || 1) * (item.integration_multiplier || 1);
  const min = (item.base_hours || 0) * factor;
  return { min, max: min * (item.uncertainty_multiplier || 1) };
}

/** Recompute an item's stored hour range from its base inputs. */
export function recomputeItemHours(item: EstimateItem): { min: number; max: number } {
  const qty = item.quantity > 0 ? item.quantity : 1;
  const factor = qty * (item.complexity_multiplier || 1) * (item.integration_multiplier || 1);
  const min = round2((item.base_hours || 0) * factor);
  return { min, max: round2(min * (item.uncertainty_multiplier || 1)) };
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

export type Selection = Map<string, { selected: boolean; quantity: number }>;

export function selectionFromItems(items: EstimateItem[]): Selection {
  const map: Selection = new Map();
  for (const item of items) {
    map.set(item.id, {
      selected: item.client_optional ? item.selected_by_client : true,
      quantity: item.quantity > 0 ? item.quantity : 1,
    });
  }
  return map;
}

export function selectionFromScenario(items: EstimateItem[], selections: ScenarioSelection[]): Selection {
  const base = selectionFromItems(items);
  for (const entry of selections) {
    if (base.has(entry.itemId)) base.set(entry.itemId, { selected: entry.selected, quantity: entry.quantity });
  }
  return base;
}

export function selectionToArray(selection: Selection): ScenarioSelection[] {
  return [...selection.entries()].map(([itemId, value]) => ({ itemId, ...value }));
}

export interface HourBreakdown {
  directMin: number;
  directMax: number;
  yanivMin: number;
  yanivMax: number;
  supplierMin: number;
  supplierMax: number;
  managementMin: number;
  managementMax: number;
  testingMin: number;
  testingMax: number;
  riskMin: number;
  riskMax: number;
  contingencyMin: number;
  contingencyMax: number;
  totalMin: number;
  totalMax: number;
  byRole: { role: string; min: number; max: number }[];
  bySupplier: { supplierId: string | null; min: number; max: number }[];
  unassignedMin: number;
  unassignedMax: number;
}

export function computeHours(
  estimate: ProjectEstimate,
  items: EstimateItem[],
  selection: Selection,
): HourBreakdown {
  let directMin = 0, directMax = 0, yanivMin = 0, yanivMax = 0, supplierMin = 0, supplierMax = 0;
  let unassignedMin = 0, unassignedMax = 0;
  const byRole = new Map<string, { min: number; max: number }>();
  const bySupplier = new Map<string | null, { min: number; max: number }>();

  for (const item of items) {
    const sel = selection.get(item.id) ?? { selected: !item.client_optional, quantity: item.quantity || 1 };
    if (!sel.selected) continue;
    const unit = perUnitHours(item);
    const min = unit.min * (sel.quantity || 1);
    const max = unit.max * (sel.quantity || 1);
    directMin += min; directMax += max;

    const role = item.responsible_role;
    const prevRole = byRole.get(role) ?? { min: 0, max: 0 };
    byRole.set(role, { min: prevRole.min + min, max: prevRole.max + max });

    if (role.startsWith("yaniv")) { yanivMin += min; yanivMax += max; }
    if (item.supplier_id) {
      supplierMin += min; supplierMax += max;
      const prev = bySupplier.get(item.supplier_id) ?? { min: 0, max: 0 };
      bySupplier.set(item.supplier_id, { min: prev.min + min, max: prev.max + max });
    } else if (!role.startsWith("yaniv")) {
      unassignedMin += min; unassignedMax += max;
    }
  }

  const pct = (v: number) => (v || 0) / 100;
  const managementMin = directMin * pct(estimate.management_buffer_percent);
  const managementMax = directMax * pct(estimate.management_buffer_percent);
  const testingMin = directMin * pct(estimate.testing_buffer_percent);
  const testingMax = directMax * pct(estimate.testing_buffer_percent);
  const riskMin = directMin * pct(estimate.risk_buffer_percent);
  const riskMax = directMax * pct(estimate.risk_buffer_percent);
  const subMin = directMin + managementMin + testingMin + riskMin;
  const subMax = directMax + managementMax + testingMax + riskMax;
  const contingencyMin = subMin * pct(estimate.contingency_percent);
  const contingencyMax = subMax * pct(estimate.contingency_percent);

  return {
    directMin: round2(directMin), directMax: round2(directMax),
    yanivMin: round2(yanivMin), yanivMax: round2(yanivMax),
    supplierMin: round2(supplierMin), supplierMax: round2(supplierMax),
    managementMin: round2(managementMin), managementMax: round2(managementMax),
    testingMin: round2(testingMin), testingMax: round2(testingMax),
    riskMin: round2(riskMin), riskMax: round2(riskMax),
    contingencyMin: round2(contingencyMin), contingencyMax: round2(contingencyMax),
    totalMin: round2(subMin + contingencyMin), totalMax: round2(subMax + contingencyMax),
    byRole: [...byRole.entries()].map(([role, v]) => ({ role, min: round2(v.min), max: round2(v.max) })),
    bySupplier: [...bySupplier.entries()].map(([supplierId, v]) => ({ supplierId, min: round2(v.min), max: round2(v.max) })),
    unassignedMin: round2(unassignedMin), unassignedMax: round2(unassignedMax),
  };
}

function roundTo(value: number, increment: number, mode: "floor" | "ceil") {
  if (!increment || increment <= 0) return Math.round(value);
  return mode === "floor"
    ? Math.floor(value / increment) * increment
    : Math.ceil(value / increment) * increment;
}

export function computeClientBudget(
  estimate: ProjectEstimate,
  hours: HourBreakdown,
  adjustments: EstimateAdjustment[] = [],
): { min: number; max: number } {
  const rate = estimate.client_calculation_rate || 0;
  let min = hours.totalMin * rate;
  let max = hours.totalMax * rate;
  for (const adj of adjustments) {
    if (adj.kind === "percent") { min *= 1 + adj.amount / 100; max *= 1 + adj.amount / 100; }
    else { min += adj.amount; max += adj.amount; }
  }
  const inc = estimate.estimate_rounding_increment;
  return { min: roundTo(min, inc, "floor"), max: roundTo(max, inc, "ceil") };
}

export interface InternalCost {
  min: number;
  max: number;
  supplierMin: number;
  supplierMax: number;
  yanivMin: number;
  yanivMax: number;
  external: number;
}

export function computeInternalCost(
  estimate: ProjectEstimate,
  allocations: EstimateRoleAllocation[],
  hours: HourBreakdown,
): InternalCost {
  let supplierMin = 0, supplierMax = 0, yanivMin = 0, yanivMax = 0;
  if (allocations.length) {
    for (const alloc of allocations) {
      const min = alloc.fixed_internal_cost ?? alloc.estimated_hours_min * alloc.internal_hourly_cost;
      const max = alloc.fixed_internal_cost ?? alloc.estimated_hours_max * alloc.internal_hourly_cost;
      if (alloc.supplier_id) { supplierMin += min; supplierMax += max; }
      else { yanivMin += min; yanivMax += max; }
    }
  } else {
    yanivMin = hours.yanivMin * estimate.yaniv_internal_hourly_cost;
    yanivMax = hours.yanivMax * estimate.yaniv_internal_hourly_cost;
  }
  const external = estimate.external_costs || 0;
  return {
    supplierMin: round2(supplierMin), supplierMax: round2(supplierMax),
    yanivMin: round2(yanivMin), yanivMax: round2(yanivMax),
    external,
    min: round2(supplierMin + yanivMin + external),
    max: round2(supplierMax + yanivMax + external),
  };
}

export function recommendedFixedPrice(internalCostMax: number, targetMarginPercent: number) {
  const margin = Math.min(Math.max(targetMarginPercent || 0, 0), 95) / 100;
  return Math.round(internalCostMax / (1 - margin));
}

export function marginPercent(price: number, cost: number) {
  if (!price) return 0;
  return round2(((price - cost) / price) * 100);
}

export function buildWarnings(args: {
  estimate: ProjectEstimate;
  budget: { min: number; max: number };
  internal: InternalCost;
  recommended: number;
  hours: HourBreakdown;
  reviews: EstimateSupplierReview[];
  items: EstimateItem[];
}): string[] {
  const { estimate, budget, internal, recommended, hours, reviews, items } = args;
  const warnings: string[] = [];
  const price = estimate.final_fixed_price ?? budget.max;
  if (budget.min < internal.max) warnings.push("The low end of the client budget is below the maximum internal cost.");
  const actual = marginPercent(price, internal.max);
  if (actual < estimate.target_margin_percent) {
    warnings.push(`Expected margin ${actual}% is below the ${estimate.target_margin_percent}% target.`);
  }
  if (price < recommended) warnings.push(`Price is below the recommended fixed price of ${Math.round(recommended)}.`);
  const increased = reviews.filter((review) => {
    const item = items.find((i) => i.id === review.item_id);
    if (!item || review.suggested_hours_max == null) return false;
    return review.suggested_hours_max > item.estimated_hours_max;
  });
  if (increased.length) warnings.push(`${increased.length} supplier review(s) increased the expected hours.`);
  if (estimate.contingency_percent < 5) warnings.push("Contingency is below 5% — the fixed price carries little protection.");
  if (hours.unassignedMax > 0) warnings.push(`${hours.unassignedMax} hours of delivery work are not assigned to a supplier.`);
  return warnings;
}

/** Calendar duration from effort hours and weekly capacity. */
export function calendarWeeks(hours: HourBreakdown, weeklyCapacity: number) {
  const capacity = weeklyCapacity > 0 ? weeklyCapacity : 10;
  return {
    min: Math.max(1, Math.ceil(hours.totalMin / capacity)),
    max: Math.max(1, Math.ceil(hours.totalMax / capacity)),
  };
}

export function formatMoney(value: number, currencyCode: string) {
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency: currencyCode, maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${currencyCode} ${Math.round(value).toLocaleString()}`;
  }
}

export function formatHours(min: number, max: number) {
  return min === max ? `${min} hrs` : `${min}–${max} hrs`;
}