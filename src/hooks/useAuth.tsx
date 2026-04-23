import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type AppUser = Tables<"users">;

interface AuthContextType {
  user: User | null;
  appUser: AppUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const userRef = useRef<User | null>(null);
  userRef.current = user;

  const loadAppUser = async (authUserId: string | null) => {
    if (!authUserId) {
      setAppUser(null);
      return;
    }

    const { data } = await supabase
      .from("users")
      .select("*")
      .eq("auth_user_id", authUserId)
      .maybeSingle();

    setAppUser(data ?? null);
  };

  useEffect(() => {
    let mounted = true;

    const syncSession = (session: Session | null) => {
      if (!mounted) return;

      const nextUser = session?.user ?? null;
      setUser(nextUser);

      if (!nextUser) {
        setAppUser(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      void loadAppUser(nextUser.id).finally(() => {
        if (mounted) setLoading(false);
      });
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Tab refocus / silent token refresh: Supabase fires TOKEN_REFRESHED or
      // SIGNED_IN with the SAME user id. Do NOT flip `loading` or refetch
      // appUser — that would unmount the current admin page (skeleton flash)
      // and wipe in-memory state. Just keep the new session token.
      const nextUserId = session?.user?.id ?? null;
      const currentUserId = userRef.current?.id ?? null;
      if (
        (event === "TOKEN_REFRESHED" || event === "SIGNED_IN") &&
        nextUserId &&
        nextUserId === currentUserId
      ) {
        if (mounted) setUser(session!.user);
        return;
      }
      syncSession(session);
    });

    void supabase.auth.getSession().then(({ data: { session } }) => {
      syncSession(session);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
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
  };

  return (
    <AuthContext.Provider value={{ user, appUser, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
