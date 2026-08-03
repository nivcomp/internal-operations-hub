// Proposed-action layer: the AI may only PROPOSE. Every proposal is validated
// server-side, stored as a pending draft with a before/after preview, and written
// to the database only after the right person confirms it.

import {
  COMPLEXITY_MULTIPLIERS, OPTION_TIERS, RESPONSIBLE_ROLES,
  calendarWeeks, computeHours, defaultSelection, round2, snapshot,
} from "./estimation.ts";

export type ActionKind =
  | "add_estimate_items"
  | "update_estimate_settings"
  | "update_estimate_items"
  | "assign_supplier"
  | "request_supplier_review"
  | "accept_supplier_review"
  | "publish_client_estimate"
  | "approve_fixed_price"
  | "save_client_scenario"
  | "supplier_review_response"
  | "create_change_request";

type Role = "agency_admin" | "client" | "supplier";

interface Spec {
  label: string;
  confirmRole: Role;
  visibility: "client_agency" | "supplier_agency" | "agency_only";
  /** Blocked once a fixed price has been approved on the estimate. */
  blockedAfterFixedPrice: boolean;
}

export const ACTION_SPECS: Record<ActionKind, Spec> = {
  add_estimate_items: { label: "Add estimate work items", confirmRole: "agency_admin", visibility: "agency_only", blockedAfterFixedPrice: true },
  update_estimate_settings: { label: "Change estimate commercial settings", confirmRole: "agency_admin", visibility: "agency_only", blockedAfterFixedPrice: true },
  update_estimate_items: { label: "Change estimate work items", confirmRole: "agency_admin", visibility: "agency_only", blockedAfterFixedPrice: true },
  assign_supplier: { label: "Assign work items to a supplier", confirmRole: "agency_admin", visibility: "agency_only", blockedAfterFixedPrice: false },
  request_supplier_review: { label: "Request supplier review", confirmRole: "agency_admin", visibility: "agency_only", blockedAfterFixedPrice: false },
  accept_supplier_review: { label: "Use supplier-reviewed hours", confirmRole: "agency_admin", visibility: "agency_only", blockedAfterFixedPrice: true },
  publish_client_estimate: { label: "Publish estimate range to the client", confirmRole: "agency_admin", visibility: "agency_only", blockedAfterFixedPrice: true },
  approve_fixed_price: { label: "Approve a fixed price", confirmRole: "agency_admin", visibility: "agency_only", blockedAfterFixedPrice: true },
  save_client_scenario: { label: "Save a budget scenario", confirmRole: "client", visibility: "client_agency", blockedAfterFixedPrice: false },
  supplier_review_response: { label: "Send estimate review to the agency", confirmRole: "supplier", visibility: "supplier_agency", blockedAfterFixedPrice: false },
  create_change_request: { label: "Create a draft change request", confirmRole: "client", visibility: "client_agency", blockedAfterFixedPrice: false },
};

export const ACTION_KINDS = Object.keys(ACTION_SPECS) as ActionKind[];

export interface Ctx {
  admin: any;
  projectId: string;
  project: any;
  profile: any;
  supplierId: string | null;
  agent: "project_guide" | "agency_control" | "work_assistant";
}

export interface Bundle {
  estimate: any | null;
  items: any[];
  allocations: any[];
  adjustments: any[];
  reviews: any[];
  scenarios: any[];
}

export async function loadBundle(admin: any, projectId: string): Promise<Bundle> {
  const { data: estimates } = await admin.from("project_estimates").select("*")
    .eq("project_id", projectId).order("version", { ascending: false });
  const list = estimates ?? [];
  const estimate = list.find((e: any) => e.status !== "superseded") ?? list[0] ?? null;
  if (!estimate) return { estimate: null, items: [], allocations: [], adjustments: [], reviews: [], scenarios: [] };
  const [items, allocations, adjustments, reviews, scenarios] = await Promise.all([
    admin.from("estimate_items").select("*").eq("estimate_id", estimate.id).order("sort_order"),
    admin.from("estimate_role_allocations").select("*").eq("estimate_id", estimate.id),
    admin.from("estimate_adjustments").select("*").eq("estimate_id", estimate.id),
    admin.from("estimate_supplier_reviews").select("*").eq("estimate_id", estimate.id),
    admin.from("estimate_scenarios").select("*").eq("project_id", projectId).order("created_at"),
  ]);
  return {
    estimate,
    items: items.data ?? [],
    allocations: allocations.data ?? [],
    adjustments: adjustments.data ?? [],
    reviews: reviews.data ?? [],
    scenarios: scenarios.data ?? [],
  };
}

// ---------------------------------------------------------------- validation

const clampNum = (value: unknown, min: number, max: number, fallback: number) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
};
const text = (value: unknown, max: number) => String(value ?? "").trim().slice(0, max);

