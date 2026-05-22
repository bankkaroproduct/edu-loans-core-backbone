import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type AppUser = Tables<"users">;

/**
 * Auth lifecycle status — single source of truth for guards.
 *
 * - `initializing` — boot or sign-in in flight. Profile not yet known.
 *                    Guards must render a skeleton, never redirect.
 * - `anonymous`    — no session. Guards redirect to the right login page.
 * - `authenticated`— session AND profile loaded AND profile is active.
 * - `unauthorized` — session exists but profile missing / inactive /
 *                    terminated. Guards must sign-out and redirect.
 */
type AuthStatus = "initializing" | "anonymous" | "authenticated" | "unauthorized";

type ExpectPortal = "admin" | "partner";

interface SignInOptions {
  /** Portal expectation; mismatched role is rejected with a typed error. */
  expect: ExpectPortal;
}

interface AuthContextType {
  status: AuthStatus;
  user: User | null;
  appUser: AppUser | null;
  /** @deprecated use `status === "initializing"` */
  loading: boolean;
  signIn: (email: string, password: string, opts: SignInOptions) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function isAdminRole(role: string | null | undefined) {
  return role === "super_admin" || role === "admin";
}
function isPartnerRole(role: string | null | undefined) {
  return role === "partner_admin" || role === "partner_agent";
}
function roleMatchesPortal(role: string | null | undefined, expect: ExpectPortal) {
  return expect === "admin" ? isAdminRole(role) : isPartnerRole(role);
}

async function fetchProfile(authUserId: string): Promise<AppUser | null> {
  // Single read, no round-trip via getUser(). Caller passes the id from the
  // sign-in response so we never race the in-memory session.
  const { data } = await supabase
    .from("users")
    .select("*")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  return data ?? null;
}

function profileIsActive(profile: AppUser | null): boolean {
  if (!profile) return false;
  if (profile.is_active === false) return false;
  if (profile.terminated_at) return false;
  return true;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("initializing");
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const userRef = useRef<User | null>(null);
  userRef.current = user;

  // Hydrate from a Supabase session (boot or auth event). Atomic: nothing
  // flips `status` until profile fetch + validity check completes.
  const hydrateFromSession = async (session: Session | null, mounted: () => boolean) => {
    const nextUser = session?.user ?? null;
    if (!nextUser) {
      if (!mounted()) return;
      setUser(null);
      setAppUser(null);
      setStatus("anonymous");
      return;
    }

    const profile = await fetchProfile(nextUser.id);
    if (!mounted()) return;

    setUser(nextUser);
    setAppUser(profile);
    setStatus(profileIsActive(profile) ? "authenticated" : "unauthorized");
  };

  useEffect(() => {
    let isMounted = true;
    const mounted = () => isMounted;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Silent token refresh / same-user re-emit: keep status, just update
      // token. Prevents skeleton flashes on tab refocus.
      const nextUserId = session?.user?.id ?? null;
      const currentUserId = userRef.current?.id ?? null;
      if (
        (event === "TOKEN_REFRESHED" || event === "SIGNED_IN") &&
        nextUserId &&
        nextUserId === currentUserId
      ) {
        if (isMounted && session?.user) setUser(session.user);
        return;
      }

      if (event === "SIGNED_OUT") {
        if (!isMounted) return;
        setUser(null);
        setAppUser(null);
        setStatus("anonymous");
        return;
      }

      // SIGNED_IN with a different user (or INITIAL_SESSION) → full hydrate.
      void hydrateFromSession(session, mounted);
    });

    void supabase.auth.getSession().then(({ data: { session } }) => {
      void hydrateFromSession(session, mounted);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string, opts: SignInOptions) => {
    // Atomic sign-in: password → profile fetch (using returned id, no
    // getUser round-trip) → role/portal validation. State is set
    // synchronously before returning, so the caller can hard-redirect
    // and the next boot sees a settled session.
    setStatus("initializing");

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      await supabase.auth.signOut().catch(() => undefined);
      setUser(null);
      setAppUser(null);
      setStatus("anonymous");
      return { error: error?.message ?? "Could not establish session. Please try again." };
    }

    const profile = await fetchProfile(data.user.id);

    if (!profile) {
      await supabase.auth.signOut().catch(() => undefined);
      setUser(null);
      setAppUser(null);
      setStatus("anonymous");
      return {
        error:
          opts.expect === "admin"
            ? "Admin profile not found. Please contact a super admin."
            : "Account profile not found. Please contact your administrator.",
      };
    }

    if (!profileIsActive(profile)) {
      await supabase.auth.signOut().catch(() => undefined);
      setUser(null);
      setAppUser(null);
      setStatus("anonymous");
      return {
        error:
          opts.expect === "admin"
            ? "This admin account is deactivated. Please contact a super admin."
            : "This account is deactivated. Please contact your administrator.",
      };
    }

    if (!roleMatchesPortal(profile.role, opts.expect)) {
      await supabase.auth.signOut().catch(() => undefined);
      setUser(null);
      setAppUser(null);
      setStatus("anonymous");
      return {
        error:
          opts.expect === "admin"
            ? "This account is not authorised for the Admin Portal. Please use the Partner Portal sign-in."
            : "This account is not authorised for the Partner Portal. Please use the Admin Portal sign-in.",
      };
    }

    setUser(data.user);
    setAppUser(profile);
    setStatus("authenticated");
    return { error: null };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: window.location.origin,
      },
    });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setAppUser(null);
    setStatus("anonymous");
  };

  const loading = status === "initializing";

  return (
    <AuthContext.Provider value={{ status, user, appUser, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
