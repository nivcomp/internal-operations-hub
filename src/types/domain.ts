export type UserRole = "agency_admin" | "client" | "supplier";

export type ProjectStatus =
  | "lead_started"
  | "discovery_in_progress"
  | "waiting_for_agency_pricing"
  | "pricing_set"
  | "brief_ready"
  | "scope_ready"
  | "waiting_for_client_approval"
  | "approved_by_client"
  | "waiting_for_payment"
  | "paid_ready_to_start"
  | "assigned_to_supplier"
  | "in_development"
  | "change_requested"
  | "change_priced"
  | "change_approved"
  | "completed";

export type Visibility = "agency_only" | "client_visible" | "supplier_visible";

export interface Agency {
  id: string;
  name: string;
  defaultCurrency: string;
  marginTargetPercent: number;
  settings: {
    requiresPaymentBeforeWork: boolean;
    requiresAgencyApprovalForChanges: boolean;
  };
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  linkedClientId?: string;
  linkedSupplierId?: string;
}

export interface Client {
  id: string;
  name: string;
  company: string;
  email: string;
  phone?: string;
  notes: string;
  status: "lead" | "active" | "paused";
}

export interface Supplier {
  id: string;
  name: string;
  email: string;
  phone?: string;
  country: string;
  timezone: string;
  status: "pending_review" | "approved" | "inactive";
}

export interface SupplierProfile {
  supplierId: string;
  languages: string[];
  mainSkills: string[];
  tools: string[];
  yearsOfExperience: number;
  hourlyRate: number;
  weeklyAvailabilityHours: number;
  portfolioLinks: string[];
  notes: string;
}

export interface SupplierSkillSuggestion {
  id: string;
  supplierId: string;
  suggestedSkill: string;
  sourceText: string;
  status: "needs_agency_approval" | "approved" | "declined";
  reviewedBy?: string;
}

export interface Project {
  id: string;
  clientId: string;
  name: string;
  status: ProjectStatus;
  summary: string;
  budgetSignal: string;
  paymentGateStatus: "blocked" | "paid" | "hour_bank_available";
  assignedSupplierIds: string[];
  createdDate: string;
  updatedDate: string;
}

export interface ProjectBrief {
  id: string;
  projectId: string;
  problemStatement: string;
  goals: string[];
  assumptions: string[];
  constraints: string[];
  exclusions: string[];
  discoveryNotes: string;
  aiDraftNotes: string;
  finalAgencyNotes: string;
}

export interface Scope {
  id: string;
  projectId: string;
  version: number;
  status: "draft" | "client_review" | "approved";
  clientFacingSummary: string;
  internalDeliveryNotes: string;
  approvedDate?: string;
}

export interface ScopeItem {
  id: string;
  scopeId: string;
  title: string;
  description: string;
  phase: string;
  clientVisible: boolean;
  supplierVisible: boolean;
  acceptanceNotes: string;
}

export interface ProjectPricing {
  id: string;
  projectId: string;
  currency: string;
  clientPrice: number;
  supplierCostEstimate: number;
  targetMarginPercent: number;
  actualMarginPercent: number;
  pricingNotes: string;
}

export interface PhasePricing {
  id: string;
  pricingId: string;
  phaseName: string;
  clientPrice: number;
  supplierCost: number;
  notes: string;
}

export interface Approval {
  id: string;
  projectId: string;
  scopeId: string;
  approverRole: UserRole;
  status: "pending" | "approved" | "rejected";
  approvedDate?: string;
  notes: string;
}

export interface ChangeRequest {
  id: string;
  projectId: string;
  requestedByClientId: string;
  title: string;
  description: string;
  status: "submitted" | "agency_review" | "priced" | "client_approved" | "declined";
  agencyPrice?: number;
  supplierCost?: number;
  approvedDate?: string;
}

export interface TimeEntry {
  id: string;
  projectId: string;
  supplierId: string;
  date: string;
  hours: number;
  description: string;
  status: "draft" | "submitted" | "approved" | "rejected";
  approvedBy?: string;
}

export interface ClientPayment {
  id: string;
  projectId: string;
  amount: number;
  currency: string;
  status: "not_due" | "requested" | "received" | "overdue";
  dueDate?: string;
  receivedDate?: string;
  notes: string;
}

export interface SupplierPayment {
  id: string;
  supplierId: string;
  projectId: string;
  amountOwed: number;
  amountPaid: number;
  currency: string;
  status: "not_ready" | "ready_to_pay" | "paid";
}

export interface HourBank {
  id: string;
  clientId: string;
  projectId?: string;
  hoursPurchased: number;
  hoursUsed: number;
  hoursRemaining: number;
  expiryDate?: string;
}

export interface ProjectMessage {
  id: string;
  projectId: string;
  authorRole: UserRole;
  body: string;
  visibility: Visibility;
  createdDate: string;
}

export interface DecisionLog {
  id: string;
  projectId: string;
  decision: string;
  madeByRole: UserRole;
  impact: string;
  createdDate: string;
}

export interface FileLink {
  id: string;
  projectId: string;
  title: string;
  url: string;
  fileType: "brief" | "design" | "contract" | "asset" | "link";
  visibility: Visibility;
  addedBy: UserRole;
}