const SETTING_RANGES: Record<string, [number, number]> = {
  client_calculation_rate: [0, 100000],
  yaniv_internal_hourly_cost: [0, 100000],
  external_costs: [0, 10000000],
  target_margin_percent: [0, 95],
  risk_buffer_percent: [0, 100],
  management_buffer_percent: [0, 100],
  testing_buffer_percent: [0, 100],
  contingency_percent: [0, 100],
  estimate_rounding_increment: [0, 100000],
  minimum_billing_unit: [0, 100],
};

function normalizeItem(raw: any, sortOrder: number) {
  const title = text(raw?.title, 200);
  if (!title) return null;
  const complexity = COMPLEXITY_MULTIPLIERS[raw?.complexity_level] ? String(raw.complexity_level) : "standard";
  const multiplier = COMPLEXITY_MULTIPLIERS[complexity];
  const role = RESPONSIBLE_ROLES.includes(String(raw?.responsible_role)) ? String(raw.responsible_role) : "development";
  const baseHours = clampNum(raw?.base_hours, 0, 2000, 4);
  const quantity = Math.round(clampNum(raw?.quantity, 1, 500, 1));
  const uncertainty = clampNum(raw?.uncertainty_multiplier, 1, 3, 1.2);
  const integration = clampNum(raw?.integration_multiplier, 1, 3, 1);
  const min = round2(baseHours * quantity * multiplier * integration);
  return {
    title,
    description: text(raw?.description, 2000),
    project_phase: text(raw?.project_phase ?? raw?.phase, 80) || "delivery",
    base_hours: baseHours,
    quantity,
    complexity_level: complexity,
    complexity_multiplier: multiplier,
    uncertainty_multiplier: uncertainty,
    integration_multiplier: integration,
    estimated_hours_min: min,
    estimated_hours_max: round2(min * uncertainty),
    responsible_role: role,
    client_visible: raw?.client_visible === false ? false : true,
    client_visible_label: text(raw?.client_visible_label, 200) || title,
    client_visible_description: text(raw?.client_visible_description, 1000),
    client_optional: !!raw?.client_optional,
    selected_by_client: !!raw?.selected_by_client,
    option_group: text(raw?.option_group, 120),
    option_tier: OPTION_TIERS.includes(String(raw?.option_tier)) ? String(raw.option_tier) : "standard",
    max_quantity: Math.round(clampNum(raw?.max_quantity, 1, 500, 1)),
    dependency_notes: text(raw?.dependency_notes, 1000),
    risk_notes: text(raw?.risk_notes, 1000),
    acceptance_criteria: text(raw?.acceptance_criteria, 1000),
    sort_order: sortOrder,
  };
}

const ITEM_PATCH_KEYS = [
  "title", "description", "project_phase", "base_hours", "quantity", "complexity_level",
  "responsible_role", "client_optional", "client_visible", "client_visible_label",
  "option_group", "option_tier", "max_quantity", "dependency_notes", "risk_notes",
  "acceptance_criteria", "estimated_hours_min", "estimated_hours_max",
];

function normalizeItemPatch(raw: any) {
  const patch: Record<string, unknown> = {};
  for (const key of ITEM_PATCH_KEYS) {
    if (!(key in (raw ?? {}))) continue;
    const value = raw[key];
    if (key === "complexity_level") {
      if (!COMPLEXITY_MULTIPLIERS[value]) continue;
      patch.complexity_level = String(value);
      patch.complexity_multiplier = COMPLEXITY_MULTIPLIERS[String(value)];
    } else if (key === "responsible_role") {
      if (!RESPONSIBLE_ROLES.includes(String(value))) continue;
      patch.responsible_role = String(value);
    } else if (key === "option_tier") {
      if (!OPTION_TIERS.includes(String(value))) continue;
      patch.option_tier = String(value);
    } else if (["base_hours", "estimated_hours_min", "estimated_hours_max"].includes(key)) {
      patch[key] = clampNum(value, 0, 20000, 0);
    } else if (["quantity", "max_quantity"].includes(key)) {
      patch[key] = Math.round(clampNum(value, 1, 500, 1));
    } else if (["client_optional", "client_visible"].includes(key)) {
      patch[key] = !!value;
    } else {
      patch[key] = text(value, 2000);
    }
  }
  return patch;
}

function withRecomputedHours(current: any, patch: Record<string, any>) {
  const next = { ...current, ...patch };
  const touchesInputs = ["base_hours", "quantity", "complexity_level"].some((k) => k in patch);
  const explicitHours = "estimated_hours_min" in patch || "estimated_hours_max" in patch;
  if (touchesInputs && !explicitHours) {
    const min = round2(
      (Number(next.base_hours) || 0) * (Number(next.quantity) || 1) *
      (Number(next.complexity_multiplier) || 1) * (Number(next.integration_multiplier) || 1),
    );
    patch.estimated_hours_min = min;
    patch.estimated_hours_max = round2(min * (Number(next.uncertainty_multiplier) || 1.2));
  }
  return patch;
}

