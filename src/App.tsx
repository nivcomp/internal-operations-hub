import { useCallback, useEffect, useState } from "react";
import { Layout } from "./components/Layout";
import {
  createChangeRequestRow,
  createClientPaymentRow,
  createClientRow,
  createProjectRow,
  createTimeEntryRow,
  fetchActivityLogs,
  fetchChangeRequests,
  fetchClientPayments,
  fetchClients,
  fetchHourBanks,
  fetchProjects,
  fetchTimeEntries,
  markClientPaymentReceivedRow,
  recordActivityRow,
  setProjectSupplierAssignmentRow,
  updateChangeRequestStatusRow,
  updateProjectRow,
  updateTimeEntryStatusRow,
} from "./services/api";
import { AIWorkbenchPage } from "./pages/AIWorkbenchPage";
import { ActionQueuePage } from "./pages/ActionQueuePage";
import { ChangeRequestsPage } from "./pages/ChangeRequestsPage";
import { ClientDetailPage } from "./pages/ClientDetailPage";
import { ClientPortalPage } from "./pages/ClientPortalPage";
import { ClientsPage } from "./pages/ClientsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { PaymentsHoursPage } from "./pages/PaymentsHoursPage";
import { PricingMarginPage } from "./pages/PricingMarginPage";
import { ProjectDetailPage } from "./pages/ProjectDetailPage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { SupplierDetailPage } from "./pages/SupplierDetailPage";
import { SupplierPortalPage } from "./pages/SupplierPortalPage";
import { SupplierTimePage } from "./pages/SupplierTimePage";
import { SuppliersPage } from "./pages/SuppliersPage";
import { currency, getProjectName, getSupplierName } from "./lib/domainHelpers";
import type { ChangeRequest, Client, ClientPayment, HourBank, Project, TimeEntry } from "./types/domain";
import type { ViewKey } from "./views";

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

