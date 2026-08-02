import { useCallback, useEffect, useState } from "react";
import { supabase } from "../integrations/supabase/client";
import type { UserRole } from "../types/domain";

export type InvitationStatus = "pending" | "active" | "disabled";

export type AccessAccount = {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  clientId: string | null;
  supplierId: string | null;
  isActive: boolean;
  createdAt: string | null;
  invitedAt: string | null;
  lastSignInAt: string | null;
  invitationStatus: InvitationStatus;
};

type AccessPayload = Record<string, unknown>;

async function callAccessAdmin<T>(payload: AccessPayload): Promise<T> {
  const { data, error } = await supabase.functions.invoke("access-admin", { body: payload });
  if (error) throw new Error(error.message);
  if (data && typeof data === "object" && "error" in data && (data as any).error) {
    throw new Error(String((data as any).error));
  }
  return data as T;
}

export const redirectUrl = () => `${window.location.origin}/reset-password`;

export async function listAccessAccounts(): Promise<AccessAccount[]> {
  const data = await callAccessAdmin<{ accounts: AccessAccount[] }>({ action: "list" });
  return data.accounts ?? [];
}

export async function inviteAccessUser(input: {
  email: string;
  fullName: string;
  role: UserRole;
  clientId?: string | null;
  supplierId?: string | null;
}): Promise<{ userId: string; link: string | null; emailed: boolean }> {
  return callAccessAdmin({
    action: "invite",
    email: input.email,
    fullName: input.fullName,
    role: input.role,
    clientId: input.clientId ?? null,
    supplierId: input.supplierId ?? null,
    redirectTo: redirectUrl(),
  });
}

export async function createAccessLink(userId: string): Promise<string> {
  const data = await callAccessAdmin<{ link: string }>({
    action: "link",
    userId,
    redirectTo: redirectUrl(),
  });
  return data.link;
}

export async function setAccessActive(userId: string, isActive: boolean): Promise<void> {
  await callAccessAdmin({ action: "setActive", userId, isActive });
}

export async function copyToClipboard(value: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    const el = document.createElement("textarea");
    el.value = value;
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
  }
}

export const accessStatusLabels: Record<InvitationStatus, string> = {
  pending: "Invitation pending",
  active: "Active",
  disabled: "Disabled",
};

export function formatDateTime(value: string | null): string {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" });
}

/** Loads every access account. Used by the access panels and Access Management. */
export function useAccessAccounts() {
  const [accounts, setAccounts] = useState<AccessAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setAccounts(await listAccessAccounts());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load access accounts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  return { accounts, loading, error, reload };
}