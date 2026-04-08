import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Tables } from "@/integrations/supabase/types";

type PartnerOrg = Tables<"partner_organizations">;

const SESSION_KEY = "eduloans_simulated_partner";

interface PartnerContextType {
  /** The partner_id to use for partner-scoped operations (simulated or real) */
  effectivePartnerId: string | null;
  /** The partner org display name */
  effectivePartnerName: string | null;
  /** Whether admin is currently simulating a partner */
  isSimulating: boolean;
  /** Available partners for admin to pick from */
  partnerOptions: Pick<PartnerOrg, "id" | "display_name" | "partner_code">[];
  /** Set simulated partner (admin only) */
  simulatePartner: (partnerId: string | null) => void;
  /** The effective user id for partner_user_id field */
  effectiveUserId: string | null;
}

const PartnerContext = createContext<PartnerContextType | undefined>(undefined);

export function PartnerContextProvider({ children }: { children: ReactNode }) {
  const { appUser } = useAuth();

  // Restore from sessionStorage on mount
  const [simulatedPartnerId, setSimulatedPartnerId] = useState<string | null>(() => {
    try {
      const stored = sessionStorage.getItem(SESSION_KEY);
      return stored ? JSON.parse(stored).id : null;
    } catch { return null; }
  });
  const [simulatedPartnerName, setSimulatedPartnerName] = useState<string | null>(() => {
    try {
      const stored = sessionStorage.getItem(SESSION_KEY);
      return stored ? JSON.parse(stored).name : null;
    } catch { return null; }
  });
  const [partnerOptions, setPartnerOptions] = useState<Pick<PartnerOrg, "id" | "display_name" | "partner_code">[]>([]);

  const isAdmin = appUser?.role === "super_admin" || appUser?.role === "admin";

  // Fetch partner list for admins
  useEffect(() => {
    if (!isAdmin) {
      setPartnerOptions([]);
      return;
    }
    supabase
      .from("partner_organizations")
      .select("id, display_name, partner_code")
      .eq("status", "active")
      .order("display_name")
      .then(({ data }) => {
        const opts = data ?? [];
        setPartnerOptions(opts);
        // If restored partner no longer valid, clear
        if (simulatedPartnerId && !opts.find((p) => p.id === simulatedPartnerId)) {
          setSimulatedPartnerId(null);
          setSimulatedPartnerName(null);
          sessionStorage.removeItem(SESSION_KEY);
        }
      });
  }, [isAdmin]);

  const simulatePartner = (partnerId: string | null) => {
    if (!isAdmin) return;
    setSimulatedPartnerId(partnerId);
    if (!partnerId) {
      setSimulatedPartnerName(null);
      sessionStorage.removeItem(SESSION_KEY);
    } else {
      const org = partnerOptions.find((p) => p.id === partnerId);
      const name = org?.display_name ?? null;
      setSimulatedPartnerName(name);
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id: partnerId, name }));
    }
  };

  const effectivePartnerId = isAdmin ? simulatedPartnerId : (appUser?.partner_id ?? null);
  const effectivePartnerName = isAdmin && simulatedPartnerId ? simulatedPartnerName : null;
  const isSimulating = isAdmin && !!simulatedPartnerId;

  return (
    <PartnerContext.Provider
      value={{
        effectivePartnerId,
        effectivePartnerName,
        isSimulating,
        partnerOptions,
        simulatePartner,
        effectiveUserId: appUser?.id ?? null,
      }}
    >
      {children}
    </PartnerContext.Provider>
  );
}

export function usePartnerContext() {
  const ctx = useContext(PartnerContext);
  if (!ctx) throw new Error("usePartnerContext must be used within PartnerContextProvider");
  return ctx;
}
