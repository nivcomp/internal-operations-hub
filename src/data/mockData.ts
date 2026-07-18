// Static reference collections hydrated on demand from the Supabase backend.
// We use `export let` so that consumer modules pick up the populated values
// via ES module live bindings once `hydrateStaticCollections()` resolves.
// This avoids running any network I/O at module-init time, which previously
// caused a silent white screen when any single fetch failed.

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

// Live-binding exports; consumers automatically observe the hydrated values.
export let clients: Client[] = [];
export let suppliers: Supplier[] = [];
export let supplierProfiles: SupplierProfile[] = [];
export let supplierSkillSuggestions: SupplierSkillSuggestion[] = [];
export let projects: Project[] = [];
export let projectBriefs: ProjectBrief[] = [];
export let scopes: Scope[] = [];
export let scopeItems: ScopeItem[] = [];
export let projectPricing: ProjectPricing[] = [];
export let phasePricing: PhasePricing[] = [];
export let approvals: Approval[] = [];
export let changeRequests: ChangeRequest[] = [];
export let timeEntries: TimeEntry[] = [];
export let clientPayments: ClientPayment[] = [];
export let supplierPayments: SupplierPayment[] = [];
export let hourBanks: HourBank[] = [];
export let projectMessages: ProjectMessage[] = [];
export let decisionLogs: DecisionLog[] = [];
export let fileLinks: FileLink[] = [];

let hydrationPromise: Promise<void> | null = null;

export function hydrateStaticCollections(force = false): Promise<void> {
  if (hydrationPromise && !force) return hydrationPromise;
  hydrationPromise = (async () => {
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
    clients = clientsRows;
    suppliers = suppliersRows;
    supplierProfiles = supplierProfilesRows;
    supplierSkillSuggestions = supplierSkillSuggestionsRows;
    projects = projectsRows;
    projectBriefs = projectBriefsRows;
    scopes = scopesRows;
    scopeItems = scopeItemsRows;
    projectPricing = projectPricingRows;
    phasePricing = phasePricingRows;
    approvals = approvalsRows;
    changeRequests = changeRequestsRows;
    timeEntries = timeEntriesRows;
    clientPayments = clientPaymentsRows;
    supplierPayments = supplierPaymentsRows;
    hourBanks = hourBanksRows;
    projectMessages = projectMessagesRows;
    decisionLogs = decisionLogsRows;
    fileLinks = fileLinksRows;
  })();
  return hydrationPromise;
}