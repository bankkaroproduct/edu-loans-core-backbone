import { useMemo } from "react";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";

/**
 * Partner visibility scope for admin lead-data queries.
 *
 * - Super admins: no restriction (see all partners).
 * - Regular admins: scoped to admin_partner_assignments.
 * - Regular admin with zero assignments: `hasNoScope` short-circuits any fetch
 *   to return empty results (UI shows an empty-state).
 *
 * Use `applyPartnerScope(query)` to inject `.in('partner_id', ids)` into any
 * Supabase query whose target table has a `partner_id` column. For lead-derived
 * tables (lead_documents, lead_stage_history, etc.), fetch scoped lead ids
 * via `student_leads` first and filter `.in('lead_id', ids)`.
 */
export interface AdminLeadScope {
  ready: boolean;
  isSuperAdmin: boolean;
  /** Empty array when super admin (means "no restriction"). */
  scopedPartnerIds: string[];
  /** True when regular admin has zero assigned partners — callers should skip queries. */
  hasNoScope: boolean;
  /** Conditionally inject `.in('partner_id', ids)` for regular admins. */
  applyPartnerScope: <T>(query: T, column?: string) => T;
}

export function useAdminLeadScope(): AdminLeadScope {
  const { loading, isSuperAdmin, assignedPartnerIds } = useAdminPermissions();

  return useMemo<AdminLeadScope>(() => {
    const ready = !loading;
    const hasNoScope = ready && !isSuperAdmin && assignedPartnerIds.length === 0;
    const scopedPartnerIds = isSuperAdmin ? [] : assignedPartnerIds;

    const applyPartnerScope = <T,>(query: T, column = "partner_id"): T => {
      if (isSuperAdmin) return query;
      // Sentinel UUID guarantees an empty result set for the rare race where a
      // caller forgets the hasNoScope short-circuit.
      const ids = assignedPartnerIds.length
        ? assignedPartnerIds
        : ["00000000-0000-0000-0000-000000000000"];
      // PostgREST builder is chainable but not typed here — `any` cast keeps
      // the public hook signature generic for both queries and counts.
      return (query as any).in(column, ids) as T;
    };

    return { ready, isSuperAdmin, scopedPartnerIds, hasNoScope, applyPartnerScope };
  }, [loading, isSuperAdmin, assignedPartnerIds]);
}
