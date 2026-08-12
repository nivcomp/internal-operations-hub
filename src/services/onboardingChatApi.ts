import { supabase } from "../integrations/supabase/client";

export type OnboardingTurn = { role: "user" | "assistant"; body: string; at: string };

export type LiveDocument = {
  summary?: string;
  businessGoal?: string;
  currentSituation?: string;
  desiredOutcome?: string;
  requirements?: string[];
  integrations?: string[];
  workflow?: string[];
  phases?: string[];
  openQuestions?: string[];
  assumptions?: string[];
  risks?: string[];
  exclusions?: string[];
  timeline?: string;
  estimatedHoursMin?: number;
  estimatedHoursMax?: number;
  estimatedBudgetNote?: string;
  requestedDate?: string;
  scopeVersion?: number;
};

export type LiveFlow = {
  nodes?: Array<{ id: string; label: string; kind?: string }>;
  edges?: Array<{ from: string; to: string; label?: string }>;
};

export type LiveSupplierProfile = {
  background?: string;
  skills?: string[];
  tools?: string[];
  languages?: string[];
  specialisations?: string[];
  experienceYears?: number;
  typicalProjectSize?: string;
  portfolioLinks?: string[];
  certificates?: string[];
  availabilityHours?: number;
  timezone?: string;
  workingHours?: string;
  communication?: string;
  hourlyRate?: number;
  currency?: string;
  fixedPricePreference?: string;
  earliestStart?: string;
  responseTime?: string;
};

export type OnboardingAnswers = Record<string, any> & {
  _transcript?: OnboardingTurn[];
  _document?: LiveDocument;
  _profile?: LiveSupplierProfile;
  _flow?: LiveFlow;
  _confidence?: number;
  _missing?: string[];
  _readyToSubmit?: boolean;
};

export type OnboardingIdentity = {
  clientId: string;
  clientName: string;
  businessName: string;
  email: string;
};

export type OnboardingChatResponse = {
  reply?: string;
  answers: OnboardingAnswers;
  transcript: OnboardingTurn[];
  identity?: OnboardingIdentity;
  readyToSubmit?: boolean;
  completedAt?: string | null;
};

async function call(payload: Record<string, unknown>): Promise<OnboardingChatResponse> {
  const { data, error } = await supabase.functions.invoke("onboarding-chat", { body: payload });
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
  return data as OnboardingChatResponse;
}

export const loadOnboardingConversation = () => call({ action: "state" });
export const sendOnboardingMessage = (message: string) => call({ action: "send", message });
export const patchOnboardingAnswers = (patch: Record<string, unknown>) => call({ action: "patch", patch });
