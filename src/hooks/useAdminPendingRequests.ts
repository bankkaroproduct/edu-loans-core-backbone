import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

/**
 * Lightweight admin-wide pending edit-request count.
 * - HEAD count query (no rows fetched).
 * - Refetches on route change (cheap).
 * - Subscribes to lead_edit_requests realtime so badge stays live.
 */
export function useAdminPendingRequests() {
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const location = useLocation();

  const fetchCount = useCallback(async () => {
    const { count: c, error } = await supabase
      .from("lead_edit_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");
    if (!error) setCount(c ?? 0);
    setLoading(false);
  }, []);

  useEffect(() => { fetchCount(); }, [fetchCount, location.pathname]);

  useEffect(() => {
    const ch = supabase
      .channel(`admin-pending-edit-requests-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "lead_edit_requests" },
        () => { fetchCount(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchCount]);

  return { count, loading, refresh: fetchCount };
}
