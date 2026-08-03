import { useMemo } from "react";
import { StatusBadge } from "../../components/StatusBadge";
import { EmptyState } from "../../components/ui/EmptyState";
import { Disclosure } from "../../components/ui/Disclosure";
import { ProjectChat } from "../../components/ProjectChat";
import { useAppData } from "../../context/AppDataContext";
import { statusLabels } from "../../lib/domainHelpers";
import type { ViewKey } from "../../views";

type Props = { clientId?: string; onNavigate: (view: ViewKey) => void; onRestartWizard: () => void };

export function ClientHomePage({ clientId, onNavigate, onRestartWizard }: Props) {
  const { clients, projects, approvals, changeRequests, clientPayments, projectSchedules, estimateSummaries } = useAppData();

  const client = clients.find((c) => c.id === clientId);
  const project = useMemo(
    () => projects.filter((p) => p.clientId === clientId).slice(-1)[0],
    [projects, clientId],
  );

  if (!project) {
    return (
      <div className="home-screen">
        <EmptyState
          title="No project yet"
          description="Let's create your first project together. It takes a few minutes and nothing is committed until you approve it."
          action={{ label: "Start defining my project", onClick: onRestartWizard }}
        />
      </div>
    );
  }

  const schedule = projectSchedules.find((s) => s.projectId === project.id);
  const estimate = estimateSummaries.find((e) => e.projectId === project.id);
  const pendingApproval = approvals.find((a) => a.projectId === project.id && a.status === "pending");
  const duePayment = clientPayments.find((p) => p.projectId === project.id && p.status !== "received");
  const pricedChange = changeRequests.find((c) => c.projectId === project.id && c.status === "priced");

  const nextAction = pendingApproval
    ? { label: "Review and approve the proposal", detail: "A proposal is waiting for your decision.", view: "client-portal" as ViewKey }
    : pricedChange
      ? { label: "Review a priced change", detail: "A change request has been priced for you.", view: "client-portal" as ViewKey }
      : duePayment
        ? { label: "Review the payment request", detail: "Work starts once payment is confirmed.", view: "client-portal" as ViewKey }
        : { label: "Continue project definition", detail: "Yaniv is reviewing your brief. You can add detail any time.", view: "client-portal" as ViewKey };

  const budgetRange = estimate && estimate.clientVisible
    ? `${Math.round(estimate.estimatedBudgetMin).toLocaleString()} – ${Math.round(estimate.estimatedBudgetMax).toLocaleString()} ${estimate.currency}`
    : project.budgetSignal || "Being prepared";

  return (
    <div className="home-screen">
      <header className="home-head">
        <p className="eyebrow">{client?.company ?? "Your workspace"}</p>
        <h1>{project.name}</h1>
        <p className="home-subtitle">Here is where your project stands and what needs you next.</p>
      </header>

      <div className="card home-next">
        <span className="eyebrow">Your next step</span>
        <h2>{nextAction.label}</h2>
        <p>{nextAction.detail}</p>
        <button type="button" className="primary-button" onClick={() => onNavigate(nextAction.view)}>
          {nextAction.label}
        </button>
      </div>

      <div className="home-facts">
        <div className="card"><span>Status</span><StatusBadge label={statusLabels[project.status]} /></div>
        <div className="card"><span>Estimated budget range</span><strong>{budgetRange}</strong></div>
        <div className="card"><span>Requested completion</span><strong>{schedule?.requestedCompletionDate ?? "Not set"}</strong></div>
      </div>

      <div className="card">
        <h2>Ask your Project Guide</h2>
        <p className="home-subtitle">Short answers about your project, options and next steps.</p>
        <ProjectChat
          projectId={project.id}
          projectName={project.name}
          agent="project_guide"
          title="Project Guide"
          subtitle="Ask anything about your project."
          safetyNotice="The guide can explain and suggest. Only Yaniv confirms price, scope and dates."
          suggestions={[
            "What do you still need from me?",
            "Is my requested date realistic?",
            "Can we compare a simpler version?",
          ]}
        />
      </div>

      <Disclosure title="More details">
        <p>Open the full project view for scope, messages, files and change requests.</p>
        <button type="button" onClick={() => onNavigate("client-portal")}>Open full project view</button>
      </Disclosure>
    </div>
  );
}