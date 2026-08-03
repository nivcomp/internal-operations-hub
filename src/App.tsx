import { useCallback, useEffect, useMemo, useState } from "react";
import { CommandPalette } from "./components/CommandPalette";
import { Layout } from "./components/Layout";
import { ToastProvider } from "./components/ui/Toast";
import { AppDataProvider, useAppData } from "./context/AppDataContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { OnboardingProvider, useOnboarding } from "./context/OnboardingContext";
import { ClientOnboardingWizard } from "./components/onboarding/ClientOnboardingWizard";
import { SupplierOnboardingWizard } from "./components/onboarding/SupplierOnboardingWizard";
import { AiOnboardingWorkspace } from "./components/onboarding/AiOnboardingWorkspace";
import { AgencyHomePage } from "./pages/home/AgencyHomePage";
import { ClientHomePage } from "./pages/home/ClientHomePage";
import { SupplierHomePage } from "./pages/home/SupplierHomePage";
import { NavContext, type NavApi, type RecentItem } from "./context/NavContext";
import { CopilotProvider, useCopilotScreen } from "./context/CopilotContext";
import { CopilotDock } from "./components/copilot/CopilotDock";
import { emitCopilotFormIntent } from "./lib/copilotForms";
import type { CopilotChip } from "./services/copilotApi";
import { AIWorkbenchPage } from "./pages/AIWorkbenchPage";
import { AIUsagePage } from "./pages/AIUsagePage";
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
    "home", "dashboard", "action-queue", "clients", "client-detail", "client-portal",
    "projects", "project-detail", "change-requests",
    "suppliers", "supplier-detail", "supplier-time", "supplier-portal",
    "pricing-margin", "payments-hours", "ai-workbench", "ai-usage", "access-management",
  ],
  client: ["home", "client-portal"],
  supplier: ["home", "supplier-portal"],
};

/** Tells the copilot which screen and record the user is looking at. */
function CopilotScreenRegistrar({
  view, projectId, clientId, supplierId, label,
}: {
  view: ViewKey;
  projectId?: string;
  clientId?: string;
  supplierId?: string;
  label: string;
}) {
  useCopilotScreen({
    page: view,
    label,
    entityType: view.includes("project") ? "project"
      : view.includes("client") ? "client"
      : view.includes("supplier") ? "supplier"
      : "none",
    entityId: projectId ?? clientId ?? supplierId ?? null,
    projectId: projectId ?? null,
    clientId: clientId ?? null,
    supplierId: supplierId ?? null,
  });
  return null;
}

