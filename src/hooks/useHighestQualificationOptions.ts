import { useEffect, useState } from "react";
import {
  HIGHEST_QUALIFICATION_OPTIONS,
  fetchHighestQualificationOptions,
} from "@/lib/highestQualificationOptions";

/**
 * Returns the active "Highest Qualification" options from the master table.
 * Always seeded with the hard-coded fallback synchronously, so the dropdown
 * never renders empty — DB values replace the fallback once they arrive.
 */
export function useHighestQualificationOptions() {
  const [options, setOptions] = useState<string[]>(() => [...HIGHEST_QUALIFICATION_OPTIONS]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    fetchHighestQualificationOptions()
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
