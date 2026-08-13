import { supabase } from "../integrations/supabase/client";
import type { LeadConversationStatus, LiveDocument, LiveFlow, OnboardingAnswers } from "./onboardingChatApi";

export type LeadConversationMessage = {
  id: string;
  conversation_id: string;
  sender_type: "client" | "agency_admin" | "ai_agent" | "system";
  sender_profile_id: string | null;
  body: string;
  visibility: "client_agency" | "agency_only";
  created_at: string;
};

export type LeadConversation = {
  id: string;
  profileId: string;
  clientId: string;
  status: LeadConversationStatus;
  contactName: string;
  businessName: string;
  email: string;
  phone: string;
  clientStatus: string;
  projectId: string | null;
  projectName: string;
  projectStatus: string;
  progress: number;
  answers?: OnboardingAnswers;
  document: LiveDocument;
  flow?: LiveFlow;
  pauseMessage: string;
  disqualificationReason: string;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  lastClientMessageAt: string | null;
  lastAgencyMessageAt: string | null;
  unread: boolean;
  lastMessage: {
    body: string;
    senderType: string;
    visibility: string;
    createdAt: string;
  } | null;
  messages?: LeadConversationMessage[];
};

async function call<T>(payload: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("lead-conversations", { body: payload });
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

export async function listLeadConversations(): Promise<LeadConversation[]> {
  const result = await call<{ conversations: LeadConversation[] }>({ action: "list" });
  return result.conversations ?? [];
}

export async function getLeadConversation(conversationId: string): Promise<LeadConversation> {
  const result = await call<{ conversation: LeadConversation }>({ action: "detail", conversationId });
  return result.conversation;
}

export async function markLeadConversationRead(conversationId: string): Promise<void> {
  await call({ action: "markRead", conversationId });
}

export async function sendLeadManagerMessage(
  conversationId: string,
  body: string,
  visibility: "client_agency" | "agency_only",
): Promise<LeadConversation> {
  const result = await call<{ conversation: LeadConversation }>({ action: "message", conversationId, body, visibility });
  return result.conversation;
}

export async function setLeadConversationStatus(
  conversationId: string,
  status: "active" | "paused" | "disqualified",
  options: { clientMessage?: string; reason?: string } = {},
): Promise<LeadConversation> {
  const result = await call<{ conversation: LeadConversation }>({
    action: "setStatus",
    conversationId,
    status,
    ...options,
  });
  return result.conversation;
}

export async function promoteLeadConversation(conversationId: string, projectName: string): Promise<string> {
  const result = await call<{ projectId: string }>({ action: "promote", conversationId, projectName });
  return result.projectId;
}
