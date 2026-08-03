/**
 * Canonical public base URL for every link we hand to a person outside the app
 * (invitation links, public registration links, auth redirects).
 *
 * Links must never carry a preview host, so we always use the production domain
 * unless we are running on localhost during development.
 */
const CANONICAL_BASE = "https://project.stat.ninja";

function envBase(): string | null {
  const raw = (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined)?.trim();
  if (!raw) return null;
  return raw.replace(/\/+$/, "");
}

export function publicBaseUrl(): string {
  const fromEnv = envBase();
  if (fromEnv) return fromEnv;
  if (typeof window !== "undefined") {
    const { hostname, origin } = window.location;
    if (hostname === "localhost" || hostname === "127.0.0.1") return origin;
  }
  return CANONICAL_BASE;
}

/** Build an absolute public URL, e.g. publicUrl("/join/client?c=abc"). */
export function publicUrl(path = "/"): string {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${publicBaseUrl()}${suffix}`;
}
