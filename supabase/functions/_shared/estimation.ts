// Server-side mirror of src/lib/estimation.ts. Used to validate AI proposals and to
// compute the "before / after" preview shown on every confirmation card.
// Keep the formulas identical to the client library.

export const round2 = (n: number) => Math.round(n * 100) / 100;

export const COMPLEXITY_MULTIPLIERS: Record<string, number> = {
  simple: 0.8,
  standard: 1,
  complex: 1.4,
  very_complex: 1.9,
};

export const RESPONSIBLE_ROLES = [
  "yaniv_discovery",
  "yaniv_project_management",
  "architecture",
  "design",
  "development",
  "automation",
  "integration",
  "testing",
  "deployment",
  "training",
  "supplier_work",
];

export const OPTION_TIERS = ["basic", "standard", "advanced"];

export type Item = Record<string, any>;
export type Estimate = Record<string, any>;
export type Selection = Map<string, { selected: boolean; quantity: number }>;

export function perUnitHours(item: Item) {
  const qty = Number(item.quantity) > 0 ? Number(item.quantity) : 1;
  const min = Number(item.estimated_hours_min) || 0;
  const max = Number(item.estimated_hours_max) || 0;
  if (min > 0 || max > 0) return { min: min / qty, max: max / qty };
  const factor = (Number(item.complexity_multiplier) || 1) * (Number(item.integration_multiplier) || 1);
  const base = (Number(item.base_hours) || 0) * factor;
  return { min: base, max: base * (Number(item.uncertainty_multiplier) || 1) };
}

export function defaultSelection(items: Item[]): Selection {
  const map: Selection = new Map();
  for (const item of items) {
    map.set(item.id, {
      selected: item.client_optional ? !!item.selected_by_client : true,
      quantity: Number(item.quantity) > 0 ? Number(item.quantity) : 1,
    });
  }
  return map;
}

export interface Hours {
  directMin: number; directMax: number;
  yanivMin: number; yanivMax: number;
  supplierMin: number; supplierMax: number;
  managementMax: number; testingMax: number; riskMax: number; contingencyMax: number;
  totalMin: number; totalMax: number;
  byRole: { role: string; min: number; max: number }[];
  bySupplier: { supplierId: string; min: number; max: number }[];
  unassignedMin: number; unassignedMax: number;
}

export function computeHours(estimate: Estimate, items: Item[], selection?: Selection): Hours {
  const sel = selection ?? defaultSelection(items);
  let directMin = 0, directMax = 0, yanivMin = 0, yanivMax = 0, supplierMin = 0, supplierMax = 0;
  let unassignedMin = 0, unassignedMax = 0;
  const byRole = new Map<string, { min: number; max: number }>();
  const bySupplier = new Map<string, { min: number; max: number }>();

  for (const item of items) {
    const s = sel.get(item.id) ?? { selected: !item.client_optional, quantity: Number(item.quantity) || 1 };
    if (!s.selected) continue;
    const unit = perUnitHours(item);
    const qty = s.quantity || 1;
    const min = unit.min * qty;
    const max = unit.max * qty;
    directMin += min; directMax += max;
    const role = String(item.responsible_role ?? "development");
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

  const pct = (v: unknown) => (Number(v) || 0) / 100;
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
    managementMax: round2(managementMax), testingMax: round2(testingMax),
    riskMax: round2(riskMax), contingencyMax: round2(contingencyMax),
    totalMin: round2(subMin + contingencyMin), totalMax: round2(subMax + contingencyMax),
    byRole: [...byRole.entries()].map(([role, v]) => ({ role, min: round2(v.min), max: round2(v.max) })),
    bySupplier: [...bySupplier.entries()].map(([supplierId, v]) => ({ supplierId, min: round2(v.min), max: round2(v.max) })),
    unassignedMin: round2(unassignedMin), unassignedMax: round2(unassignedMax),
  };
}

function roundTo(value: number, increment: number, mode: "floor" | "ceil") {
  if (!increment || increment <= 0) return Math.round(value);
  return mode === "floor" ? Math.floor(value / increment) * increment : Math.ceil(value / increment) * increment;
}

export function computeClientBudget(estimate: Estimate, hours: Hours, adjustments: Item[] = []) {
  const rate = Number(estimate.client_calculation_rate) || 0;
  let min = hours.totalMin * rate;
  let max = hours.totalMax * rate;
  for (const adj of adjustments) {
    const amount = Number(adj.amount) || 0;
    if (adj.kind === "percent") { min *= 1 + amount / 100; max *= 1 + amount / 100; }
    else { min += amount; max += amount; }
  }
  const inc = Number(estimate.estimate_rounding_increment) || 0;
  return { min: roundTo(min, inc, "floor"), max: roundTo(max, inc, "ceil") };
}

export function computeInternalCost(estimate: Estimate, allocations: Item[], hours: Hours) {
  let supplierMin = 0, supplierMax = 0, yanivMin = 0, yanivMax = 0;
  if (allocations.length) {
    for (const alloc of allocations) {
      const fixed = alloc.fixed_internal_cost == null ? null : Number(alloc.fixed_internal_cost);
      const rate = Number(alloc.internal_hourly_cost) || 0;
      const min = fixed ?? (Number(alloc.estimated_hours_min) || 0) * rate;
      const max = fixed ?? (Number(alloc.estimated_hours_max) || 0) * rate;
      if (alloc.supplier_id) { supplierMin += min; supplierMax += max; }
      else { yanivMin += min; yanivMax += max; }
    }
  } else {
    const rate = Number(estimate.yaniv_internal_hourly_cost) || 0;
    yanivMin = hours.yanivMin * rate;
    yanivMax = hours.yanivMax * rate;
  }
  const external = Number(estimate.external_costs) || 0;
  return {
    supplierMin: round2(supplierMin), supplierMax: round2(supplierMax),
    yanivMin: round2(yanivMin), yanivMax: round2(yanivMax),
    external,
    min: round2(supplierMin + yanivMin + external),
    max: round2(supplierMax + yanivMax + external),
  };
}

export function recommendedFixedPrice(internalCostMax: number, targetMarginPercent: number) {
  const margin = Math.min(Math.max(Number(targetMarginPercent) || 0, 0), 95) / 100;
  return Math.round(internalCostMax / (1 - margin));
}

export function marginPercent(price: number, cost: number) {
  if (!price) return 0;
  return round2(((price - cost) / price) * 100);
}

export function calendarWeeks(totalMin: number, totalMax: number, weeklyCapacity: number) {
  const capacity = weeklyCapacity > 0 ? weeklyCapacity : 10;
  return { min: Math.max(1, Math.ceil(totalMin / capacity)), max: Math.max(1, Math.ceil(totalMax / capacity)) };
}

/** Full snapshot used by both context building and confirmation previews. */
export function snapshot(estimate: Estimate, items: Item[], allocations: Item[], adjustments: Item[]) {
  const hours = computeHours(estimate, items);
  const budget = computeClientBudget(estimate, hours, adjustments);
  const internal = computeInternalCost(estimate, allocations, hours);
  const recommended = recommendedFixedPrice(internal.max, Number(estimate.target_margin_percent) || 0);
  const price = estimate.final_fixed_price == null ? budget.max : Number(estimate.final_fixed_price);
  return { hours, budget, internal, recommended, margin: marginPercent(price, internal.max) };
}
