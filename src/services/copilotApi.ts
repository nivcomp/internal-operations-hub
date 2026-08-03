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
  }>("copilot", { action: "send", screen, text, viaVoice });
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