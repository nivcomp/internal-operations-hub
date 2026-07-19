import { useState } from "react";
import { Layout } from "./components/Layout";
import { AppDataProvider, useAppData } from "./context/AppDataContext";
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
import type { ViewKey } from "./views";

function AppShell() {
  const {
    status, error, reload,
    clients, projects, changeRequests, timeEntries, clientPayments, hourBanks, activityEntries,
    createClient, createProject, createChangeRequest, createTimeEntry, createClientPayment,
    markPaymentReceived, updateProjectSupplierAssignment, updateTimeEntryStatus, updateChangeRequestStatus,
  } = useAppData();

  const [activeView, setActiveView] = useState<ViewKey>("dashboard");
  const [selectedClientId, setSelectedClientId] = useState<string | undefined>();
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>();
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | undefined>();

  function openClientDetail(clientId: string) { setSelectedClientId(clientId); setActiveView("client-detail"); }
  function openClientPortal(clientId: string) { setSelectedClientId(clientId); setActiveView("client-portal"); }
  function openProjectDetail(projectId: string) { setSelectedProjectId(projectId); setActiveView("project-detail"); }
  function openSupplierDetail(supplierId: string) { setSelectedSupplierId(supplierId); setActiveView("supplier-detail"); }
  function openSupplierPortal(supplierId: string) { setSelectedSupplierId(supplierId); setActiveView("supplier-portal"); }

  function reloadFromDatabase() {
    setSelectedClientId(undefined);
    setSelectedProjectId(undefined);
    setSelectedSupplierId(undefined);
    reload();
  }

  async function handleCreateClient(input: Parameters<typeof createClient>[0]) {
    const persisted = await createClient(input);
    openClientDetail(persisted.id);
    return persisted;
  }
  async function handleCreateProject(clientId: string, input: Parameters<typeof createProject>[1]) {
    const persisted = await createProject(clientId, input);
    openProjectDetail(persisted.id);
    return persisted;
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
    clients: <ClientsPage clients={clients} onClientCreate={handleCreateClient} onClientSelect={openClientDetail} />,
    "client-detail": (
      <ClientDetailPage
        selectedClientId={selectedClientId}
        clients={clients}
        projects={projects}
        changeRequests={changeRequests}
        clientPayments={clientPayments}
        hourBanks={hourBanks}
        onProjectCreate={handleCreateProject}
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
    "change-requests": <ChangeRequestsPage changeRequests={changeRequests} projects={projects} onStatusChange={updateChangeRequestStatus} />,
    "supplier-time": <SupplierTimePage projects={projects} timeEntries={timeEntries} onStatusChange={updateTimeEntryStatus} />,
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
      {status === "loading" ? (
        <div className="card" style={{ padding: "2rem", textAlign: "center" }}>
          <p>Loading data from database…</p>
        </div>
      ) : status === "error" ? (
        <div className="card" style={{ padding: "2rem" }}>
          <h2>Could not load data</h2>
          <p style={{ color: "var(--color-danger, #b91c1c)" }}>{error}</p>
          <button type="button" onClick={reloadFromDatabase}>Retry</button>
        </div>
      ) : (
        page[activeView]
      )}
    </Layout>
  );
}

function App() {
  return (
    <AppDataProvider>
      <AppShell />
    </AppDataProvider>
  );
}

export default App;
