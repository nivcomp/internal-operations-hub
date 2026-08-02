import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User as AuthUser } from "@supabase/supabase-js";
import { supabase } from "../integrations/supabase/client";
import type { UserRole } from "../types/domain";

export type Profile = {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  clientId?: string;
  supplierId?: string;
  isActive: boolean;
};

export type AuthStatus = "loading" | "signed_out" | "signed_in" | "no_profile";

type AuthValue = {
  status: AuthStatus;
  session: Session | null;
  user: AuthUser | null;
  profile: Profile | null;
  profileError: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

function mapProfile(row: Record<string, any>): Profile {
  return {
    id: row.id,
    fullName: row.full_name ?? row.email ?? "",
    email: row.email ?? "",
    role: row.role as UserRole,
    clientId: row.client_id ?? undefined,
    supplierId: row.supplier_id ?? undefined,
    isActive: row.is_active !== false,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [initialised, setInitialised] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);

  const loadProfile = useCallback(async (userId: string) => {
    setProfileLoading(true);
    setProfileError(null);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, role, client_id, supplier_id, is_active")
      .eq("id", userId)
      .maybeSingle();
    if (error) {
      setProfile(null);
      setProfileError(error.message);
    } else if (!data) {
      setProfile(null);
      setProfileError("No profile is linked to this account yet. Ask the agency admin for access.");
    } else {
      const mapped = mapProfile(data);
      setProfile(mapped.isActive ? mapped : null);
      if (!mapped.isActive) setProfileError("This account has been deactivated.");
    }
    setProfileLoading(false);
  }, []);

  useEffect(() => {
    // Register the listener first so no auth event is missed.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession?.user) {
        // Defer the Supabase call out of the auth callback.
        setTimeout(() => { void loadProfile(nextSession.user.id); }, 0);
      } else {
        setProfile(null);
        setProfileError(null);
      }
    });

    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) void loadProfile(data.session.user.id);
      setInitialised(true);
    });

    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw new Error(error.message);
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw new Error(error.message);
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw new Error(error.message);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session?.user) await loadProfile(session.user.id);
  }, [session, loadProfile]);

  const status: AuthStatus = !initialised
    ? "loading"
    : !session
      ? "signed_out"
      : profileLoading
        ? "loading"
        : profile
          ? "signed_in"
          : "no_profile";

  return (
    <AuthContext.Provider
      value={{
        status,
        session,
        user: session?.user ?? null,
        profile,
        profileError,
        signIn,
        signOut,
        requestPasswordReset,
        updatePassword,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
