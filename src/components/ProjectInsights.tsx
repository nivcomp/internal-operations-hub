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
  const [reportView, setReportView] = useState<ProjectView | null>(null);
  const [reportBusy, setReportBusy] = useState(false);

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
          void openReport(defaultMode);
        }
      }),
    [projectId, defaultMode],
  );

  if (loading && !view) return <section className="card"><p className="muted-text">Loading the project view…</p></section>;
  if (error) return <section className="card"><p className="form-error">{error}</p></section>;
  if (!view || !graph) return null;

  /**
   * Agency users can preview the client and supplier versions. The preview is
   * re-fetched through the same role filter the real reader would get, so what
   * Yaniv sees is exactly what that role receives.
   */
  async function openReport(mode: ReportMode) {
    setReportMode(mode);
    if (mode === defaultMode) {
      setReportView(view);
      return;
    }
    setReportBusy(true);
    try {
      const targetRole: ViewRole = mode === "internal" ? "agency_admin" : mode;
      const targetSupplier = mode === "supplier" ? (view?.suppliers[0]?.id ?? supplierId) : null;
      setReportView(await fetchProjectView(projectId, targetRole, targetSupplier));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not build that report.");
      setReportMode(null);
    } finally {
      setReportBusy(false);
    }
  }

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
                onClick={() => void openReport(mode)}
                disabled={reportBusy}
              >
                {MODE_LABEL[mode]}
              </button>
            ))}
          </div>
        ) : null}
        {reportBusy || !reportView ? (
          <section className="card"><p className="muted-text">Building the report…</p></section>
        ) : (
          <ProjectReport view={reportView} mode={reportMode} onClose={() => { setReportMode(null); setReportView(null); }} />
        )}
      </>
    );
  }

  return (
    <>
      <div className="form-actions no-print">
        <button type="button" className="ghost-button" onClick={() => setShowDiagram((value) => !value)}>
          {showDiagram ? "Hide project flow" : "Show project flow"}
        </button>
        <button type="button" className="ghost-button" onClick={() => void openReport(defaultMode)}>
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
