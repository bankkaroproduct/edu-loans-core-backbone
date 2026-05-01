import { supabase } from "@/integrations/supabase/client";
import { createDownstreamRecords } from "@/hooks/useLeadWriteFlow";
import type { Tables } from "@/integrations/supabase/types";
import { normalizePhone } from "@/lib/phone";
import {
  HIGHEST_QUALIFICATION_OPTIONS,
  matchHighestQualification,
  fetchHighestQualificationOptions,
} from "@/lib/highestQualificationOptions";
import {
  EMPLOYMENT_TYPE_OPTIONS,
  matchEmploymentType,
  fetchEmploymentTypeOptions,
} from "@/lib/employmentTypeOptions";
import { intakeSessionLabel } from "@/lib/intakeSession";

type AppUser = Tables<"users">;

export interface ParsedRow {
  rowNumber: number;
  raw: Record<string, string>;
  student_first_name?: string;
  student_last_name?: string;
  student_phone?: string;
  student_email?: string;
  student_whatsapp?: string;
  /** Required 6-digit Indian pincode. Master lookup fills city/state/district/tier. */
  pincode?: string;
  city?: string;
  state?: string;
  district?: string;
  tier?: string;
  country_of_residence?: string;
  intended_study_country?: string;
  intake_term?: string;
  intake_year?: number;
  course_name?: string;
  university_name?: string;
  tenth_score?: number;
  twelfth_score?: number;
  graduation_score?: number;
  highest_qualification?: string;
  highest_qualification_score?: number;
  work_experience?: number;
  test_scores_raw?: string;
  loan_amount_required?: number;
  coapplicant_name?: string;
  coapplicant_relation?: string;
  coapplicant_age?: number;
  coapplicant_employment_type?: string;
  coapplicant_employer?: string;
  coapplicant_income?: number;
  coapplicant_existing_emi?: number;
  coapplicant_cibil?: number;
  collateral_available?: boolean;
  collateral_notes?: string;
  source_sub_type?: string;
  partner_remark?: string;
}

export interface RowResult {
  rowNumber: number;
  raw: Record<string, string>;
  status: "success" | "failed" | "duplicate";
  reason: string;
  /** Non-blocking row-level warning (e.g. pincode not in master). Surfaces on success rows. */
  warning?: string;
  createdLeadId?: string;
  createdLeadDisplayId?: string;
  matchedLeadId?: string;
  matchedLeadDisplayId?: string;
}

export type ProcessingStage = "idle" | "parsing" | "validating" | "processing" | "completed" | "error";

/** Required-fields contract — unchanged business rules. */
const REQUIRED_HEADERS = [
  "student_first_name", "student_last_name", "student_phone",
  "intended_study_country", "intake_session",
  "course_name", "loan_amount_required",
];

/**
 * Final canonical 32-column header order — used everywhere (Partner + Admin):
 * - Downloaded template
 * - Parser strict-template check (rejects outdated templates missing new headers)
 * - UI column reference
 *
 * `intake_session` is a SINGLE composite column in quarter-format
 * (e.g. "Apr-Jun-2026") — internally decomposed into `intake_term` + `intake_year`
 * for storage. Old `intake_term` / `intake_year` columns are NO LONGER accepted.
 */
const ALL_HEADERS = [
  "student_first_name", "student_last_name", "student_phone", "student_email",
  "student_whatsapp", "city", "state", "country_of_residence",
  "intended_study_country", "intake_session", "course_name",
  "university_name",
  "10th_score", "12th_score", "graduation_score",
  "highest_qualification", "highest_qualification_score",
  "work_experience", "test_scores",
  "loan_amount_required",
  "coapplicant_name", "coapplicant_relation",
  "coapplicant_age", "coapplicant_employment_type", "coapplicant_employer",
  "coapplicant_income", "coapplicant_existing_emi", "coapplicant_cibil",
  "collateral_available", "collateral_notes", "source_sub_type", "partner_remark",
];

/** Headers introduced in the newest template — used to detect outdated uploads. */
const NEW_TEMPLATE_HEADERS = [
  "intake_session",
  "10th_score", "12th_score", "graduation_score",
  "highest_qualification", "highest_qualification_score",
  "work_experience", "test_scores",
  "coapplicant_age", "coapplicant_employment_type", "coapplicant_employer",
  "coapplicant_existing_emi", "coapplicant_cibil",
];

