import { useMemo, useState } from "react";
import type { LiveFlow } from "../../services/onboardingChatApi";
import { deliverable, type SolutionKind, type WordingLang } from "../../lib/clientWording";

type FlowNode = { id: string; label: string; kind?: string };

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
    hint: "אפשר ללחוץ על כל שלב כדי לראות מה קורה בו.",
    empty: "כשנדבר על התהליך שלך, הוא יצויר כאן שלב אחרי שלב.",
    close: "סגור",
    open: "פתח תצוגה",
    steps: "שלבים",
    crmTitle: "איך זה ייראה אצלך",
    crmColumns: ["פנייה חדשה", "בטיפול", "נסגר"],
    crmRows: ["ישראל ישראלי", "דנה כהן", "עסק חדש"],
    generic: "בשלב הזה המידע עובר הלאה בלי שתצטרך לעשות משהו ידני.",
    userStep: "כאן מישהו מבצע פעולה — למשל שולח הודעה או ממלא פרטים.",
    approvalStep: "כאן מחכים לאישור שלך לפני שממשיכים.",
    deliverableStep: "כאן נמצא מה שבונים לך. אפשר לפתוח ולראות איך זה נראה.",
  },
  en: {
    title: "Your process",
    hint: "Click any step to see what happens there.",
    empty: "Once we talk about your process, it will be drawn here step by step.",
    close: "Close",
    open: "Open the preview",
    steps: "steps",
    crmTitle: "How it will look for you",
    crmColumns: ["New enquiry", "In progress", "Closed"],
    crmRows: ["John Miller", "Dana Cohen", "New business"],
    generic: "At this step information moves on by itself — nothing manual for you.",
    userStep: "Here a person does something — sends a message or fills in details.",
    approvalStep: "Here we wait for your approval before continuing.",
    deliverableStep: "This is what we are building for you. Open it to see how it looks.",
  },
} as const;

const KIND_ICON: Record<string, string> = {
  user: "👤",
  system: "⚙️",
  integration: "🔗",
  approval: "✅",
  automation: "⚡",
};

const CRM_TOOLS: Array<{ match: RegExp; name: string; color: string }> = [
  { match: /monday|מנדיי|מאנדיי/i, name: "Monday", color: "#ff3d57" },
  { match: /airtable|איירטייבל/i, name: "Airtable", color: "#2d7ff9" },
  { match: /hubspot|האבספוט/i, name: "HubSpot", color: "#ff7a59" },
  { match: /sheets|גיליון|אקסל|excel/i, name: "Google Sheets", color: "#0f9d58" },
  { match: /crm|לקוחות/i, name: "CRM", color: "#6366f1" },
];

function detectCrm(label: string) {
  return CRM_TOOLS.find((tool) => tool.match.test(label)) ?? null;
}

function isDeliverableNode(label: string, kind?: string) {
  return kind === "automation" || /אפליקצי|app|מסך|screen|בוט|bot|וואטסאפ|whatsapp|אוטומצי|automation/i.test(label);
}

/** Orders nodes into levels so the flow reads like a small tree, n8n style. */
function buildLevels(nodes: FlowNode[], edges: Array<{ from: string; to: string }>) {
  const byId = new Map(nodes.map((node) => [node.id || node.label, node]));
  const incoming = new Map<string, number>();
  nodes.forEach((node) => incoming.set(node.id || node.label, 0));
  edges.forEach((edge) => {
    if (incoming.has(edge.to)) incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
  });

  const levels: FlowNode[][] = [];
  const placed = new Set<string>();
  let current = nodes.filter((node) => (incoming.get(node.id || node.label) ?? 0) === 0);
  if (!current.length) current = nodes.slice(0, 1);

  while (current.length && levels.length < 8) {
    const row = current.filter((node) => !placed.has(node.id || node.label));
    if (!row.length) break;
    row.forEach((node) => placed.add(node.id || node.label));
    levels.push(row);
    const next: FlowNode[] = [];
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

export function ProjectFlowCanvas({ flow, language, solutionKind, onOpenDeliverable }: Props) {
  const text = copy[language];
  const nodes = useMemo(
    () => (flow.nodes ?? []).filter((node) => node && node.label).slice(0, 14) as FlowNode[],
    [flow.nodes],
  );
  const edges = useMemo(
    () => (flow.edges ?? []).filter((edge) => edge && edge.from && edge.to),
    [flow.edges],
  );
  const levels = useMemo(() => buildLevels(nodes, edges), [nodes, edges]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (!nodes.length) {
    return (
      <section className="card flow-canvas">
        <h2>{text.title}</h2>
        <p className="form-note">{text.empty}</p>
      </section>
    );
  }

  const selected = nodes.find((node) => (node.id || node.label) === selectedId) ?? null;
  const crm = selected ? detectCrm(selected.label) : null;
  const deliverableNode = selected ? isDeliverableNode(selected.label, selected.kind) : false;
  const product = deliverable(solutionKind, language);

  return (
    <section className="card flow-canvas" dir={language === "he" ? "rtl" : "ltr"}>
      <header className="flow-canvas-head">
        <div>
          <h2>{text.title}</h2>
          <p className="form-note">{text.hint}</p>
        </div>
        <span className="flow-canvas-count">{nodes.length} {text.steps}</span>
      </header>

      <div className="flow-canvas-tree">
        {levels.map((row, index) => (
          <div className="flow-canvas-level" key={index}>
            {index > 0 && <span className="flow-canvas-link" aria-hidden="true" />}
            <div className="flow-canvas-row">
              {row.map((node) => {
                const id = node.id || node.label;
                return (
                  <button
                    type="button"
                    key={id}
                    className={`flow-canvas-node${selectedId === id ? " is-active" : ""}`}
                    onClick={() => setSelectedId(selectedId === id ? null : id)}
                  >
                    <span className="flow-canvas-icon">{KIND_ICON[node.kind ?? "system"] ?? "⚙️"}</span>
                    <span className="flow-canvas-label">{node.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <div className="flow-canvas-detail">
          <header>
            <strong>{selected.label}</strong>
            <button type="button" className="ghost-button" onClick={() => setSelectedId(null)}>{text.close}</button>
          </header>

          {crm ? (
            <div className="flow-crm-preview">
              <p className="form-note">{text.crmTitle} · {crm.name}</p>
              <div className="flow-crm-board">
                {text.crmColumns.map((column, columnIndex) => (
                  <div className="flow-crm-column" key={column}>
                    <span className="flow-crm-column-title" style={{ borderColor: crm.color }}>{column}</span>
                    {text.crmRows.slice(0, 3 - columnIndex).map((row) => (
                      <span className="flow-crm-card" key={row}>{row}</span>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ) : deliverableNode ? (
            <div className="flow-canvas-deliverable">
              <p>{text.deliverableStep}</p>
              {onOpenDeliverable && (
                <button type="button" className="primary-button" onClick={onOpenDeliverable}>
                  {text.open} · {product.name}
                </button>
              )}
            </div>
          ) : (
            <p>
              {selected.kind === "user"
                ? text.userStep
                : selected.kind === "approval"
                  ? text.approvalStep
                  : text.generic}
            </p>
          )}
        </div>
      )}
    </section>
  );
}