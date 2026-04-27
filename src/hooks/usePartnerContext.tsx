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
  /**
   * For partner-role users: true when the partner organization status is anything
   * other than 'active' (e.g. inactive, suspended, terminated, onboarding).
   * Always false for admins (admins are never gated by partner-org status).
   * `null` while still resolving on first load.
   */
  isPartnerInactive: boolean | null;
  /** The raw partner organization status for partner-role users (null for admins or while loading). */
  partnerOrgStatus: string | null;
  /**
   * True when the *effective* partner (own org for partners, simulated org for admins)
   * is anything other than 'active'. Used to gate NEW lead initiation surfaces
   * (Add Lead, Quick Lead, Bulk Upload) for both partners AND admins acting on
   * behalf of an inactive partner. `null` while still resolving. `false` for
   * admins when no partner is simulated (admin context with no target).
   */
  isEffectivePartnerInactive: boolean | null;
  /** Status string for the effective partner (own for partner role, simulated for admin). */
  effectivePartnerStatus: string | null;
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
  const [partnerOrgStatus, setPartnerOrgStatus] = useState<string | null>(null);

  const isAdmin = appUser?.role === "super_admin" || appUser?.role === "admin";
  const isPartnerRole = appUser?.role === "partner_admin" || appUser?.role === "partner_agent";

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

  // Fetch own partner org status for partner-role users (one-shot per partner_id).
  // Used to gate new-lead submission surfaces when status !== 'active'.
  useEffect(() => {
    if (!isPartnerRole || !appUser?.partner_id) {
      setPartnerOrgStatus(null);
      return;
    }
    let cancelled = false;
    supabase
      .from("partner_organizations")
      .select("status")
      .eq("id", appUser.partner_id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setPartnerOrgStatus(data?.status ?? null);
      });
    return () => { cancelled = true; };
  }, [isPartnerRole, appUser?.partner_id]);

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

  // Admins are never gated. For partner roles, treat as inactive whenever the
  // org status is anything other than 'active'. `null` while the status query
  // is still in flight, so callers can avoid flashing the gate prematurely.
  const isPartnerInactive = isAdmin
    ? false
    : isPartnerRole
      ? (partnerOrgStatus === null ? null : partnerOrgStatus !== "active")
      : false;

  return (
    <PartnerContext.Provider
      value={{
        effectivePartnerId,
        effectivePartnerName,
        isSimulating,
        partnerOptions,
        simulatePartner,
        effectiveUserId: appUser?.id ?? null,
        isPartnerInactive,
        partnerOrgStatus,
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
