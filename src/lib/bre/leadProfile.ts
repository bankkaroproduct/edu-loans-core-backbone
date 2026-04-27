// Builds a BreProfileInput from a stored student_leads row.
// Pure mapping — no fabrication. Missing fields stay null/undefined so the
// engine treats them as missing (band score 0) and rejection_reasons surface
// honestly.

import type { Tables } from "@/integrations/supabase/types";
import type { BreProfileInput } from "./types";

type Lead = Tables<"student_leads">;

const COUNTRY_TO_ISO: Record<string, string> = {
  "united states": "US",
  usa: "US",
  us: "US",
  "united states of america": "US",
  "united kingdom": "GB",
  uk: "GB",
  england: "GB",
  "great britain": "GB",
  canada: "CA",
  australia: "AU",
  germany: "DE",
  france: "FR",
  netherlands: "NL",
  singapore: "SG",
  ireland: "IE",
  "new zealand": "NZ",
  spain: "ES",
  italy: "IT",
  switzerland: "CH",
  sweden: "SE",
  denmark: "DK",
};

function toIso(name: string | null | undefined): string {
  if (!name) return "";
  const k = String(name).trim().toLowerCase();
  return COUNTRY_TO_ISO[k] ?? String(name).trim().toUpperCase();
}

function parseGpa(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const m = String(raw).match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  // If looks like a 10-point GPA, scale to percentage equivalent (rough)
  if (n <= 10 && String(raw).toLowerCase().includes("gpa")) return Math.round(n * 9.5);
  return n;
}

export interface BuildProfileMissing {
  field: string;
  label: string;
}

export interface BuildProfileResult {
  profile: BreProfileInput;
  missing: BuildProfileMissing[];
}

/**
 * Map a lead row → BRE profile input. Returns a `missing` list flagging
 * required-for-BRE fields that aren't on the lead so the UI can warn the
 * admin honestly instead of synthesising data.
 */
export function buildBreProfileFromLead(lead: Lead): BuildProfileResult {
  const missing: BuildProfileMissing[] = [];

  const destinationIso = toIso(lead.intended_study_country);
  if (!destinationIso) missing.push({ field: "intended_study_country", label: "Study country" });

  const loanAmount = lead.loan_amount_required != null ? Number(lead.loan_amount_required) : 0;
  if (!loanAmount || loanAmount <= 0) missing.push({ field: "loan_amount_required", label: "Loan amount" });

  const courseCategory = (lead.course_category || "").toLowerCase() || undefined;

  const collateralRoute: BreProfileInput["collateral_route"] =
    lead.collateral_available === true ? "either" : lead.collateral_available === false ? "unsecured" : "either";

  // Co-applicant bucket
  const coIncomeMonthly = lead.coapplicant_income != null ? Number(lead.coapplicant_income) : null;
  const coEmi = lead.coapplicant_existing_emi != null ? Number(lead.coapplicant_existing_emi) : null;
  const coEmiBurdenPct =
    coIncomeMonthly && coIncomeMonthly > 0 && coEmi != null ? Math.round((coEmi / coIncomeMonthly) * 100) : null;

  if (coIncomeMonthly == null) missing.push({ field: "coapplicant_income", label: "Co-applicant income" });
  if (!lead.coapplicant_relation) missing.push({ field: "coapplicant_relation", label: "Co-applicant relationship" });

  const profile: BreProfileInput = {
    loan_amount: loanAmount,
    destination_country: destinationIso,
    course_category: courseCategory,
    course_level: undefined,
    collateral_route: collateralRoute,
    state: lead.state ?? undefined,
    student: {
      graduation_marks: parseGpa(lead.marks_gpa),
      english_proficiency: null,
    },
    university: {
      // Lead row doesn't store tier — engine will treat as missing band → 0.
      university_tier: null,
      country_tier: null,
      course_category: courseCategory ?? null,
    },
    coapplicant: {
      relationship: lead.coapplicant_relation ?? null,
      employment_type: lead.coapplicant_employment_type ?? null,
      monthly_income: coIncomeMonthly,
      existing_emi_burden_pct: coEmiBurdenPct,
      // age + cibil_score are not captured on the lead today
      age: null,
      cibil_score: null,
    },
  };

  return { profile, missing };
}
