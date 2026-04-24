import { supabase } from "@/integrations/supabase/client";
import { createDownstreamRecords } from "@/hooks/useLeadWriteFlow";
import type { Tables } from "@/integrations/supabase/types";
import { normalizePhone } from "@/lib/phone";

type AppUser = Tables<"users">;

export interface ParsedRow {
  rowNumber: number;
  raw: Record<string, string>;
  student_first_name?: string;
  student_last_name?: string;
  student_phone?: string;
  student_email?: string;
  student_whatsapp?: string;
  city?: string;
  state?: string;
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
  loan_amount_required?: number;
  coapplicant_name?: string;
  coapplicant_relation?: string;
  coapplicant_income?: number;
  coapplicant_existing_emi?: number;
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
  createdLeadId?: string;
  createdLeadDisplayId?: string;
  matchedLeadId?: string;
  matchedLeadDisplayId?: string;
}

export type ProcessingStage = "idle" | "parsing" | "validating" | "processing" | "completed" | "error";

/** Required-fields contract — unchanged business rules. */
const REQUIRED_HEADERS = [
  "student_first_name", "student_last_name", "student_phone",
  "intended_study_country", "intake_term", "intake_year",
  "course_name", "loan_amount_required",
];

/**
 * Final canonical header order — used everywhere (Partner + Admin):
 * - Downloaded template
 * - Parser strict-template check (rejects outdated templates missing the 6 new headers)
 * - UI column reference
 *
 * The 6 new fields (academic scores + EMI) are required IN THE TEMPLATE
 * (so old templates are cleanly rejected) but VALUES inside them stay optional.
 */
const ALL_HEADERS = [
  "student_first_name", "student_last_name", "student_phone", "student_email",
  "student_whatsapp", "city", "state", "country_of_residence",
  "intended_study_country", "intake_term", "intake_year", "course_name",
  "university_name",
  "10th_score", "12th_score", "graduation_score",
  "highest_qualification", "highest_qualification_score",
  "loan_amount_required",
  "coapplicant_name", "coapplicant_relation", "coapplicant_income",
  "coapplicant_existing_emi",
  "collateral_available", "collateral_notes", "source_sub_type", "partner_remark",
];

/** Headers introduced in the new template — used to detect outdated uploads. */
const NEW_TEMPLATE_HEADERS = [
  "10th_score", "12th_score", "graduation_score",
  "highest_qualification", "highest_qualification_score",
  "coapplicant_existing_emi",
];

/** Allowed values for highest_qualification — must match Add Lead / Student portal list. */
const ALLOWED_QUALIFICATIONS = [
  "12th / High School", "Diploma", "Bachelor's Degree",
  "Master's Degree", "PhD / Doctorate", "Other",
];

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
  intakeTerms: string[];
  intakeYears: number[];
  universityMap: Map<string, string>; // lowercase name -> id
}

async function loadMasterData(): Promise<MasterData> {
  const [cRes, iRes, uRes] = await Promise.all([
    supabase.from("countries_master").select("country_name").eq("active_flag", true),
    supabase.from("intake_master").select("intake_term,intake_year").eq("active_flag", true),
    supabase.from("universities_master").select("id,university_name").eq("active_flag", true),
  ]);

  const countries = (cRes.data ?? []).map((c) => c.country_name.toLowerCase());
  const intakeTerms = [...new Set((iRes.data ?? []).map((i) => i.intake_term.toLowerCase()))];
  const intakeYears = [...new Set((iRes.data ?? []).map((i) => i.intake_year))];
  const universityMap = new Map<string, string>();
  (uRes.data ?? []).forEach((u) => universityMap.set(u.university_name.toLowerCase(), u.id));

  return { countries, intakeTerms, intakeYears, universityMap };
}

function validateRow(row: Record<string, string>, master: MasterData): { parsed: ParsedRow; errors: string[] } {
  const errors: string[] = [];
  const rowNumber = 0; // set by caller

  const val = (key: string) => (row[key] ?? "").trim();
  const firstName = val("student_first_name");
  const lastName = val("student_last_name");
  const phone = val("student_phone");
  const email = val("student_email");
  const country = val("intended_study_country");
  const intakeTerm = val("intake_term");
  const intakeYearStr = val("intake_year");
  const courseName = val("course_name");
  const loanStr = val("loan_amount_required");
  const collateralStr = val("collateral_available");
  const collateralNotes = val("collateral_notes");
  const coapplicantIncomeStr = val("coapplicant_income");

  if (!firstName) errors.push("student_first_name is required");
  if (!lastName) errors.push("student_last_name is required");
  if (!phone) errors.push("student_phone is required");
  else if (!/^\+?[\d\s\-()]{7,15}$/.test(phone)) errors.push("Invalid phone format");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("Invalid email format");
  if (!country) errors.push("intended_study_country is required");
  else if (!master.countries.includes(country.toLowerCase())) errors.push(`Country "${country}" not found in master data`);
  if (!intakeTerm) errors.push("intake_term is required");
  else if (!master.intakeTerms.includes(intakeTerm.toLowerCase())) errors.push(`Intake term "${intakeTerm}" not found in master data`);

  const intakeYear = parseInt(intakeYearStr, 10);
  if (!intakeYearStr) errors.push("intake_year is required");
  else if (isNaN(intakeYear) || intakeYear < 2020 || intakeYear > 2035) errors.push("intake_year must be a valid year (2020-2035)");

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
    intake_year: isNaN(intakeYear) ? undefined : intakeYear,
    course_name: courseName,
    university_name: universityRaw || undefined,
    loan_amount_required: isNaN(loanAmount) ? undefined : loanAmount,
    coapplicant_name: val("coapplicant_name") || undefined,
    coapplicant_relation: val("coapplicant_relation") || undefined,
    coapplicant_income: coapplicantIncome,
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
        collateral_available: row.collateral_available ?? null,
        collateral_notes: row.collateral_notes ?? null,
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