const money = (value: number, currency: string) => `${currency} ${Math.round(value).toLocaleString("en-GB")}`;

/** Simulated before/after so the confirmation card is honest about consequences. */
function agencyPreview(bundle: Bundle, nextEstimate: any, nextItems: any[], records: string[], requested: string) {
  const est = bundle.estimate;
  const before = snapshot(est, bundle.items, bundle.allocations, bundle.adjustments);
  const after = snapshot(nextEstimate, nextItems, bundle.allocations, bundle.adjustments);
  const cur = est.currency ?? "GBP";
  return {
    requested,
    records,
    current: [
      { label: "Effort hours", value: `${before.hours.totalMin}–${before.hours.totalMax} hrs` },
      { label: "Client budget range", value: `${money(before.budget.min, cur)} – ${money(before.budget.max, cur)}` },
      { label: "Internal cost", value: `${money(before.internal.min, cur)} – ${money(before.internal.max, cur)}` },
      { label: "Expected margin", value: `${before.margin}%` },
    ],
    proposed: [
      { label: "Effort hours", value: `${after.hours.totalMin}–${after.hours.totalMax} hrs` },
      { label: "Client budget range", value: `${money(after.budget.min, cur)} – ${money(after.budget.max, cur)}` },
      { label: "Internal cost", value: `${money(after.internal.min, cur)} – ${money(after.internal.max, cur)}` },
      { label: "Expected margin", value: `${after.margin}%` },
    ],
    client_visibility_effect: nextEstimate.client_visible
      ? "The client sees the updated estimate range once this is confirmed."
      : "Not visible to the client — the estimate is not published.",
    internal_cost_effect: `${money(before.internal.max, cur)} → ${money(after.internal.max, cur)} (maximum)`,
    margin_effect: `${before.margin}% → ${after.margin}% (target ${est.target_margin_percent}%)`,
  };
}

export interface Validated {
  kind: ActionKind;
  title: string;
  summary: string;
  payload: Record<string, unknown>;
  preview: Record<string, unknown>;
  estimateId: string | null;
  estimateVersion: number | null;
}

