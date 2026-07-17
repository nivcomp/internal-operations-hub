import {
  fetchApprovals,
  fetchChangeRequests,
  fetchClientPayments,
  fetchClients,
  fetchDecisionLogs,
  fetchFileLinks,
  fetchHourBanks,
  fetchPhasePricing,
  fetchProjectBriefs,
  fetchProjectMessages,
  fetchProjectPricing,
  fetchProjects,
  fetchScopeItems,
  fetchScopes,
  fetchSkillSuggestions,
  fetchSupplierPayments,
  fetchSupplierProfiles,
  fetchSuppliers,
  fetchTimeEntries,
} from "../services/api";
import type {
  Agency,
  Approval,
  ChangeRequest,
  Client,
  ClientPayment,
  DecisionLog,
  FileLink,
  HourBank,
  PhasePricing,
  Project,
  ProjectBrief,
  ProjectMessage,
  ProjectPricing,
  Scope,
  ScopeItem,
  Supplier,
  SupplierPayment,
  SupplierProfile,
  SupplierSkillSuggestion,
  TimeEntry,
  User,
} from "../types/domain";

export const agency: Agency = {
  id: "agency-1",
  name: "Yaniv Studio",
  defaultCurrency: "GBP",
  marginTargetPercent: 35,
  settings: {
    requiresPaymentBeforeWork: true,
    requiresAgencyApprovalForChanges: true,
  },
};

export const users: User[] = [
  { id: "user-yaniv", name: "Yaniv", email: "yaniv@example.com", role: "agency_admin" },
  { id: "user-client-1", name: "Maya Cohen", email: "maya@northline.example", role: "client", linkedClientId: "client-1" },
  { id: "user-supplier-1", name: "Sam Reed", email: "sam@supplier.example", role: "supplier", linkedSupplierId: "supplier-1" },
];

  {
    id: "client-1",
    name: "Maya Cohen",
    company: "Northline Health",
    email: "maya@northline.example",
    phone: "+44 20 0000 0101",
    notes: "Needs a clear path from messy operations notes to a scoped client portal project.",
    status: "active",
  },
  {
    id: "client-2",
    name: "Daniel Hart",
    company: "Hart Advisory",
    email: "daniel@hart.example",
    notes: "New lead. Wants AI-assisted intake for his consulting clients.",
    status: "lead",
  },
  {
    id: "client-3",
    name: "Leah Brooks",
    company: "Brooks Supply",
    email: "leah@brooks.example",
    notes: "Retainer client with paid hours available.",
    status: "active",
  },
];

export const suppliers: Supplier[] = [
  {
    id: "supplier-1",
    name: "Sam Reed",
    email: "sam@supplier.example",
    phone: "+44 7700 900100",
    country: "United Kingdom",
    timezone: "Europe/London",
    status: "approved",
  },
  {
    id: "supplier-2",
    name: "Iris Novak",
    email: "iris@supplier.example",
    country: "Portugal",
    timezone: "Europe/Lisbon",
    status: "approved",
  },
  {
    id: "supplier-3",
    name: "Nadia Park",
    email: "nadia@supplier.example",
    country: "Canada",
    timezone: "America/Toronto",
    status: "pending_review",
  },
];

export const supplierProfiles: SupplierProfile[] = [
  {
    supplierId: "supplier-1",
    languages: ["English"],
    mainSkills: ["React", "TypeScript", "Supabase"],
    tools: ["GitHub", "Figma", "Vercel"],
    yearsOfExperience: 8,
    hourlyRate: 70,
    weeklyAvailabilityHours: 22,
    portfolioLinks: ["https://example.com/sam"],
    notes: "Strong on practical internal dashboards.",
  },
  {
    supplierId: "supplier-2",
    languages: ["English", "Portuguese"],
    mainSkills: ["Discovery", "UX flows", "Documentation"],
    tools: ["Miro", "Notion", "Figma"],
    yearsOfExperience: 6,
    hourlyRate: 58,
    weeklyAvailabilityHours: 16,
    portfolioLinks: ["https://example.com/iris"],
    notes: "Good fit for brief cleanup and client-facing flow maps.",
  },
  {
    supplierId: "supplier-3",
    languages: ["English", "French"],
    mainSkills: ["Automation", "QA"],
    tools: ["Make", "Airtable", "Playwright"],
    yearsOfExperience: 5,
    hourlyRate: 52,
    weeklyAvailabilityHours: 10,
    portfolioLinks: ["https://example.com/nadia"],
    notes: "Onboarding pending agency review.",
  },
];

