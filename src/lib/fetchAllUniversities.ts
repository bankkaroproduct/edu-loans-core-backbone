// Shared paginated fetcher for universities_master.
//
// PostgREST caps a single `select` response at 1000 rows by default. The
// universities_master table exceeds that, so any consumer that lists or
// validates the full set must paginate via .range(). This helper centralizes
// that loop so Admin, Partner, and Student flows all see the same data.
//
// Scope: universities_master only. Do not generalize to other masters here.
import { supabase } from "@/integrations/supabase/client";

const PAGE_SIZE = 1000;
const SAFETY_CAP = 50_000;

export interface FetchAllUniversitiesOptions {
  /** Default true — filter to active_flag = true. */
  activeOnly?: boolean;
  /** Optional ORDER BY column (ascending). */
  orderBy?: string;
}

/**
 * Fetch every row of universities_master matching the given filters.
 * @param select PostgREST select string (e.g. "*", "id,university_name").
 */
export async function fetchAllUniversitiesMaster<T = any>(
  select: string,
  opts: FetchAllUniversitiesOptions = {},
): Promise<T[]> {
  const { activeOnly = true, orderBy } = opts;
  const out: T[] = [];
  let from = 0;
  while (from < SAFETY_CAP) {
    let q = supabase.from("universities_master").select(select);
    if (activeOnly) q = q.eq("active_flag", true);
    if (orderBy) q = q.order(orderBy, { ascending: true });
    const { data, error } = await q.range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return out;
}
