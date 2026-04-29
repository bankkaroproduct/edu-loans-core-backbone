import { useEffect, useState } from "react";
import {
  EMPLOYMENT_TYPE_OPTIONS,
  fetchEmploymentTypeOptions,
} from "@/lib/employmentTypeOptions";

/**
 * Returns active "Employment Type" options from the master table
 * (`employment_type_master`). Synchronously seeded with the hard-coded fallback
 * so the dropdown never renders empty — DB values replace the fallback once
 * they arrive. Mirrors `useHighestQualificationOptions`.
 */
export function useEmploymentTypeOptions() {
  const [options, setOptions] = useState<string[]>(() => [...EMPLOYMENT_TYPE_OPTIONS]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    fetchEmploymentTypeOptions()
      .then((opts) => {
        if (!cancelled && opts.length > 0) setOptions(opts);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { options, loading };
}
