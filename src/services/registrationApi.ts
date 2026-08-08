import { supabase } from "../integrations/supabase/client";
import { redirectUrl } from "./accessApi";
import { publicUrl } from "../config/publicUrl";

export type RegistrationRole = "client" | "supplier";

export type RegistrationSettings = {
  role: RegistrationRole;
  enabled: boolean;
  path_code: string;
  daily_limit: number;
  intro_text: string;
  updated_at: string;
};

export type PublicRegistration = {
  id: string;
  role: RegistrationRole;
  company: string;
  contact_name: string;
  email: string;
  phone: string;
  message: string;
  status: "awaiting_confirmation" | "confirmed" | "converted" | "rejected" | "blocked";
  seen_by_admin: boolean;
  confirmed_at: string | null;
  converted_at: string | null;
  reviewed_at: string | null;
  review_notes: string;
  client_id: string | null;
  supplier_id: string | null;
  created_at: string;
};

async function callAdmin<T>(payload: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("access-admin", { body: payload });
  if (error) {
    const response = (error as any)?.context as Response | undefined;
    if (response && typeof response.json === "function") {
      try {
        const body = await response.clone().json();
        if (body?.error) throw new Error(String(body.error));
      } catch (parseError) {
        if (parseError instanceof Error && !/JSON/i.test(parseError.message)) throw parseError;
      }
    }
    throw new Error(error.message);
  }
  if (data && typeof data === "object" && "error" in data && (data as any).error) {
    throw new Error(String((data as any).error));
  }
  return data as T;
}

export async function loadRegistrationSettings(): Promise<RegistrationSettings[]> {
  const data = await callAdmin<{ settings: RegistrationSettings[] }>({ action: "registrationSettings" });
  return data.settings ?? [];
}

export async function saveRegistrationSettings(input: {
  role: RegistrationRole;
  enabled?: boolean;
  dailyLimit?: number;
  introText?: string;
  rotateCode?: boolean;
}): Promise<RegistrationSettings> {
  const data = await callAdmin<{ settings: RegistrationSettings }>({
    action: "setRegistrationSettings", ...input,
  });
  return data.settings;
}

export async function listRegistrations(): Promise<PublicRegistration[]> {
  const data = await callAdmin<{ registrations: PublicRegistration[] }>({ action: "listRegistrations" });
  return data.registrations ?? [];
}

export async function markRegistrationsSeen(): Promise<void> {
  await callAdmin({ action: "markRegistrationsSeen" });
}

export async function reviewRegistration(input: {
  registrationId: string;
  decision: "approve" | "reject" | "block";
  notes?: string;
}): Promise<{ link: string | null }> {
  return callAdmin<{ link: string | null }>({
    action: "reviewRegistration", redirectTo: redirectUrl(), ...input,
  });
}

/** Public registration link for a role, e.g. /join/client?c=<code>. */
export function publicRegistrationLink(settings: RegistrationSettings): string {
  return publicUrl(`/join/${settings.role}?c=${settings.path_code}`);
}

/**
 * Single-use link that lets the client of one specific project set a password
 * and continue that exact project — not a new general registration.
 */
export function createProjectContinuationLink(input: { projectId: string; email?: string }) {
  return callAdmin<{ link: string; email: string; projectName: string }>({
    action: "projectContinuationLink", ...input,
  });
}

// ---- unauthenticated calls (used by the public join page) -------------------

const FUNCTIONS_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/public-registration`;

async function callPublic<T>(payload: Record<string, unknown>): Promise<T> {
  const response = await fetch(FUNCTIONS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
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
  return callPublic<{ submitted: boolean; emailed: boolean; notice: string }>({
    action: "submit",
    redirectTo: publicUrl("/"),
    ...input,
  });
}

/** Called once a self-registered person lands back in the app with a session. */
export async function claimPublicRegistration(): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return false;
  const response = await fetch(FUNCTIONS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ action: "claim", role: "client" }),
  });
  const body = await response.json().catch(() => ({}));
  return Boolean(body?.claimed);
}