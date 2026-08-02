import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "../integrations/supabase/client";

export type AgentType = "project_guide" | "agency_control" | "work_assistant";

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
    proposed_actions?: { title: string; detail: string; affects?: string }[];
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
  return callChat<{ conversation: ChatConversation; messages: ChatMessage[]; drafts: ChatDraft[] }>({
    action: "history",
    agent,
    projectId,
  });
}

export function sendChatMessage(agent: AgentType, projectId: string, body: string) {
  return callChat<{ conversation: ChatConversation; userMessage: ChatMessage; aiMessage: ChatMessage; draft: ChatDraft | null }>({
    action: "send",
    agent,
    projectId,
    body,
  });
}