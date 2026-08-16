import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "../integrations/supabase/client";

export const API_SCOPES = [
  "schema.read", "data.read", "data.write", "data.delete", "actions.execute", "audit.read",
] as const;
export type ApiScope = typeof API_SCOPES[number];

export type ApiCredential = {
  id: string;
  name: string;
  key_prefix: string;
  scopes: ApiScope[];
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
};

export type ApiContractSummary = {
  baseUrl: string;
  docsUrl: string;
  openApiUrl: string;
  skillPackageUrl: string;
  tableCount: number;
  functionCount: number;
  serviceCount: number;
  scopes: ApiScope[];
};

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("api-admin", { body });
  if (error) {
    let message = error.message;
    if (error instanceof FunctionsHttpError) {
      const text = await error.context.text();
      try { message = JSON.parse(text)?.error ?? text; } catch { message = text || message; }
    }
    throw new Error(message);
  }
  if (data && typeof data === "object" && "error" in data && (data as any).error) {
    throw new Error(String((data as any).error));
  }
  return data as T;
}

export async function loadApiCredentials() {
  const result = await call<{ keys: ApiCredential[] }>({ action: "list" });
  return result.keys ?? [];
}

export function loadApiContractSummary() {
  return call<ApiContractSummary>({ action: "contractSummary" });
}

export function createApiCredential(input: { name: string; scopes: ApiScope[]; expiresAt?: string | null }) {
  return call<{ key: ApiCredential; secret: string; shownOnce: true }>({ action: "create", ...input });
}

export async function revokeApiCredential(id: string) {
  await call<{ ok: true }>({ action: "revoke", id });
}