/** Static fallback if the master fetch fails — keeps validation deterministic. */
const FALLBACK_QUALIFICATIONS = HIGHEST_QUALIFICATION_OPTIONS;
const FALLBACK_EMPLOYMENT_TYPES = EMPLOYMENT_TYPE_OPTIONS;

export function getTemplateCSV(): string {
  return ALL_HEADERS.join(",") + "\n";
}

function parseDelimitedLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { current += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === delimiter) { result.push(current.trim()); current = ""; }
      else { current += ch; }
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Auto-detect the delimiter from the header row. Supports comma (`,`) and tilde (`~`).
 * Strategy:
 *   1. Count occurrences of each candidate delimiter outside of quotes in the header row.
 *   2. Pick whichever produces the most fields (and at least 2).
 *   3. If counts tie, prefer comma (the standard CSV default).
 */
function detectDelimiter(headerLine: string): "," | "~" {
  const candidates: Array<"," | "~"> = [",", "~"];
  let best: "," | "~" = ",";
  let bestCount = -1;
  for (const d of candidates) {
    const fields = parseDelimitedLine(headerLine, d);
    const count = fields.length;
    if (count > bestCount) {
      best = d;
      bestCount = count;
    }
  }
  return best;
}

export function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[]; delimiter: string } | { error: string } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 1) return { error: "File is empty" };

  const normalize = (raw: string[]) =>
    raw.map((h) => h.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, ""));

  // First attempt: auto-detected delimiter
  let delimiter: "," | "~" = detectDelimiter(lines[0]);
  let headers = normalize(parseDelimitedLine(lines[0], delimiter));
  let missing = REQUIRED_HEADERS.filter((r) => !headers.includes(r));

  // Fallback: if detection produced a single mega-field but the other delimiter appears,
  // retry with the alternate delimiter.
  if (missing.length > 0) {
    const alt: "," | "~" = delimiter === "," ? "~" : ",";
    if (lines[0].includes(alt)) {
      const altHeaders = normalize(parseDelimitedLine(lines[0], alt));
      const altMissing = REQUIRED_HEADERS.filter((r) => !altHeaders.includes(r));
      if (altMissing.length < missing.length) {
        delimiter = alt;
        headers = altHeaders;
        missing = altMissing;
      }
    }
  }

  if (missing.length > 0) return { error: `Missing required columns: ${missing.join(", ")}` };

  // Reject outdated templates that don't include the new academic + EMI columns.
  const missingNewCols = NEW_TEMPLATE_HEADERS.filter((h) => !headers.includes(h));
  if (missingNewCols.length > 0) {
    return {
      error:
        `Outdated template detected. Missing column(s): ${missingNewCols.join(", ")}. ` +
        `Please re-download the latest template and re-upload.`,
    };
  }

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseDelimitedLine(lines[i], delimiter);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = (values[idx] ?? "").trim(); });
    if (Object.values(row).some((v) => v !== "")) rows.push(row);
  }

  if (rows.length === 0) return { error: "No data rows found" };
  if (rows.length > 1000) return { error: `File contains ${rows.length} rows. Maximum is 1000 per batch.` };

  return { headers, rows, delimiter };
}

function normBool(val: string): boolean | null {
  const v = val.toLowerCase();
  if (["yes", "true", "1", "y"].includes(v)) return true;
  if (["no", "false", "0", "n", ""].includes(v)) return false;
  return null;
}

interface MasterData {
  countries: string[];
  /** Map: lower-case quarter-format label (e.g. "apr-jun-2026") → { term, year } */
  intakeSessionMap: Map<string, { term: string; year: number }>;
  /** Pretty-printed list of allowed intake_session values (chronological). */
  intakeSessionLabels: string[];
  universityMap: Map<string, string>; // lowercase name -> id
  qualifications: readonly string[];
  employmentTypes: readonly string[];
}

