import { useMemo, useRef, useState } from "react";
import type { LiveFlow } from "../../services/onboardingChatApi";
import { deliverable, type SolutionKind, type WordingLang } from "../../lib/clientWording";
import {
  categorizeClientProcessNode,
  getClientProcessStatus,
  PROCESS_CATEGORY_META,
  PROCESS_STATUS_LABELS,
  type ClientProcessNode,
} from "../../lib/clientProcess";
import { ClientGlossaryText } from "./TechnicalTerm";
import { ProcessNodeDetails } from "./ProcessNodeDetails";

type FlowEdge = { from: string; to: string; label?: string };

type Props = {
  flow: LiveFlow;
  language: WordingLang;
  solutionKind: SolutionKind | null;
  /** Opens the visual preview of what is being built (app screens, bot, automation). */
  onOpenDeliverable?: () => void;
};

const copy = {
  he: {
    title: "התהליך שלך",
    hint: "כל שלב לחיץ. פתח שלב כדי להבין מה קורה, למה הוא קיים ומה מגיע אחריו.",
    empty: "כשנדבר על התהליך שלך, הוא יוצג כאן שלב אחרי שלב.",
    steps: "שלבים",
    openStep: "פתח הסבר על השלב",
    branch: "התהליך מתפצל כאן לכמה מסלולים",
  },
  en: {
    title: "Your process",
    hint: "Every step is clickable. Open a step to see what happens, why it exists and what comes next.",
    empty: "Once we talk about your process, it will be shown here step by step.",
    steps: "steps",
    openStep: "Open step explanation",
    branch: "The process branches into multiple routes here",
  },
} as const;

function isDeliverableNode(label: string, kind?: string) {
  return kind === "automation" || /אפליקצי|app|מסך|screen|בוט|bot|וואטסאפ|whatsapp|אוטומצי|automation/i.test(label);
}

/** Orders the existing flow nodes into levels without changing the stored flow or its edges. */
function buildLevels(nodes: ClientProcessNode[], edges: FlowEdge[]) {
  const byId = new Map(nodes.map((node) => [node.id || node.label, node]));
  const incoming = new Map<string, number>();
  nodes.forEach((node) => incoming.set(node.id || node.label, 0));
  edges.forEach((edge) => {
    if (incoming.has(edge.to)) incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
  });

  const levels: ClientProcessNode[][] = [];
  const placed = new Set<string>();
  let current = nodes.filter((node) => (incoming.get(node.id || node.label) ?? 0) === 0);
  if (!current.length) current = nodes.slice(0, 1);

  while (current.length && levels.length < Math.max(8, nodes.length)) {
    const row = current.filter((node) => !placed.has(node.id || node.label));
    if (!row.length) break;
    row.forEach((node) => placed.add(node.id || node.label));
    levels.push(row);
    const next: ClientProcessNode[] = [];
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

function labelsForNode(node: ClientProcessNode, nodes: ClientProcessNode[], edges: FlowEdge[], direction: "previous" | "next") {
  const id = node.id || node.label;
  const linkedIds = edges
    .filter((edge) => direction === "previous" ? edge.to === id : edge.from === id)
    .map((edge) => direction === "previous" ? edge.from : edge.to);
  return linkedIds
    .map((linkedId) => nodes.find((candidate) => (candidate.id || candidate.label) === linkedId)?.label)
    .filter((label): label is string => Boolean(label));
}

export function ProjectFlowCanvas({ flow, language, solutionKind, onOpenDeliverable }: Props) {
  const text = copy[language];
  const nodes = useMemo(
    () => (flow.nodes ?? []).filter((node) => node && node.label) as ClientProcessNode[],
    [flow.nodes],
  );
  const edges = useMemo(
    () => (flow.edges ?? []).filter((edge) => edge && edge.from && edge.to) as FlowEdge[],
    [flow.edges],
  );
  const levels = useMemo(() => buildLevels(nodes, edges), [nodes, edges]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const nodeRefs = useRef(new Map<string, HTMLButtonElement>());

  if (!nodes.length) {
    return (
      <section className="card client-flow-card" dir={language === "he" ? "rtl" : "ltr"}>
        <h2>{text.title}</h2>
        <p className="form-note">{text.empty}</p>
      </section>
    );
  }

  const selected = nodes.find((node) => (node.id || node.label) === selectedId) ?? null;
  const product = deliverable(solutionKind, language);
  const selectedPrevious = selected ? labelsForNode(selected, nodes, edges, "previous") : [];
  const selectedNext = selected ? labelsForNode(selected, nodes, edges, "next") : [];

  function openNode(id: string) {
    setSelectedId(id);
  }

  function closeNode() {
    const id = selectedId;
    setSelectedId(null);
    if (id) window.requestAnimationFrame(() => nodeRefs.current.get(id)?.focus());
  }

  return (
    <section className="card client-flow-card" dir={language === "he" ? "rtl" : "ltr"}>
      <header className="client-flow-head">
        <div>
          <h2>{text.title}</h2>
          <p className="form-note">{text.hint}</p>
        </div>
        <span className="client-flow-count">{nodes.length} {text.steps}</span>
      </header>

      <div className="client-flow-tree" aria-label={text.title}>
        {levels.map((row, index) => {
          const previousRow = index > 0 ? levels[index - 1] : [];
          const isBranch = row.length > 1 || previousRow.length > 1;
          return (
            <div className="client-flow-level" key={index}>
              {index > 0 ? (
                <span
                  className={`client-flow-connector${isBranch ? " is-branch" : ""}`}
                  aria-label={isBranch ? text.branch : undefined}
                  title={isBranch ? text.branch : undefined}
                />
              ) : null}
              <div className={`client-flow-row${row.length > 1 ? " has-branches" : ""}`}>
                {row.map((node) => {
                  const id = node.id || node.label;
                  const categoryKey = categorizeClientProcessNode(node);
                  const category = PROCESS_CATEGORY_META[categoryKey];
                  const status = getClientProcessStatus(node.status);
                  return (
                    <article
                      key={id}
                      className={`client-flow-node${selectedId === id ? " is-active" : ""}`}
                      data-category={categoryKey}
                    >
                      <button
                        type="button"
                        className="client-flow-node-open"
                        aria-haspopup="dialog"
                        aria-label={`${text.openStep}: ${node.label}`}
                        ref={(element: HTMLButtonElement | null) => {
                          if (element) nodeRefs.current.set(id, element);
                          else nodeRefs.current.delete(id);
                        }}
                        onClick={() => openNode(id)}
                      />
                      <span className="client-flow-node-icon" aria-hidden="true">{category.icon}</span>
                      <span className="client-flow-node-body">
                        <span className="client-flow-node-label"><ClientGlossaryText text={node.label} language={language} /></span>
                        <span className="client-flow-node-meta">
                          <span className="client-flow-category-badge" data-category={categoryKey}>{category[language]}</span>
                          {status ? <span className="client-flow-status-badge" data-status={status}>{PROCESS_STATUS_LABELS[status][language]}</span> : null}
                        </span>
                      </span>
                      <span className="client-flow-node-chevron" aria-hidden="true">›</span>
                    </article>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {selected ? (
        <ProcessNodeDetails
          node={selected}
          language={language}
          previousLabels={selectedPrevious}
          nextLabels={selectedNext}
          onClose={closeNode}
          onOpenDeliverable={isDeliverableNode(selected.label, selected.kind) && onOpenDeliverable ? () => {
            closeNode();
            onOpenDeliverable();
          } : undefined}
          deliverableLabel={product.name}
        />
      ) : null}
    </section>
  );
}