export const supplierSkillSuggestions: SupplierSkillSuggestion[] = [
  {
    id: "skill-suggestion-1",
    supplierId: "supplier-3",
    suggestedSkill: "CRM cleanup",
    sourceText: "I also clean up messy CRM pipelines before automation work.",
    status: "needs_agency_approval",
  },
];

export const projects: Project[] = [
  {
    id: "project-1",
    clientId: "client-1",
    name: "Patient onboarding portal",
    status: "waiting_for_client_approval",
    summary: "Client-facing portal to capture onboarding documents and reduce email coordination.",
    budgetSignal: "GBP 14k to 18k",
    paymentGateStatus: "blocked",
    assignedSupplierIds: ["supplier-1"],
    createdDate: "2026-06-20",
    updatedDate: "2026-07-06",
  },
  {
    id: "project-2",
    clientId: "client-2",
    name: "Consulting intake workspace",
    status: "waiting_for_agency_pricing",
    summary: "Turn new consulting inquiries into structured briefs with internal review before quotes.",
    budgetSignal: "Unknown",
    paymentGateStatus: "blocked",
    assignedSupplierIds: [],
    createdDate: "2026-07-05",
    updatedDate: "2026-07-07",
  },
  {
    id: "project-3",
    clientId: "client-3",
    name: "Retainer reporting improvements",
    status: "in_development",
    summary: "Improve monthly reporting views using prepaid hours from the client's hour bank.",
    budgetSignal: "Hour bank",
    paymentGateStatus: "hour_bank_available",
    assignedSupplierIds: ["supplier-2"],
    createdDate: "2026-06-01",
    updatedDate: "2026-07-07",
  },
  {
    id: "project-4",
    clientId: "client-1",
    name: "Support triage cleanup",
    status: "waiting_for_payment",
    summary: "Small follow-on project approved by client, waiting on deposit before work starts.",
    budgetSignal: "GBP 4.5k",
    paymentGateStatus: "blocked",
    assignedSupplierIds: ["supplier-1"],
    createdDate: "2026-07-01",
    updatedDate: "2026-07-06",
  },
];

export const projectBriefs: ProjectBrief[] = [
  {
    id: "brief-1",
    projectId: "project-1",
    problemStatement: "Northline loses time collecting onboarding documents and status updates by email.",
    goals: ["Reduce email chasing", "Give client staff one intake view", "Keep launch scope practical"],
    assumptions: ["Existing CRM remains the source of truth", "MVP uses manual payment tracking"],
    constraints: ["No payment provider integration yet", "Client wants first launch in six weeks"],
    exclusions: ["Native mobile app", "Automated insurance checks"],
    discoveryNotes: "Client has examples in Drive. Needs document upload, status labels, and internal notes.",
    aiDraftNotes: "Placeholder: AI could turn discovery notes into a brief draft after Yaniv reviews.",
    finalAgencyNotes: "Confirm file storage policy before build.",
  },
];

export const scopes: Scope[] = [
  {
    id: "scope-1",
    projectId: "project-1",
    version: 1,
    status: "client_review",
    clientFacingSummary: "Build a simple onboarding portal for document collection and status visibility.",
    internalDeliveryNotes: "Keep supplier instructions separate from client scope. No auth complexity in first pass.",
  },
  {
    id: "scope-2",
    projectId: "project-3",
    version: 2,
    status: "approved",
    clientFacingSummary: "Improve monthly reporting filters and export notes.",
    internalDeliveryNotes: "Use existing reporting layout. Do not introduce new analytics stack.",
    approvedDate: "2026-06-15",
  },
];