async function loadMasterData(): Promise<MasterData> {
  const [cRes, iRes, uRes, qOpts, eOpts] = await Promise.all([
    supabase.from("countries_master").select("country_name").eq("active_flag", true),
    supabase.from("intake_master").select("intake_term,intake_year,sort_order").eq("active_flag", true).order("sort_order", { ascending: true }),
    supabase.from("universities_master").select("id,university_name").eq("active_flag", true),
    fetchHighestQualificationOptions(),
    fetchEmploymentTypeOptions(),
  ]);

  const countries = (cRes.data ?? []).map((c) => c.country_name.toLowerCase());

  const intakeSessionMap = new Map<string, { term: string; year: number }>();
  const intakeSessionLabels: string[] = [];
  for (const r of iRes.data ?? []) {
    const label = intakeSessionLabel(r.intake_term, r.intake_year); // "Apr-Jun-2026"
    if (!label) continue;
    const key = label.toLowerCase();
    if (!intakeSessionMap.has(key)) {
      intakeSessionMap.set(key, { term: r.intake_term, year: r.intake_year });
      intakeSessionLabels.push(label);
    }
  }

  const universityMap = new Map<string, string>();
  (uRes.data ?? []).forEach((u) => universityMap.set(u.university_name.toLowerCase(), u.id));
  const qualifications = qOpts.length > 0 ? qOpts : FALLBACK_QUALIFICATIONS;
  const employmentTypes = eOpts.length > 0 ? eOpts : [...FALLBACK_EMPLOYMENT_TYPES];

  return { countries, intakeSessionMap, intakeSessionLabels, universityMap, qualifications, employmentTypes };
}

