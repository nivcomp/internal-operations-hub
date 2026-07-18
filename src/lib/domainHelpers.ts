import type { Client, Project, ProjectPricing, ProjectStatus, Scope, Supplier } from "../types/domain";

export const currency = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

export const statusLabels: Record<ProjectStatus, string> = {
  lead_started: "Lead started",
  discovery_in_progress: "Discovery",
  waiting_for_agency_pricing: "Needs pricing",
  pricing_set: "Pricing set",
  brief_ready: "Brief ready",
  scope_ready: "Scope ready",
  waiting_for_client_approval: "Client approval",
  approved_by_client: "Approved",
  waiting_for_payment: "Waiting payment",
  paid_ready_to_start: "Ready to start",
  assigned_to_supplier: "Assigned",
  in_development: "In development",
  change_requested: "Change requested",
  change_priced: "Change priced",
  change_approved: "Change approved",
  completed: "Completed",
};

// All helpers take their collections explicitly; no module-level global data.

export function getClient(project: Project, clientRecords: Client[]) {
  return clientRecords.find((client) => client.id === project.clientId);
}

export function getClientById(clientId: string, clientRecords: Client[]) {
  return clientRecords.find((client) => client.id === clientId);
}

export function getPricing(projectId: string, pricingRecords: ProjectPricing[]) {
  return pricingRecords.find((pricing) => pricing.projectId === projectId);
}

export function getProjectById(projectId: string, projectRecords: Project[]) {
  return projectRecords.find((project) => project.id === projectId);
}

export function getProjectsForClient(clientId: string, projectRecords: Project[]) {
  return projectRecords.filter((project) => project.clientId === clientId);
}

export function getSupplierById(supplierId: string, supplierRecords: Supplier[]) {
  return supplierRecords.find((supplier) => supplier.id === supplierId);
}

export function getSupplierName(supplierId: string, supplierRecords: Supplier[]) {
  return supplierRecords.find((supplier) => supplier.id === supplierId)?.name ?? "Unassigned";
}

export function getProjectName(projectId: string, projectRecords: Project[]) {
  return projectRecords.find((project) => project.id === projectId)?.name ?? "Unknown project";
}

export function hasApprovedScope(project: Project, scopeRecords: Scope[]) {
  return scopeRecords.some((scope) => scope.projectId === project.id && scope.status === "approved");
}

export function hasPaymentOrHours(project: Project) {
  return project.paymentGateStatus === "paid" || project.paymentGateStatus === "hour_bank_available";
}

export function canWorkStart(project: Project, scopeRecords: Scope[]) {
  return hasApprovedScope(project, scopeRecords) && hasPaymentOrHours(project);
}

export function marginAmount(pricingRecords: ProjectPricing[]) {
  const revenue = pricingRecords.reduce((sum, pricing) => sum + pricing.clientPrice, 0);
  const cost = pricingRecords.reduce((sum, pricing) => sum + pricing.supplierCostEstimate, 0);
  return { revenue, cost, margin: revenue - cost };
}
