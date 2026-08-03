import type {
  ChangeRequest, ClientPayment, DecisionLog, FileLink, Project, Scope, Supplier, TimeEntry,
} from "../types/domain";

export type TimelineEvent = {
  id: string;
  date: string;
  title: string;
  detail: string;
  kind: "project" | "scope" | "approval" | "supplier" | "payment" | "change" | "time" | "file" | "decision" | "estimate";
  tone: "neutral" | "success" | "warning";
};

type TimelineSources = {
  project: Project;
  scopes: Scope[];
  changeRequests: ChangeRequest[];
  payments: ClientPayment[];
  timeEntries: TimeEntry[];
  files: FileLink[];
  decisions: DecisionLog[];
  suppliers: Supplier[];
  estimateVersions?: { version: number; createdAt: string; note?: string }[];
};

const safeDate = (value?: string) => value ?? "";

/**
 * Builds a read-only chronological view from records that already exist.
 * No schema change and no business rules are involved.
 */
export function buildProjectTimeline({
  project, scopes, changeRequests, payments, timeEntries, files, decisions, suppliers, estimateVersions = [],
}: TimelineSources): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  events.push({
    id: `created-${project.id}`,
    date: safeDate(project.createdDate),
    title: "Project created",
    detail: project.summary || "Project record opened.",
    kind: "project",
    tone: "neutral",
  });

  for (const scope of scopes.filter((item) => item.projectId === project.id)) {
    events.push({
      id: `scope-${scope.id}`,
      date: safeDate(scope.approvedDate),
      title: scope.status === "approved" ? `Scope v${scope.version} approved` : `Scope v${scope.version} — ${scope.status.replace("_", " ")}`,
      detail: scope.clientFacingSummary || "Scope drafted.",
      kind: scope.status === "approved" ? "approval" : "scope",
      tone: scope.status === "approved" ? "success" : "warning",
    });
  }

  for (const version of estimateVersions) {
    events.push({
      id: `estimate-${version.version}-${version.createdAt}`,
      date: version.createdAt,
      title: `Estimate version ${version.version}`,
      detail: version.note || "Estimate snapshot stored.",
      kind: "estimate",
      tone: "neutral",
    });
  }

  for (const supplierId of project.assignedSupplierIds) {
    const supplier = suppliers.find((item) => item.id === supplierId);
    events.push({
      id: `supplier-${project.id}-${supplierId}`,
      date: safeDate(project.updatedDate),
      title: `Supplier assigned: ${supplier?.name ?? "Unknown supplier"}`,
      detail: "Assignment is controlled by the agency.",
      kind: "supplier",
      tone: "neutral",
    });
  }

  for (const payment of payments.filter((item) => item.projectId === project.id)) {
    events.push({
      id: `payment-${payment.id}`,
      date: safeDate(payment.receivedDate ?? payment.dueDate),
      title: payment.status === "received" ? "Payment received" : `Payment ${payment.status}`,
      detail: payment.notes || "Client payment record.",
      kind: "payment",
      tone: payment.status === "received" ? "success" : "warning",
    });
  }

  for (const request of changeRequests.filter((item) => item.projectId === project.id)) {
    events.push({
      id: `change-${request.id}`,
      date: safeDate(request.approvedDate),
      title: `Change request: ${request.title}`,
      detail: `Status ${request.status.replace(/_/g, " ")}.`,
      kind: "change",
      tone: request.status === "client_approved" ? "success" : "warning",
    });
  }

  for (const entry of timeEntries.filter((item) => item.projectId === project.id)) {
    const supplier = suppliers.find((item) => item.id === entry.supplierId);
    events.push({
      id: `time-${entry.id}`,
      date: safeDate(entry.date),
      title: `${entry.hours}h logged by ${supplier?.name ?? "supplier"}`,
      detail: entry.description || "Time entry.",
      kind: "time",
      tone: entry.status === "approved" ? "success" : "warning",
    });
  }

  for (const file of files.filter((item) => item.projectId === project.id)) {
    events.push({
      id: `file-${file.id}`,
      date: "",
      title: `File added: ${file.title}`,
      detail: `Visibility ${file.visibility.replace(/_/g, " ")}.`,
      kind: "file",
      tone: "neutral",
    });
  }

  for (const decision of decisions.filter((item) => item.projectId === project.id)) {
    events.push({
      id: `decision-${decision.id}`,
      date: "",
      title: `Decision: ${decision.decision}`,
      detail: decision.impact || "Recorded decision.",
      kind: "decision",
      tone: "neutral",
    });
  }

  return events.sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return b.date.localeCompare(a.date);
  });
}