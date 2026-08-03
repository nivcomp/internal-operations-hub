import { useMemo, useState } from "react";
import { useAppData } from "../context/AppDataContext";
import { buildProjectTimeline, type TimelineEvent } from "../lib/projectTimeline";
import type { ChangeRequest, ClientPayment, Project, TimeEntry } from "../types/domain";
import { EmptyState } from "./ui/EmptyState";

type ProjectTimelineProps = {
  project: Project;
  changeRequests: ChangeRequest[];
  clientPayments: ClientPayment[];
  timeEntries: TimeEntry[];
};

const kindLabels: Record<TimelineEvent["kind"], string> = {
  project: "Project",
  scope: "Scope",
  approval: "Approval",
  supplier: "Supplier",
  payment: "Payment",
  change: "Change",
  time: "Time",
  file: "File",
  decision: "Decision",
  estimate: "Estimate",
};

const filterOptions: ("all" | TimelineEvent["kind"])[] = ["all", "approval", "supplier", "payment", "change", "estimate", "time"];

/** Read-only chronological view of everything that already happened on a project. */
export function ProjectTimeline({ project, changeRequests, clientPayments, timeEntries }: ProjectTimelineProps) {
  const { scopes, fileLinks, decisionLogs, suppliers } = useAppData();
  const [filter, setFilter] = useState<"all" | TimelineEvent["kind"]>("all");

  const events = useMemo(
    () => buildProjectTimeline({
      project,
      scopes,
      changeRequests,
      payments: clientPayments,
      timeEntries,
      files: fileLinks,
      decisions: decisionLogs,
      suppliers,
    }),
    [project, scopes, changeRequests, clientPayments, timeEntries, fileLinks, decisionLogs, suppliers],
  );

  const visible = filter === "all" ? events : events.filter((event) => event.kind === filter);

  if (events.length === 0) {
    return (
      <EmptyState
        title="Nothing has happened yet"
        description="Approvals, supplier assignments, estimate versions, payments and changes appear here as soon as they are recorded."
      />
    );
  }

  return (
    <section className="card">
      <div className="section-head">
        <div>
          <h2>Timeline</h2>
          <p className="muted-text">Everything recorded on this project, newest first.</p>
        </div>
        <div className="filter-chips">
          {filterOptions.map((option) => (
            <button
              key={option}
              type="button"
              className={`chip${filter === option ? " active" : ""}`}
              onClick={() => setFilter(option)}
            >
              {option === "all" ? "All" : kindLabels[option]}
            </button>
          ))}
        </div>
      </div>
      {visible.length === 0 ? (
        <p className="muted-text">No events of that type yet.</p>
      ) : (
        <ol className="timeline">
          {visible.map((event) => (
            <li key={event.id} className={`timeline-item ${event.tone}`}>
              <span className="timeline-dot" aria-hidden />
              <div className="timeline-body">
                <div className="timeline-head">
                  <strong>{event.title}</strong>
                  <span className="timeline-kind">{kindLabels[event.kind]}</span>
                  <span className="muted-text">{event.date || "Undated"}</span>
                </div>
                <p className="muted-text">{event.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}