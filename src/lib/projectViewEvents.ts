/**
 * Lets the AI chat open the project flow diagram or the printable report that
 * is already mounted on the same screen, without changing any data flow.
 */
export type ProjectViewIntent = "flow" | "report";

const EVENT = "projectview:open";

export function requestProjectView(projectId: string, intent: ProjectViewIntent) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { projectId, intent } }));
}

export function onProjectViewRequest(
  projectId: string,
  handler: (intent: ProjectViewIntent) => void,
) {
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<{ projectId: string; intent: ProjectViewIntent }>).detail;
    if (detail?.projectId === projectId) handler(detail.intent);
  };
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}

/** Detects "show me the project flow" / "print the report" style chat commands, EN + HE. */
export function detectProjectViewIntent(text: string): ProjectViewIntent | null {
  const value = (text || "").toLowerCase();
  const flow = [
    "project flow", "flow diagram", "show me the flow", "diagram", "process map",
    "תרשים", "זרימה", "מפת תהליך", "תהליך הפרויקט",
  ];
  const report = [
    "print", "export pdf", "pdf", "project report", "proposal document", "download the report",
    "הדפס", "הדפסה", "דוח", "דו\"ח", "להוריד", "הצעת מחיר מודפסת",
  ];
  if (flow.some((needle) => value.includes(needle))) return "flow";
  if (report.some((needle) => value.includes(needle))) return "report";
  return null;
}
