import { useEffect, useState } from "react";
import { Layout } from "./components/Layout";
import { AppDataProvider, useAppData } from "./context/AppDataContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { AIWorkbenchPage } from "./pages/AIWorkbenchPage";
import { AccessManagementPage } from "./pages/AccessManagementPage";
import { ActionQueuePage } from "./pages/ActionQueuePage";
import { ChangeRequestsPage } from "./pages/ChangeRequestsPage";
import { ClientDetailPage } from "./pages/ClientDetailPage";
import { ClientPortalPage } from "./pages/ClientPortalPage";
import { ClientsPage } from "./pages/ClientsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { PaymentsHoursPage } from "./pages/PaymentsHoursPage";
import { PricingMarginPage } from "./pages/PricingMarginPage";
import { ProjectDetailPage } from "./pages/ProjectDetailPage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { SupplierDetailPage } from "./pages/SupplierDetailPage";
import { SupplierPortalPage } from "./pages/SupplierPortalPage";
import { SupplierTimePage } from "./pages/SupplierTimePage";
import { SuppliersPage } from "./pages/SuppliersPage";
import type { UserRole } from "./types/domain";
import type { ViewKey } from "./views";

const roleViews: Record<UserRole, ViewKey[]> = {
  agency_admin: [
    "dashboard", "action-queue", "clients", "client-detail", "client-portal",
    "projects", "project-detail", "change-requests",
    "suppliers", "supplier-detail", "supplier-time", "supplier-portal",
    "pricing-margin", "payments-hours", "ai-workbench", "access-management",
  ],
  client: ["client-portal"],
  supplier: ["supplier-portal"],
};

function AppShell() {
  const { profile, signOut } = useAuth();
  const {
    status, error, reload,
    clients, projects, changeRequests, timeEntries, clientPayments, hourBanks, activityEntries,
    createClient, createProject, createChangeRequest, createTimeEntry, createClientPayment,
    markPaymentReceived, updateProjectSupplierAssignment, updateTimeEntryStatus, updateChangeRequestStatus,
  } = useAppData();

  const role: UserRole = profile?.role ?? "client";
  const allowedViews = roleViews[role];

  const [activeView, setActiveView] = useState<ViewKey>(allowedViews[0]);
  const [selectedClientId, setSelectedClientId] = useState<string | undefined>(profile?.clientId);
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>();
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | undefined>(profile?.supplierId);

  useEffect(() => {
    if (!allowedViews.includes(activeView)) setActiveView(allowedViews[0]);
  }, [allowedViews, activeView]);

  function navigate(view: ViewKey) {
    if (allowedViews.includes(view)) setActiveView(view);
  }

  function openClientDetail(clientId: string) { setSelectedClientId(clientId); navigate("client-detail"); }
  function openClientPortal(clientId: string) { setSelectedClientId(clientId); navigate("client-portal"); }
  function openProjectDetail(projectId: string) { setSelectedProjectId(projectId); navigate("project-detail"); }
  function openSupplierDetail(supplierId: string) { setSelectedSupplierId(supplierId); navigate("supplier-detail"); }
  function openSupplierPortal(supplierId: string) { setSelectedSupplierId(supplierId); navigate("supplier-portal"); }

  function reloadFromDatabase() {
    setSelectedClientId(profile?.clientId);
    setSelectedProjectId(undefined);
    setSelectedSupplierId(profile?.supplierId);
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
        onNavigate={navigate}
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
        selectedClientId={role === "client" ? profile?.clientId : selectedClientId}
        clients={clients}
        projects={projects}
        changeRequests={changeRequests}
        clientPayments={clientPayments}
        hourBanks={hourBanks}
        isPreview={role === "agency_admin"}
      />
    ),
    "supplier-portal": (
      <SupplierPortalPage
        selectedSupplierId={role === "supplier" ? profile?.supplierId : selectedSupplierId}
        projects={projects}
        timeEntries={timeEntries}
        isPreview={role === "agency_admin"}
      />
    ),
    "ai-workbench": <AIWorkbenchPage />,
    "access-management": (
      <AccessManagementPage onClientSelect={openClientDetail} onSupplierSelect={openSupplierDetail} />
    ),
  } satisfies Record<ViewKey, JSX.Element>;

  return (
    <Layout
      activeView={activeView}
      onNavigate={navigate}
      allowedViews={allowedViews}
      accountLabel={profile?.fullName ?? profile?.email ?? ""}
      accountRole={role}
      onSignOut={() => void signOut()}
    >
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

function AuthGate() {
  const { status, profileError, signOut } = useAuth();
  const [isResetRoute, setIsResetRoute] = useState(
    () => window.location.pathname === "/reset-password" || window.location.hash.includes("type=recovery"),
  );

  function leaveResetRoute() {
    setIsResetRoute(false);
    if (window.location.pathname === "/reset-password") window.history.replaceState({}, "", "/");
  }

  if (isResetRoute) return <ResetPasswordPage onDone={leaveResetRoute} />;

  if (status === "loading") {
    return (
      <div className="auth-screen">
        <div className="card auth-card"><p>Checking your session…</p></div>
      </div>
    );
  }
  if (status === "signed_out") return <LoginPage />;
  if (status === "no_profile") {
    return (
      <div className="auth-screen">
        <div className="card auth-card">
          <h1 style={{ fontSize: "1.15rem" }}>No access yet</h1>
          <p className="form-error">{profileError ?? "This account has no profile."}</p>
          <button type="button" onClick={() => void signOut()}>Sign out</button>
        </div>
      </div>
    );
  }

  return (
    <AppDataProvider>
      <AppShell />
    </AppDataProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}

export default App;
