/**
 * Bridge that lets the copilot help with the form that is already on screen.
 * It can only focus a field or offer a value for the user to review — it never
 * submits anything, so all existing validation and save logic stays in charge.
 */

const EVENT = "copilot:form";

export type CopilotFormIntent =
  | { kind: "focus"; section: string; field: string }
  | { kind: "suggest"; section: string; field: string; value: string };

export function emitCopilotFormIntent(intent: CopilotFormIntent) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: intent }));
}

export function onCopilotFormIntent(section: string, handler: (intent: CopilotFormIntent) => void) {
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<CopilotFormIntent>).detail;
    if (detail && (detail.section === section || detail.section === "*")) handler(detail);
  };
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}