function validateRow(row: Record<string, string>, master: MasterData): { parsed: ParsedRow; errors: string[] } {
  const errors: string[] = [];

  const val = (key: string) => (row[key] ?? "").trim();
  const firstName = val("student_first_name");
  const lastName = val("student_last_name");
  const phone = val("student_phone");
  const email = val("student_email");
  const country = val("intended_study_country");
  const intakeSessionStr = val("intake_session");
  const courseName = val("course_name");
  const loanStr = val("loan_amount_required");
  const collateralStr = val("collateral_available");
  const collateralNotes = val("collateral_notes");
  const coapplicantIncomeStr = val("coapplicant_income");
  const coapplicantEmiStr = val("coapplicant_existing_emi");
  const coapplicantAgeStr = val("coapplicant_age");
  const coapplicantCibilStr = val("coapplicant_cibil");
  const coapplicantEmployer = val("coapplicant_employer");
  const coapplicantEmploymentTypeRaw = val("coapplicant_employment_type");
  const tenthStr = val("10th_score");
  const twelfthStr = val("12th_score");
  const gradStr = val("graduation_score");
  const qualification = val("highest_qualification");
  const qualificationScoreStr = val("highest_qualification_score");
  const workExpStr = val("work_experience");
  const testScoresRaw = val("test_scores");

  if (!firstName) errors.push("student_first_name is required");
  if (!lastName) errors.push("student_last_name is required");
  if (!phone) errors.push("student_phone is required");
  else if (!/^\+?[\d\s\-()]{7,15}$/.test(phone)) errors.push("Invalid phone format");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("Invalid email format");
  if (!country) errors.push("intended_study_country is required");
  else if (!master.countries.includes(country.toLowerCase())) errors.push(`Country "${country}" not found in master data`);

  // intake_session: composite quarter-format value, e.g. "Apr-Jun-2026".
  // Internally decomposed into intake_term + intake_year for storage.
  let intakeTerm: string | undefined;
  let intakeYear: number | undefined;
  if (!intakeSessionStr) {
    errors.push("intake_session is required");
  } else {
    const hit = master.intakeSessionMap.get(intakeSessionStr.toLowerCase());
    if (!hit) {
      errors.push(
        `intake_session "${intakeSessionStr}" not found. Allowed values include: ${master.intakeSessionLabels.slice(0, 6).join(", ")}${master.intakeSessionLabels.length > 6 ? ", …" : ""}`,
      );
    } else {
      intakeTerm = hit.term;
      intakeYear = hit.year;
    }
  }

  if (!courseName) errors.push("course_name is required");
  if (!loanStr) errors.push("loan_amount_required is required");
  const loanAmount = parseFloat(loanStr.replace(/,/g, ""));
  if (loanStr && (isNaN(loanAmount) || loanAmount <= 0)) errors.push("loan_amount_required must be a positive number");

  let collateralAvailable: boolean | null = null;
  if (collateralStr) {
    collateralAvailable = normBool(collateralStr);
    if (collateralAvailable === null) errors.push('collateral_available must be yes/no/true/false');
  }
  if (collateralAvailable === true && !collateralNotes) errors.push("collateral_notes required when collateral_available is yes");

  let coapplicantIncome: number | undefined;
  if (coapplicantIncomeStr) {
    coapplicantIncome = parseFloat(coapplicantIncomeStr.replace(/,/g, ""));
    if (isNaN(coapplicantIncome)) errors.push("coapplicant_income must be numeric");
  }

  // ─── Numeric helpers ───
  const parseNumeric = (s: string, label: string, opts: { min?: number; max?: number } = {}): number | undefined => {
    if (!s) return undefined;
    const n = parseFloat(s.replace(/,/g, ""));
    if (isNaN(n)) { errors.push(`${label} must be numeric (got "${s}")`); return undefined; }
    if (opts.min !== undefined && n < opts.min) { errors.push(`${label} must be ≥ ${opts.min}`); return undefined; }
    if (opts.max !== undefined && n > opts.max) { errors.push(`${label} must be ≤ ${opts.max}`); return undefined; }
    return n;
  };
  const tenth = parseNumeric(tenthStr, "10th_score", { min: 0 });
  const twelfth = parseNumeric(twelfthStr, "12th_score", { min: 0 });
  const grad = parseNumeric(gradStr, "graduation_score", { min: 0 });
  const qualScore = parseNumeric(qualificationScoreStr, "highest_qualification_score", { min: 0 });
  const coapplicantEmi = parseNumeric(coapplicantEmiStr, "coapplicant_existing_emi", { min: 0 });
  const coapplicantAge = parseNumeric(coapplicantAgeStr, "coapplicant_age", { min: 18, max: 100 });
  const coapplicantCibil = parseNumeric(coapplicantCibilStr, "coapplicant_cibil", { min: 300, max: 900 });
  const workExp = parseNumeric(workExpStr, "work_experience", { min: 0, max: 60 });

  let qualificationNormalized: string | undefined;
  if (qualification) {
    const match = matchHighestQualification(qualification, master.qualifications);
    if (!match) {
      errors.push(`highest_qualification must be one of: ${master.qualifications.join(" | ")}`);
    } else {
      qualificationNormalized = match;
    }
  }

  let employmentTypeNormalized: string | undefined;
  if (coapplicantEmploymentTypeRaw) {
    const match = matchEmploymentType(coapplicantEmploymentTypeRaw, master.employmentTypes);
    if (!match) {
      errors.push(`coapplicant_employment_type must be one of: ${master.employmentTypes.join(" | ")}`);
    } else {
      employmentTypeNormalized = match;
    }
  }

  const universityRaw = val("university_name");

  const parsed: ParsedRow = {
    rowNumber: 0,
    raw: row,
    student_first_name: firstName,
    student_last_name: lastName,
    student_phone: phone,
    student_email: email || undefined,
    student_whatsapp: val("student_whatsapp") || undefined,
    city: val("city") || undefined,
    state: val("state") || undefined,
    country_of_residence: val("country_of_residence") || undefined,
    intended_study_country: country,
    intake_term: intakeTerm,
    intake_year: intakeYear,
    course_name: courseName,
    university_name: universityRaw || undefined,
    tenth_score: tenth,
    twelfth_score: twelfth,
    graduation_score: grad,
    highest_qualification: qualificationNormalized,
    highest_qualification_score: qualScore,
    work_experience: workExp,
    test_scores_raw: testScoresRaw || undefined,
    loan_amount_required: isNaN(loanAmount) ? undefined : loanAmount,
    coapplicant_name: val("coapplicant_name") || undefined,
    coapplicant_relation: val("coapplicant_relation") || undefined,
    coapplicant_age: coapplicantAge,
    coapplicant_employment_type: employmentTypeNormalized,
    coapplicant_employer: coapplicantEmployer || undefined,
    coapplicant_income: coapplicantIncome,
    coapplicant_existing_emi: coapplicantEmi,
    coapplicant_cibil: coapplicantCibil,
    collateral_available: collateralAvailable ?? undefined,
    collateral_notes: collateralNotes || undefined,
    source_sub_type: val("source_sub_type") || undefined,
    partner_remark: val("partner_remark") || undefined,
  };

  return { parsed, errors };
}

