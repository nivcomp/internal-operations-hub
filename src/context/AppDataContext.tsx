import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import {
  createChangeRequestRow,
  createClientPaymentRow,
  createClientRow,
  createProjectRow,
  createTimeEntryRow,
  fetchActivityLogs,
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
  markClientPaymentReceivedRow,
  recordActivityRow,
  setProjectSupplierAssignmentRow,
  updateChangeRequestStatusRow,
  updateProjectRow,
  updateTimeEntryStatusRow,
} from "../services/api";
import { currency, getProjectName, getSupplierName } from "../lib/domainHelpers";
import type {
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
} from "../types/domain";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------
export type NewClientInput = Pick<Client, "name" | "company" | "email" | "phone" | "notes" | "status">;
export type NewProjectInput = Pick<Project, "name" | "summary" | "budgetSignal">;
export type NewChangeRequestInput = Pick<ChangeRequest, "title" | "description" | "agencyPrice" | "supplierCost">;
export type NewTimeEntryInput = Pick<TimeEntry, "supplierId" | "date" | "hours" | "description">;
export type NewClientPaymentInput = Pick<ClientPayment, "amount" | "dueDate" | "notes">;
export type ActivityEntry = {
  id: string;
  createdAt: string;
  label: string;
  detail: string;
};

export type DataStatus = "loading" | "ready" | "error";

export type AppDataValue = {
  status: DataStatus;
  error: string | null;
  reload: () => void;

  // Collections
  clients: Client[];
  suppliers: Supplier[];
  supplierProfiles: SupplierProfile[];
  supplierSkillSuggestions: SupplierSkillSuggestion[];
  projects: Project[];
  projectBriefs: ProjectBrief[];
  scopes: Scope[];
  scopeItems: ScopeItem[];
  projectPricing: ProjectPricing[];
  phasePricing: PhasePricing[];
  approvals: Approval[];
  changeRequests: ChangeRequest[];
  timeEntries: TimeEntry[];
  clientPayments: ClientPayment[];
  supplierPayments: SupplierPayment[];
  hourBanks: HourBank[];
  projectMessages: ProjectMessage[];
  decisionLogs: DecisionLog[];
  fileLinks: FileLink[];
  activityEntries: ActivityEntry[];

  // Mutations
  createClient: (input: NewClientInput) => Promise<Client>;
  createProject: (clientId: string, input: NewProjectInput) => Promise<Project>;
  createChangeRequest: (projectId: string, clientId: string, input: NewChangeRequestInput) => Promise<ChangeRequest>;
  createTimeEntry: (projectId: string, input: NewTimeEntryInput) => Promise<TimeEntry>;
  createClientPayment: (projectId: string, input: NewClientPaymentInput) => Promise<ClientPayment>;
  markPaymentReceived: (paymentId: string) => Promise<void>;
  updateProjectSupplierAssignment: (projectId: string, supplierId: string, assigned: boolean) => Promise<void>;
  updateTimeEntryStatus: (timeEntryId: string, status: "approved" | "rejected") => Promise<void>;
  updateChangeRequestStatus: (
    changeRequestId: string,
    status: "priced" | "client_approved" | "declined",
  ) => Promise<void>;
};

const AppDataContext = createContext<AppDataValue | null>(null);

export function useAppData(): AppDataValue {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used within <AppDataProvider>");
  return ctx;
}

