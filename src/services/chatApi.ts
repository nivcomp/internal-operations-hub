import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "../integrations/supabase/client";

export type AgentType = "project_guide" | "agency_control" | "work_assistant";

export type ActionKind =
  | "add_estimate_items"
  | "update_estimate_settings"
  | "update_estimate_items"
  | "assign_supplier"
  | "request_supplier_review"
  | "accept_supplier_review"
  | "publish_client_estimate"
  | "approve_fixed_price"
  | "save_client_scenario"
  | "supplier_review_response"
  | "create_change_request";

export type ActionPreview = {
  requested?: string;
  records?: string[];
  current?: { label: string; value: string }[];
  proposed?: { label: string; value: string }[];
  client_visibility_effect?: string;
  internal_cost_effect?: string;
  margin_effect?: string;
};

export type PendingAction = {
  id: string;
  project_id: string;
  conversation_id: string | null;
  message_id: string | null;
  action_kind: ActionKind;
  confirm_role: "agency_admin" | "client" | "supplier";
  agent_type: AgentType | "";
  status: string;
  visibility: string;
  payload: Record<string, any>;
  preview: ActionPreview;
  created_at: string;
};

export type ChatMessage = {
  id: string;
  conversation_id: string;
  project_id: string;
  sender_type: "client" | "agency_admin" | "supplier" | "ai_agent" | "system";
  sender_profile_id: string | null;
  agent_type: AgentType | null;
  body: string;
  structured_payload: {
    language?: string;
    questions?: string[];
    proposed_actions?: { kind?: string; title: string; summary?: string; detail?: string; affects?: string }[];
    rejected_actions?: { kind: string; reason: string }[];
    confirmed_action?: string;
    drafts?: Record<string, unknown>;
    ai_draft?: boolean;
  };
  visibility: "client_agency" | "supplier_agency" | "agency_only" | "shared_all";
  status: string;
  created_at: string;
};

export type ChatConversation = { id: string; project_id: string; kind: string; title: string };

export type ChatDraft = {
  id: string;
  draft_type: string;
  payload: Record<string, unknown>;
  status: string;
  created_at: string;
};

async function callChat<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("project-chat", { body });
  if (error) {
    let detail = error.message;
    if (error instanceof FunctionsHttpError) {
      const text = await error.context.text();
      try {
        const parsed = JSON.parse(text);
        detail = parsed.error ?? text;
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

export function loadChatHistory(agent: AgentType, projectId: string) {
  return callChat<{
    conversation: ChatConversation;
    messages: ChatMessage[];
    drafts: ChatDraft[];
    pendingActions: PendingAction[];
  }>({
    action: "history",
    agent,
    projectId,
  });
}

export function sendChatMessage(agent: AgentType, projectId: string, body: string) {
  return callChat<{
    conversation: ChatConversation;
    userMessage: ChatMessage;
    aiMessage: ChatMessage;
    draft: ChatDraft | null;
    pendingActions: PendingAction[];
    rejectedActions: { kind: string; reason: string }[];
  }>({
    action: "send",
    agent,
    projectId,
    body,
  });
}

/** Applies a proposed action after a human confirmed it. Optional `payload` carries manual edits. */
export function confirmProposedAction(
  agent: AgentType,
  projectId: string,
  draftId: string,
  payload?: Record<string, unknown>,
) {
  return callChat<{ ok: true; status: string; summary: string }>({
    action: "confirm_action",
    agent,
    projectId,
    draftId,
    ...(payload ? { payload } : {}),
  });
}

export function cancelProposedAction(agent: AgentType, projectId: string, draftId: string) {
  return callChat<{ ok: true; status: string }>({
    action: "cancel_action",
    agent,
    projectId,
    draftId,
  });
}