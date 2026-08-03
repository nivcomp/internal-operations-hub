import type { ProjectView } from "../services/projectViewApi";

export type FlowNodeKind =
  | "goal" | "discovery" | "phase" | "work" | "integration" | "dependency"
  | "approval" | "payment" | "supplier" | "testing" | "delivery"
  | "change_request" | "completion";

export type FlowNode = {
  id: string;
  kind: FlowNodeKind;
  stage: number;
  title: string;
  subtitle?: string;
  detail?: string;
  state: "done" | "active" | "blocked" | "pending";
  parentId?: string;
  meta?: { label: string; value: string }[];
};

export type FlowEdge = { from: string; to: string; label?: string };

export type FlowGraph = { nodes: FlowNode[]; edges: FlowEdge[]; phases: string[] };

const PHASE_ORDER = [
  "discovery", "architecture", "design", "development", "automation",
  "integration", "testing", "deployment", "training", "support",
];

function phaseRank(phase: string) {
  const index = PHASE_ORDER.indexOf((phase || "").toLowerCase());
  return index === -1 ? PHASE_ORDER.length : index;
}

function titleCase(value: string) {
  return (value || "other").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const num = (value: unknown) => Number(value ?? 0);

/**
 * Builds the project flow from the already role-filtered project view.
 * Nothing hidden from the role can appear here, because it never arrived.
 */
export function buildProjectFlow(view: ProjectView): FlowGraph {
  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];
  const isClient = view.role === "client";
  const isSupplier = view.role === "supplier";
  const est = view.estimate;

  const add = (node: FlowNode) => { nodes.push(node); return node.id; };

  // Stage 0 — goal
  add({
    id: "goal",
    kind: "goal",
    stage: 0,
    title: isSupplier ? "Assigned project" : "Project goal",
    subtitle: view.project.name,
    detail: view.project.summary || "No summary recorded yet.",
    state: "done",
    meta: isSupplier ? [] : [{ label: "Client", value: view.clientCompany || view.clientName || "—" }],
  });

  // Stage 1 — discovery
  const approvedScope = view.scopes.find((s: any) => s.status === "approved");
  const discoveryDetail = isSupplier
    ? approvedScope?.internal_delivery_notes || "Delivery notes will appear once the scope is approved."
    : approvedScope?.client_facing_summary || view.scopes[0]?.client_facing_summary || "Discovery in progress.";
  add({
    id: "discovery",
    kind: "discovery",
    stage: 1,
    title: "Discovery and scope",
    subtitle: approvedScope ? `Scope v${approvedScope.version} approved` : "Scope being defined",
    detail: discoveryDetail,
    state: approvedScope ? "done" : "active",
    meta: [
      { label: "Requirements", value: String(view.requirements.length) },
      { label: "Open questions", value: String(view.questions.filter((q: any) => q.status !== "answered").length) },
    ],
  });
  edges.push({ from: "goal", to: "discovery" });

  // Stage 2 — phases with their work items as children
  const byPhase = new Map<string, typeof view.items>();
  for (const item of view.items) {
    const key = (item.project_phase || "other").toLowerCase();
    if (!byPhase.has(key)) byPhase.set(key, []);
    byPhase.get(key)!.push(item);
  }
  const phases = Array.from(byPhase.keys()).sort((a, b) => phaseRank(a) - phaseRank(b));

  let previous = "discovery";
  for (const phase of phases) {
    const items = byPhase.get(phase)!;
    const hoursMin = items.reduce((s, i) => s + num(i.estimated_hours_min), 0);
    const hoursMax = items.reduce((s, i) => s + num(i.estimated_hours_max), 0);
    const phaseId = `phase:${phase}`;
    add({
      id: phaseId,
      kind: "phase",
      stage: 2,
      title: titleCase(phase),
      subtitle: `${items.length} work item${items.length === 1 ? "" : "s"}`,
      detail: isClient ? "Work included in this part of the project." : `Effort ${Math.round(hoursMin)}–${Math.round(hoursMax)} hours.`,
      state: "pending",
      meta: isClient
        ? [{ label: "Optional items", value: String(items.filter((i) => i.client_optional).length) }]
        : [
            { label: "Effort", value: `${Math.round(hoursMin)}–${Math.round(hoursMax)} h` },
            { label: "Unassigned", value: String(items.filter((i) => !i.supplier_id).length) },
          ],
    });
    edges.push({ from: previous, to: phaseId });
    previous = phaseId;

    for (const item of items) {
      const supplierName = view.suppliers.find((s) => s.id === item.supplier_id)?.name;
      add({
        id: `work:${item.id}`,
        kind: "work",
        stage: 3,
        parentId: phaseId,
        title: item.title,
        subtitle: isClient
          ? (item.client_optional ? `Optional · ${titleCase(item.option_tier || "standard")}` : "Included")
          : `${titleCase(item.responsible_role)}${supplierName ? ` · ${supplierName}` : " · unassigned"}`,
        detail: item.description || "",
        state: item.client_optional && !item.selected_by_client ? "pending" : "active",
        meta: isClient
          ? [{ label: "Quantity", value: String(item.quantity) }]
          : [
              { label: "Effort", value: `${Math.round(num(item.estimated_hours_min))}–${Math.round(num(item.estimated_hours_max))} h` },
              { label: "Complexity", value: titleCase(item.complexity_level) },
            ],
      });
      edges.push({ from: phaseId, to: `work:${item.id}` });

      if (item.dependency_notes) {
        add({
          id: `dep:${item.id}`,
          kind: "dependency",
          stage: 3,
          parentId: phaseId,
          title: "Dependency",
          subtitle: item.title,
          detail: item.dependency_notes,
          state: "blocked",
        });
        edges.push({ from: `work:${item.id}`, to: `dep:${item.id}`, label: "depends on" });
      }
      if (num(item.integration_multiplier) > 1) {
        add({
          id: `int:${item.id}`,
          kind: "integration",
          stage: 3,
          parentId: phaseId,
          title: "Integration",
          subtitle: item.title,
          detail: isClient ? "Connects to an external system." : `Integration factor ×${item.integration_multiplier}.`,
          state: "pending",
        });
        edges.push({ from: `work:${item.id}`, to: `int:${item.id}` });
      }
    }
  }

  // Stage 4 — supplier assignment (never shown to a client)
  if (!isClient && view.suppliers.length > 0) {
    for (const supplier of view.suppliers) {
      const assigned = view.items.filter((i) => i.supplier_id === supplier.id);
      const id = `supplier:${supplier.id}`;
      add({
        id,
        kind: "supplier",
        stage: 4,
        title: isSupplier ? "Your assigned work" : supplier.name,
        subtitle: `${assigned.length} work item${assigned.length === 1 ? "" : "s"}`,
        detail: assigned.map((i) => i.title).join(", ") || "No items assigned yet.",
        state: assigned.length ? "active" : "pending",
      });
      edges.push({ from: previous, to: id });
    }
  }

  // Stage 5 — approval gate
  const approvalRows = view.approvals;
  const approvedAll = approvalRows.length > 0 && approvalRows.every((a: any) => a.status === "approved");
  const fixedApproved = Boolean(est?.approved_by_yaniv && est?.final_fixed_price != null);
  add({
    id: "approval",
    kind: "approval",
    stage: 5,
    title: "Approval gate",
    subtitle: fixedApproved ? "Fixed price approved" : approvedAll ? "Scope approved" : "Waiting for approval",
    detail: fixedApproved
      ? "The agreed scope and price are locked. New work goes through a change request."
      : "Work can only start after the scope and price are approved.",
    state: fixedApproved || approvedAll ? "done" : "active",
    meta: approvalRows.slice(0, 4).map((a: any) => ({ label: titleCase(a.approver_role), value: titleCase(a.status) })),
  });
  edges.push({ from: previous, to: "approval" });

  // Stage 6 — payment gate
  if (!isSupplier) {
    const gate = view.project.payment_gate_status;
    const received = view.payments.filter((p: any) => p.status === "received").length;
    add({
      id: "payment",
      kind: "payment",
      stage: 6,
      title: "Payment gate",
      subtitle: titleCase(gate),
      detail: est?.payment_milestones || "Payment milestones are agreed before delivery starts.",
      state: gate === "cleared" ? "done" : gate === "blocked" ? "blocked" : "active",
      meta: [
        { label: "Payments received", value: `${received}/${view.payments.length}` },
        ...(view.paidHours.length
          ? [{ label: "Hours remaining", value: String(view.paidHours.reduce((s: number, h: any) => s + num(h.hours_remaining), 0)) }]
          : []),
      ],
    });
    edges.push({ from: "approval", to: "payment" });
  } else {
    add({
      id: "payment",
      kind: "payment",
      stage: 6,
      title: "Work authorisation",
      subtitle: view.project.payment_gate_status === "blocked" ? "Not authorised yet" : "Authorised to start",
      detail: "The agency confirms when the work is approved and funded.",
      state: view.project.payment_gate_status === "blocked" ? "blocked" : "done",
    });
    edges.push({ from: "approval", to: "payment" });
  }

  // Stage 7 — testing
  const testingItems = view.items.filter((i) => (i.project_phase || "").toLowerCase() === "testing");
  add({
    id: "testing",
    kind: "testing",
    stage: 7,
    title: "Testing and acceptance",
    subtitle: testingItems.length ? `${testingItems.length} testing item(s)` : "Acceptance review",
    detail: view.items.map((i) => i.acceptance_criteria).filter(Boolean).slice(0, 3).join(" · ")
      || "Each deliverable is checked against its acceptance criteria.",
    state: "pending",
  });
  edges.push({ from: "payment", to: "testing" });

  // Stage 8 — delivery
  add({
    id: "delivery",
    kind: "delivery",
    stage: 8,
    title: "Delivery",
    subtitle: est?.delivery_range_label || (est?.delivery_start_date ? `${est.delivery_start_date} → ${est.delivery_end_date ?? "?"}` : "Range to be confirmed"),
    detail: isSupplier ? "Hand over completed work to the agency." : "Agreed delivery window for the approved scope.",
    state: view.project.status === "completed" ? "done" : "pending",
  });
  edges.push({ from: "testing", to: "delivery" });

  // Stage 9 — change requests
  if (!isSupplier) {
    if (view.changeRequests.length === 0) {
      add({
        id: "cr:none",
        kind: "change_request",
        stage: 9,
        title: "Change requests",
        subtitle: "None yet",
        detail: "Anything outside the approved scope becomes a change request the agency reviews and prices.",
        state: "pending",
      });
      edges.push({ from: "delivery", to: "cr:none" });
    }
    for (const cr of view.changeRequests) {
      const id = `cr:${cr.id}`;
      add({
        id,
        kind: "change_request",
        stage: 9,
        title: cr.title,
        subtitle: titleCase(cr.status),
        detail: cr.description || "",
        state: cr.status === "client_approved" ? "done" : cr.status === "rejected" ? "blocked" : "active",
        meta: isClient
          ? (cr.agency_price != null ? [{ label: "Price", value: String(cr.agency_price) }] : [])
          : [
              ...(cr.agency_price != null ? [{ label: "Client price", value: String(cr.agency_price) }] : []),
              ...(cr.supplier_cost != null ? [{ label: "Supplier cost", value: String(cr.supplier_cost) }] : []),
            ],
      });
      edges.push({ from: "delivery", to: id });
    }
  }

  // Stage 10 — completion
  add({
    id: "completion",
    kind: "completion",
    stage: 10,
    title: "Completion",
    subtitle: view.project.status === "completed" ? "Project completed" : "Not completed yet",
    detail: "Final acceptance, closing summary and any remaining payments.",
    state: view.project.status === "completed" ? "done" : "pending",
  });
  edges.push({ from: "delivery", to: "completion" });

  return { nodes, edges, phases };
}