function AppShell() {
  const { profile, signOut } = useAuth();
  const { restart: restartOnboarding } = useOnboarding();
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
  const [history, setHistory] = useState<ViewKey[]>([]);
  const [recents, setRecents] = useState<RecentItem[]>([]);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    if (!allowedViews.includes(activeView)) setActiveView(allowedViews[0]);
  }, [allowedViews, activeView]);

  const navigate = useCallback((view: ViewKey) => {
    if (!allowedViews.includes(view)) return;
    setActiveView((current) => {
      if (current !== view) setHistory((prev) => [...prev, current].slice(-25));
      return view;
    });
  }, [allowedViews]);

  const goBack = useCallback(() => {
    setHistory((prev) => {
      if (prev.length === 0) return prev;
      const next = prev.slice(0, -1);
      setActiveView(prev[prev.length - 1]);
      return next;
    });
  }, []);

  const rememberRecent = useCallback((item: RecentItem) => {
    setRecents((prev) => [item, ...prev.filter((entry) => !(entry.id === item.id && entry.kind === item.kind))].slice(0, 6));
  }, []);

  function openClientDetail(clientId: string) {
    setSelectedClientId(clientId);
    const client = clients.find((item) => item.id === clientId);
    rememberRecent({ id: clientId, kind: "client", label: client?.company ?? "Client", sublabel: client?.name });
    navigate("client-detail");
  }
  function openClientPortal(clientId: string) { setSelectedClientId(clientId); navigate("client-portal"); }
  function openProjectDetail(projectId: string) {
    setSelectedProjectId(projectId);
    const project = projects.find((item) => item.id === projectId);
    rememberRecent({ id: projectId, kind: "project", label: project?.name ?? "Project" });
    navigate("project-detail");
  }
  function openSupplierDetail(supplierId: string) {
    setSelectedSupplierId(supplierId);
    rememberRecent({ id: supplierId, kind: "supplier", label: "Supplier" });
    navigate("supplier-detail");
  }
  function openSupplierPortal(supplierId: string) { setSelectedSupplierId(supplierId); navigate("supplier-portal"); }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
      if (event.altKey && event.key === "ArrowLeft") {
        event.preventDefault();
        goBack();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goBack]);

  const navApi = useMemo<NavApi>(() => ({
    activeView,
    allowedViews,
    navigate,
    goBack,
    canGoBack: history.length > 0,
    openProject: openProjectDetail,
    openClient: openClientDetail,
    openSupplier: openSupplierDetail,
    openClientPortal,
    openSupplierPortal,
    recents,
    selectedProjectId,
    selectedClientId,
    selectedSupplierId,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [activeView, allowedViews, navigate, goBack, history.length, recents, selectedProjectId, selectedClientId, selectedSupplierId]);

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
    home:
      role === "client" ? (
        <ClientHomePage
          clientId={profile?.clientId}
          onNavigate={navigate}
          onRestartWizard={() => void restartOnboarding()}
        />
      ) : role === "supplier" ? (
        <SupplierHomePage
          supplierId={profile?.supplierId}
          onNavigate={navigate}
          onRestartWizard={() => void restartOnboarding()}
        />
      ) : (
        <AgencyHomePage onNavigate={navigate} onProjectSelect={openProjectDetail} />
      ),
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
    "ai-usage": <AIUsagePage />,
    "access-management": (
      <AccessManagementPage onClientSelect={openClientDetail} onSupplierSelect={openSupplierDetail} />
    ),
  } satisfies Record<ViewKey, JSX.Element>;

  return (
    <NavContext.Provider value={navApi}>
      <CopilotProvider
        onChip={(chip: CopilotChip) => {
          if (chip.type === "navigate") navigate(chip.view as ViewKey);
          else if (chip.type === "open_project") openProjectDetail(chip.id);
          else if (chip.type === "open_client") openClientDetail(chip.id);
          else if (chip.type === "open_supplier") openSupplierDetail(chip.id);
          else if (chip.type === "back") goBack();
          else if (chip.type === "focus_field") {
            emitCopilotFormIntent({ kind: "focus", section: "*", field: chip.field });
          } else if (chip.type === "suggest_value") {
            emitCopilotFormIntent({ kind: "suggest", section: "*", field: chip.field, value: chip.value });
          }
        }}
      >
      <CopilotScreenRegistrar
        view={activeView}
        projectId={selectedProjectId}
        clientId={selectedClientId}
        supplierId={selectedSupplierId}
        label={activeView}
      />
      <Layout
      activeView={activeView}
      onNavigate={navigate}
      allowedViews={allowedViews}
      accountLabel={profile?.fullName ?? profile?.email ?? ""}
      accountRole={role}
      onSignOut={() => void signOut()}
      onSearchOpen={() => setPaletteOpen(true)}
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
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <CopilotDock />
      </CopilotProvider>
    </NavContext.Provider>
  );
}

function OnboardingGate() {
  const { profile } = useAuth();
  const { loading, needsOnboarding, refresh } = useOnboarding();
  const { reload } = useAppData();
  const [useClassicForm, setUseClassicForm] = useState(false);

  async function finishOnboarding() {
    await refresh();
    reload();
  }

  if (loading) {
    return (
      <div className="auth-screen">
        <div className="card auth-card"><p>Preparing your workspace…</p></div>
      </div>
    );
  }

  if (needsOnboarding && (profile?.role === "client" || profile?.role === "supplier")) {
    if (useClassicForm) {
      return profile.role === "client"
        ? <ClientOnboardingWizard onDone={() => void finishOnboarding()} />
        : <SupplierOnboardingWizard onDone={() => void finishOnboarding()} />;
    }
    return (
      <AiOnboardingWorkspace
        role={profile.role}
        onDone={() => void finishOnboarding()}
        onUseForm={() => setUseClassicForm(true)}
      />
    );
  }

  return <AppShell />;
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
      <ToastProvider>
        <OnboardingProvider>
          <OnboardingGate />
        </OnboardingProvider>
      </ToastProvider>
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
