/**
 * Tiny event bus so a confirmed AI action in the chat refreshes the estimation
 * screens that are mounted next to it, without changing their data flow.
 */
const EVENT = "estimation:changed";

export function notifyEstimationChanged(projectId: string) {
  window.dispatchEvent(new CustomEvent<string>(EVENT, { detail: projectId }));
}

export function onEstimationChanged(projectId: string, handler: () => void) {
  const listener = (event: Event) => {
    if ((event as CustomEvent<string>).detail === projectId) handler();
  };
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
