/**
 * Canonical public base URL for links we email or share.
 * Only allow redirect targets on the production domain (or localhost during
 * development); anything else falls back to the canonical domain so shared
 * links never carry a preview host.
 */
export const CANONICAL_BASE_URL = "https://project.stat.ninja";

const ALLOWED_HOSTS = new Set([
  "project.stat.ninja",
  "sweet-scope-view.lovable.app",
  "localhost",
  "127.0.0.1",
]);

export function safeRedirect(value: unknown, fallbackPath = "/"): string {
  const fallback = `${CANONICAL_BASE_URL}${fallbackPath.startsWith("/") ? fallbackPath : `/${fallbackPath}`}`;
  if (typeof value !== "string" || !value.startsWith("http")) return fallback;
  try {
    const url = new URL(value);
    if (!ALLOWED_HOSTS.has(url.hostname)) {
      return `${CANONICAL_BASE_URL}${url.pathname}${url.search}`;
    }
    return url.toString();
  } catch {
    return fallback;
  }
}
