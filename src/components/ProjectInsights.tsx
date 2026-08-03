import { useCallback, useEffect, useState } from "react";
import ProjectFlowDiagram from "./ProjectFlowDiagram";
import ProjectReport, { type ReportMode } from "./ProjectReport";
import { buildProjectFlow, type FlowGraph } from "../lib/projectFlow";
import { fetchProjectView, type ProjectView, type ViewRole } from "../services/projectViewApi";
import { onEstimationChanged } from "../lib/estimationEvents";
import { onProjectViewRequest } from "../lib/projectViewEvents";

type Props = {
  projectId: string;
  role: ViewRole;
  supplierId?: string | null;
  /** Agency users may also preview the client and supplier versions of the report. */
  allowModeSwitch?: boolean;
};

const MODE_LABEL: Record<ReportMode, string> = {
  client: "Client proposal",
  internal: "Internal report",
  supplier: "Supplier brief",
};

/**
 * Project flow diagram + printable report for one project.
 * Both always render the role-filtered view, so nothing hidden by RLS or by the
 * role filter can reach the screen or the printout.
 */
export default function ProjectInsights({ projectId, role, supplierId = null, allowModeSwitch = false }: Props) {
  const [view, setView] = useState<ProjectView | null>(null);
  const [graph, setGraph] = useState<FlowGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDiagram, setShowDiagram] = useState(true);
  const [reportMode, setReportMode] = useState<ReportMode | null>(null);

  const defaultMode: ReportMode = role === "agency_admin" ? "internal" : role === "client" ? "client" : "supplier";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchProjectView(projectId, role, supplierId);
      setView(next);
      setGraph(buildProjectFlow(next));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the project view.");
    } finally {
      setLoading(false);
    }
  }, [projectId, role, supplierId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => onEstimationChanged(projectId, () => { void load(); }), [projectId, load]);
  useEffect(
    () =>
      onProjectViewRequest(projectId, (intent) => {
        if (intent === "flow") {
          setShowDiagram(true);
          setReportMode(null);
        } else {
          setReportMode(defaultMode);
        }
      }),
    [projectId, defaultMode],
  );

  if (loading && !view) return <section className="card"><p className="muted-text">Loading the project view…</p></section>;
  if (error) return <section className="card"><p className="form-error">{error}</p></section>;
  if (!view || !graph) return null;

  if (reportMode) {
    return (
      <>
        {allowModeSwitch ? (
          <div className="form-actions no-print">
            {(Object.keys(MODE_LABEL) as ReportMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                className={mode === reportMode ? "primary-button" : "ghost-button"}
                onClick={() => setReportMode(mode)}
              >
                {MODE_LABEL[mode]}
              </button>
            ))}
          </div>
        ) : null}
        <ProjectReport
          view={reportMode === view.role.replace("agency_admin", "internal") ? view : view}
          mode={reportMode}
          onClose={() => setReportMode(null)}
        />
      </>
    );
  }

  return (
    <>
      <div className="form-actions no-print">
        <button type="button" className="ghost-button" onClick={() => setShowDiagram((value) => !value)}>
          {showDiagram ? "Hide project flow" : "Show project flow"}
        </button>
        <button type="button" className="ghost-button" onClick={() => setReportMode(defaultMode)}>
          Print / Export
        </button>
        <button type="button" className="ghost-button" onClick={() => void load()} disabled={loading}>
          Refresh
        </button>
      </div>
      {showDiagram ? (
        <ProjectFlowDiagram
          graph={graph}
          title={role === "supplier" ? "Your part of the project" : "Project flow"}
        />
      ) : null}
    </>
  );
}
