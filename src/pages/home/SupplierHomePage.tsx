import { useMemo } from "react";
import { EmptyState } from "../../components/ui/EmptyState";
import { Disclosure } from "../../components/ui/Disclosure";
import { ProjectChat } from "../../components/ProjectChat";
import { useAppData } from "../../context/AppDataContext";
import type { ViewKey } from "../../views";

type Props = { supplierId?: string; onNavigate: (view: ViewKey) => void; onRestartWizard: () => void };

export function SupplierHomePage({ supplierId, onNavigate, onRestartWizard }: Props) {
  const { projects, timeEntries, projectSchedules, suppliers } = useAppData();

  const supplier = suppliers.find((s) => s.id === supplierId);
  const assigned = useMemo(
    () => projects.filter((p) => supplierId && p.assignedSupplierIds.includes(supplierId)),
    [projects, supplierId],
  );
  const myEntries = timeEntries.filter((entry) => entry.supplierId === supplierId);
  const waiting = myEntries.filter((entry) => entry.status === "submitted");
  const approvedHours = myEntries.filter((entry) => entry.status === "approved")
    .reduce((sum, entry) => sum + entry.hours, 0);

  if (assigned.length === 0) {
    return (
      <div className="home-screen">
        <header className="home-head">
          <p className="eyebrow">Supplier workspace</p>
          <h1>{supplier?.name ?? "Welcome"}</h1>
        </header>
        <EmptyState
          title="No work assigned yet"
          description="Complete your profile so Yaniv can match you to projects. Work appears here as soon as it is assigned to you."
          action={{ label: "Review my profile", onClick: onRestartWizard }}
        />
      </div>
    );
  }

  const active = assigned[0];
  const schedule = projectSchedules.find((s) => s.projectId === active.id);

  return (
    <div className="home-screen">
      <header className="home-head">
        <p className="eyebrow">Supplier workspace</p>
        <h1>{active.name}</h1>
        <p className="home-subtitle">Only work assigned to you is shown here.</p>
      </header>

      <div className="card home-next">
        <span className="eyebrow">Your next step</span>
        <h2>{waiting.length > 0 ? "Wait for hour approval" : "Log the time you worked"}</h2>
        <p>
          {waiting.length > 0
            ? `${waiting.length} time ${waiting.length === 1 ? "entry is" : "entries are"} waiting for approval.`
            : "Keep your hours up to date so approvals are not delayed."}
        </p>
        <button type="button" className="primary-button" onClick={() => onNavigate("supplier-portal")}>
          Open assigned work
        </button>
      </div>

      <div className="home-facts">
        <div className="card"><span>Assigned projects</span><strong>{assigned.length}</strong></div>
        <div className="card"><span>Delivery target</span><strong>{schedule?.approvedDeliveryDate ?? schedule?.recommendedDeliveryEnd ?? "To be confirmed"}</strong></div>
        <div className="card"><span>Hours waiting approval</span><strong>{waiting.reduce((s, e) => s + e.hours, 0)}</strong></div>
        <div className="card"><span>Approved hours</span><strong>{approvedHours}</strong></div>
      </div>

      <div className="card">
        <h2>Ask your Work Assistant</h2>
        <ProjectChat
          projectId={active.id}
          projectName={active.name}
          agent="work_assistant"
          title="Work Assistant"
          subtitle="Ask about the work, blockers or your hours."
          safetyNotice="The assistant never shares client pricing or agency margin."
          suggestions={[
            "Explain what this project needs from me",
            "Help me report a blocker",
            "Prepare a progress update",
          ]}
        />
      </div>

      <Disclosure title="More details">
        <p>Open the full workspace for delivery instructions, time entries and files.</p>
        <button type="button" onClick={() => onNavigate("supplier-portal")}>Open full workspace</button>
      </Disclosure>
    </div>
  );
}