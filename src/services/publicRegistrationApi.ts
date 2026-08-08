/**
 * Browser-only API for the anonymous registration screen.
 *
 * Keep this module independent from the authenticated backend client: public
 * join routes must still render when auth configuration is unavailable in a
 * static deployment, instead of crashing before React mounts.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type RegistrationRole = "client" | "supplier";

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID || "jvluliwmugamojdqstha";
const PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2bHVsaXdtdWdhbW9qZHFzdGhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzMTA5NjcsImV4cCI6MjA5OTg4Njk2N30.YoCrQU5j_K45TN4XMBJk4R-Ssha6-W53mOh9-VTXBuI";
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)
  || `https://${PROJECT_ID}.supabase.co`;
const FUNCTIONS_URL = `https://${PROJECT_ID}.supabase.co/functions/v1/public-registration`;

/**
 * Dedicated auth client for the public join screens.
 *
 * The shared app client is built purely from build-time environment variables,
 * so a bundle published without them throws "supabaseUrl is required" before any
 * request is sent. This client always has a working address, and it writes the
 * session to the same storage key, so the app picks the session up as usual.
 */
let authClient: SupabaseClient | null = null;
function getAuthClient(): SupabaseClient {
  if (!authClient) {
    authClient = createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
      auth: { storage: localStorage, persistSession: true, autoRefreshToken: true },
    });
  }
  return authClient;
}

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

/** Creates the real Auth account with the password the person chose. */
export async function createAccount(input: {
  email: string;
  password: string;
  fullName: string;
  language: "he" | "en";
  redirectTo: string;
}): Promise<{ signedIn: boolean; needsVerification: boolean; error?: string }> {
  const { data, error } = await getAuthClient().auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      emailRedirectTo: input.redirectTo,
      data: { full_name: input.fullName, preferred_language: input.language },
    },
  });
  if (error) {
    const he = input.language === "he";
    const raw = error.message || "";
    const friendly = /already registered|already exists/i.test(raw)
      ? (he ? "כתובת המייל הזו כבר רשומה. אפשר להתחבר עם הסיסמה הקיימת." : "This email is already registered — please sign in instead.")
      : /password/i.test(raw)
        ? (he ? "הסיסמה חלשה מדי. בחרו סיסמה באורך 8 תווים לפחות." : "That password is too weak — use at least 8 characters.")
        : (he ? "לא הצלחנו ליצור את החשבון כרגע. נסו שוב בעוד רגע." : "We could not create the account right now. Please try again.");
    return { signedIn: false, needsVerification: false, error: friendly };
  }
  if (data.session) return { signedIn: true, needsVerification: false };
  return { signedIn: false, needsVerification: true };
}

/** Provisions the isolated profile + client/supplier record for the new session. */
export async function claimAccount(role: RegistrationRole): Promise<boolean> {
  const { data } = await getAuthClient().auth.getSession();
  const token = data.session?.access_token;
  if (!token) return false;
  const response = await fetch(FUNCTIONS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: PUBLISHABLE_KEY,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ action: "claim", role }),
  });
  const body = await response.json().catch(() => ({}));
  return Boolean(body?.claimed);
}

export async function resendVerification(email: string, redirectTo: string): Promise<string | null> {
  const { error } = await getAuthClient().auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: redirectTo },
  });
  return error?.message ?? null;
}

// ---- project continuation link ---------------------------------------------

export type ContinuationInfo = {
  valid: boolean;
  reason?: "invalid" | "used" | "expired";
  email?: string;
  company?: string;
  contactName?: string;
  projectName?: string;
  accountExists?: boolean;
};

/** Reads the public details of a single-use project continuation link. */
export function continuationInfo(token: string) {
  return callPublic<ContinuationInfo>({ action: "continueInfo", token });
}

/** Sets the password for the invited client and signs them in. */
export async function activateContinuation(token: string, password: string): Promise<{
  signedIn: boolean; accountExists?: boolean; error?: string;
}> {
  let result: { ok?: boolean; accountExists?: boolean; email?: string };
  try {
    result = await callPublic({ action: "continueActivate", token, password });
  } catch (cause) {
    const raw = cause instanceof Error ? cause.message : "";
    if (raw === "password_too_short") return { signedIn: false, error: "הסיסמה חייבת להכיל לפחות 8 תווים." };
    return { signedIn: false, error: "לא הצלחנו להשלים את הכניסה כרגע. נסו שוב בעוד רגע." };
  }
  if (result.accountExists) return { signedIn: false, accountExists: true };
  if (!result.ok || !result.email) return { signedIn: false, error: "לא הצלחנו להשלים את הכניסה כרגע." };

  const { error } = await getAuthClient().auth.signInWithPassword({ email: result.email, password });
  if (error) return { signedIn: false, error: "החשבון נוצר, אך ההתחברות נכשלה. נסו להתחבר במסך הכניסה." };
  return { signedIn: true };
}
