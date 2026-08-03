import { supabase } from "../integrations/supabase/client";
import { redirectUrl } from "./accessApi";

export type InvitationRecord = {
  id: string;
  role: "client" | "supplier";
  contact_name: string;
  company: string;
  email: string;
  phone: string;
  client_id: string | null;
  supplier_id: string | null;
  invite_link: string;
  emailed: boolean;
  status: string;
  created_at: string;
};

export type QuickInviteResult = {
  userId: string;
  clientId: string | null;
  supplierId: string | null;
  link: string | null;
  emailed: boolean;
  invitation: InvitationRecord | null;
};

async function call<T>(payload: Record<string, unknown>): Promise<T> {
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

/** Minimal client invitation: company, contact, email, optional phone. */
export function quickInviteClient(input: {
  company: string; contactName: string; email: string; phone?: string;
}): Promise<QuickInviteResult> {
  return call<QuickInviteResult>({
    action: "quickInviteClient",
    company: input.company,
    contactName: input.contactName,
    email: input.email,
    phone: input.phone ?? "",
    redirectTo: redirectUrl(),
  });
}

/** Minimal supplier invitation: name, email, optional phone. */
export function quickInviteSupplier(input: {
  contactName: string; email: string; phone?: string;
}): Promise<QuickInviteResult> {
  return call<QuickInviteResult>({
    action: "quickInviteSupplier",
    contactName: input.contactName,
    email: input.email,
    phone: input.phone ?? "",
    redirectTo: redirectUrl(),
  });
}

export async function listInvitations(): Promise<InvitationRecord[]> {
  const data = await call<{ invitations: InvitationRecord[] }>({ action: "listInvitations" });
  return data.invitations ?? [];
}