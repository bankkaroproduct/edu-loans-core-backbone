import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";

/**
 * Partner visibility scope for admin lead-data queries.
 *
 * - Super admins: no restriction (see all partners).
 * - Regular admins: scoped to admin_partner_assignments PLUS the implicit
 *   PTR-DIRECT partner (which owns leads that admins create directly from
 *   the portal). Without this auto-inclusion, admins would create leads
 *   they then can't see in the queue.
 * - Regular admin with zero assignments AND PTR-DIRECT lookup failed:
 *   `hasNoScope` short-circuits any fetch to return empty results.
 */
export interface AdminLeadScope {
  ready: boolean;
  isSuperAdmin: boolean;
  /** Empty array when super admin (means "no restriction"). */
  scopedPartnerIds: string[];
  /** True when regular admin has zero effective partners — callers should skip queries. */
  hasNoScope: boolean;
  /** Conditionally inject `.in('partner_id', ids)` for regular admins. */
  applyPartnerScope: <T>(query: T, column?: string) => T;
}

// Module-level cache — PTR-DIRECT's id is global and immutable.
let ptrDirectIdCache: string | null = null;
let ptrDirectPromise: Promise<string | null> | null = null;

async function fetchPtrDirectId(): Promise<string | null> {
  if (ptrDirectIdCache) return ptrDirectIdCache;
  if (ptrDirectPromise) return ptrDirectPromise;
  ptrDirectPromise = (async () => {
    const { data } = await supabase
      .from("partner_organizations")
      .select("id")
      .eq("partner_code", "PTR-DIRECT")
      .maybeSingle();
    ptrDirectIdCache = data?.id ?? null;
    return ptrDirectIdCache;
  })();
  return ptrDirectPromise;
}

export function useAdminLeadScope(): AdminLeadScope {
  const { loading, isSuperAdmin, assignedPartnerIds } = useAdminPermissions();
  const [ptrDirectId, setPtrDirectId] = useState<string | null>(ptrDirectIdCache);
  const [ptrDirectLoaded, setPtrDirectLoaded] = useState<boolean>(ptrDirectIdCache !== null);

  useEffect(() => {
    if (isSuperAdmin || loading) return;
    if (ptrDirectIdCache !== null) {
      setPtrDirectId(ptrDirectIdCache);
      setPtrDirectLoaded(true);
      return;
    }
    let cancelled = false;
    fetchPtrDirectId().then((id) => {
      if (cancelled) return;
      setPtrDirectId(id);
      setPtrDirectLoaded(true);
    });
    return () => { cancelled = true; };
  }, [isSuperAdmin, loading]);

  return useMemo<AdminLeadScope>(() => {
    // Super admins: ready as soon as permissions load. PTR-DIRECT lookup not needed.
    const ready = !loading && (isSuperAdmin || ptrDirectLoaded);

    const effectiveIds = isSuperAdmin
      ? []
      : [...assignedPartnerIds, ...(ptrDirectId ? [ptrDirectId] : [])];

    const hasNoScope = ready && !isSuperAdmin && effectiveIds.length === 0;
    const scopedPartnerIds = effectiveIds;

    const applyPartnerScope = <T,>(query: T, column = "partner_id"): T => {
      if (isSuperAdmin) return query;
      const ids = effectiveIds.length
        ? effectiveIds
        : ["00000000-0000-0000-0000-000000000000"];
      return (query as any).in(column, ids) as T;
    };

    return { ready, isSuperAdmin, scopedPartnerIds, hasNoScope, applyPartnerScope };
  }, [loading, isSuperAdmin, assignedPartnerIds, ptrDirectId, ptrDirectLoaded]);
}
