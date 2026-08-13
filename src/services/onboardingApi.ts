import { supabase } from "../integrations/supabase/client";
import type { UserRole } from "../types/domain";

// The onboarding table is new; the generated types may lag behind it.
const db = supabase as any;

export type OnboardingState = {
  profileId: string;
  role: UserRole;
  currentStep: number;
  skippedSteps: string[];
  completionPercentage: number;
  answers: Record<string, unknown>;
  startedAt: string;
  completedAt: string | null;
};

function map(row: Record<string, any>): OnboardingState {
  return {
    profileId: row.profile_id,
    role: row.role,
    currentStep: row.current_step ?? 0,
    skippedSteps: row.skipped_steps ?? [],
    completionPercentage: row.completion_percentage ?? 0,
    answers: (row.answers ?? {}) as Record<string, unknown>,
    startedAt: row.onboarding_started_at,
    completedAt: row.onboarding_completed_at ?? null,
  };
}

export async function fetchOnboardingState(profileId: string): Promise<OnboardingState | null> {
  const { data, error } = await db
    .from("onboarding_state")
    .select("*")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? map(data) : null;
}

export async function ensureOnboardingState(profileId: string, role: UserRole): Promise<OnboardingState> {
  const existing = await fetchOnboardingState(profileId);
  if (existing) return existing;
  const { data, error } = await db
    .from("onboarding_state")
    .insert({ profile_id: profileId, role })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return map(data);
}

export async function saveOnboardingState(
  profileId: string,
  patch: Partial<Pick<OnboardingState, "currentStep" | "skippedSteps" | "completionPercentage" | "answers" | "completedAt">>,
): Promise<OnboardingState> {
  const row: Record<string, unknown> = {};
  if (patch.currentStep !== undefined) row.current_step = patch.currentStep;
  if (patch.skippedSteps !== undefined) row.skipped_steps = patch.skippedSteps;
  if (patch.completionPercentage !== undefined) row.completion_percentage = patch.completionPercentage;
  if (patch.answers !== undefined) row.answers = patch.answers;
  if (patch.completedAt !== undefined) row.onboarding_completed_at = patch.completedAt;

  const { data, error } = await db
    .from("onboarding_state")
    .update(row)
    .eq("profile_id", profileId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return map(data);
}

/** Saves the supplier profile and sends it to the agency for approval. */
export async function submitSupplierOnboarding(answers: Record<string, unknown>): Promise<string> {
  const { data, error } = await db.rpc("submit_supplier_onboarding", { _answers: answers });
  if (error) throw new Error(error.message);
  return data as string;
}
