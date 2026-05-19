// Shared constants & helpers for the Admin Dashboard "Action Needed Today" card.
// Used by useAdminDashboard (metric counts) and the ActionNeededDrillDown drawer.

import type { Database } from "@/integrations/supabase/types";

type StageEnum = Database["public"]["Enums"]["lead_stage_enum"];

// Stages excluded from BOTH Review Due and Follow-up Required.
// - draft: partner WIP, not yet admin's responsibility
// - sanction_received / disbursed / rejected / dropped: closed/final outcomes
export const ACTION_NEEDED_EXCLUDED_STAGES: StageEnum[] = [
  "draft",
  "sanction_received",
  "disbursed",
  "rejected",
  "dropped",
];

// 16 mandatory fields sourced from AddLead validation gate.
// Columns on student_leads selected by the Review Due query.
export const REVIEW_DUE_SELECT_COLUMNS =
  "id, lead_id, student_full_name, student_first_name, student_last_name, partner_id, current_stage, current_status, updated_at, " +
  "student_phone, intended_study_country, university_id, university_name_raw, course_name, intake_term, intake_year, " +
  "highest_qualification, loan_amount_required, " +
  "coapplicant_name, coapplicant_relation, coapplicant_mobile, coapplicant_email, coapplicant_employment_type, coapplicant_income";

const isMissing = (v: unknown): boolean =>
  v === null || v === undefined || (typeof v === "string" && v.trim() === "");

/** Count how many of the 16 mandatory fields are missing on a lead row. */
export function countMissingMandatory(l: Record<string, any>): number {
  let missing = 0;
  if (isMissing(l.student_first_name)) missing++;
  if (isMissing(l.student_last_name)) missing++;
  if (isMissing(l.student_phone)) missing++;
  if (isMissing(l.intended_study_country)) missing++;
  // University: missing only if BOTH the master id AND the raw text are empty
  if (isMissing(l.university_id) && isMissing(l.university_name_raw)) missing++;
  if (isMissing(l.course_name)) missing++;
  if (isMissing(l.intake_term)) missing++;
  if (isMissing(l.intake_year)) missing++;
  if (isMissing(l.highest_qualification)) missing++;
  if (isMissing(l.loan_amount_required)) missing++;
  if (isMissing(l.coapplicant_name)) missing++;
  if (isMissing(l.coapplicant_relation)) missing++;
  if (isMissing(l.coapplicant_mobile)) missing++;
  if (isMissing(l.coapplicant_email)) missing++;
  if (isMissing(l.coapplicant_employment_type)) missing++;
  if (isMissing(l.coapplicant_income)) missing++;
  return missing;
}

/** A lead is Review Due when strictly more than 5 mandatory fields are missing. */
export const REVIEW_DUE_THRESHOLD = 5;
export const isReviewDue = (l: Record<string, any>) =>
  countMissingMandatory(l) > REVIEW_DUE_THRESHOLD;
