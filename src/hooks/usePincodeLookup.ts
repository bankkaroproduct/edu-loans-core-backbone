// Debounced lookup against the public.pincode_master table.
// Returns { found, district, state, tier, hasConflict } once a 6-digit pincode is entered.
// In-memory LRU cache (last 50 lookups). Empty / partial input → no lookup.

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PincodeLookupResult {
  loading: boolean;
  found: boolean | null; // null = not yet looked up
  district: string | null;
  state: string | null;
  tier: string | null;
  hasConflict: boolean;
}

const EMPTY: PincodeLookupResult = {
  loading: false,
  found: null,
  district: null,
  state: null,
  tier: null,
  hasConflict: false,
};

// Tiny LRU
const cache = new Map<string, PincodeLookupResult>();
const CACHE_MAX = 50;
function rememberInCache(key: string, value: PincodeLookupResult) {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, value);
  if (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
}

export function usePincodeLookup(pincode: string | null | undefined): PincodeLookupResult {
  const [result, setResult] = useState<PincodeLookupResult>(EMPTY);
  const requestSeq = useRef(0);

  useEffect(() => {
    const trimmed = (pincode ?? "").trim();
    if (!/^\d{6}$/.test(trimmed)) {
      setResult(EMPTY);
      return;
    }

    const cached = cache.get(trimmed);
    if (cached) {
      setResult(cached);
      return;
    }

    setResult((r) => ({ ...r, loading: true }));
    const seq = ++requestSeq.current;

    const handle = window.setTimeout(async () => {
      const { data, error } = await supabase
        .from("pincode_master")
        .select("district, state, tier, has_conflict")
        .eq("pincode", trimmed)
        .maybeSingle();

      // Stale response guard
      if (seq !== requestSeq.current) return;

      if (error) {
        const next: PincodeLookupResult = { ...EMPTY, found: false };
        setResult(next);
        return;
      }

      const next: PincodeLookupResult = data
        ? {
            loading: false,
            found: true,
            district: data.district ?? null,
            state: data.state ?? null,
            tier: data.tier ?? null,
            hasConflict: !!data.has_conflict,
          }
        : { ...EMPTY, found: false };

      rememberInCache(trimmed, next);
      setResult(next);
    }, 300);

    return () => window.clearTimeout(handle);
  }, [pincode]);

  return result;
}
