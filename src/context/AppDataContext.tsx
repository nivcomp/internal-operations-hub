import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import {
  createChangeRequestRow,
  createClientChangeRequestRow,
  createClientPaymentRow,
  createClientRow,
  createProjectMessageRow,
  createProjectRow,
  createSupplierProfileRow,
  createSupplierRow,
  createTimeEntryRow,
  deleteSupplierRow,
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
  updateApprovalStatusRow,
  updateChangeRequestStatusRow,
  updateClientRow,
  updateProjectRow,
  updateTimeEntryRow,
  updateTimeEntryStatusRow,
} from "../services/api";
import { currency, getProjectName, getSupplierName } from "../lib/domainHelpers";
import { supabase } from "../integrations/supabase/client";
import {
  fetchEstimateSummaries, fetchProjectSchedules, saveProjectScheduleRow, type EstimateSummary,
} from "../services/scheduleApi";
import type { ProjectSchedule } from "../lib/scheduling";
import { onAnyEstimationChanged } from "../lib/estimationEvents";
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
export type NewSupplierInput = {
  name: string;
  email: string;
  phone: string;
  country: string;
  timezone: string;
  status: Supplier["status"];
  mainSkills: string[];
  hourlyRate: number;
  currency: string;
  weeklyAvailabilityHours: number;
  notes: string;
};
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
  projectSchedules: ProjectSchedule[];
  estimateSummaries: EstimateSummary[];
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
  updateClient: (clientId: string, input: NewClientInput) => Promise<Client>;
  createSupplier: (input: NewSupplierInput) => Promise<Supplier>;
  createProject: (clientId: string, input: NewProjectInput) => Promise<Project>;
  createChangeRequest: (projectId: string, clientId: string, input: NewChangeRequestInput) => Promise<ChangeRequest>;
  submitClientChangeRequest: (projectId: string, clientId: string, input: { title: string; description: string }) => Promise<ChangeRequest>;
  createTimeEntry: (projectId: string, input: NewTimeEntryInput) => Promise<TimeEntry>;
  updateTimeEntry: (timeEntryId: string, patch: { date: string; hours: number; description: string }) => Promise<void>;
  createClientPayment: (projectId: string, input: NewClientPaymentInput) => Promise<ClientPayment>;
  updateApprovalStatus: (approvalId: string, status: "approved" | "rejected", notes?: string) => Promise<void>;
  createProjectMessage: (projectId: string, body: string, visibility: ProjectMessage["visibility"], authorRole: ProjectMessage["authorRole"]) => Promise<void>;
  markPaymentReceived: (paymentId: string) => Promise<void>;
  updateProjectSupplierAssignment: (projectId: string, supplierId: string, assigned: boolean) => Promise<void>;
  updateTimeEntryStatus: (timeEntryId: string, status: "approved" | "rejected") => Promise<void>;
  updateChangeRequestStatus: (
    changeRequestId: string,
    status: "priced" | "client_approved" | "declined",
  ) => Promise<void>;
  saveProjectSchedule: (projectId: string, patch: Partial<ProjectSchedule>) => Promise<ProjectSchedule>;
  refreshCommercials: () => Promise<void>;
  /** Project ids that changed in the database since you last opened them. */
  liveUpdates: Record<string, number>;
  markProjectSeen: (projectId: string) => void;
} & MutationHelpers;

