import { useState } from "react";
import { Layout } from "./components/Layout";
import {
  changeRequests as initialChangeRequests,
  clientPayments as initialClientPayments,
  clients as initialClients,
  hourBanks as initialHourBanks,
  projects as initialProjects,
  timeEntries as initialTimeEntries,
} from "./data/mockData";
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

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function App() {
  const [activeView, setActiveView] = useState<ViewKey>("dashboard");
  const [selectedClientId, setSelectedClientId] = useState<string | undefined>();
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>();
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | undefined>();
  const [clients, setClients] = useState<Client[]>(initialClients);
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>(initialChangeRequests);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>(initialTimeEntries);
  const [clientPayments, setClientPayments] = useState<ClientPayment[]>(initialClientPayments);
  const [hourBanks] = useState<HourBank[]>(initialHourBanks);
  const [activityEntries, setActivityEntries] = useState<ActivityEntry[]>([]);

  function recordActivity(label: string, detail: string) {
    const entry: ActivityEntry = {
      id: createId("activity"),
      createdAt: new Date().toLocaleString("en-GB", {
        dateStyle: "short",
        timeStyle: "short",
      }),
      label,
      detail,
    };
    setActivityEntries((current) => [entry, ...current].slice(0, 20));
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

  function resetLocalSession() {
    setClients(initialClients);
    setProjects(initialProjects);
    setChangeRequests(initialChangeRequests);
    setTimeEntries(initialTimeEntries);
    setClientPayments(initialClientPayments);
    setSelectedClientId(undefined);
    setSelectedProjectId(undefined);
    setSelectedSupplierId(undefined);
    setActiveView("action-queue");
    const entry: ActivityEntry = {
      id: createId("activity"),
      createdAt: new Date().toLocaleString("en-GB", {
        dateStyle: "short",
        timeStyle: "short",
      }),
      label: "Session reset",
      detail: "Local workflow state was restored from mock seed data.",
    };
    setActivityEntries([entry]);
  }

  function createClient(input: NewClientInput) {
    const client: Client = {
      id: createId("client"),
      ...input,
      phone: input.phone || undefined,
    };
    setClients((current) => [...current, client]);
    recordActivity("Client created", `${client.company} was added as ${client.status}.`);
    openClientDetail(client.id);
  }

  function createProject(clientId: string, input: NewProjectInput) {
    const project: Project = {
      id: createId("project"),
      clientId,
      name: input.name,
      status: "discovery_in_progress",
      summary: input.summary,
      budgetSignal: input.budgetSignal,
      paymentGateStatus: "blocked",
      assignedSupplierIds: [],
      createdDate: new Date().toISOString().slice(0, 10),
      updatedDate: new Date().toISOString().slice(0, 10),
    };
    setProjects((current) => [...current, project]);
    recordActivity("Project created", `${project.name} was created for ${clients.find((client) => client.id === clientId)?.company ?? "a client"}.`);
    openProjectDetail(project.id);
  }

  function createChangeRequest(projectId: string, clientId: string, input: NewChangeRequestInput) {
    const request: ChangeRequest = {
      id: createId("change"),
      projectId,
      requestedByClientId: clientId,
      title: input.title,
      description: input.description,
      status: "agency_review",
      agencyPrice: input.agencyPrice,
      supplierCost: input.supplierCost,
    };
    setChangeRequests((current) => [...current, request]);
    recordActivity("Change request created", `${request.title} was added to ${getProjectName(projectId, projects)}.`);
  }

  function createTimeEntry(projectId: string, input: NewTimeEntryInput) {
    const entry: TimeEntry = {
      id: createId("time"),
      projectId,
      supplierId: input.supplierId,
      date: input.date,
      hours: input.hours,
      description: input.description,
      status: "submitted",
    };
    setTimeEntries((current) => [...current, entry]);
    recordActivity("Supplier time submitted", `${entry.hours} hours from ${getSupplierName(entry.supplierId)} were submitted for ${getProjectName(projectId, projects)}.`);
  }

  function markPaymentReceived(paymentId: string) {
    const receivedDate = new Date().toISOString().slice(0, 10);
    const paymentToUpdate = clientPayments.find((payment) => payment.id === paymentId);
    setClientPayments((current) =>
      current.map((payment) =>
        payment.id === paymentId ? { ...payment, status: "received", receivedDate } : payment,
      ),
    );
    if (paymentToUpdate) {
      recordActivity("Payment received", `${getProjectName(paymentToUpdate.projectId, projects)} payment was marked received.`);
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

  function createClientPayment(projectId: string, input: NewClientPaymentInput) {
    const payment: ClientPayment = {
      id: createId("client-payment"),
      projectId,
      amount: input.amount,
      currency: "GBP",
      status: "requested",
      dueDate: input.dueDate || undefined,
      notes: input.notes.trim() || "Manual payment request created locally.",
    };
    setClientPayments((current) => [...current, payment]);
    setProjects((current) =>
      current.map((project) =>
        project.id === projectId && project.status !== "completed"
          ? { ...project, status: "waiting_for_payment", paymentGateStatus: "blocked" }
          : project,
      ),
    );
    recordActivity("Payment requested", `${currency.format(payment.amount)} was requested for ${getProjectName(projectId, projects)}.`);
  }

  function updateProjectSupplierAssignment(projectId: string, supplierId: string, assigned: boolean) {
    setProjects((current) =>
      current.map((project) => {
        if (project.id !== projectId) return project;
        const supplierIds = assigned
          ? Array.from(new Set([...project.assignedSupplierIds, supplierId]))
          : project.assignedSupplierIds.filter((id) => id !== supplierId);
        return { ...project, assignedSupplierIds: supplierIds, updatedDate: new Date().toISOString().slice(0, 10) };
      }),
    );
    recordActivity(
      assigned ? "Supplier assigned" : "Supplier unassigned",
      `${getSupplierName(supplierId)} was ${assigned ? "assigned to" : "removed from"} ${getProjectName(projectId, projects)}.`,
    );
  }

  function updateTimeEntryStatus(timeEntryId: string, status: "approved" | "rejected") {
    const entryToUpdate = timeEntries.find((entry) => entry.id === timeEntryId);
    setTimeEntries((current) =>
      current.map((entry) =>
        entry.id === timeEntryId
          ? { ...entry, status, approvedBy: status === "approved" ? "user-yaniv" : undefined }
          : entry,
      ),
    );
    if (entryToUpdate) {
      recordActivity(
        status === "approved" ? "Supplier time approved" : "Supplier time rejected",
        `${entryToUpdate.hours} hours from ${getSupplierName(entryToUpdate.supplierId)} for ${getProjectName(entryToUpdate.projectId, projects)} were ${status}.`,
      );
    }
  }

  function updateChangeRequestStatus(changeRequestId: string, status: "priced" | "client_approved" | "declined") {
    const requestToUpdate = changeRequests.find((request) => request.id === changeRequestId);
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
      recordActivity("Change request updated", `${requestToUpdate.title} is now ${status.replace("_", " ")}.`);
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
        onResetSession={resetLocalSession}
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
      {page[activeView]}
    </Layout>
  );
}

export default App;
