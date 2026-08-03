import { supabase } from "../integrations/supabase/client";

const db = supabase as any;

export type UsageLimit = {
  id: string;
  scope_type: "global" | "role" | "profile" | "project";
  scope_id: string | null;
  daily_message_limit: number;
  monthly_message_limit: number;
  daily_token_limit: number;
  monthly_token_limit: number;
  maximum_message_length: number;
  maximum_context_size: number;
  maximum_output_tokens: number;
  cooldown_seconds: number;
  warning_threshold_percent: number;
  hard_stop_threshold_percent: number;
  is_paused: boolean;
  paused_reason: string;
  paused_until: string | null;
  note: string;
};

export type UsageEvent = {
  id: string;
  profile_id: string | null;
  project_id: string | null;
  actor_role: string;
  agent_type: string;
  classification: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  estimated_cost: number;
  duration_ms: number | null;
  outcome: string;
  rejection_reason: string;
  created_at: string;
};

export type UsageAlert = {
  id: string;
  alert_type: string;
  severity: string;
  profile_id: string | null;
  project_id: string | null;
  title: string;
  detail: string;
  acknowledged: boolean;
  created_at: string;
};

function fail(context: string, error: { message?: string } | null): never {
  console.error(`[aiUsage] ${context}`, error);
  throw new Error(`${context}: ${error?.message ?? "Unknown database error"}`);
}

export async function fetchUsageLimits(): Promise<UsageLimit[]> {
  const { data, error } = await db.from("ai_usage_limits").select("*").order("scope_type");
  if (error) fail("Load AI usage limits", error);
  return (data ?? []) as UsageLimit[];
}

export async function updateUsageLimit(id: string, patch: Partial<UsageLimit>): Promise<UsageLimit> {
  const { data, error } = await db.from("ai_usage_limits").update(patch).eq("id", id).select("*").single();
  if (error) fail("Update AI usage limit", error);
  return data as UsageLimit;
}

export async function fetchUsageEvents(days = 30): Promise<UsageEvent[]> {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const { data, error } = await db
    .from("ai_usage_events").select("*").gte("created_at", since)
    .order("created_at", { ascending: false }).limit(1000);
  if (error) fail("Load AI usage events", error);
  return (data ?? []) as UsageEvent[];
}

export async function fetchUsageAlerts(): Promise<UsageAlert[]> {
  const { data, error } = await db
    .from("ai_usage_alerts").select("*").order("created_at", { ascending: false }).limit(200);
  if (error) fail("Load AI usage alerts", error);
  return (data ?? []) as UsageAlert[];
}

export async function acknowledgeAlert(id: string, profileId: string): Promise<void> {
  const { error } = await db.from("ai_usage_alerts")
    .update({ acknowledged: true, acknowledged_by: profileId, acknowledged_at: new Date().toISOString() })
    .eq("id", id);
  if (error) fail("Acknowledge alert", error);
}