// Mutation keys — stable strings used to look up pending/error/success state
// from any component. Format: <domain>:<action>[:<id>].
export const MutationKeys = {
  createClient: "client:create",
  updateClient: (clientId: string) => `client:update:${clientId}`,
  createSupplier: "supplier:create",
  createProject: (clientId: string) => `project:create:${clientId}`,
  createChangeRequest: (projectId: string) => `changeRequest:create:${projectId}`,
  submitClientChangeRequest: (projectId: string) => `changeRequest:client:${projectId}`,
  updateChangeRequestStatus: (id: string) => `changeRequest:status:${id}`,
  createTimeEntry: (projectId: string) => `timeEntry:create:${projectId}`,
  updateTimeEntry: (id: string) => `timeEntry:update:${id}`,
  updateTimeEntryStatus: (id: string) => `timeEntry:status:${id}`,
  updateApprovalStatus: (id: string) => `approval:status:${id}`,
  createProjectMessage: (projectId: string) => `message:create:${projectId}`,
  createClientPayment: (projectId: string) => `payment:create:${projectId}`,
  markPaymentReceived: (id: string) => `payment:receive:${id}`,
  updateProjectSupplierAssignment: (projectId: string, supplierId: string) =>
    `assignment:${projectId}:${supplierId}`,
  saveProjectSchedule: (projectId: string) => `schedule:save:${projectId}`,
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
  const [projectSchedules, setProjectSchedules] = useState<ProjectSchedule[]>([]);
  const [estimateSummaries, setEstimateSummaries] = useState<EstimateSummary[]>([]);

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
      try {
        const [sched, estSummaries] = await Promise.all([fetchProjectSchedules(), fetchEstimateSummaries()]);
        setProjectSchedules(sched);
        setEstimateSummaries(estSummaries);
      } catch (err) {
        // Commercial rollups are additive; never block the operational data load.
        console.error("[AppData] commercial rollup load failed", err);
      }
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

  const updateClient = useCallback((clientId: string, input: NewClientInput): Promise<Client> => {
    return runAction(MutationKeys.updateClient(clientId), "Client details updated.", async () => {
      const persisted = await updateClientRow(clientId, {
        ...input,
        phone: input.phone || undefined,
      });
      setClients((current) => current.map((row) => (row.id === clientId ? persisted : row)));
      await recordActivity("Client updated", `${persisted.company} contact details were updated.`);
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

  const createSupplier = useCallback((input: NewSupplierInput): Promise<Supplier> => {
    return runAction(MutationKeys.createSupplier, "Supplier saved.", async () => {
      const persisted = await createSupplierRow({
        name: input.name,
        email: input.email,
        phone: input.phone || undefined,
        country: input.country,
        timezone: input.timezone,
        status: input.status,
      });
      let profile: SupplierProfile;
      try {
        profile = await createSupplierProfileRow({
          supplierId: persisted.id,
          mainSkills: input.mainSkills,
          hourlyRate: input.hourlyRate,
          currency: input.currency,
          weeklyAvailabilityHours: input.weeklyAvailabilityHours,
          notes: input.notes,
        });
      } catch (err) {
        // Roll the supplier row back so a failed save leaves no half-created record.
        try { await deleteSupplierRow(persisted.id); } catch { /* surfaced by the error below */ }
        throw err;
      }
      setSuppliers((current) => [...current, persisted]);
      setSupplierProfiles((current) => [...current.filter((p) => p.supplierId !== persisted.id), profile]);
      await recordActivity("Supplier created", `${persisted.name} was added as ${persisted.status.replace("_", " ")}.`);
      return persisted;
    });
  }, [runAction, recordActivity]);

  const submitClientChangeRequest = useCallback((projectId: string, clientId: string, input: { title: string; description: string }): Promise<ChangeRequest> => {
    return runAction(MutationKeys.submitClientChangeRequest(projectId), "Change request sent to the agency.", async () => {
      const persisted = await createClientChangeRequestRow({
        projectId, clientId, title: input.title, description: input.description,
      });
      setChangeRequests((current) => [...current, persisted]);
      await recordActivity("Client change request", `${persisted.title} was requested by the client.`);
      return persisted;
    });
  }, [runAction, recordActivity]);

  const updateTimeEntry = useCallback((timeEntryId: string, patch: { date: string; hours: number; description: string }) => {
    return runAction(MutationKeys.updateTimeEntry(timeEntryId), "Time entry updated.", async () => {
      const persisted = await updateTimeEntryRow(timeEntryId, patch);
      setTimeEntries((current) => current.map((entry) => (entry.id === timeEntryId ? persisted : entry)));
    });
  }, [runAction]);

  const updateApprovalStatus = useCallback((approvalId: string, status: "approved" | "rejected", notes?: string) => {
    return runAction(MutationKeys.updateApprovalStatus(approvalId), `Approval ${status}.`, async () => {
      const persisted = await updateApprovalStatusRow(approvalId, status, notes);
      setApprovals((current) => current.map((approval) => (approval.id === approvalId ? persisted : approval)));
      await recordActivity(
        status === "approved" ? "Scope approved" : "Scope declined",
        `${getProjectName(persisted.projectId, projects)} scope approval was ${status}.`,
      );
    });
  }, [runAction, projects, recordActivity]);

  const createProjectMessage = useCallback((
    projectId: string,
    body: string,
    visibility: ProjectMessage["visibility"],
    authorRole: ProjectMessage["authorRole"],
  ) => {
    return runAction(MutationKeys.createProjectMessage(projectId), "Message sent.", async () => {
      const persisted = await createProjectMessageRow({ projectId, authorRole, body, visibility });
      setProjectMessages((current) => [...current, persisted]);
    });
  }, [runAction]);

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

  const refreshCommercials = useCallback(async () => {
    try {
      const [sched, estSummaries] = await Promise.all([fetchProjectSchedules(), fetchEstimateSummaries()]);
      setProjectSchedules(sched);
      setEstimateSummaries(estSummaries);
    } catch (err) {
      console.error("[AppData] commercial refresh failed", err);
    }
  }, []);

  // Keep the shared commercial rollup in sync after Copilot or an estimate
  // screen changes project_estimates. Simple, Advanced and the client portal
  // therefore read the same freshly loaded canonical record.
  useEffect(() => onAnyEstimationChanged(() => { void refreshCommercials(); }), [refreshCommercials]);

  // ---- Live sync ----------------------------------------------------------
  // Everything the client does in their own portal is written to the same
  // shared database. Realtime keeps the agency view in sync without a refresh.
  const [liveUpdates, setLiveUpdates] = useState<Record<string, number>>({});
  const markProjectSeen = useCallback((projectId: string) => {
    setLiveUpdates((current) => {
      if (!(projectId in current)) return current;
      const next = { ...current };
      delete next[projectId];
      return next;
    });
  }, []);

  const refreshTimers = useRef<Record<string, number>>({});
  const scheduleRefresh = useCallback((key: string, fn: () => Promise<void>) => {
    window.clearTimeout(refreshTimers.current[key]);
    refreshTimers.current[key] = window.setTimeout(() => { void fn(); }, 400);
  }, []);

  useEffect(() => {
    const timers = refreshTimers.current;
    const touch = (row: any) => {
      const projectId = row?.project_id;
      if (typeof projectId === "string" && projectId) {
        setLiveUpdates((current) => ({ ...current, [projectId]: Date.now() }));
      }
    };

    const channel = supabase.channel("agency-live-sync");
    const listen = (table: string, onChange: () => void) => {
      channel.on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table },
        (payload: any) => {
          touch(payload.new ?? payload.old);
          onChange();
        },
      );
    };

    listen("projects", () => scheduleRefresh("projects", async () => {
      setProjects(await fetchProjects());
    }));
    listen("project_messages", () => scheduleRefresh("messages", async () => {
      setProjectMessages(await fetchProjectMessages());
    }));
    listen("approvals", () => scheduleRefresh("approvals", async () => {
      setApprovals(await fetchApprovals());
    }));
    listen("change_requests", () => scheduleRefresh("changeRequests", async () => {
      setChangeRequests(await fetchChangeRequests());
    }));
    // Chat, questions, prototype decisions and signatures have no local
    // collection here — they only flag the project as having a fresh update.
    listen("chat_messages", () => {});
    listen("project_questions", () => {});
    listen("prototype_approvals", () => {});
    listen("proposal_signatures", () => {});

    channel.subscribe();
    return () => {
      Object.values(timers).forEach((id) => window.clearTimeout(id));
      void supabase.removeChannel(channel);
    };
  }, [scheduleRefresh]);

  const saveProjectSchedule = useCallback((projectId: string, patch: Partial<ProjectSchedule>) => {
    return runAction(MutationKeys.saveProjectSchedule(projectId), "Schedule saved.", async () => {
      const persisted = await saveProjectScheduleRow(projectId, patch);
      setProjectSchedules((current) => {
        const exists = current.some((row) => row.projectId === projectId);
        return exists
          ? current.map((row) => (row.projectId === projectId ? persisted : row))
          : [...current, persisted];
      });
      return persisted;
    });
  }, [runAction]);

  const value: AppDataValue = {
    status, error, reload: () => void loadAll(),
    clients, suppliers, supplierProfiles, supplierSkillSuggestions,
    projects, projectBriefs, scopes, scopeItems, projectPricing, phasePricing,
    approvals, changeRequests, timeEntries, clientPayments, supplierPayments,
    hourBanks, projectMessages, decisionLogs, fileLinks, activityEntries,
    projectSchedules, estimateSummaries,
    createClient, updateClient, createSupplier, createProject, createChangeRequest,
    submitClientChangeRequest, createTimeEntry, updateTimeEntry,
    updateApprovalStatus, createProjectMessage,
    createClientPayment, markPaymentReceived, updateProjectSupplierAssignment,
    updateTimeEntryStatus, updateChangeRequestStatus,
    saveProjectSchedule, refreshCommercials,
    liveUpdates, markProjectSeen,
    isPending, getError, getSuccess, clearMutationState,
  };

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}
