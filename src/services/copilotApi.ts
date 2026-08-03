import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "../integrations/supabase/client";

export type CopilotChip =
  | { label: string; type: "navigate"; view: string }
  | { label: string; type: "open_project" | "open_client" | "open_supplier"; id: string }
  | { label: string; type: "focus_field"; field: string }
  | { label: string; type: "suggest_value"; field: string; value: string }
  | { label: string; type: "back" };

export type CopilotScreenHint = {
  page: string;
  label?: string;
  entityType?: "project" | "client" | "supplier" | "estimate" | "form" | "none";
  entityId?: string | null;
  projectId?: string | null;
  clientId?: string | null;
  supplierId?: string | null;
  formSection?: string;
  fields?: { name: string; label?: string; filled?: boolean; required?: boolean; value?: string }[];
  errors?: string[];
  missing?: string[];
  visibleActions?: string[];
  notes?: string[];
};

export type CopilotMessage = {
  id: string;
  sender: "user" | "assistant";
  body: string;
  payload: {
    language?: string;
    observation?: string;
    chips?: CopilotChip[];
    rejectedActions?: { kind: string; reason: string }[];
    pendingActionIds?: string[];
    voice?: boolean;
  };
  created_at: string;
};

export type CopilotPendingAction = {
  id: string;
  project_id: string;
  action_kind: string;
  confirm_role: string;
  status: string;
  payload: Record<string, unknown>;
  preview: Record<string, any>;
  title?: string;
  summary?: string;
};

export type CopilotUsage = {
  percentUsed: number;
  messagesToday: number;
  dailyMessageLimit: number;
  paused: boolean;
  pausedReason: string;
  maximumMessageLength: number;
};

export type OperatorRisk = "low" | "medium" | "high";

export type CopilotOperatorAction = {
  id: string;
  plan_id: string | null;
  plan_title: string | null;
  plan_step: number;
  action_type: string;
  action_label: string;
  target_type: string;
  target_id: string | null;
  target_label: string;
  source_command: string;
  source: string;
  risk_level: OperatorRisk;
  requires_confirmation: boolean;
  status:
    | "proposed" | "awaiting_confirmation" | "approved" | "executing"
    | "completed" | "partially_completed" | "failed" | "cancelled";
  payload: Record<string, unknown>;
  preview: {
    fields?: { label: string; current?: string; proposed?: string }[];
    impact?: string[];
    related?: string[];
    recommendation?: string;
  };
  result: { summary?: string } | null;
  failure_reason: string | null;
  created_at: string;
  executed_at: string | null;
};

async function call<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    let detail = error.message;
    if (error instanceof FunctionsHttpError) {
      const text = await error.context.text();
      try {
        detail = JSON.parse(text).error ?? text;
      } catch {
        detail = text || detail;
      }
    }
    throw new Error(detail);
  }
  if (data && typeof data === "object" && "error" in (data as any)) {
    throw new Error(String((data as any).error));
  }
  return data as T;
}

export function loadCopilotHistory(screen: CopilotScreenHint) {
  return call<{
    scopeKey: string;
    label: string;
    messages: CopilotMessage[];
    preferences: Record<string, unknown>;
    usage: CopilotUsage;
    operatorMode?: boolean;
    operatorActions?: CopilotOperatorAction[];
  }>("copilot", { action: "history", screen });
}

export function sendCopilotMessage(screen: CopilotScreenHint, text: string, viaVoice: boolean) {
  return call<{
    scopeKey: string;
    label: string;
    userMessage: CopilotMessage;
    assistantMessage: CopilotMessage;
    chips: CopilotChip[];
    pendingActions: CopilotPendingAction[];
    rejectedActions: { kind: string; reason: string }[];
    usage: CopilotUsage;
    operatorMode?: boolean;
    operatorActions?: CopilotOperatorAction[];
  }>("copilot", { action: "send", screen, text, viaVoice });
}

export function loadOperatorQueue(screen: CopilotScreenHint) {
  return call<{ actions: CopilotOperatorAction[] }>("copilot", { action: "operator_queue", screen });
}

export function confirmOperatorActions(screen: CopilotScreenHint, ids: string[]) {
  return call<{
    ok: boolean;
    status: "completed" | "partially_completed" | "failed";
    results: { id: string; ok: boolean; summary?: string; error?: string; skipped?: boolean }[];
    actions: CopilotOperatorAction[];
  }>("copilot", { action: "operator_confirm", screen, ids });
}

export function retryOperatorActions(screen: CopilotScreenHint, ids: string[]) {
  return call<{
    ok: boolean;
    status: "completed" | "partially_completed" | "failed";
    results: { id: string; ok: boolean; summary?: string; error?: string }[];
    actions: CopilotOperatorAction[];
  }>("copilot", { action: "operator_retry", screen, ids });
}

export function cancelOperatorActions(screen: CopilotScreenHint, ids: string[]) {
  return call<{ ok: true }>("copilot", { action: "operator_cancel", screen, ids });
}

export function confirmCopilotAction(screen: CopilotScreenHint, draftId: string) {
  return call<{ ok: true; status: string; summary: string }>("copilot", {
    action: "confirm_action", screen, draftId,
  });
}

export function cancelCopilotAction(screen: CopilotScreenHint, draftId: string) {
  return call<{ ok: true; status: string }>("copilot", { action: "cancel_action", screen, draftId });
}

export function clearCopilotThread(screen: CopilotScreenHint) {
  return call<{ ok: true }>("copilot", { action: "clear", screen });
}

export function saveCopilotPreferences(screen: CopilotScreenHint, preferences: Record<string, unknown>) {
  return call<{ ok: true }>("copilot", { action: "save_preferences", screen, preferences });
}

export function transcribeAudio(base64Wav: string) {
  return call<{ text: string }>("copilot-voice", { action: "transcribe", audio: base64Wav });
}

export function synthesizeSpeech(text: string) {
  return call<{ audio: string; mime: string }>("copilot-voice", { action: "speak", text });
}