export const scopeItems: ScopeItem[] = [
  {
    id: "scope-item-1",
    scopeId: "scope-1",
    title: "Onboarding status dashboard",
    description: "Client-facing list of patient onboarding status and outstanding items.",
    phase: "MVP build",
    clientVisible: true,
    supplierVisible: true,
    acceptanceNotes: "Client can see the status for each onboarding record.",
  },
  {
    id: "scope-item-2",
    scopeId: "scope-1",
    title: "Internal agency launch checklist",
    description: "Yaniv reviews readiness before any client-facing commitment is made.",
    phase: "Launch",
    clientVisible: false,
    supplierVisible: true,
    acceptanceNotes: "Agency confirms scope, files, and payment gate before supplier starts.",
  },
  {
    id: "scope-item-3",
    scopeId: "scope-2",
    title: "Report filters",
    description: "Add date range and project status filters to the monthly report.",
    phase: "Retainer",
    clientVisible: true,
    supplierVisible: true,
    acceptanceNotes: "Filters are visible and save the current reporting context.",
  },
];

export const projectPricing: ProjectPricing[] = [
  {
    id: "pricing-1",
    projectId: "project-1",
    currency: "GBP",
    clientPrice: 16500,
    supplierCostEstimate: 9800,
    targetMarginPercent: 35,
    actualMarginPercent: 40.6,
    pricingNotes: "Healthy margin if scope stays within MVP boundaries.",
  },
  {
    id: "pricing-2",
    projectId: "project-3",
    currency: "GBP",
    clientPrice: 5000,
    supplierCostEstimate: 2850,
    targetMarginPercent: 35,
    actualMarginPercent: 43,
    pricingNotes: "Retainer uses paid hours; watch approved supplier time.",
  },
  {
    id: "pricing-3",
    projectId: "project-4",
    currency: "GBP",
    clientPrice: 4500,
    supplierCostEstimate: 2900,
    targetMarginPercent: 35,
    actualMarginPercent: 35.6,
    pricingNotes: "Do not start until deposit received.",
  },
];

export const phasePricing: PhasePricing[] = [
  { id: "phase-1", pricingId: "pricing-1", phaseName: "Discovery cleanup", clientPrice: 3500, supplierCost: 1200, notes: "Agency-heavy review." },
  { id: "phase-2", pricingId: "pricing-1", phaseName: "MVP build", clientPrice: 10500, supplierCost: 7400, notes: "Supplier build estimate." },
  { id: "phase-3", pricingId: "pricing-1", phaseName: "QA and launch", clientPrice: 2500, supplierCost: 1200, notes: "Agency approval gate." },
  { id: "phase-4", pricingId: "pricing-3", phaseName: "Support triage", clientPrice: 4500, supplierCost: 2900, notes: "Small approved project awaiting payment." },
];

export const approvals: Approval[] = [
  { id: "approval-1", projectId: "project-1", scopeId: "scope-1", approverRole: "client", status: "pending", notes: "Client has scope v1 for review." },
  { id: "approval-2", projectId: "project-3", scopeId: "scope-2", approverRole: "client", status: "approved", approvedDate: "2026-06-15", notes: "Approved as hour-bank work." },
];

export const changeRequests: ChangeRequest[] = [
  {
    id: "change-1",
    projectId: "project-1",
    requestedByClientId: "client-1",
    title: "Add automated reminder emails",
    description: "Client asked for reminders when documents are missing.",
    status: "agency_review",
  },
  {
    id: "change-2",
    projectId: "project-3",
    requestedByClientId: "client-3",
    title: "Export report as CSV",
    description: "Add a CSV export to monthly reporting.",
    status: "priced",
    agencyPrice: 900,
    supplierCost: 420,
  },
  {
    id: "change-3",
    projectId: "project-4",
    requestedByClientId: "client-1",
    title: "Add extra inbox categories",
    description: "Client wants two additional triage categories.",
    status: "client_approved",
    agencyPrice: 650,
    supplierCost: 300,
    approvedDate: "2026-07-06",
  },
];

