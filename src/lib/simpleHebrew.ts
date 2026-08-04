import type {
  ChangeRequest, Client, ClientPayment, Project, ProjectStatus, Supplier, SupplierProfile, TimeEntry,
} from "../types/domain";

/** Natural Hebrew labels for project statuses (not machine translations). */
export const statusHe: Record<ProjectStatus, string> = {
  lead_started: "ליד חדש",
  discovery_in_progress: "באפיון",
  waiting_for_agency_pricing: "מחכה לתמחור",
  pricing_set: "תומחר",
  brief_ready: "בריף מוכן",
  scope_ready: "אפיון מוכן",
  waiting_for_client_approval: "מחכה לאישור הלקוח",
  approved_by_client: "אושר על ידי הלקוח",
  waiting_for_payment: "מחכה לתשלום",
  paid_ready_to_start: "שולם, מוכן להתחלה",
  assigned_to_supplier: "שויך לספק",
  in_development: "בפיתוח",
  change_requested: "בקשת שינוי",
  change_priced: "שינוי תומחר",
  change_approved: "שינוי אושר",
  completed: "הושלם",
};

export const clientStatusHe: Record<Client["status"], string> = {
  lead: "ליד",
  active: "פעיל",
  paused: "מושהה",
};

export const supplierStatusHe: Record<Supplier["status"], string> = {
  pending_review: "מחכה לאישור",
  approved: "מאושר",
  inactive: "לא פעיל",
};

export function projectNextActionHe(project: Project): string {
  switch (project.status) {
    case "lead_started":
    case "discovery_in_progress":
      return "השלם אפיון עם הלקוח";
    case "waiting_for_agency_pricing":
      return "קבע תמחור לפרויקט";
    case "pricing_set":
    case "brief_ready":
    case "scope_ready":
      return "שלח את ההצעה לאישור הלקוח";
    case "waiting_for_client_approval":
      return "עקוב אחרי אישור הלקוח";
    case "approved_by_client":
    case "waiting_for_payment":
      return "וודא שהתשלום או בנק השעות התקבל";
    case "paid_ready_to_start":
      return "שייך ספק והתחל עבודה";
    case "assigned_to_supplier":
    case "in_development":
      return "עקוב אחרי התקדמות הספק";
    case "change_requested":
      return "תמחר את בקשת השינוי";
    case "change_priced":
      return "המתן לאישור הלקוח לשינוי";
    case "change_approved":
      return "עדכן את הספק על השינוי";
    case "completed":
      return "אין פעולה פתוחה";
    default:
      return "בדוק את הפרויקט";
  }
}

export function projectBlockerHe(project: Project): string | null {
  if (project.paymentGateStatus === "blocked" && project.status !== "completed") {
    return "חסום עד לתשלום או בנק שעות";
  }
  if (project.status === "waiting_for_agency_pricing") return "מחכה לתמחור שלך";
  if (project.status === "waiting_for_client_approval") return "מחכה ללקוח";
  return null;
}

/** Short, deterministic Hebrew summary of a project – what happens, what is missing. */
export function projectSummaryHe(input: {
  project: Project;
  client?: Client;
  changeRequests: ChangeRequest[];
  payments: ClientPayment[];
  suppliers: Supplier[];
}): string {
  const { project, client, changeRequests, payments, suppliers } = input;
  const openChanges = changeRequests.filter(
    (r) => r.projectId === project.id && r.status !== "declined" && r.status !== "client_approved",
  ).length;
  const openPayments = payments.filter(
    (p) => p.projectId === project.id && p.status !== "received",
  ).length;
  const assigned = project.assignedSupplierIds
    .map((id) => suppliers.find((s) => s.id === id)?.name)
    .filter(Boolean) as string[];

  const parts = [
    `הפרויקט של ${client?.company ?? "לקוח לא ידוע"} נמצא בשלב "${statusHe[project.status]}".`,
    assigned.length ? `משויך ל${assigned.join(", ")}.` : "עדיין לא שויך ספק.",
  ];
  if (openChanges) parts.push(`${openChanges} בקשות שינוי פתוחות.`);
  if (openPayments) parts.push(`${openPayments} תשלומים שטרם התקבלו.`);
  parts.push(`הפעולה הבאה: ${projectNextActionHe(project)}.`);
  return parts.join(" ");
}

export function clientSummaryHe(input: {
  client: Client;
  projects: Project[];
}): string {
  const { client, projects } = input;
  const mine = projects.filter((p) => p.clientId === client.id);
  const waiting = mine.filter((p) =>
    ["waiting_for_agency_pricing", "waiting_for_client_approval", "waiting_for_payment"].includes(p.status));
  if (mine.length === 0) {
    return `${client.company} נרשם אך עדיין אין לו פרויקט. הפעולה הבאה: פתח פרויקט או השלם אפיון.`;
  }
  return waiting.length
    ? `${client.company} — ${mine.length} פרויקטים, ${waiting.length} מהם ממתינים לפעולה. הפעולה הבאה: ${projectNextActionHe(waiting[0])}.`
    : `${client.company} — ${mine.length} פרויקטים, שום דבר לא ממתין לך כרגע.`;
}

export function supplierSummaryHe(input: {
  supplier: Supplier;
  profile?: SupplierProfile;
  projects: Project[];
  timeEntries: TimeEntry[];
}): string {
  const { supplier, profile, projects, timeEntries } = input;
  const assigned = projects.filter((p) => p.assignedSupplierIds.includes(supplier.id));
  const waitingHours = timeEntries.filter((t) => t.supplierId === supplier.id && t.status === "submitted");
  const parts = [`${supplier.name} במצב "${supplierStatusHe[supplier.status]}".`];
  if (profile?.mainSkills?.length) parts.push(`תחומים: ${profile.mainSkills.slice(0, 4).join(", ")}.`);
  parts.push(assigned.length ? `${assigned.length} פרויקטים משויכים.` : "אין פרויקטים משויכים.");
  if (waitingHours.length) parts.push(`${waitingHours.length} דיווחי שעות מחכים לאישור.`);
  if (supplier.status === "pending_review") parts.push("הפעולה הבאה: אשר את הספק.");
  return parts.join(" ");
}

export function timeAgoHe(iso?: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (days <= 0) return "היום";
  if (days === 1) return "אתמול";
  if (days < 30) return `לפני ${days} ימים`;
  return date.toLocaleDateString("he-IL");
}