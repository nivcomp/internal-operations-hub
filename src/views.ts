export const views = [
  { key: "dashboard", label: "Dashboard" },
  { key: "action-queue", label: "Action Queue" },
  { key: "clients", label: "Clients" },
  { key: "client-detail", label: "Client Detail" },
  { key: "projects", label: "Projects" },
  { key: "project-detail", label: "Project Detail" },
  { key: "suppliers", label: "Suppliers" },
  { key: "supplier-detail", label: "Supplier Detail" },
  { key: "pricing-margin", label: "Pricing / Margin" },
  { key: "change-requests", label: "Change Requests" },
  { key: "supplier-time", label: "Supplier Time" },
  { key: "payments-hours", label: "Payments / Hours" },
  { key: "client-portal", label: "Client Portal" },
  { key: "supplier-portal", label: "Supplier Portal" },
  { key: "ai-workbench", label: "AI Workbench" },
] as const;

export type ViewKey = (typeof views)[number]["key"];
