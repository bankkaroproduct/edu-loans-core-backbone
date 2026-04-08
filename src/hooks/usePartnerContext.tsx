import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Tables } from "@/integrations/supabase/types";

type PartnerOrg = Tables<"partner_organizations">;

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
  const [simulatedPartnerId, setSimulatedPartnerId] = useState<string | null>(null);
  const [simulatedPartnerName, setSimulatedPartnerName] = useState<string | null>(null);
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
      .then(({ data }) => setPartnerOptions(data ?? []));
  }, [isAdmin]);

  const simulatePartner = (partnerId: string | null) => {
    if (!isAdmin) return;
    setSimulatedPartnerId(partnerId);
    if (!partnerId) {
      setSimulatedPartnerName(null);
    } else {
      const org = partnerOptions.find((p) => p.id === partnerId);
      setSimulatedPartnerName(org?.display_name ?? null);
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