export async function validateAction(
  ctx: Ctx,
  bundle: Bundle,
  raw: any,
): Promise<{ error: string } | Validated> {
  const kind = String(raw?.kind ?? "") as ActionKind;
  const spec = ACTION_SPECS[kind];
  if (!spec) return { error: `Unknown action kind: ${kind}` };
  const payload = raw?.payload ?? {};
  const title = text(raw?.title, 160) || spec.label;
  const summary = text(raw?.summary ?? raw?.detail, 1200);
  const est = bundle.estimate;

  // Only the estimate-free actions can run without an estimate.
  const needsEstimate = kind !== "create_change_request";
  if (needsEstimate && !est) return { error: "No estimate exists for this project yet. Create one first." };

  if (est && spec.blockedAfterFixedPrice && est.status === "fixed_price_approved" && kind !== "approve_fixed_price") {
    return { error: "A fixed price is already approved on this estimate. Create a new estimate version or a change request instead." };
  }
  if (kind === "approve_fixed_price" && est?.status === "fixed_price_approved") {
    return { error: "This estimate already has an approved fixed price." };
  }

  // ---- agency actions -----------------------------------------------------
  if (kind === "add_estimate_items") {
    const rawItems = Array.isArray(payload.items) ? payload.items.slice(0, 25) : [];
    const items = rawItems.map((item: any, index: number) => normalizeItem(item, bundle.items.length + index)).filter(Boolean);
    if (!items.length) return { error: "No valid work items were proposed." };
    const simulated = [...bundle.items, ...items.map((i: any, n: number) => ({ ...i, id: `new-${n}`, supplier_id: null }))];
    return {
      kind, title, summary,
      payload: { items },
      preview: agencyPreview(bundle, est, simulated, items.map((i: any) => `New work item: ${i.title}`), summary || `Add ${items.length} work item(s)`),
      estimateId: est.id, estimateVersion: est.version,
    };
  }

  if (kind === "update_estimate_settings") {
    const patch: Record<string, unknown> = {};
    for (const [key, range] of Object.entries(SETTING_RANGES)) {
      if (key in payload) patch[key] = clampNum(payload[key], range[0], range[1], Number(est[key]) || 0);
    }
    if ("show_hourly_rate_to_client" in payload) patch.show_hourly_rate_to_client = !!payload.show_hourly_rate_to_client;
    if ("currency" in payload) patch.currency = text(payload.currency, 3).toUpperCase() || est.currency;
    if ("notes" in payload) patch.notes = text(payload.notes, 2000);
    if (!Object.keys(patch).length) return { error: "No supported estimate setting was proposed." };
    const nextEstimate = { ...est, ...patch };
    const records = Object.keys(patch).map((key) => `${key}: ${est[key]} → ${(patch as any)[key]}`);
    return {
      kind, title, summary,
      payload: { patch },
      preview: agencyPreview(bundle, nextEstimate, bundle.items, records, summary || "Update commercial settings"),
      estimateId: est.id, estimateVersion: est.version,
    };
  }

  if (kind === "update_estimate_items") {
    const updates = (Array.isArray(payload.updates) ? payload.updates : []).slice(0, 40)
      .map((entry: any) => {
        const item = bundle.items.find((i) => i.id === entry?.item_id || i.title === entry?.title);
        if (!item) return null;
        const patch = withRecomputedHours(item, normalizeItemPatch(entry.patch ?? entry));
        if (!Object.keys(patch).length) return null;
        return { item_id: item.id, title: item.title, patch };
      })
      .filter(Boolean) as any[];
    if (!updates.length) return { error: "None of the proposed work items could be matched." };
    const simulated = bundle.items.map((item) => {
      const update = updates.find((u) => u.item_id === item.id);
      return update ? { ...item, ...update.patch } : item;
    });
    return {
      kind, title, summary,
      payload: { updates },
      preview: agencyPreview(bundle, est, simulated, updates.map((u) => `Work item: ${u.title}`), summary || `Change ${updates.length} work item(s)`),
      estimateId: est.id, estimateVersion: est.version,
    };
  }

  if (kind === "assign_supplier") {
    const { data: assigned } = await ctx.admin.from("project_supplier_assignments")
      .select("supplier_id, suppliers(name)").eq("project_id", ctx.projectId);
    const supplierId = text(payload.supplier_id, 60);
    const supplierName = text(payload.supplier_name, 200);
    const match = (assigned ?? []).find((row: any) =>
      row.supplier_id === supplierId ||
      (supplierName && String(row.suppliers?.name ?? "").toLowerCase() === supplierName.toLowerCase()));
    if (!match) return { error: "That supplier is not assigned to this project. Assign the supplier to the project first." };
    const ids = (Array.isArray(payload.item_ids) ? payload.item_ids : [])
      .map((id: any) => bundle.items.find((i) => i.id === id || i.title === id)?.id)
      .filter(Boolean) as string[];
    const titles = (Array.isArray(payload.item_titles) ? payload.item_titles : [])
      .map((t: any) => bundle.items.find((i) => i.title.toLowerCase() === String(t).toLowerCase())?.id)
      .filter(Boolean) as string[];
    const itemIds = [...new Set([...ids, ...titles])];
    if (!itemIds.length) return { error: "No matching work items were found to assign." };
    const simulated = bundle.items.map((item) => itemIds.includes(item.id) ? { ...item, supplier_id: match.supplier_id } : item);
    return {
      kind, title, summary,
      payload: { supplier_id: match.supplier_id, item_ids: itemIds },
      preview: agencyPreview(bundle, est, simulated,
        itemIds.map((id) => `Assign "${bundle.items.find((i) => i.id === id)?.title}" to ${match.suppliers?.name ?? "supplier"}`),
        summary || `Assign ${itemIds.length} item(s) to ${match.suppliers?.name ?? "the supplier"}`),
      estimateId: est.id, estimateVersion: est.version,
    };
  }

  if (kind === "request_supplier_review") {
    const assignedItems = bundle.items.filter((item) => item.supplier_id);
    if (!assignedItems.length) return { error: "No work items are assigned to a supplier yet." };
    return {
      kind, title, summary,
      payload: { item_ids: assignedItems.map((i) => i.id) },
      preview: {
        requested: summary || "Send the assigned work items to the supplier for review",
        records: assignedItems.map((i) => `Review request: ${i.title}`),
        current: [{ label: "Estimate status", value: est.status }],
        proposed: [{ label: "Estimate status", value: "waiting_for_supplier_review" }],
        client_visibility_effect: "No change for the client.",
        internal_cost_effect: "No immediate change — supplier answers may change hours later.",
        margin_effect: "No immediate change.",
      },
      estimateId: est.id, estimateVersion: est.version,
    };
  }

  if (kind === "accept_supplier_review") {
    const reviews = bundle.reviews.filter((r) => r.suggested_hours_max != null);
    const wanted = Array.isArray(payload.review_ids) && payload.review_ids.length
      ? reviews.filter((r) => payload.review_ids.includes(r.id) || payload.review_ids.includes(r.item_id))
      : reviews;
    if (!wanted.length) return { error: "There are no supplier-suggested hours to accept." };
    const simulated = bundle.items.map((item) => {
      const review = wanted.find((r) => r.item_id === item.id);
      if (!review) return item;
      return {
        ...item,
        estimated_hours_min: Number(review.suggested_hours_min ?? item.estimated_hours_min),
        estimated_hours_max: Number(review.suggested_hours_max ?? item.estimated_hours_max),
      };
    });
    return {
      kind, title, summary,
      payload: { review_ids: wanted.map((r) => r.id) },
      preview: agencyPreview(bundle, est, simulated,
        wanted.map((r) => `Accept supplier hours for "${bundle.items.find((i) => i.id === r.item_id)?.title ?? r.item_id}"`),
        summary || "Use the supplier-reviewed hours"),
      estimateId: est.id, estimateVersion: est.version,
    };
  }

  if (kind === "publish_client_estimate") {
    const nextEstimate = { ...est, client_visible: true, status: "client_estimate_visible" };
    return {
      kind, title, summary,
      payload: {},
      preview: agencyPreview(bundle, nextEstimate, bundle.items,
        ["Estimate becomes visible in the client budget simulator"],
        summary || "Publish the estimate range to the client"),
      estimateId: est.id, estimateVersion: est.version,
    };
  }

  if (kind === "approve_fixed_price") {
    const before = snapshot(est, bundle.items, bundle.allocations, bundle.adjustments);
    const price = clampNum(payload.final_fixed_price, 1, 100000000, before.recommended);
    const cur = est.currency ?? "GBP";
    const nextMargin = before.internal.max ? round2(((price - before.internal.max) / price) * 100) : 100;
    return {
      kind, title, summary,
      payload: {
        final_fixed_price: price,
        fixed_price_scope: text(payload.fixed_price_scope, 4000),
        fixed_price_exclusions: text(payload.fixed_price_exclusions, 4000),
        payment_milestones: text(payload.payment_milestones, 2000),
        delivery_range_label: text(payload.delivery_range_label, 200),
      },
      preview: {
        requested: summary || `Approve a fixed price of ${money(price, cur)}`,
        records: ["project_estimates: final fixed price, approval flag, status", "estimate_versions: snapshot"],
        current: [
          { label: "Fixed price", value: est.final_fixed_price == null ? "Not approved" : money(Number(est.final_fixed_price), cur) },
          { label: "Recommended price", value: money(before.recommended, cur) },
          { label: "Internal cost (max)", value: money(before.internal.max, cur) },
          { label: "Expected margin", value: `${before.margin}%` },
        ],
        proposed: [
          { label: "Fixed price", value: money(price, cur) },
          { label: "Recommended price", value: money(before.recommended, cur) },
          { label: "Internal cost (max)", value: money(before.internal.max, cur) },
          { label: "Expected margin", value: `${nextMargin}%` },
        ],
        client_visibility_effect: "The client sees this fixed price. Later scope changes become change requests.",
        internal_cost_effect: `Unchanged at ${money(before.internal.max, cur)}`,
        margin_effect: `${before.margin}% → ${nextMargin}% (target ${est.target_margin_percent}%)`,
      },
      estimateId: est.id, estimateVersion: est.version,
    };
  }

  // ---- client actions -----------------------------------------------------
  if (kind === "save_client_scenario") {
    const clientItems = bundle.items.filter((i) => i.client_visible);
    const selections = defaultSelection(bundle.items);
    const requested = Array.isArray(payload.selections) ? payload.selections : [];
    const changes: string[] = [];
    for (const entry of requested.slice(0, 100)) {
      const item = clientItems.find((i) =>
        i.id === entry?.item_id ||
        String(i.client_visible_label ?? i.title).toLowerCase() === String(entry?.title ?? "").toLowerCase() ||
        i.title.toLowerCase() === String(entry?.title ?? "").toLowerCase());
      if (!item) continue;
      if (!item.client_optional) continue;
      const quantity = Math.round(clampNum(entry?.quantity, 1, Number(item.max_quantity) || 1, Number(item.quantity) || 1));
      const selected = entry?.selected !== false;
      selections.set(item.id, { selected, quantity });
      changes.push(`${item.client_visible_label || item.title}: ${selected ? `included${quantity > 1 ? ` ×${quantity}` : ""}` : "removed"}`);
    }
    if (!changes.length) return { error: "No optional feature in the published estimate matched that request." };
    const beforeHours = computeHours(est, bundle.items);
    const afterHours = computeHours(est, bundle.items, selections);
    const cur = est.currency ?? "GBP";
    const bMin = Math.round(beforeHours.totalMin * (Number(est.client_calculation_rate) || 0));
    const bMax = Math.round(beforeHours.totalMax * (Number(est.client_calculation_rate) || 0));
    const aMin = Math.round(afterHours.totalMin * (Number(est.client_calculation_rate) || 0));
    const aMax = Math.round(afterHours.totalMax * (Number(est.client_calculation_rate) || 0));
    const weeks = calendarWeeks(afterHours.totalMin, afterHours.totalMax, 20);
    return {
      kind, title, summary,
      payload: {
        name: text(payload.name, 120) || "My selection",
        client_notes: text(payload.client_notes, 2000),
        selections: [...selections.entries()].map(([itemId, v]) => ({ itemId, ...v })),
      },
      preview: {
        requested: summary || changes.join("; "),
        records: changes,
        current: [
          { label: "Estimated work hours", value: `${beforeHours.totalMin}–${beforeHours.totalMax} hrs` },
          { label: "Estimated budget range", value: `${money(bMin, cur)} – ${money(bMax, cur)}` },
        ],
        proposed: [
          { label: "Estimated work hours", value: `${afterHours.totalMin}–${afterHours.totalMax} hrs` },
          { label: "Estimated budget range", value: `${money(aMin, cur)} – ${money(aMax, cur)}` },
          { label: "Indicative delivery time", value: `${weeks.min}–${weeks.max} weeks` },
        ],
        client_visibility_effect: "Saves a scenario in your budget simulator. It is not an order and not a final price.",
        internal_cost_effect: "Not shown in the client workspace.",
        margin_effect: "Not shown in the client workspace.",
      },
      estimateId: est.id, estimateVersion: est.version,
    };
  }

  if (kind === "create_change_request") {
    const crTitle = text(payload.title, 200);
    if (!crTitle) return { error: "A change request needs a title." };
    return {
      kind, title, summary,
      payload: { title: crTitle, description: text(payload.description, 4000) },
      preview: {
        requested: summary || `Create a draft change request: ${crTitle}`,
        records: [`change_requests: ${crTitle}`],
        current: [{ label: "Status", value: "Not requested" }],
        proposed: [{ label: "Status", value: "Requested — the agency will review and price it" }],
        client_visibility_effect: "Visible to you and the agency. The approved project price does not change until the agency prices it and you approve.",
        internal_cost_effect: "Not shown in the client workspace.",
        margin_effect: "Not shown in the client workspace.",
      },
      estimateId: est?.id ?? null, estimateVersion: est?.version ?? null,
    };
  }

  // ---- supplier actions ---------------------------------------------------
  if (kind === "supplier_review_response") {
    if (!ctx.supplierId) return { error: "No supplier is linked to this workspace." };
    const mine = bundle.items.filter((item) => item.supplier_id === ctx.supplierId);
    if (!mine.length) return { error: "No estimate work items are assigned to you on this project." };
    const rows = (Array.isArray(payload.responses) ? payload.responses : []).slice(0, 40)
      .map((entry: any) => {
        const item = mine.find((i) =>
          i.id === entry?.item_id || i.title.toLowerCase() === String(entry?.title ?? "").toLowerCase());
        if (!item) return null;
        const decision = ["accept", "change", "decline"].includes(String(entry?.decision)) ? String(entry.decision) : "change";
        const minHours = entry?.suggested_hours_min == null ? null : clampNum(entry.suggested_hours_min, 0, 20000, 0);
        const maxHours = entry?.suggested_hours_max == null ? null : clampNum(entry.suggested_hours_max, 0, 20000, 0);
        return {
          item_id: item.id,
          item_title: item.title,
          current_hours: `${item.estimated_hours_min}–${item.estimated_hours_max} hrs`,
          supplier_decision: decision,
          status: decision === "accept" ? "supplier_reviewed" : "supplier_changes_requested",
          suggested_hours_min: decision === "accept" ? item.estimated_hours_min : minHours,
          suggested_hours_max: decision === "accept" ? item.estimated_hours_max : maxHours,
          fixed_quote: entry?.fixed_quote == null ? null : clampNum(entry.fixed_quote, 0, 10000000, 0),
          assumptions: text(entry?.assumptions, 2000),
          dependencies: text(entry?.dependencies, 2000),
          missing_information: text(entry?.missing_information, 2000),
          delivery_risk: text(entry?.delivery_risk, 2000),
          proposed_duration_days: entry?.proposed_duration_days == null ? null : Math.round(clampNum(entry.proposed_duration_days, 0, 3650, 0)),
          weekly_availability_hours: entry?.weekly_availability_hours == null ? null : clampNum(entry.weekly_availability_hours, 0, 168, 0),
        };
      })
      .filter(Boolean) as any[];
    if (!rows.length) return { error: "None of the proposed items are assigned to you." };
    return {
      kind, title, summary,
      payload: { responses: rows },
      preview: {
        requested: summary || `Send ${rows.length} estimate response(s) to the agency`,
        records: rows.map((r) => `${r.item_title}: ${r.supplier_decision}`),
        current: rows.map((r) => ({ label: r.item_title, value: `Agency estimate ${r.current_hours}` })),
        proposed: rows.map((r) => ({
          label: r.item_title,
          value: r.supplier_decision === "decline"
            ? "Declined"
            : `${r.suggested_hours_min ?? "?"}–${r.suggested_hours_max ?? "?"} hrs${r.fixed_quote ? ` · fixed quote ${r.fixed_quote}` : ""}${r.proposed_duration_days ? ` · ${r.proposed_duration_days} days` : ""}`,
        })),
        client_visibility_effect: "Not visible to the client. The agency reviews your response first.",
        internal_cost_effect: "Not shown in the supplier workspace.",
        margin_effect: "Not shown in the supplier workspace.",
      },
      estimateId: est.id, estimateVersion: est.version,
    };
  }

  return { error: `Action ${kind} is not supported.` };
}