// -----------------------------------------------------------------------------
// Provider
// -----------------------------------------------------------------------------
export function AppDataProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<DataStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  const [clients, setClients] = useState<Client[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierProfiles, setSupplierProfiles] = useState<SupplierProfile[]>([]);
  const [supplierSkillSuggestions, setSupplierSkillSuggestions] = useState<SupplierSkillSuggestion[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectBriefs, setProjectBriefs] = useState<ProjectBrief[]>([]);
  const [scopes, setScopes] = useState<Scope[]>([]);
  const [scopeItems, setScopeItems] = useState<ScopeItem[]>([]);
  const [projectPricing, setProjectPricing] = useState<ProjectPricing[]>([]);
  const [phasePricing, setPhasePricing] = useState<PhasePricing[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [clientPayments, setClientPayments] = useState<ClientPayment[]>([]);
  const [supplierPayments, setSupplierPayments] = useState<SupplierPayment[]>([]);
  const [hourBanks, setHourBanks] = useState<HourBank[]>([]);
  const [projectMessages, setProjectMessages] = useState<ProjectMessage[]>([]);
  const [decisionLogs, setDecisionLogs] = useState<DecisionLog[]>([]);
  const [fileLinks, setFileLinks] = useState<FileLink[]>([]);
  const [activityEntries, setActivityEntries] = useState<ActivityEntry[]>([]);

  const loadAll = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const [
        cli, sup, supProf, supSkill,
        proj, briefs, sco, scoItems, pricing, phasePr,
        appr, cr, te, cp, sp, hb, pm, dl, fl, al,
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
        fetchActivityLogs(20),
      ]);
      setClients(cli);
      setSuppliers(sup);
      setSupplierProfiles(supProf);
      setSupplierSkillSuggestions(supSkill);
      setProjects(proj);
      setProjectBriefs(briefs);
      setScopes(sco);
      setScopeItems(scoItems);
      setProjectPricing(pricing);
      setPhasePricing(phasePr);
      setApprovals(appr);
      setChangeRequests(cr);
      setTimeEntries(te);
      setClientPayments(cp);
      setSupplierPayments(sp);
      setHourBanks(hb);
      setProjectMessages(pm);
      setDecisionLogs(dl);
      setFileLinks(fl);
      setActivityEntries(al);
      setStatus("ready");
    } catch (err) {
      console.error("[AppData] load failed", err);
      setError(err instanceof Error ? err.message : "Unknown error loading data from database.");
      setStatus("error");
    }
  }, []);

  useEffect(() => { void loadAll(); }, [loadAll]);

  const recordActivity = useCallback(async (label: string, detail: string) => {
    const persisted = await recordActivityRow(label, detail);
    if (persisted) setActivityEntries((current) => [persisted, ...current].slice(0, 20));
  }, []);

  // ---- Mutations ----------------------------------------------------------
  const createClient = useCallback(async (input: NewClientInput): Promise<Client> => {
    const persisted = await createClientRow({
      name: input.name,
      company: input.company,
      email: input.email,
      phone: input.phone || undefined,
      notes: input.notes,
      status: input.status,
    });
    if (!persisted) throw new Error("Failed to save client. Please try again.");
    setClients((current) => [...current, persisted]);
    void recordActivity("Client created", `${persisted.company} was added as ${persisted.status}.`);
    return persisted;
  }, [recordActivity]);

  const createProject = useCallback(async (clientId: string, input: NewProjectInput): Promise<Project> => {
    const persisted = await createProjectRow({
      clientId, name: input.name, summary: input.summary, budgetSignal: input.budgetSignal,
    });
    if (!persisted) throw new Error("Failed to save project. Please try again.");
    setProjects((current) => [...current, persisted]);
    const company = clients.find((c) => c.id === clientId)?.company ?? "a client";
    void recordActivity("Project created", `${persisted.name} was created for ${company}.`);
    return persisted;
  }, [clients, recordActivity]);

  const createChangeRequest = useCallback(async (projectId: string, clientId: string, input: NewChangeRequestInput): Promise<ChangeRequest> => {
    const persisted = await createChangeRequestRow({
      projectId, clientId,
      title: input.title, description: input.description,
      agencyPrice: input.agencyPrice, supplierCost: input.supplierCost,
    });
    if (!persisted) throw new Error("Failed to save change request. Please try again.");
    setChangeRequests((current) => [...current, persisted]);
    void recordActivity("Change request created", `${persisted.title} was added to ${getProjectName(projectId, projects)}.`);
    return persisted;
  }, [projects, recordActivity]);

  const createTimeEntry = useCallback(async (projectId: string, input: NewTimeEntryInput): Promise<TimeEntry> => {
    const persisted = await createTimeEntryRow({
      projectId, supplierId: input.supplierId, date: input.date,
      hours: input.hours, description: input.description,
    });
    if (!persisted) throw new Error("Failed to save time entry. Please try again.");
    setTimeEntries((current) => [...current, persisted]);
    void recordActivity(
      "Supplier time submitted",
      `${persisted.hours} hours from ${getSupplierName(persisted.supplierId, suppliers)} were submitted for ${getProjectName(projectId, projects)}.`,
    );
    return persisted;
  }, [projects, suppliers, recordActivity]);

  const createClientPayment = useCallback(async (projectId: string, input: NewClientPaymentInput): Promise<ClientPayment> => {
    const notes = input.notes.trim() || "Manual payment request created locally.";
    const persisted = await createClientPaymentRow({
      projectId, amount: input.amount, dueDate: input.dueDate || undefined, notes,
    });
    if (!persisted) throw new Error("Failed to save payment request. Please try again.");
    setClientPayments((current) => [...current, persisted]);
    await updateProjectRow(projectId, { status: "waiting_for_payment", paymentGateStatus: "blocked" });
    setProjects((current) => current.map((project) =>
      project.id === projectId && project.status !== "completed"
        ? { ...project, status: "waiting_for_payment", paymentGateStatus: "blocked" }
        : project,
    ));
    void recordActivity("Payment requested", `${currency.format(persisted.amount)} was requested for ${getProjectName(projectId, projects)}.`);
    return persisted;
  }, [projects, recordActivity]);

  const markPaymentReceived = useCallback(async (paymentId: string) => {
    const paymentToUpdate = clientPayments.find((p) => p.id === paymentId);
    const receivedDate = await markClientPaymentReceivedRow(paymentId);
    if (!receivedDate) throw new Error("Failed to mark payment as received. Please try again.");
    setClientPayments((current) => current.map((p) =>
      p.id === paymentId ? { ...p, status: "received", receivedDate } : p,
    ));
    if (paymentToUpdate) {
      void recordActivity("Payment received", `${getProjectName(paymentToUpdate.projectId, projects)} payment was marked received.`);
      const project = projects.find((p) => p.id === paymentToUpdate.projectId);
      const newStatus = project?.status === "waiting_for_payment" ? "paid_ready_to_start" : undefined;
      await updateProjectRow(paymentToUpdate.projectId, {
        paymentGateStatus: "paid",
        ...(newStatus ? { status: newStatus } : {}),
      });
      setProjects((current) => current.map((project) =>
        project.id === paymentToUpdate.projectId
          ? {
              ...project,
              paymentGateStatus: "paid",
              status: project.status === "waiting_for_payment" ? "paid_ready_to_start" : project.status,
            }
          : project,
      ));
    }
  }, [clientPayments, projects, recordActivity]);

  const updateProjectSupplierAssignment = useCallback(async (projectId: string, supplierId: string, assigned: boolean) => {
    await setProjectSupplierAssignmentRow(projectId, supplierId, assigned);
    setProjects((current) => current.map((project) => {
      if (project.id !== projectId) return project;
      const supplierIds = assigned
        ? Array.from(new Set([...project.assignedSupplierIds, supplierId]))
        : project.assignedSupplierIds.filter((id) => id !== supplierId);
      return { ...project, assignedSupplierIds: supplierIds, updatedDate: new Date().toISOString().slice(0, 10) };
    }));
    void recordActivity(
      assigned ? "Supplier assigned" : "Supplier unassigned",
      `${getSupplierName(supplierId, suppliers)} was ${assigned ? "assigned to" : "removed from"} ${getProjectName(projectId, projects)}.`,
    );
  }, [projects, suppliers, recordActivity]);

  const updateTimeEntryStatus = useCallback(async (timeEntryId: string, status: "approved" | "rejected") => {
    const entryToUpdate = timeEntries.find((entry) => entry.id === timeEntryId);
    await updateTimeEntryStatusRow(timeEntryId, status);
    setTimeEntries((current) => current.map((entry) =>
      entry.id === timeEntryId
        ? { ...entry, status, approvedBy: status === "approved" ? "user-yaniv" : undefined }
        : entry,
    ));
    if (entryToUpdate) {
      void recordActivity(
        status === "approved" ? "Supplier time approved" : "Supplier time rejected",
        `${entryToUpdate.hours} hours from ${getSupplierName(entryToUpdate.supplierId, suppliers)} for ${getProjectName(entryToUpdate.projectId, projects)} were ${status}.`,
      );
    }
  }, [projects, suppliers, timeEntries, recordActivity]);

  const updateChangeRequestStatus = useCallback(async (
    changeRequestId: string,
    status: "priced" | "client_approved" | "declined",
  ) => {
    const requestToUpdate = changeRequests.find((r) => r.id === changeRequestId);
    await updateChangeRequestStatusRow(changeRequestId, status);
    setChangeRequests((current) => current.map((request) => {
      if (request.id !== changeRequestId) return request;
      return {
        ...request,
        status,
        approvedDate: status === "client_approved" ? new Date().toISOString().slice(0, 10) : request.approvedDate,
      };
    }));
    if (requestToUpdate) {
      void recordActivity("Change request updated", `${requestToUpdate.title} is now ${status.replace("_", " ")}.`);
    }
  }, [changeRequests, recordActivity]);

  const value: AppDataValue = {
    status, error, reload: () => void loadAll(),
    clients, suppliers, supplierProfiles, supplierSkillSuggestions,
    projects, projectBriefs, scopes, scopeItems, projectPricing, phasePricing,
    approvals, changeRequests, timeEntries, clientPayments, supplierPayments,
    hourBanks, projectMessages, decisionLogs, fileLinks, activityEntries,
    createClient, createProject, createChangeRequest, createTimeEntry,
    createClientPayment, markPaymentReceived, updateProjectSupplierAssignment,
    updateTimeEntryStatus, updateChangeRequestStatus,
  };

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}
