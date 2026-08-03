import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FlowGraph, FlowNode } from "../lib/projectFlow";

const NODE_W = 216;
const NODE_H = 96;
const COL_GAP = 76;
const ROW_GAP = 22;
const PAD = 40;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2.5;

type Placed = FlowNode & { x: number; y: number };

export type Layout = {
  nodes: Placed[];
  edges: { from: Placed; to: Placed; label?: string }[];
  width: number;
  height: number;
};

/** Simple layered layout: one column per stage, nodes stacked inside a column. */
export function layoutGraph(graph: FlowGraph, hiddenParents: Set<string>): Layout {
  const visible = graph.nodes.filter((n) => !(n.parentId && hiddenParents.has(n.parentId)));
  const stages = Array.from(new Set(visible.map((n) => n.stage))).sort((a, b) => a - b);
  const columnHeights = stages.map(
    (stage) => visible.filter((n) => n.stage === stage).length * (NODE_H + ROW_GAP) - ROW_GAP,
  );
  const tallest = Math.max(NODE_H, ...columnHeights);

  const placed: Placed[] = [];
  stages.forEach((stage, columnIndex) => {
    const column = visible.filter((n) => n.stage === stage);
    const columnHeight = column.length * (NODE_H + ROW_GAP) - ROW_GAP;
    const startY = PAD + (tallest - columnHeight) / 2;
    column.forEach((node, rowIndex) => {
      placed.push({
        ...node,
        x: PAD + columnIndex * (NODE_W + COL_GAP),
        y: startY + rowIndex * (NODE_H + ROW_GAP),
      });
    });
  });

  const index = new Map(placed.map((n) => [n.id, n]));
  const edges: Layout["edges"] = [];
  for (const edge of graph.edges) {
    const from = index.get(edge.from);
    const to = index.get(edge.to);
    if (from && to) edges.push({ from, to, label: edge.label });
  }

  return {
    nodes: placed,
    edges,
    width: PAD * 2 + stages.length * (NODE_W + COL_GAP) - COL_GAP,
    height: PAD * 2 + tallest,
  };
}

const STATE_STYLE: Record<FlowNode["state"], { fill: string; stroke: string; ink: string }> = {
  done: { fill: "var(--success-bg)", stroke: "var(--success-line)", ink: "var(--success)" },
  active: { fill: "var(--info-bg)", stroke: "var(--info-line)", ink: "var(--info)" },
  blocked: { fill: "var(--danger-bg)", stroke: "var(--danger-line)", ink: "var(--danger)" },
  pending: { fill: "var(--surface)", stroke: "var(--line)", ink: "var(--ink-muted)" },
};