function detectIntraFileDuplicates(rows: ParsedRow[]): Map<number, { matchRow: number; reason: string }> {
  const dups = new Map<number, { matchRow: number; reason: string }>();
  const phoneMap = new Map<string, number>();
  const emailMap = new Map<string, number>();
  const nameIntakeMap = new Map<string, number>();

  for (const row of rows) {
    // Use canonical phone form for intra-file dedup so "9876543210" and "+919876543210"
    // collide as expected.
    const phone = normalizePhone(row.student_phone);
    if (phone && phoneMap.has(phone)) {
      dups.set(row.rowNumber, { matchRow: phoneMap.get(phone)!, reason: `Duplicate phone matches row ${phoneMap.get(phone)}` });
      continue;
    }
    if (phone) phoneMap.set(phone, row.rowNumber);

    const email = row.student_email?.toLowerCase();
    if (email && emailMap.has(email)) {
      dups.set(row.rowNumber, { matchRow: emailMap.get(email)!, reason: `Duplicate email matches row ${emailMap.get(email)}` });
      continue;
    }
    if (email) emailMap.set(email, row.rowNumber);

    const nameKey = `${(row.student_first_name ?? "").toLowerCase()} ${(row.student_last_name ?? "").toLowerCase()}|${row.intake_term?.toLowerCase()}|${row.intake_year}`;
    if (nameKey.length > 5 && nameIntakeMap.has(nameKey)) {
      dups.set(row.rowNumber, { matchRow: nameIntakeMap.get(nameKey)!, reason: `Duplicate name+intake matches row ${nameIntakeMap.get(nameKey)}` });
      continue;
    }
    if (nameKey.length > 5) nameIntakeMap.set(nameKey, row.rowNumber);
  }

  return dups;
}

async function checkSystemDuplicate(row: ParsedRow, partnerId: string): Promise<{ isDuplicate: boolean; matchedLeadId?: string; matchedDisplayId?: string; reason?: string }> {
  // Always look up by canonical +91XXXXXXXXXX form so we hit the same value the trigger stores.
  const canonicalPhone = normalizePhone(row.student_phone);
  if (canonicalPhone) {
    const { data } = await supabase
      .from("student_leads")
      .select("id,lead_id,student_full_name")
      .eq("partner_id", partnerId)
      .eq("student_phone", canonicalPhone)
      .eq("is_archived", false)
      .limit(1);
    if (data && data.length > 0) {
      return { isDuplicate: true, matchedLeadId: data[0].id, matchedDisplayId: data[0].lead_id ?? undefined, reason: `Phone ${canonicalPhone} matches existing lead ${data[0].lead_id ?? data[0].id}` };
    }
  }

  const email = row.student_email?.toLowerCase();
  if (email) {
    const { data } = await supabase
      .from("student_leads")
      .select("id,lead_id,student_full_name")
      .eq("partner_id", partnerId)
      .eq("student_email", email)
      .eq("is_archived", false)
      .limit(1);
    if (data && data.length > 0) {
      return { isDuplicate: true, matchedLeadId: data[0].id, matchedDisplayId: data[0].lead_id ?? undefined, reason: `Email ${email} matches existing lead ${data[0].lead_id ?? data[0].id}` };
    }
  }

  return { isDuplicate: false };
}

