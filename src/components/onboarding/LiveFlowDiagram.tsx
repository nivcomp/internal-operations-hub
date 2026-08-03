import type { LiveFlow } from "../../services/onboardingChatApi";

const KIND_COLORS: Record<string, string> = {
  user: "var(--color-accent-soft, #e6eefb)",
  system: "var(--color-surface-alt, #f1f5f9)",
  integration: "#eef7f0",
  approval: "#fdf3e3",
  automation: "#f3eefc",
};

/**
 * Lightweight live diagram of the workflow the AI has understood so far.
 * Client-safe by construction: it only renders nodes and edges from the
 * client's own onboarding document — never pricing or internal data.
 */
export function LiveFlowDiagram({ flow }: { flow: LiveFlow }) {
  const nodes = (flow.nodes ?? []).filter((node) => node && node.label).slice(0, 12);
  const edges = (flow.edges ?? []).filter((edge) => edge && edge.from && edge.to).slice(0, 24);

  if (!nodes.length) {
    return <p className="form-note">The diagram appears once we talk about your workflow.</p>;
  }

  return (
    <div className="live-flow">
      <div className="live-flow-nodes">
        {nodes.map((node) => (
          <span
            key={node.id || node.label}
            className="live-flow-node"
            style={{ background: KIND_COLORS[node.kind ?? "system"] ?? KIND_COLORS.system }}
          >
            <small>{node.kind ?? "step"}</small>
            {node.label}
          </span>
        ))}
      </div>
      {edges.length ? (
        <ul className="live-flow-edges">
          {edges.map((edge, index) => {
            const from = nodes.find((n) => n.id === edge.from)?.label ?? edge.from;
            const to = nodes.find((n) => n.id === edge.to)?.label ?? edge.to;
            return <li key={index}>{from} → {to}{edge.label ? ` (${edge.label})` : ""}</li>;
          })}
        </ul>
      ) : null}
    </div>
  );
}