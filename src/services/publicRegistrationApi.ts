/**
 * Browser-only API for the anonymous registration screen.
 *
 * Keep this module independent from the authenticated backend client: public
 * join routes must still render when auth configuration is unavailable in a
 * static deployment, instead of crashing before React mounts.
 */
export type RegistrationRole = "client" | "supplier";

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID || "jvluliwmugamojdqstha";
const PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2bHVsaXdtdWdhbW9qZHFzdGhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzMTA5NjcsImV4cCI6MjA5OTg4Njk2N30.YoCrQU5j_K45TN4XMBJk4R-Ssha6-W53mOh9-VTXBuI";
const FUNCTIONS_URL = `https://${PROJECT_ID}.supabase.co/functions/v1/public-registration`;

async function callPublic<T>(payload: Record<string, unknown>): Promise<T> {
  const response = await fetch(FUNCTIONS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: PUBLISHABLE_KEY,
      Authorization: `Bearer ${PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.error) {
    throw new Error(String(body?.error ?? "Something went wrong. Please try again."));
  }
  return body as T;
}

export function checkPublicLink(role: RegistrationRole, code: string) {
  return callPublic<{ open: boolean; introText?: string }>({ action: "info", role, code });
}

export function submitPublicRegistration(input: {
  role: RegistrationRole;
  code: string;
  company: string;
  contactName: string;
  email: string;
  phone: string;
  message: string;
  website: string;
  elapsedMs: number;
}) {
  return callPublic<{
    submitted: boolean;
    emailed?: boolean;
    immediateAccess?: boolean;
    tokenHash?: string | null;
    notice: string;
  }>({
    action: "submit",
    redirectTo: "https://project.stat.ninja/",
    ...input,
  });
}

/**
 * Exchanges the one-time token for a session and moves the person into their
 * own workspace. The authenticated client is imported lazily so the public
 * registration screen itself never depends on it while rendering.
 */
export async function startSessionFromToken(tokenHash: string): Promise<boolean> {
  const { supabase } = await import("../integrations/supabase/client");
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "signup" });
  return !error;
}