// ------------------------------------------------------------------- apply

export async function applyAction(ctx: Ctx, draft: any): Promise<string> {
  const admin = ctx.admin;
  const kind = draft.action_kind as ActionKind;
  const payload = draft.payload ?? {};
  const bundle = await loadBundle(admin, ctx.projectId);
  const est = bundle.estimate;
  const spec = ACTION_SPECS[kind];

  if (kind !== "create_change_request" && !est) throw new Error("The estimate no longer exists.");
  if (est && spec.blockedAfterFixedPrice && est.status === "fixed_price_approved" && kind !== "approve_fixed_price") {
    throw new Error("A fixed price is already approved. Create a new estimate version instead.");
  }
  if (draft.estimate_id && est && draft.estimate_id !== est.id) {
    throw new Error("This proposal refers to an older estimate version and can no longer be applied.");
  }

  const fail = (error: any, what: string) => { if (error) throw new Error(`${what}: ${error.message}`); };

  if (kind === "add_estimate_items") {
    const rows = (payload.items as any[]).map((item, index) => ({
      ...item,
      estimate_id: est.id,
      sort_order: bundle.items.length + index,
      ai_generated: true,
      source_message_id: draft.message_id,
    }));
    const { error } = await admin.from("estimate_items").insert(rows);
    fail(error, "Add work items");
    if (est.status === "draft") await admin.from("project_estimates").update({ status: "ai_estimate" }).eq("id", est.id);
    return `Added ${rows.length} work item(s) from the AI proposal.`;
  }

  if (kind === "update_estimate_settings") {
    const { error } = await admin.from("project_estimates").update(payload.patch).eq("id", est.id);
    fail(error, "Update estimate settings");
    return `Updated ${Object.keys(payload.patch).length} estimate setting(s).`;
  }

  if (kind === "update_estimate_items") {
    for (const update of payload.updates as any[]) {
      const { error } = await admin.from("estimate_items").update(update.patch).eq("id", update.item_id).eq("estimate_id", est.id);
      fail(error, "Update work item");
    }
    return `Updated ${(payload.updates as any[]).length} work item(s).`;
  }

  if (kind === "assign_supplier") {
    const { error } = await admin.from("estimate_items")
      .update({ supplier_id: payload.supplier_id }).in("id", payload.item_ids).eq("estimate_id", est.id);
    fail(error, "Assign supplier");
    return `Assigned ${(payload.item_ids as string[]).length} work item(s) to the supplier.`;
  }

  if (kind === "request_supplier_review") {
    const rows = bundle.items.filter((i) => i.supplier_id).map((item) => ({
      estimate_id: est.id, item_id: item.id, supplier_id: item.supplier_id, status: "waiting_for_supplier",
    }));
    const { error } = await admin.from("estimate_supplier_reviews").upsert(rows, { onConflict: "item_id,supplier_id" });
    fail(error, "Request supplier review");
    await admin.from("project_estimates").update({ status: "waiting_for_supplier_review" }).eq("id", est.id);
    return `Requested supplier review for ${rows.length} work item(s).`;
  }

  if (kind === "accept_supplier_review") {
    const reviews = bundle.reviews.filter((r) => (payload.review_ids as string[]).includes(r.id));
    for (const review of reviews) {
      const patch: Record<string, unknown> = {};
      if (review.suggested_hours_min != null) patch.estimated_hours_min = Number(review.suggested_hours_min);
      if (review.suggested_hours_max != null) patch.estimated_hours_max = Number(review.suggested_hours_max);
      if (Object.keys(patch).length) {
        const { error } = await admin.from("estimate_items").update(patch).eq("id", review.item_id);
        fail(error, "Apply supplier hours");
      }
      await admin.from("estimate_supplier_reviews").update({ status: "accepted_by_yaniv" }).eq("id", review.id);
    }
    await admin.from("project_estimates").update({ status: "supplier_reviewed" }).eq("id", est.id);
    return `Applied supplier-reviewed hours to ${reviews.length} work item(s).`;
  }

  if (kind === "publish_client_estimate") {
    const s = snapshot(est, bundle.items, bundle.allocations, bundle.adjustments);
    const { error } = await admin.from("project_estimates").update({
      client_visible: true,
      status: "client_estimate_visible",
      estimated_hours_min: s.hours.totalMin,
      estimated_hours_max: s.hours.totalMax,
      estimated_budget_min: s.budget.min,
      estimated_budget_max: s.budget.max,
      internal_cost: s.internal.max,
      recommended_fixed_price: s.recommended,
    }).eq("id", est.id);
    fail(error, "Publish estimate");
    return "The estimate range is now visible to the client.";
  }

  if (kind === "approve_fixed_price") {
    const s = snapshot(est, bundle.items, bundle.allocations, bundle.adjustments);
    await admin.from("estimate_versions").insert({
      estimate_id: est.id, project_id: ctx.projectId, version: est.version,
      snapshot: { estimate: est, items: bundle.items }, note: "Snapshot before fixed-price approval (AI-assisted, confirmed by the agency)",
    });
    const patch: Record<string, unknown> = {
      final_fixed_price: payload.final_fixed_price,
      approved_by_yaniv: true,
      client_visible: true,
      status: "fixed_price_approved",
      internal_cost: s.internal.max,
      recommended_fixed_price: s.recommended,
      estimated_hours_min: s.hours.totalMin,
      estimated_hours_max: s.hours.totalMax,
      estimated_budget_min: s.budget.min,
      estimated_budget_max: s.budget.max,
    };
    for (const key of ["fixed_price_scope", "fixed_price_exclusions", "payment_milestones", "delivery_range_label"]) {
      if (payload[key]) patch[key] = payload[key];
    }
    const { error } = await admin.from("project_estimates").update(patch).eq("id", est.id);
    fail(error, "Approve fixed price");
    return `Approved a fixed price of ${est.currency} ${payload.final_fixed_price}.`;
  }

  if (kind === "save_client_scenario") {
    const selections = new Map<string, { selected: boolean; quantity: number }>(
      (payload.selections as any[]).map((s: any) => [s.itemId, { selected: !!s.selected, quantity: Number(s.quantity) || 1 }]),
    );
    const hours = computeHours(est, bundle.items, selections);
    const rate = Number(est.client_calculation_rate) || 0;
    const { error } = await admin.from("estimate_scenarios").insert({
      estimate_id: est.id,
      project_id: ctx.projectId,
      name: payload.name,
      client_notes: payload.client_notes,
      selections: payload.selections,
      estimated_hours_min: hours.totalMin,
      estimated_hours_max: hours.totalMax,
      estimated_budget_min: Math.round(hours.totalMin * rate),
      estimated_budget_max: Math.round(hours.totalMax * rate),
      source_message_id: draft.message_id,
      created_by_agent: draft.agent_type,
    });
    fail(error, "Save scenario");
    return `Saved the scenario "${payload.name}".`;
  }

  if (kind === "supplier_review_response") {
    const rows = (payload.responses as any[]).map((r) => ({
      estimate_id: est.id,
      item_id: r.item_id,
      supplier_id: ctx.supplierId,
      status: r.status,
      supplier_decision: r.supplier_decision,
      suggested_hours_min: r.suggested_hours_min,
      suggested_hours_max: r.suggested_hours_max,
      fixed_quote: r.fixed_quote,
      assumptions: r.assumptions,
      dependencies: r.dependencies,
      missing_information: r.missing_information,
      delivery_risk: r.delivery_risk,
      proposed_duration_days: r.proposed_duration_days,
      weekly_availability_hours: r.weekly_availability_hours,
      source_message_id: draft.message_id,
    }));
    const { error } = await admin.from("estimate_supplier_reviews").upsert(rows, { onConflict: "item_id,supplier_id" });
    fail(error, "Save supplier review");
    await admin.from("project_estimates").update({ status: "supplier_reviewed" }).eq("id", est.id);
    return `Sent ${rows.length} estimate response(s) to the agency.`;
  }

  if (kind === "create_change_request") {
    const { error } = await admin.from("change_requests").insert({
      project_id: ctx.projectId,
      requested_by_client_id: ctx.project.client_id,
      title: payload.title,
      description: payload.description,
      status: "requested",
    });
    fail(error, "Create change request");
    return `Created a draft change request: ${payload.title}.`;
  }

  throw new Error(`Action ${kind} cannot be applied.`);
}
