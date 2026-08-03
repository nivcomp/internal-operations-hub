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

export type RegistrationIntake = {
  role: RegistrationRole;
  code: string;
  company: string;
  contactName: string;
  email: string;
  phone: string;
  message: string;
  website: string;
  language: "he" | "en";
  timezone: string;
  consent: boolean;
  elapsedMs: number;
};

/** Records the intake row and reports whether the address can still register. */
export function prepareRegistration(input: RegistrationIntake) {
  return callPublic<{ status: "ready" | "email_exists"; registrationId?: string }>({
    action: "register",
    ...input,
  });
}

/**
 * Creates the real Auth account with the password the person chose. The
 * authenticated client is imported lazily so the public screen never depends on
 * it while rendering.
 */
export async function createAccount(input: {
  email: string;
  password: string;
  fullName: string;
  language: "he" | "en";
  redirectTo: string;
}): Promise<{ signedIn: boolean; needsVerification: boolean; error?: string }> {
  const { supabase } = await import("../integrations/supabase/client");
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      emailRedirectTo: input.redirectTo,
      data: { full_name: input.fullName, preferred_language: input.language },
    },
  });
  if (error) return { signedIn: false, needsVerification: false, error: error.message };
  if (data.session) return { signedIn: true, needsVerification: false };
  return { signedIn: false, needsVerification: true };
}

/** Provisions the isolated profile + client/supplier record for the new session. */
export async function claimAccount(): Promise<boolean> {
  const { supabase } = await import("../integrations/supabase/client");
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return false;
  const response = await fetch(FUNCTIONS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: PUBLISHABLE_KEY,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ action: "claim" }),
  });
  const body = await response.json().catch(() => ({}));
  return Boolean(body?.claimed);
}

export async function resendVerification(email: string, redirectTo: string): Promise<string | null> {
  const { supabase } = await import("../integrations/supabase/client");
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: redirectTo },
  });
  return error?.message ?? null;
}
