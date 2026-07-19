import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
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

export type MutationHelpers = {
  isPending: (key: string) => boolean;
  getError: (key: string) => string | undefined;
  getSuccess: (key: string) => string | undefined;
  clearMutationState: (key: string) => void;
};

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
} & MutationHelpers;

// Mutation keys — stable strings used to look up pending/error/success state
// from any component. Format: <domain>:<action>[:<id>].
export const MutationKeys = {
  createClient: "client:create",
  createProject: (clientId: string) => `project:create:${clientId}`,
  createChangeRequest: (projectId: string) => `changeRequest:create:${projectId}`,
  updateChangeRequestStatus: (id: string) => `changeRequest:status:${id}`,
  createTimeEntry: (projectId: string) => `timeEntry:create:${projectId}`,
  updateTimeEntryStatus: (id: string) => `timeEntry:status:${id}`,
  createClientPayment: (projectId: string) => `payment:create:${projectId}`,
  markPaymentReceived: (id: string) => `payment:receive:${id}`,
  updateProjectSupplierAssignment: (projectId: string, supplierId: string) =>
    `assignment:${projectId}:${supplierId}`,
} as const;

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

  // Mutation state (per-key)
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [successes, setSuccesses] = useState<Record<string, string | undefined>>({});
  const pendingRef = useRef<Record<string, boolean>>({});
  pendingRef.current = pending;

  const isPending = useCallback((key: string) => Boolean(pending[key]), [pending]);
  const getError = useCallback((key: string) => errors[key], [errors]);
  const getSuccess = useCallback((key: string) => successes[key], [successes]);
  const clearMutationState = useCallback((key: string) => {
    setErrors((s) => ({ ...s, [key]: undefined }));
    setSuccesses((s) => ({ ...s, [key]: undefined }));
  }, []);

  const runAction = useCallback(async <R,>(key: string, successMsg: string, fn: () => Promise<R>): Promise<R> => {
    if (pendingRef.current[key]) {
      // Duplicate submission guard — reject silently so callers keep their state.
      throw new Error("A save for this action is already in progress.");
    }
    setPending((s) => ({ ...s, [key]: true }));
    setErrors((s) => ({ ...s, [key]: undefined }));
    setSuccesses((s) => ({ ...s, [key]: undefined }));
    try {
      const result = await fn();
      setSuccesses((s) => ({ ...s, [key]: successMsg }));
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[AppData] mutation "${key}" failed`, err);
      setErrors((s) => ({ ...s, [key]: msg }));
      throw err;
    } finally {
      setPending((s) => {
        const next = { ...s };
        delete next[key];
        return next;
      });
    }
  }, []);

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
    try {
      const persisted = await recordActivityRow(label, detail);
      setActivityEntries((current) => [persisted, ...current].slice(0, 20));
    } catch (err) {
      // Activity logging must never mask the primary mutation success.
      console.error("[AppData] activity log write failed", err);
    }
  }, []);

  // ---- Mutations ----------------------------------------------------------
  const createClient = useCallback((input: NewClientInput): Promise<Client> => {
    return runAction(MutationKeys.createClient, "Client saved.", async () => {
      const persisted = await createClientRow({
        name: input.name,
        company: input.company,
        email: input.email,
        phone: input.phone || undefined,
        notes: input.notes,
        status: input.status,
      });
      setClients((current) => [...current, persisted]);
      await recordActivity("Client created", `${persisted.company} was added as ${persisted.status}.`);
      return persisted;
    });
  }, [runAction, recordActivity]);

  const createProject = useCallback((clientId: string, input: NewProjectInput): Promise<Project> => {
    return runAction(MutationKeys.createProject(clientId), "Project saved.", async () => {
      const persisted = await createProjectRow({
        clientId, name: input.name, summary: input.summary, budgetSignal: input.budgetSignal,
      });
      setProjects((current) => [...current, persisted]);
      const company = clients.find((c) => c.id === clientId)?.company ?? "a client";
      await recordActivity("Project created", `${persisted.name} was created for ${company}.`);
      return persisted;
    });
  }, [runAction, clients, recordActivity]);

  const createChangeRequest = useCallback((projectId: string, clientId: string, input: NewChangeRequestInput): Promise<ChangeRequest> => {
    return runAction(MutationKeys.createChangeRequest(projectId), "Change request saved.", async () => {
      const persisted = await createChangeRequestRow({
        projectId, clientId,
        title: input.title, description: input.description,
        agencyPrice: input.agencyPrice, supplierCost: input.supplierCost,
      });
      setChangeRequests((current) => [...current, persisted]);
      await recordActivity("Change request created", `${persisted.title} was added to ${getProjectName(projectId, projects)}.`);
      return persisted;
    });
  }, [runAction, projects, recordActivity]);

  const createTimeEntry = useCallback((projectId: string, input: NewTimeEntryInput): Promise<TimeEntry> => {
    return runAction(MutationKeys.createTimeEntry(projectId), "Time entry saved.", async () => {
      const persisted = await createTimeEntryRow({
        projectId, supplierId: input.supplierId, date: input.date,
        hours: input.hours, description: input.description,
      });
      setTimeEntries((current) => [...current, persisted]);
      await recordActivity(
        "Supplier time submitted",
        `${persisted.hours} hours from ${getSupplierName(persisted.supplierId, suppliers)} were submitted for ${getProjectName(projectId, projects)}.`,
      );
      return persisted;
    });
  }, [runAction, projects, suppliers, recordActivity]);

  // Compound operation: insert payment + patch project. Not currently atomic in the DB —
  // documented in the verification report. If the second step fails, refetch projects
  // so React state matches the database, and rethrow.
  const createClientPayment = useCallback((projectId: string, input: NewClientPaymentInput): Promise<ClientPayment> => {
    return runAction(MutationKeys.createClientPayment(projectId), "Payment request saved.", async () => {
      const notes = input.notes.trim() || "Manual payment request.";
      const persisted = await createClientPaymentRow({
        projectId, amount: input.amount, dueDate: input.dueDate || undefined, notes,
      });
      try {
        await updateProjectRow(projectId, { status: "waiting_for_payment", paymentGateStatus: "blocked" });
      } catch (err) {
        // Payment row exists; project patch failed. Refetch to reconcile.
        try { setProjects(await fetchProjects()); } catch { /* leave stale */ }
        setClientPayments((current) => [...current, persisted]);
        throw err;
      }
      setClientPayments((current) => [...current, persisted]);
      setProjects((current) => current.map((project) =>
        project.id === projectId && project.status !== "completed"
          ? { ...project, status: "waiting_for_payment", paymentGateStatus: "blocked" }
          : project,
      ));
      await recordActivity("Payment requested", `${currency.format(persisted.amount)} was requested for ${getProjectName(projectId, projects)}.`);
      return persisted;
    });
  }, [runAction, projects, recordActivity]);

  // Compound operation: mark received + patch project payment gate.
  const markPaymentReceived = useCallback((paymentId: string) => {
    return runAction(MutationKeys.markPaymentReceived(paymentId), "Payment marked received.", async () => {
      const paymentToUpdate = clientPayments.find((p) => p.id === paymentId);
      const receivedDate = await markClientPaymentReceivedRow(paymentId);
      setClientPayments((current) => current.map((p) =>
        p.id === paymentId ? { ...p, status: "received", receivedDate } : p,
      ));
      if (paymentToUpdate) {
        const project = projects.find((p) => p.id === paymentToUpdate.projectId);
        const newStatus = project?.status === "waiting_for_payment" ? "paid_ready_to_start" : undefined;
        try {
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
        } catch (err) {
          try { setProjects(await fetchProjects()); } catch { /* leave stale */ }
          throw err;
        }
        await recordActivity("Payment received", `${getProjectName(paymentToUpdate.projectId, projects)} payment was marked received.`);
      }
    });
  }, [runAction, clientPayments, projects, recordActivity]);

  const updateProjectSupplierAssignment = useCallback((projectId: string, supplierId: string, assigned: boolean) => {
    return runAction(
      MutationKeys.updateProjectSupplierAssignment(projectId, supplierId),
      assigned ? "Supplier assigned." : "Supplier removed.",
      async () => {
        await setProjectSupplierAssignmentRow(projectId, supplierId, assigned);
        setProjects((current) => current.map((project) => {
          if (project.id !== projectId) return project;
          const supplierIds = assigned
            ? Array.from(new Set([...project.assignedSupplierIds, supplierId]))
            : project.assignedSupplierIds.filter((id) => id !== supplierId);
          return { ...project, assignedSupplierIds: supplierIds, updatedDate: new Date().toISOString().slice(0, 10) };
        }));
        await recordActivity(
          assigned ? "Supplier assigned" : "Supplier unassigned",
          `${getSupplierName(supplierId, suppliers)} was ${assigned ? "assigned to" : "removed from"} ${getProjectName(projectId, projects)}.`,
        );
      },
    );
  }, [runAction, projects, suppliers, recordActivity]);

  const updateTimeEntryStatus = useCallback((timeEntryId: string, status: "approved" | "rejected") => {
    return runAction(MutationKeys.updateTimeEntryStatus(timeEntryId), `Time entry ${status}.`, async () => {
      const entryToUpdate = timeEntries.find((entry) => entry.id === timeEntryId);
      await updateTimeEntryStatusRow(timeEntryId, status);
      setTimeEntries((current) => current.map((entry) =>
        entry.id === timeEntryId
          ? { ...entry, status, approvedBy: status === "approved" ? "user-yaniv" : undefined }
          : entry,
      ));
      if (entryToUpdate) {
        await recordActivity(
          status === "approved" ? "Supplier time approved" : "Supplier time rejected",
          `${entryToUpdate.hours} hours from ${getSupplierName(entryToUpdate.supplierId, suppliers)} for ${getProjectName(entryToUpdate.projectId, projects)} were ${status}.`,
        );
      }
    });
  }, [runAction, projects, suppliers, timeEntries, recordActivity]);

  const updateChangeRequestStatus = useCallback((
    changeRequestId: string,
    status: "priced" | "client_approved" | "declined",
  ) => {
    return runAction(MutationKeys.updateChangeRequestStatus(changeRequestId), "Change request updated.", async () => {
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
        await recordActivity("Change request updated", `${requestToUpdate.title} is now ${status.replace("_", " ")}.`);
      }
    });
  }, [runAction, changeRequests, recordActivity]);

  const value: AppDataValue = {
    status, error, reload: () => void loadAll(),
    clients, suppliers, supplierProfiles, supplierSkillSuggestions,
    projects, projectBriefs, scopes, scopeItems, projectPricing, phasePricing,
    approvals, changeRequests, timeEntries, clientPayments, supplierPayments,
    hourBanks, projectMessages, decisionLogs, fileLinks, activityEntries,
    createClient, createProject, createChangeRequest, createTimeEntry,
    createClientPayment, markPaymentReceived, updateProjectSupplierAssignment,
    updateTimeEntryStatus, updateChangeRequestStatus,
    isPending, getError, getSuccess, clearMutationState,
  };

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}
