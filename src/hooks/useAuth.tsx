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

interface SignInResult {
  error: string | null;
  /** Set to "rate_limited" when Lovable Cloud Auth returned HTTP 429. */
  code?: "rate_limited";
  /** Seconds to wait before retry when rate-limited. Default 900 (15 min). */
  retryAfterSec?: number;
}

interface AuthContextType {
  status: AuthStatus;
  user: User | null;
  appUser: AppUser | null;
  /** @deprecated use `status === "initializing"` */
  loading: boolean;
  signIn: (email: string, password: string, opts: SignInOptions) => Promise<SignInResult>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

/**
 * Soft client-side attempt counter — cosmetic UX only, NOT a security control.
 * Real rate-limiting is enforced by Lovable Cloud Auth at the server (HTTP 429).
 * Anyone clearing sessionStorage bypasses this counter; that's fine.
 */
const SOFT_COUNTER_WINDOW_MS = 15 * 60 * 1000;
const SOFT_COUNTER_MAX = 5;
function softCounterKey(email: string) {
  return `login_attempts:${email.toLowerCase()}`;
}
export function readSoftCounter(email: string): { count: number; firstAt: number } | null {
  try {
    const raw = sessionStorage.getItem(softCounterKey(email));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { count: number; firstAt: number };
    if (Date.now() - parsed.firstAt > SOFT_COUNTER_WINDOW_MS) {
      sessionStorage.removeItem(softCounterKey(email));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
function bumpSoftCounter(email: string) {
  const cur = readSoftCounter(email);
  const next = cur ? { count: cur.count + 1, firstAt: cur.firstAt } : { count: 1, firstAt: Date.now() };
  sessionStorage.setItem(softCounterKey(email), JSON.stringify(next));
}
export function clearSoftCounter(email: string) {
  sessionStorage.removeItem(softCounterKey(email));
}
export const SOFT_LIMITS = { max: SOFT_COUNTER_MAX, windowMs: SOFT_COUNTER_WINDOW_MS };

function isRateLimitError(err: { message?: string; status?: number } | null | undefined): boolean {
  if (!err) return false;
  if (err.status === 429) return true;
  const msg = (err.message || "").toLowerCase();
  return msg.includes("rate limit") || msg.includes("too many");
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

    // Stale-hydration guard: if the active session changed while we were
    // fetching (e.g. a newer Partner login landed after an older Admin
    // hydrate kicked off), discard this result so we don't overwrite the
    // newer authenticated state with stale profile data.
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (!mounted()) return;
    if ((currentSession?.user?.id ?? null) !== nextUser.id) return;

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

      // Lovable Cloud Auth returned 429 — surface a structured rate-limit code
      // so login screens can render the lockout notice with a countdown.
      if (isRateLimitError(error as any)) {
        return {
          error: "Too many sign-in attempts. Please wait a few minutes and try again.",
          code: "rate_limited" as const,
          retryAfterSec: 15 * 60,
        };
      }

      // Bad-credentials / other auth failure → bump the cosmetic soft counter.
      bumpSoftCounter(email);
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
    clearSoftCounter(email);
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
