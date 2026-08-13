import { useCallback, useMemo, useState, type CSSProperties } from "react";
import type { LiveFlow } from "../../services/onboardingChatApi";
import { buildClientProcessExplanation, type ClientProcessNodeData } from "../../lib/clientProcessExplanation";
import type { ClientGlossaryEntry } from "../../lib/clientGlossary";
import type { SolutionKind, WordingLang } from "../../lib/clientWording";
import { ProcessNode } from "./ProcessNode";
import { ProcessNodeDetails, type ProcessDetailsSelection } from "./ProcessNodeDetails";

type Props = {
  flow: LiveFlow;
  language: WordingLang;
  solutionKind: SolutionKind | null;
  /** Opens the real visual preview of what is being built for the project. */
  onOpenDeliverable?: () => void;
};

const copy = {
  he: {
    title: "התהליך שלך",
    hint: "אפשר ללחוץ על כל שלב כדי להבין מה קורה, למה הוא חשוב ומה מגיע אחריו.",
    empty: "כשנגדיר יחד את התהליך שלך, הוא יוצג כאן שלב אחרי שלב.",
    steps: "שלבים",
    branch: (count: number) => `מכאן התהליך מתפצל ל־${count} מסלולים`,
  },
  en: {
    title: "Your process",
    hint: "Select any step to understand what happens, why it matters and what comes next.",
    empty: "Once we define your process together, it will appear here step by step.",
    steps: "steps",
    branch: (count: number) => `The process branches into ${count} paths here`,
  },
} as const;

function isDeliverableNode(label: string, kind?: string) {
  return kind === "automation" || /אפליקצי|app|מסך|screen|בוט|bot|וואטסאפ|whatsapp|אוטומצי|automation/i.test(label);
}

/** Orders the existing LiveFlow nodes into readable levels without creating a second flow model. */
function buildLevels(nodes: ClientProcessNodeData[], edges: Array<{ from: string; to: string }>) {
  const byId = new Map(nodes.map((node) => [node.id || node.label, node]));
  const incoming = new Map<string, number>();
  nodes.forEach((node) => incoming.set(node.id || node.label, 0));
  edges.forEach((edge) => {
    if (incoming.has(edge.to)) incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
  });

  const levels: ClientProcessNodeData[][] = [];
  const placed = new Set<string>();
  let current = nodes.filter((node) => (incoming.get(node.id || node.label) ?? 0) === 0);
  if (!current.length) current = nodes.slice(0, 1);

  while (current.length && levels.length < 8) {
    const row = current.filter((node) => !placed.has(node.id || node.label));
    if (!row.length) break;
    row.forEach((node) => placed.add(node.id || node.label));
    levels.push(row);

    const next: ClientProcessNodeData[] = [];
    row.forEach((node) => {
      edges
        .filter((edge) => edge.from === (node.id || node.label))
        .forEach((edge) => {
          const target = byId.get(edge.to);
          if (target && !placed.has(edge.to) && !next.includes(target)) next.push(target);
        });
    });
    current = next;
  }

  const rest = nodes.filter((node) => !placed.has(node.id || node.label));
  if (rest.length) levels.push(rest);
  return levels;
}

export function ProjectFlowCanvas({ flow, language, solutionKind: _solutionKind, onOpenDeliverable }: Props) {
  const text = copy[language];
  const nodes = useMemo(
    () => (flow.nodes ?? []).filter((node) => node && node.label).slice(0, 14) as ClientProcessNodeData[],
    [flow.nodes],
  );
  const edges = useMemo(
    () => (flow.edges ?? []).filter((edge) => edge && edge.from && edge.to),
    [flow.edges],
  );
  const levels = useMemo(() => buildLevels(nodes, edges), [nodes, edges]);
  const explanations = useMemo(
    () => new Map(nodes.map((node) => [node.id || node.label, buildClientProcessExplanation(node, language)])),
    [language, nodes],
  );
  const [selection, setSelection] = useState<ProcessDetailsSelection | null>(null);
  const closeDetails = useCallback(() => setSelection(null), []);

  const openNode = useCallback((node: ClientProcessNodeData) => {
    setSelection({
      type: "node",
      node,
      explanation: buildClientProcessExplanation(node, language),
      canOpenDeliverable: Boolean(onOpenDeliverable && isDeliverableNode(node.label, node.kind)),
    });
  }, [language, onOpenDeliverable]);

  const openTerm = useCallback((term: ClientGlossaryEntry) => {
    setSelection({ type: "term", term });
  }, []);

  if (!nodes.length) {
    return (
      <section className="card client-project-flow" dir={language === "he" ? "rtl" : "ltr"}>
        <h2>{text.title}</h2>
        <p className="form-note">{text.empty}</p>
      </section>
    );
  }

  const selectedId = selection?.type === "node" ? selection.node.id || selection.node.label : null;

  return (
    <>
      <section className="card client-project-flow" dir={language === "he" ? "rtl" : "ltr"}>
        <header className="client-project-flow-head">
          <div>
            <h2>{text.title}</h2>
            <p className="form-note">{text.hint}</p>
          </div>
          <span className="client-project-flow-count">{nodes.length} {text.steps}</span>
        </header>

        <div className="client-project-flow-tree">
          {levels.map((row, index) => {
            const connectorStyle = { "--flow-branches": row.length } as CSSProperties;
            return (
              <div className={`client-project-flow-level${row.length > 1 ? " has-branches" : ""}`} key={row.map((node) => node.id || node.label).join("-")}>
                {index > 0 ? (
                  <>
                    {row.length > 1 ? <span className="client-project-flow-branch-label">{text.branch(row.length)}</span> : null}
                    <div className="client-project-flow-connector" style={connectorStyle} aria-hidden="true">
                      {row.map((node) => <span key={node.id || node.label} />)}
                    </div>
                  </>
                ) : null}
                <div className="client-project-flow-row" style={connectorStyle}>
                  {row.map((node) => {
                    const id = node.id || node.label;
                    const explanation = explanations.get(id) ?? buildClientProcessExplanation(node, language);
                    return (
                      <ProcessNode
                        key={id}
                        node={node}
                        explanation={explanation}
                        language={language}
                        active={selectedId === id}
                        onOpen={() => openNode(node)}
                        onOpenTerm={(term) => openTerm(term)}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <ProcessNodeDetails
        selection={selection}
        language={language}
        onClose={closeDetails}
        onOpenDeliverable={onOpenDeliverable}
      />
    </>
  );
}
