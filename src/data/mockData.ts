// This module now hydrates from the Supabase backend at load time.
// Legacy named exports are preserved so existing pages keep working
// (they still import synchronously). Top-level await blocks module
// evaluation until data is fetched, so consumers see populated arrays.

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

// Static configuration (not persisted yet).
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
];

// Hydrate every collection in parallel from the backend.
const [
  clientsRows,
  suppliersRows,
  supplierProfilesRows,
  supplierSkillSuggestionsRows,
  projectsRows,
  projectBriefsRows,
  scopesRows,
  scopeItemsRows,
  projectPricingRows,
  phasePricingRows,
  approvalsRows,
  changeRequestsRows,
  timeEntriesRows,
  clientPaymentsRows,
  supplierPaymentsRows,
  hourBanksRows,
  projectMessagesRows,
  decisionLogsRows,
  fileLinksRows,
] = await Promise.all([
  fetchClients(),
  fetchSuppliers(),
  fetchSupplierProfiles(),
  fetchSkillSuggestions(),
  fetchProjects(),
  fetchProjectBriefs(),
  fetchScopes(),
  fetchScopeItems(),
  fetchProjectPricing(),
  fetchPhasePricing(),
  fetchApprovals(),
  fetchChangeRequests(),
  fetchTimeEntries(),
  fetchClientPayments(),
  fetchSupplierPayments(),
  fetchHourBanks(),
  fetchProjectMessages(),
  fetchDecisionLogs(),
  fetchFileLinks(),
]);

export const clients: Client[] = clientsRows;
export const suppliers: Supplier[] = suppliersRows;
export const supplierProfiles: SupplierProfile[] = supplierProfilesRows;
export const supplierSkillSuggestions: SupplierSkillSuggestion[] = supplierSkillSuggestionsRows;
export const projects: Project[] = projectsRows;
export const projectBriefs: ProjectBrief[] = projectBriefsRows;
export const scopes: Scope[] = scopesRows;
export const scopeItems: ScopeItem[] = scopeItemsRows;
export const projectPricing: ProjectPricing[] = projectPricingRows;
export const phasePricing: PhasePricing[] = phasePricingRows;
export const approvals: Approval[] = approvalsRows;
export const changeRequests: ChangeRequest[] = changeRequestsRows;
export const timeEntries: TimeEntry[] = timeEntriesRows;
export const clientPayments: ClientPayment[] = clientPaymentsRows;
export const supplierPayments: SupplierPayment[] = supplierPaymentsRows;
export const hourBanks: HourBank[] = hourBanksRows;
export const projectMessages: ProjectMessage[] = projectMessagesRows;
export const decisionLogs: DecisionLog[] = decisionLogsRows;
export const fileLinks: FileLink[] = fileLinksRows;