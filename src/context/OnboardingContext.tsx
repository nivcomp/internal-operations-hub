import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "./AuthContext";
import {
  ensureOnboardingState,
  saveOnboardingState,
  type OnboardingState,
} from "../services/onboardingApi";

type OnboardingValue = {
  loading: boolean;
  error: string | null;
  state: OnboardingState | null;
  /** True while the role still has onboarding to complete. */
  needsOnboarding: boolean;
  save: (patch: Parameters<typeof saveOnboardingState>[1]) => Promise<void>;
  markComplete: () => Promise<void>;
  restart: () => Promise<void>;
  refresh: () => Promise<void>;
};

const OnboardingContext = createContext<OnboardingValue | null>(null);

export function useOnboarding(): OnboardingValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used within <OnboardingProvider>");
  return ctx;
}

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [state, setState] = useState<OnboardingState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      setState(await ensureOnboardingState(profile.id, profile.role));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load onboarding progress.");
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => { void load(); }, [load]);

  const save = useCallback(async (patch: Parameters<typeof saveOnboardingState>[1]) => {
    if (!profile) return;
    const next = await saveOnboardingState(profile.id, patch);
    setState(next);
  }, [profile]);

  const markComplete = useCallback(async () => {
    await save({ completionPercentage: 100, completedAt: new Date().toISOString() });
  }, [save]);

  const restart = useCallback(async () => {
    await save({ currentStep: 0, completionPercentage: 0, completedAt: null });
  }, [save]);

  // Agency admins are never blocked: their setup assistant is a checklist, not a gate.
  const needsOnboarding =
    !!profile && profile.role !== "agency_admin" && !!state && !state.completedAt;

  return (
    <OnboardingContext.Provider
      value={{ loading, error, state, needsOnboarding, save, markComplete, restart, refresh: load }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}