export async function processBulkUpload(
  fileText: string,
  fileName: string,
  appUser: AppUser,
  onStageChange: (stage: ProcessingStage) => void,
  onProgress: (current: number, total: number) => void,
  overridePartnerId?: string | null,
  overrideUserId?: string | null,
): Promise<{ batchId: string; results: RowResult[]; totalRows: number; successCount: number; failedCount: number; duplicateCount: number }> {

  const partnerId = overridePartnerId ?? appUser.partner_id;
  if (!partnerId) throw new Error("No partner association found");

  const userId = overrideUserId ?? appUser.id;

  // 1. Parse
  onStageChange("parsing");
  const parsed = parseCSV(fileText);
  if ("error" in parsed) throw new Error(parsed.error);

  const totalRows = parsed.rows.length;

  // 2. Validate + load masters
  onStageChange("validating");
  const master = await loadMasterData();

  const validatedRows: { parsed: ParsedRow; errors: string[] }[] = [];
  for (let i = 0; i < parsed.rows.length; i++) {
    const result = validateRow(parsed.rows[i], master);
    result.parsed.rowNumber = i + 1;
    validatedRows.push(result);
  }

  // 3. Intra-file duplicate detection
  const validParsed = validatedRows.filter((v) => v.errors.length === 0).map((v) => v.parsed);
  const intraFileDups = detectIntraFileDuplicates(validParsed);

  // 4. Create batch record
  const { data: batchData, error: batchError } = await supabase
    .from("bulk_upload_batches")
    .insert({
      partner_id: partnerId,
      uploaded_by: userId,
      file_name: fileName,
      total_rows: totalRows,
      batch_status: "processing",
    })
    .select("id,batch_id")
    .single();

  if (batchError || !batchData) throw new Error(batchError?.message ?? "Failed to create batch");
  const batchDbId = batchData.id;

  // 5. Process rows
  onStageChange("processing");
  const results: RowResult[] = [];
  let successCount = 0;
  let failedCount = 0;
  let duplicateCount = 0;

  for (let i = 0; i < validatedRows.length; i++) {
    onProgress(i + 1, totalRows);
    const { parsed: row, errors } = validatedRows[i];

    // Validation failures
    if (errors.length > 0) {
      failedCount++;
      results.push({ rowNumber: row.rowNumber, raw: row.raw, status: "failed", reason: errors.join("; ") });
      await supabase.from("bulk_upload_row_results").insert({
        batch_id: batchDbId,
        row_number: row.rowNumber,
        raw_payload: row.raw as any,
        validation_status: "failed",
        failure_reason: errors.join("; "),
      });
      continue;
    }

    // Intra-file duplicate
    const intra = intraFileDups.get(row.rowNumber);
    if (intra) {
      duplicateCount++;
      results.push({ rowNumber: row.rowNumber, raw: row.raw, status: "duplicate", reason: intra.reason });
      await supabase.from("bulk_upload_row_results").insert({
        batch_id: batchDbId,
        row_number: row.rowNumber,
        raw_payload: row.raw as any,
        validation_status: "duplicate",
        failure_reason: intra.reason,
      });
      continue;
    }

    // System duplicate check
    const sysDup = await checkSystemDuplicate(row, partnerId);
    if (sysDup.isDuplicate) {
      duplicateCount++;
      results.push({
        rowNumber: row.rowNumber, raw: row.raw, status: "duplicate", reason: sysDup.reason!,
        matchedLeadId: sysDup.matchedLeadId, matchedLeadDisplayId: sysDup.matchedDisplayId,
      });
      await supabase.from("bulk_upload_row_results").insert({
        batch_id: batchDbId,
        row_number: row.rowNumber,
        raw_payload: row.raw as any,
        validation_status: "duplicate",
        failure_reason: sysDup.reason,
        created_lead_id: sysDup.matchedLeadId ?? null,
      });
      continue;
    }

    // Create the lead
    
    const universityId = row.university_name ? master.universityMap.get(row.university_name.toLowerCase()) ?? null : null;

    const { data: leadData, error: leadError } = await supabase
      .from("student_leads")
      .insert({
        partner_id: partnerId,
        partner_user_id: userId,
        source_type: "partner",
        source_sub_type: row.source_sub_type ?? "bulk_upload",
        student_first_name: row.student_first_name!,
        student_last_name: row.student_last_name ?? null,
        
        student_phone: row.student_phone!,
        student_email: row.student_email ?? null,
        student_whatsapp: row.student_whatsapp ?? null,
        city: row.city ?? null,
        state: row.state ?? null,
        country_of_residence: row.country_of_residence ?? null,
        intended_study_country: row.intended_study_country!,
        intake_term: row.intake_term!,
        intake_year: row.intake_year!,
        course_name: row.course_name!,
        university_name_raw: row.university_name ?? null,
        university_id: universityId,
        loan_amount_required: row.loan_amount_required ?? null,
        coapplicant_name: row.coapplicant_name ?? null,
        coapplicant_relation: row.coapplicant_relation ?? null,
        coapplicant_income: row.coapplicant_income ?? null,
        coapplicant_existing_emi: row.coapplicant_existing_emi ?? null,
        coapplicant_employment_type: row.coapplicant_employment_type ?? null,
        coapplicant_employer: row.coapplicant_employer ?? null,
        collateral_available: row.collateral_available ?? null,
        collateral_notes: row.collateral_notes ?? null,
        // Academic + co-applicant extension — mirror Add Lead conventions:
        //  - highest_qualification → text column
        //  - highest_qualification_score → marks_gpa text column
        //  - 10th/12th/graduation, work_experience_years, coapplicant_age,
        //    coapplicant_cibil, and free-text test_scores raw_text → test_scores jsonb
        highest_qualification: row.highest_qualification ?? null,
        marks_gpa: row.highest_qualification_score != null ? String(row.highest_qualification_score) : null,
        test_scores: (() => {
          const ts: Record<string, number | string> = {};
          if (row.tenth_score != null) ts.tenth = row.tenth_score;
          if (row.twelfth_score != null) ts.twelfth = row.twelfth_score;
          if (row.graduation_score != null) ts.graduation = row.graduation_score;
          if (row.highest_qualification_score != null) ts.highest_qualification = row.highest_qualification_score;
          if (row.work_experience != null) ts.work_experience_years = row.work_experience;
          if (row.coapplicant_age != null) ts.coapplicant_age = row.coapplicant_age;
          if (row.coapplicant_cibil != null) ts.coapplicant_cibil = row.coapplicant_cibil;
          if (row.test_scores_raw) ts.raw_text = row.test_scores_raw;
          return Object.keys(ts).length > 0 ? ts : {};
        })() as any,
        current_stage: "submitted" as any,
        current_status: "awaiting_verification" as any,
      })
      .select("id,lead_id")
      .single();

    if (leadError || !leadData) {
      failedCount++;
      results.push({ rowNumber: row.rowNumber, raw: row.raw, status: "failed", reason: leadError?.message ?? "Lead creation failed" });
      await supabase.from("bulk_upload_row_results").insert({
        batch_id: batchDbId,
        row_number: row.rowNumber,
        raw_payload: row.raw as any,
        validation_status: "failed",
        failure_reason: leadError?.message ?? "Lead creation failed",
      });
      continue;
    }

    // Downstream records
    await createDownstreamRecords({
      leadId: leadData.id,
      appUser,
      stage: "submitted",
      status: "awaiting_verification",
      isDraft: false,
      hasDuplicateOverride: false,
      partnerRemark: row.partner_remark,
    });

    successCount++;
    results.push({
      rowNumber: row.rowNumber, raw: row.raw, status: "success", reason: "Lead created successfully",
      createdLeadId: leadData.id, createdLeadDisplayId: leadData.lead_id ?? undefined,
    });
    await supabase.from("bulk_upload_row_results").insert({
      batch_id: batchDbId,
      row_number: row.rowNumber,
      raw_payload: row.raw as any,
      validation_status: "success",
      created_lead_id: leadData.id,
    });
  }

  // 6. Update batch summary
  // Status rules:
  //   completed              = no fail AND no duplicate
  //   completed_with_errors  = any fail OR any duplicate (but at least one success)
  //   failed                 = zero success AND at least one real failure
  // Note: failed_rows stores REAL validation/insert failures only.
  // Duplicates are tracked per-row in bulk_upload_row_results (validation_status='duplicate')
  // and derivable as: total_rows - success_rows - failed_rows.
  const batchStatus =
    failedCount === 0 && duplicateCount === 0
      ? "completed"
      : successCount === 0 && failedCount > 0
        ? "failed"
        : "completed_with_errors";

  await supabase.from("bulk_upload_batches").update({
    success_rows: successCount,
    failed_rows: failedCount,
    batch_status: batchStatus as any,
    processed_at: new Date().toISOString(),
  }).eq("id", batchDbId);

  // Audit log for batch
  await supabase.from("audit_logs").insert({
    actor_user_id: appUser.id,
    actor_role: appUser.role,
    entity_type: "bulk_upload_batch",
    entity_id: batchDbId,
    action_type: "bulk_upload_processed",
    new_value: { total: totalRows, success: successCount, failed: failedCount, duplicates: duplicateCount } as any,
    meta: { file_name: fileName } as any,
  });

  onStageChange("completed");

  return { batchId: batchData.batch_id ?? batchDbId, results, totalRows, successCount, failedCount, duplicateCount };
}

export function generateErrorReportCSV(results: RowResult[]): string {
  const errorRows = results.filter((r) => r.status !== "success");
  if (errorRows.length === 0) return "";

  const allKeys = Object.keys(errorRows[0].raw);
  const headers = ["row_number", ...allKeys, "status", "reason", "matched_lead_id"];
  const lines = [headers.join(",")];

  for (const r of errorRows) {
    const values = [
      String(r.rowNumber),
      ...allKeys.map((k) => `"${(r.raw[k] ?? "").replace(/"/g, '""')}"`),
      r.status,
      `"${r.reason.replace(/"/g, '""')}"`,
      r.matchedLeadDisplayId ?? r.matchedLeadId ?? "",
    ];
    lines.push(values.join(","));
  }

  return lines.join("\n");
}
