import { useAuth } from "@/hooks/useAuth";

export function useRoleAccess() {
  const { appUser } = useAuth();

  const role = appUser?.role ?? null;
  const isPartnerAdmin = role === "partner_admin";
  const isPartnerAgent = role === "partner_agent";
  const isAdmin = role === "super_admin" || role === "admin";
  const userId = appUser?.id ?? null;
  const partnerId = appUser?.partner_id ?? null;

  return {
    role,
    isPartnerAdmin,
    isPartnerAgent,
    isAdmin,
    userId,
    partnerId,
    /** For partner_agent, returns their user ID to scope queries. For admins/partner_admin, returns null (no extra filter). */
    agentUserId: isPartnerAgent ? userId : null,
  };
}