function clip(text: string, max: number) {
  const value = text ?? "";
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function NodeShape({ node, onSelect, selected }: { node: Placed; onSelect?: (n: Placed) => void; selected?: boolean }) {
  const style = STATE_STYLE[node.state];
  return (
    <g
      transform={`translate(${node.x}, ${node.y})`}
      onClick={onSelect ? () => onSelect(node) : undefined}
      style={{ cursor: onSelect ? "pointer" : "default" }}
    >
      <rect
        width={NODE_W}
        height={NODE_H}
        rx={10}
        fill={style.fill}
        stroke={selected ? "var(--brand)" : style.stroke}
        strokeWidth={selected ? 2 : 1}
      />
      <rect width={4} height={NODE_H} rx={2} fill={style.ink} opacity={0.55} />
      <text x={16} y={24} fontSize={9} fontWeight={700} letterSpacing="0.08em" fill={style.ink}>
        {node.kind.replace(/_/g, " ").toUpperCase()}
      </text>
      <text x={16} y={46} fontSize={13} fontWeight={600} fill="var(--ink-strong)">
        {clip(node.title, 26)}
      </text>
      {node.subtitle ? (
        <text x={16} y={64} fontSize={11} fill="var(--ink-muted)">
          {clip(node.subtitle, 30)}
        </text>
      ) : null}
      {node.meta?.length ? (
        <text x={16} y={82} fontSize={10} fill="var(--ink-muted)">
          {clip(node.meta.map((m) => `${m.label}: ${m.value}`).join("  ·  "), 34)}
        </text>
      ) : null}
    </g>
  );
}

function Edges({ edges }: { edges: Layout["edges"] }) {
  return (
    <g>
      {edges.map((edge, i) => {
        const x1 = edge.from.x + NODE_W;
        const y1 = edge.from.y + NODE_H / 2;
        const x2 = edge.to.x;
        const y2 = edge.to.y + NODE_H / 2;
        const mid = (x1 + x2) / 2;
        const path = x2 >= x1
          ? `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`
          : `M ${edge.from.x + NODE_W / 2} ${edge.from.y + NODE_H} C ${edge.from.x} ${y1 + 60}, ${x2 - 40} ${y2}, ${x2} ${y2}`;
        return (
          <path
            key={`${edge.from.id}-${edge.to.id}-${i}`}
            d={path}
            fill="none"
            stroke="var(--line-strong)"
            strokeWidth={1.4}
            markerEnd="url(#flow-arrow)"
          />
        );
      })}
    </g>
  );
}

function Defs() {
  return (
    <defs>
      <marker id="flow-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--line-strong)" />
      </marker>
    </defs>
  );
}

/** Static, non-interactive rendering used by the printable report. */
export function ProjectFlowStatic({ graph, maxWidth = 720 }: { graph: FlowGraph; maxWidth?: number }) {
  const layout = useMemo(() => layoutGraph(graph, new Set()), [graph]);
  return (
    <svg
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      width={maxWidth}
      height={(layout.height / layout.width) * maxWidth}
      role="img"
      aria-label="Project flow diagram"
    >
      <Defs />
      <Edges edges={layout.edges} />
      {layout.nodes.map((node) => <NodeShape key={node.id} node={node} />)}
    </svg>
  );
}

export default function ProjectFlowDiagram({ graph, title }: { graph: FlowGraph; title?: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(
    graph.nodes.filter((n) => n.kind === "phase").map((n) => n.id),
  ));
  const [selected, setSelected] = useState<Placed | null>(null);
  const [mode, setMode] = useState<"diagram" | "list">("diagram");

  const layout = useMemo(() => layoutGraph(graph, collapsed), [graph, collapsed]);

  const fit = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    // Never shrink below a readable size: a long single-row flow stays legible
    // and is panned horizontally instead of being scaled to nothing.
    const raw = Math.min(rect.width / layout.width, rect.height / layout.height);
    const next = Math.min(1, Math.max(0.6, raw));
    setZoom(next);
    setOffset({
      x: Math.min(0, (rect.width - layout.width * next) / 2),
      y: Math.max(0, (rect.height - layout.height * next) / 2),
    });
  }, [layout.width, layout.height]);

  useEffect(() => { fit(); }, [fit]);

  const stateRef = useRef({ zoom, offset });
  stateRef.current = { zoom, offset };

  const wheelRef = useRef((event: WheelEvent) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const dy = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 100 : 1);
    const current = stateRef.current;
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current.zoom * Math.exp(-dy * 0.0015)));
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;
    const k = next / current.zoom;
    setOffset({ x: px - (px - current.offset.x) * k, y: py - (py - current.offset.y) * k });
    setZoom(next);
  });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (event: WheelEvent) => { event.preventDefault(); wheelRef.current(event); };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  const dragRef = useRef<{ id: number; x: number; y: number } | null>(null);
  const onPointerDown = (event: React.PointerEvent) => {
    if ((event.target as HTMLElement).closest("button")) return;
    dragRef.current = { id: event.pointerId, x: event.clientX - offset.x, y: event.clientY - offset.y };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    setOffset({ x: event.clientX - drag.x, y: event.clientY - drag.y });
  };
  const endDrag = () => { dragRef.current = null; };

  const zoomAtCenter = (factor: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * factor));
    const px = rect.width / 2;
    const py = rect.height / 2;
    const k = next / zoom;
    setOffset({ x: px - (px - offset.x) * k, y: py - (py - offset.y) * k });
    setZoom(next);
  };

  const togglePhase = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const phaseNodes = graph.nodes.filter((n) => n.kind === "phase");
  const allCollapsed = phaseNodes.every((n) => collapsed.has(n.id));

  return (
    <section className="card flow-card">
      <header className="flow-toolbar">
        <div>
          <h3 style={{ margin: 0 }}>{title ?? "Project flow"}</h3>
          <p className="muted-text" style={{ margin: "2px 0 0" }}>
            {layout.nodes.length} steps · scroll to zoom, drag to pan
          </p>
        </div>
        <div className="flow-actions">
          <button type="button" className="ghost-button" onClick={() => setMode(mode === "diagram" ? "list" : "diagram")}>
            {mode === "diagram" ? "List view" : "Diagram view"}
          </button>
          {phaseNodes.length > 0 && (
            <button
              type="button"
              className="ghost-button"
              onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(phaseNodes.map((n) => n.id)))}
            >
              {allCollapsed ? "Expand phases" : "Collapse phases"}
            </button>
          )}
          {mode === "diagram" && (
            <>
              <button type="button" className="ghost-button" onClick={() => zoomAtCenter(1 / 1.2)} aria-label="Zoom out">−</button>
              <span className="muted-text" style={{ minWidth: 44, textAlign: "center" }}>{Math.round(zoom * 100)}%</span>
              <button type="button" className="ghost-button" onClick={() => zoomAtCenter(1.2)} aria-label="Zoom in">+</button>
              <button type="button" className="ghost-button" onClick={fit}>Fit</button>
            </>
          )}
        </div>
      </header>

      {mode === "list" ? (
        <ol className="flow-list">
          {graph.nodes.map((node) => (
            <li key={node.id} className={`flow-list-item state-${node.state}`}>
              <span className="flow-kind">{node.kind.replace(/_/g, " ")}</span>
              <strong>{node.title}</strong>
              {node.subtitle ? <span className="muted-text"> — {node.subtitle}</span> : null}
              {node.detail ? <p className="muted-text small">{node.detail}</p> : null}
            </li>
          ))}
        </ol>
      ) : (
        <div
          ref={containerRef}
          className="flow-canvas"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <svg width="100%" height="100%">
            <Defs />
            <g transform={`translate(${offset.x}, ${offset.y}) scale(${zoom})`}>
              <Edges edges={layout.edges} />
              {layout.nodes.map((node) => (
                <g key={node.id}>
                  <NodeShape
                    node={node}
                    selected={selected?.id === node.id}
                    onSelect={(n) => {
                      setSelected(n);
                      if (n.kind === "phase") togglePhase(n.id);
                    }}
                  />
                  {node.kind === "phase" ? (
                    <text x={node.x + NODE_W - 18} y={node.y + 24} fontSize={12} fill="var(--ink-muted)">
                      {collapsed.has(node.id) ? "+" : "−"}
                    </text>
                  ) : null}
                </g>
              ))}
            </g>
          </svg>
        </div>
      )}

      {selected ? (
        <aside className="flow-detail">
          <div>
            <span className="flow-kind">{selected.kind.replace(/_/g, " ")}</span>
            <strong> {selected.title}</strong>
            {selected.subtitle ? <div className="muted-text small">{selected.subtitle}</div> : null}
            {selected.detail ? <p className="small" style={{ margin: "6px 0 0" }}>{selected.detail}</p> : null}
            {selected.meta?.length ? (
              <ul className="flow-meta">
                {selected.meta.map((m) => <li key={m.label}><span className="muted-text">{m.label}:</span> {m.value}</li>)}
              </ul>
            ) : null}
          </div>
          <button type="button" className="ghost-button" onClick={() => setSelected(null)}>Close</button>
        </aside>
      ) : null}
    </section>
  );
}
