// Centralized loader for the master tables used by Admin Lead Detail summary
// card editing. Returns active rows from countries_master, universities_master,
// courses_master, and intake_master. No hardcoded fallbacks — UI must handle
// loading state.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { sortByPriority } from "@/lib/countryOrder";
import { fetchAllUniversitiesMaster } from "@/lib/fetchAllUniversities";

export interface CountryRow {
  id: string;
  country_name: string;
}
export interface UniversityRow {
  id: string;
  university_name: string;
  country: string | null;
}
export interface CourseRow {
  id: string;
  course_name: string;
  course_category: string | null;
}
export interface IntakeRow {
  id: string;
  intake_term: string;
  intake_year: number;
  sort_order: number | null;
}

interface State {
  countries: CountryRow[];
  universities: UniversityRow[];
  courses: CourseRow[];
  intakes: IntakeRow[];
  loading: boolean;
}

export function useLeadMasterData(): State {
  const [state, setState] = useState<State>({
    countries: [],
    universities: [],
    courses: [],
    intakes: [],
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [c, u, co, i] = await Promise.all([
        supabase.from("countries_master").select("id, country_name").eq("active_flag", true).order("country_name"),
        // Paginated fetch — universities_master exceeds PostgREST's 1000-row default.
        fetchAllUniversitiesMaster<UniversityRow>("id, university_name, country", {
          activeOnly: true,
          orderBy: "university_name",
        }),
        supabase.from("courses_master").select("id, course_name, course_category").eq("active_flag", true).order("course_name"),
        supabase.from("intake_master").select("id, intake_term, intake_year, sort_order").eq("active_flag", true).order("sort_order"),
      ]);
      if (cancelled) return;
      const countries = sortByPriority((c.data ?? []) as CountryRow[], (r) => r.country_name);
      setState({
        countries,
        universities: u as UniversityRow[],
        courses: (co.data ?? []) as CourseRow[],
        intakes: (i.data ?? []) as IntakeRow[],
        loading: false,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
