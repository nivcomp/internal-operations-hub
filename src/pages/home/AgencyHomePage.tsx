import { useEffect, useMemo, useState } from "react";
import { AgencySetupAssistant } from "../../components/onboarding/AgencySetupAssistant";
import { InviteDialog } from "../../components/access/InviteDialog";
import { EmptyState } from "../../components/ui/EmptyState";
import { Disclosure } from "../../components/ui/Disclosure";
import { useAppData } from "../../context/AppDataContext";
import { listRegistrations, type PublicRegistration } from "../../services/registrationApi";
import {
  getNeedsPricingItems, getSupplierTimeApprovalItems, getWaitingApprovalItems, getWaitingPaymentItems,
} from "../../lib/actionQueue";
import type { ViewKey } from "../../views";

type Props = {
  onNavigate: (view: ViewKey) => void;
  onProjectSelect: (projectId: string) => void;
};

export function AgencyHomePage({ onNavigate, onProjectSelect }: Props) {
  const { clients, suppliers, projects, changeRequests, clientPayments, timeEntries } = useAppData();
  const [inviteRole, setInviteRole] = useState<"client" | "supplier" | null>(null);
  const [registrations, setRegistrations] = useState<PublicRegistration[]>([]);

  useEffect(() => {
    void (async () => {
      try { setRegistrations(await listRegistrations()); } catch { /* informational only */ }
    })();
  }, []);

  const newRegistrations = registrations.filter((item) => !item.seen_by_admin && item.status !== "rejected");

  const needsPricing = useMemo(() => getNeedsPricingItems(projects, changeRequests), [projects, changeRequests]);
  const waitingApproval = useMemo(() => getWaitingApprovalItems(projects, changeRequests), [projects, changeRequests]);
  const waitingPayment = useMemo(() => getWaitingPaymentItems(projects, clientPayments), [projects, clientPayments]);
  const waitingTime = useMemo(() => getSupplierTimeApprovalItems(timeEntries), [timeEntries]);
  const pendingSuppliers = suppliers.filter((s) => s.status === "pending_review");

  const attention = [
    { label: "Projects waiting for pricing", count: needsPricing.length, view: "action-queue" as ViewKey },
    { label: "Clients waiting for a response", count: waitingApproval.length, view: "action-queue" as ViewKey },
    { label: "Suppliers waiting for approval", count: pendingSuppliers.length, view: "suppliers" as ViewKey },
    { label: "Payments waiting", count: waitingPayment.length, view: "payments-hours" as ViewKey },
    { label: "Time entries waiting", count: waitingTime.length, view: "supplier-time" as ViewKey },
  ];
  const total = attention.reduce((sum, item) => sum + item.count, 0);
  const firstQueueItem = [...needsPricing, ...waitingApproval].find((item) => item.type === "project");
  const firstProject = firstQueueItem && firstQueueItem.type === "project" ? firstQueueItem.project : projects[0];

  return (
    <div className="home-screen">
      <header className="home-head">
        <p className="eyebrow">Your day</p>
        <h1>{total > 0 ? `${total} ${total === 1 ? "item needs" : "items need"} your attention` : "Nothing is waiting on you"}</h1>
        <p className="home-subtitle">Everything else stays out of the way until you need it.</p>
      </header>

      {newRegistrations.length ? (
        <button type="button" className="card home-alert" onClick={() => onNavigate("access-management")}>
          <span>
            {newRegistrations.length === 1
              ? "1 new person registered themselves"
              : `${newRegistrations.length} new people registered themselves`}
          </span>
          <strong>Review</strong>
        </button>
      ) : null}

      <section className="card add-people">
        <h2>Add people</h2>
        <p className="form-note">Send a personal invitation in a few seconds — the AI assistant collects the rest.</p>
        <div className="add-people-grid">
          <button type="button" className="add-people-card" onClick={() => setInviteRole("client")}>
            <strong>Invite a client</strong>
            <span>Company, name, email — then share the link.</span>
          </button>
          <button type="button" className="add-people-card" onClick={() => setInviteRole("supplier")}>
            <strong>Invite a supplier</strong>
            <span>Name and email — profile setup happens in chat.</span>
          </button>
        </div>
        <div className="action-row compact">
          <button type="button" onClick={() => onNavigate("access-management")}>Manage access and links</button>
        </div>
      </section>

      {clients.length === 0 ? (
        <EmptyState
          title="No clients yet"
          description="Create your first client, then add a project for them. The setup assistant below covers the rest."
          action={{ label: "Create your first client", onClick: () => onNavigate("clients") }}
        />
      ) : (
        <>
          <div className="card home-next">
            <span className="eyebrow">Next action</span>
            <h2>{firstProject ? `Review ${firstProject.name}` : "Create your first project"}</h2>
            <p>{total > 0 ? "Start with the item that blocks the most work." : "You are up to date. Move a project forward when you are ready."}</p>
            <button
              type="button"
              className="primary-button"
              onClick={() => (firstProject ? onProjectSelect(firstProject.id) : onNavigate("projects"))}
            >
              {firstProject ? "Review next project" : "Go to projects"}
            </button>
          </div>

          <div className="home-facts">
            {attention.map((item) => (
              <button key={item.label} type="button" className="card home-fact-button" onClick={() => onNavigate(item.view)}>
                <span>{item.label}</span>
                <strong>{item.count}</strong>
              </button>
            ))}
          </div>
        </>
      )}

      <AgencySetupAssistant
        hasClient={clients.length > 0}
        hasSupplier={suppliers.length > 0}
        hasProject={projects.length > 0}
        onCreateClient={() => onNavigate("clients")}
        onCreateSupplier={() => onNavigate("suppliers")}
        onCreateProject={() => onNavigate("projects")}
      />

      <Disclosure title="More details">
        <p>The full dashboard, action queue and reporting stay available.</p>
        <div className="action-row compact">
          <button type="button" onClick={() => onNavigate("dashboard")}>Open dashboard</button>
          <button type="button" onClick={() => onNavigate("action-queue")}>Open action queue</button>
          <button type="button" onClick={() => onNavigate("ai-workbench")}>Ask the assistant</button>
        </div>
      </Disclosure>

      {inviteRole ? (
        <InviteDialog role={inviteRole} onClose={() => setInviteRole(null)} />
      ) : null}
    </div>
  );
}