function App() {
  const [activeView, setActiveView] = useState<ViewKey>("dashboard");
  const [selectedClientId, setSelectedClientId] = useState<string | undefined>();
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>();
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | undefined>();
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [clientPayments, setClientPayments] = useState<ClientPayment[]>([]);
  const [hourBanks, setHourBanks] = useState<HourBank[]>([]);
  const [activityEntries, setActivityEntries] = useState<ActivityEntry[]>([]);
  const [dataStatus, setDataStatus] = useState<"loading" | "ready" | "error">("loading");
  const [dataError, setDataError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setDataStatus("loading");
    setDataError(null);
    try {
      const [c, p, cr, te, cp, hb, al] = await Promise.all([
        fetchClients(),
        fetchProjects(),
        fetchChangeRequests(),
        fetchTimeEntries(),
        fetchClientPayments(),
        fetchHourBanks(),
        fetchActivityLogs(20),
      ]);
      setClients(c);
      setProjects(p);
      setChangeRequests(cr);
      setTimeEntries(te);
      setClientPayments(cp);
      setHourBanks(hb);
      setActivityEntries(al);
      setDataStatus("ready");
    } catch (err) {
      console.error("[App] failed to load data", err);
      setDataError(err instanceof Error ? err.message : "Unknown error loading data from database.");
      setDataStatus("error");
    }
  }, []);

  useEffect(() => { void loadAll(); }, [loadAll]);

  async function recordActivity(label: string, detail: string) {
    const persisted = await recordActivityRow(label, detail);
    if (persisted) setActivityEntries((current) => [persisted, ...current].slice(0, 20));
  }

  function openClientDetail(clientId: string) {
    setSelectedClientId(clientId);
    setActiveView("client-detail");
  }

  function openClientPortal(clientId: string) {
    setSelectedClientId(clientId);
    setActiveView("client-portal");
  }

  function openProjectDetail(projectId: string) {
    setSelectedProjectId(projectId);
    setActiveView("project-detail");
  }

  function openSupplierDetail(supplierId: string) {
    setSelectedSupplierId(supplierId);
    setActiveView("supplier-detail");
  }

  function openSupplierPortal(supplierId: string) {
    setSelectedSupplierId(supplierId);
    setActiveView("supplier-portal");
  }

  function reloadFromDatabase() {
    setSelectedClientId(undefined);
    setSelectedProjectId(undefined);
    setSelectedSupplierId(undefined);
    void loadAll();
  }

  async function createClient(input: NewClientInput) {
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
    openClientDetail(persisted.id);
  }

  async function createProject(clientId: string, input: NewProjectInput) {
    const persisted = await createProjectRow({
      clientId,
      name: input.name,
      summary: input.summary,
      budgetSignal: input.budgetSignal,
    });
    if (!persisted) throw new Error("Failed to save project. Please try again.");
    setProjects((current) => [...current, persisted]);
    void recordActivity("Project created", `${persisted.name} was created for ${clients.find((client) => client.id === clientId)?.company ?? "a client"}.`);
    openProjectDetail(persisted.id);
  }

  async function createChangeRequest(projectId: string, clientId: string, input: NewChangeRequestInput) {
    const persisted = await createChangeRequestRow({
      projectId,
      clientId,
      title: input.title,
      description: input.description,
      agencyPrice: input.agencyPrice,
      supplierCost: input.supplierCost,
    });
    if (!persisted) throw new Error("Failed to save change request. Please try again.");
    setChangeRequests((current) => [...current, persisted]);
    void recordActivity("Change request created", `${persisted.title} was added to ${getProjectName(projectId, projects)}.`);
  }

  async function createTimeEntry(projectId: string, input: NewTimeEntryInput) {
    const persisted = await createTimeEntryRow({
      projectId,
      supplierId: input.supplierId,
      date: input.date,
      hours: input.hours,
      description: input.description,
    });
    if (!persisted) throw new Error("Failed to save time entry. Please try again.");
    setTimeEntries((current) => [...current, persisted]);
    void recordActivity("Supplier time submitted", `${persisted.hours} hours from ${getSupplierName(persisted.supplierId)} were submitted for ${getProjectName(projectId, projects)}.`);
  }

  async function markPaymentReceived(paymentId: string) {
    const paymentToUpdate = clientPayments.find((payment) => payment.id === paymentId);
    const receivedDate = await markClientPaymentReceivedRow(paymentId);
    if (!receivedDate) throw new Error("Failed to mark payment as received. Please try again.");
    setClientPayments((current) =>
      current.map((payment) =>
        payment.id === paymentId ? { ...payment, status: "received", receivedDate } : payment,
      ),
    );
    if (paymentToUpdate) {
      void recordActivity("Payment received", `${getProjectName(paymentToUpdate.projectId, projects)} payment was marked received.`);
      const newStatus =
        (paymentToUpdate && projects.find((p) => p.id === paymentToUpdate.projectId)?.status) === "waiting_for_payment"
          ? "paid_ready_to_start"
          : undefined;
      void updateProjectRow(paymentToUpdate.projectId, {
        paymentGateStatus: "paid",
        ...(newStatus ? { status: newStatus } : {}),
      });
      setProjects((current) =>
        current.map((project) =>
          project.id === paymentToUpdate.projectId
            ? {
                ...project,
                paymentGateStatus: "paid",
                status: project.status === "waiting_for_payment" ? "paid_ready_to_start" : project.status,
              }
            : project,
        ),
      );
    }
  }

  async function createClientPayment(projectId: string, input: NewClientPaymentInput) {
    const notes = input.notes.trim() || "Manual payment request created locally.";
    const persisted = await createClientPaymentRow({
      projectId,
      amount: input.amount,
      dueDate: input.dueDate || undefined,
      notes,
    });
    if (!persisted) throw new Error("Failed to save payment request. Please try again.");
    setClientPayments((current) => [...current, persisted]);
    void updateProjectRow(projectId, { status: "waiting_for_payment", paymentGateStatus: "blocked" });
    setProjects((current) =>
      current.map((project) =>
        project.id === projectId && project.status !== "completed"
          ? { ...project, status: "waiting_for_payment", paymentGateStatus: "blocked" }
          : project,
      ),
    );
    void recordActivity("Payment requested", `${currency.format(persisted.amount)} was requested for ${getProjectName(projectId, projects)}.`);
  }

  async function updateProjectSupplierAssignment(projectId: string, supplierId: string, assigned: boolean) {
    await setProjectSupplierAssignmentRow(projectId, supplierId, assigned);
    setProjects((current) =>
      current.map((project) => {
        if (project.id !== projectId) return project;
        const supplierIds = assigned
          ? Array.from(new Set([...project.assignedSupplierIds, supplierId]))
          : project.assignedSupplierIds.filter((id) => id !== supplierId);
        return { ...project, assignedSupplierIds: supplierIds, updatedDate: new Date().toISOString().slice(0, 10) };
      }),
    );
    void recordActivity(
      assigned ? "Supplier assigned" : "Supplier unassigned",
      `${getSupplierName(supplierId)} was ${assigned ? "assigned to" : "removed from"} ${getProjectName(projectId, projects)}.`,
    );
  }

  async function updateTimeEntryStatus(timeEntryId: string, status: "approved" | "rejected") {
    const entryToUpdate = timeEntries.find((entry) => entry.id === timeEntryId);
    await updateTimeEntryStatusRow(timeEntryId, status);
    setTimeEntries((current) =>
      current.map((entry) =>
        entry.id === timeEntryId
          ? { ...entry, status, approvedBy: status === "approved" ? "user-yaniv" : undefined }
          : entry,
      ),
    );
    if (entryToUpdate) {
      void recordActivity(
        status === "approved" ? "Supplier time approved" : "Supplier time rejected",
        `${entryToUpdate.hours} hours from ${getSupplierName(entryToUpdate.supplierId)} for ${getProjectName(entryToUpdate.projectId, projects)} were ${status}.`,
      );
    }
  }

  async function updateChangeRequestStatus(changeRequestId: string, status: "priced" | "client_approved" | "declined") {
    const requestToUpdate = changeRequests.find((request) => request.id === changeRequestId);
    await updateChangeRequestStatusRow(changeRequestId, status);
    setChangeRequests((current) =>
      current.map((request) => {
        if (request.id !== changeRequestId) return request;
        return {
          ...request,
          status,
          approvedDate: status === "client_approved" ? new Date().toISOString().slice(0, 10) : request.approvedDate,
        };
      }),
    );
    if (requestToUpdate) {
      void recordActivity("Change request updated", `${requestToUpdate.title} is now ${status.replace("_", " ")}.`);
    }
  }

  const page = {
    dashboard: (
      <DashboardPage
        clients={clients}
        projects={projects}
        changeRequests={changeRequests}
        timeEntries={timeEntries}
        activityEntries={activityEntries}
        onNavigate={setActiveView}
        onProjectSelect={openProjectDetail}
      />
    ),
    "action-queue": (
      <ActionQueuePage
        clients={clients}
        projects={projects}
        changeRequests={changeRequests}
        timeEntries={timeEntries}
        clientPayments={clientPayments}
        hourBanks={hourBanks}
        activityEntries={activityEntries}
        onProjectSelect={openProjectDetail}
        onClientSelect={openClientDetail}
        onPaymentReceived={markPaymentReceived}
        onTimeEntryStatusChange={updateTimeEntryStatus}
        onChangeRequestStatusChange={updateChangeRequestStatus}
        onResetSession={reloadFromDatabase}
      />
    ),
    clients: <ClientsPage clients={clients} onClientCreate={createClient} onClientSelect={openClientDetail} />,
    "client-detail": (
      <ClientDetailPage
        selectedClientId={selectedClientId}
        clients={clients}
        projects={projects}
        changeRequests={changeRequests}
        clientPayments={clientPayments}
        hourBanks={hourBanks}
        onProjectCreate={createProject}
        onProjectSelect={openProjectDetail}
        onClientPortalOpen={openClientPortal}
      />
    ),
    projects: <ProjectsPage clients={clients} projects={projects} onProjectSelect={openProjectDetail} />,
    "project-detail": (
      <ProjectDetailPage
        selectedProjectId={selectedProjectId}
        clients={clients}
        projects={projects}
        changeRequests={changeRequests}
        timeEntries={timeEntries}
        clientPayments={clientPayments}
        onChangeRequestCreate={createChangeRequest}
        onChangeRequestStatusChange={updateChangeRequestStatus}
        onClientPaymentCreate={createClientPayment}
        onPaymentReceived={markPaymentReceived}
        onSupplierAssignmentChange={updateProjectSupplierAssignment}
        onTimeEntryCreate={createTimeEntry}
        onTimeEntryStatusChange={updateTimeEntryStatus}
      />
    ),
    suppliers: <SuppliersPage onSupplierSelect={openSupplierDetail} />,
    "supplier-detail": (
      <SupplierDetailPage
        selectedSupplierId={selectedSupplierId}
        projects={projects}
        timeEntries={timeEntries}
        onSupplierPortalOpen={openSupplierPortal}
      />
    ),
    "pricing-margin": <PricingMarginPage />,
    "change-requests": (
      <ChangeRequestsPage
        changeRequests={changeRequests}
        projects={projects}
        onStatusChange={updateChangeRequestStatus}
      />
    ),
    "supplier-time": (
      <SupplierTimePage
        projects={projects}
        timeEntries={timeEntries}
        onStatusChange={updateTimeEntryStatus}
      />
    ),
    "payments-hours": (
      <PaymentsHoursPage
        clients={clients}
        projects={projects}
        clientPayments={clientPayments}
        hourBanks={hourBanks}
        onPaymentReceived={markPaymentReceived}
      />
    ),
    "client-portal": (
      <ClientPortalPage
        selectedClientId={selectedClientId}
        clients={clients}
        projects={projects}
        changeRequests={changeRequests}
        clientPayments={clientPayments}
        hourBanks={hourBanks}
      />
    ),
    "supplier-portal": <SupplierPortalPage selectedSupplierId={selectedSupplierId} projects={projects} timeEntries={timeEntries} />,
    "ai-workbench": <AIWorkbenchPage />,
  } satisfies Record<ViewKey, JSX.Element>;

  return (
    <Layout activeView={activeView} onNavigate={setActiveView}>
      {dataStatus === "loading" ? (
        <div className="card" style={{ padding: "2rem", textAlign: "center" }}>
          <p>Loading data from database…</p>
        </div>
      ) : dataStatus === "error" ? (
        <div className="card" style={{ padding: "2rem" }}>
          <h2>Could not load data</h2>
          <p style={{ color: "var(--color-danger, #b91c1c)" }}>{dataError}</p>
          <button type="button" onClick={reloadFromDatabase}>Retry</button>
        </div>
      ) : (
        page[activeView]
      )}
    </Layout>
  );
}

export default App;
