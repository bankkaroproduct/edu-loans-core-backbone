import { useMemo } from "react";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";
import { useAuth } from "@/hooks/useAuth";

/**
 * Partner visibility scope for admin lead-data queries.
 *
 * - Super admins: no restriction (see all partners).
 * - Regular admins: leads belonging to their assigned partners
 *   (admin_partner_assignments) OR leads they personally created
 *   (student_leads.created_by = users.id). The OR keeps admin-created
 *   Student Direct leads visible to their creator without leaking every
 *   other admin's PTR-DIRECT leads.
 * - Regular admin with zero assigned partners AND no user id resolved:
 *   `hasNoScope` short-circuits any fetch to return empty results.
 */
export interface AdminLeadScope {
  ready: boolean;
  isSuperAdmin: boolean;
  /** Empty array when super admin (means "no restriction"). */
  scopedPartnerIds: string[];
  /** Current admin's `users.id` (used for creator-based OR scoping). */
  currentUserId: string | null;
  /** True when regular admin has no effective scope — callers should skip queries. */
  hasNoScope: boolean;
  /** Conditionally inject scope (partner_id IN ids OR created_by = me) for regular admins. */
  applyPartnerScope: <T>(query: T, column?: string) => T;
}

export function useAdminLeadScope(): AdminLeadScope {
  const { loading, isSuperAdmin, assignedPartnerIds } = useAdminPermissions();
  const { appUser } = useAuth();
  const currentUserId = appUser?.id ?? null;

  return useMemo<AdminLeadScope>(() => {
    const ready = !loading && (isSuperAdmin || !!currentUserId);

    const hasNoScope =
      ready && !isSuperAdmin && assignedPartnerIds.length === 0 && !currentUserId;

    const applyPartnerScope = <T,>(query: T, column = "partner_id"): T => {
      if (isSuperAdmin) return query;
      const ids = assignedPartnerIds;
      // Build PostgREST `.or()` filter combining partner-in + creator-eq.
      // When both halves are empty, force a no-match sentinel.
      const parts: string[] = [];
      if (ids.length) parts.push(`${column}.in.(${ids.join(",")})`);
      if (currentUserId) parts.push(`created_by.eq.${currentUserId}`);
      if (parts.length === 0) {
        return (query as any).eq(column, "00000000-0000-0000-0000-000000000000") as T;
      }
      if (parts.length === 1) {
        // Single-condition path — use native filters for cleaner queries.
        if (ids.length) return (query as any).in(column, ids) as T;
        return (query as any).eq("created_by", currentUserId) as T;
      }
      return (query as any).or(parts.join(",")) as T;
    };

    return {
      ready,
      isSuperAdmin,
      scopedPartnerIds: isSuperAdmin ? [] : assignedPartnerIds,
      currentUserId,
      hasNoScope,
      applyPartnerScope,
    };
  }, [loading, isSuperAdmin, assignedPartnerIds, currentUserId]);
}