export const timeEntries: TimeEntry[] = [
  { id: "time-1", projectId: "project-3", supplierId: "supplier-2", date: "2026-07-05", hours: 3, description: "Built report filter states.", status: "submitted" },
  { id: "time-2", projectId: "project-3", supplierId: "supplier-2", date: "2026-07-06", hours: 2.5, description: "QA on filter combinations.", status: "approved", approvedBy: "user-yaniv" },
  { id: "time-3", projectId: "project-1", supplierId: "supplier-1", date: "2026-07-06", hours: 1.5, description: "Reviewed scope notes only; no build started.", status: "submitted" },
];

export const clientPayments: ClientPayment[] = [
  { id: "client-payment-1", projectId: "project-1", amount: 8250, currency: "GBP", status: "requested", dueDate: "2026-07-12", notes: "Deposit requested after approval." },
  { id: "client-payment-2", projectId: "project-3", amount: 5000, currency: "GBP", status: "received", receivedDate: "2026-06-01", notes: "Hour bank purchased." },
  { id: "client-payment-3", projectId: "project-4", amount: 2250, currency: "GBP", status: "requested", dueDate: "2026-07-10", notes: "Work blocked until received." },
];

export const supplierPayments: SupplierPayment[] = [
  { id: "supplier-payment-1", supplierId: "supplier-2", projectId: "project-3", amountOwed: 145, amountPaid: 0, currency: "GBP", status: "ready_to_pay" },
  { id: "supplier-payment-2", supplierId: "supplier-1", projectId: "project-1", amountOwed: 0, amountPaid: 0, currency: "GBP", status: "not_ready" },
];

export const hourBanks: HourBank[] = [
  { id: "hour-bank-1", clientId: "client-3", projectId: "project-3", hoursPurchased: 40, hoursUsed: 11.5, hoursRemaining: 28.5, expiryDate: "2026-09-01" },
];

export const projectMessages: ProjectMessage[] = [
  {
    id: "message-1",
    projectId: "project-1",
    authorRole: "agency_admin",
    body: "Scope is ready for client approval. Supplier build remains blocked until payment is received.",
    visibility: "client_visible",
    createdDate: "2026-07-06",
  },
  {
    id: "message-2",
    projectId: "project-3",
    authorRole: "supplier",
    body: "Report filters are ready for agency review.",
    visibility: "agency_only",
    createdDate: "2026-07-06",
  },
  {
    id: "message-3",
    projectId: "project-1",
    authorRole: "agency_admin",
    body: "Please review the assigned scope notes before starting any implementation work.",
    visibility: "supplier_visible",
    createdDate: "2026-07-07",
  },
];

export const decisionLogs: DecisionLog[] = [
  {
    id: "decision-1",
    projectId: "project-1",
    decision: "Do not start build until deposit is marked received.",
    madeByRole: "agency_admin",
    impact: "Protects margin and avoids unfunded supplier work.",
    createdDate: "2026-07-06",
  },
];

export const fileLinks: FileLink[] = [
  {
    id: "file-1",
    projectId: "project-1",
    title: "Northline discovery notes",
    url: "https://example.com/discovery",
    fileType: "brief",
    visibility: "agency_only",
    addedBy: "agency_admin",
  },
  {
    id: "file-2",
    projectId: "project-1",
    title: "Client portal examples",
    url: "https://example.com/examples",
    fileType: "link",
    visibility: "supplier_visible",
    addedBy: "agency_admin",
  },
  {
    id: "file-3",
    projectId: "project-1",
    title: "Approved scope summary",
    url: "https://example.com/scope-summary",
    fileType: "brief",
    visibility: "client_visible",
    addedBy: "agency_admin",
  },
];
