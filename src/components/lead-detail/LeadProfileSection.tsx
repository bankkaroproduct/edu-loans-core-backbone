import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, GraduationCap, Wallet, FolderInput, ShieldCheck } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { useRoleAccess } from "@/hooks/useRoleAccess";
import { InlineEditField } from "@/components/admin/InlineEditField";
import { formatINR, formatINRWithUnit } from "@/lib/formatCurrency";
import {
  normalizeAcademicScore,
  resolveCoappWorkExpDecimalYears,
  formatCoappWorkExpDecimal,
} from "@/lib/academicScore";
import type { NumericKind } from "@/lib/numericValidation";
import { useLeadMasterData } from "@/hooks/useLeadMasterData";
import { COURSE_CATEGORY_OPTIONS } from "@/lib/courseCategoryOptions";
import { TEST_SCORE_RANGES, ACADEMIC_TOTAL_RANGE, ACADEMIC_PERCENTAGE_MAX, WORK_EXPERIENCE_YEARS_RANGE } from "@/lib/leadScoreRanges";
import type { MasterOption } from "@/components/ui/master-combobox";
import { formatDisplayLabel } from "@/lib/formatDisplayLabel";

type Lead = Tables<"student_leads"> & {
  district?: string | null;
  tier?: string | null;
  lead_authenticity?: string | null;
};

const AUTHENTICITY_LABEL: Record<string, { label: string; tone: "default" | "secondary" | "destructive" | "outline" }> = {
  unverified: { label: "Unverified", tone: "outline" },
  verified: { label: "Verified", tone: "default" },
  suspicious: { label: "Suspicious", tone: "secondary" },
  fraudulent: { label: "Fraudulent", tone: "destructive" },
};

interface EditableConfig {
  leadId: string;
  field: string;
  jsonbColumn?: string;
  inputType?: string;
  options?: { value: string; label: string }[];
  parseValue?: (raw: string) => unknown;
  formatDisplay?: (v: string) => string;
  numericKind?: NumericKind;
  optionsRenderAs?: "buttons" | "dropdown";
  numericRange?: { min?: number; max?: number; label?: string };
  siblingMaxKey?: string;
  percentageMaxWhenNoSibling?: number;
  masterCombobox?: {
    options: MasterOption[];
    placeholder?: string;
    manualPlaceholder?: string;
    helperText?: string;
  };
}

function Field({
  label,
  value,
  editable,
  readOnlyFallback = "—",
  onSaved,
}: {
  label: string;
  value: string | null | undefined;
  editable?: EditableConfig;
  readOnlyFallback?: string;
  onSaved?: () => void;
}) {
  const hasValue = value !== null && value !== undefined && value !== "";
  return (
    <div className="min-w-0">
      <span className="text-muted-foreground text-xs">{label}</span>
      <p className={hasValue ? "text-sm font-medium break-words" : "text-sm text-muted-foreground/70"}>
        {editable ? (
          <InlineEditField
            leadId={editable.leadId}
            field={editable.field}
            jsonbColumn={editable.jsonbColumn}
            label={label}
            value={value ?? null}
            inputType={editable.inputType}
            options={editable.options}
            optionsRenderAs={editable.optionsRenderAs}
            parseValue={editable.parseValue}
            formatDisplay={editable.formatDisplay}
            numericKind={editable.numericKind}
            numericRange={editable.numericRange}
            siblingMaxKey={editable.siblingMaxKey}
            percentageMaxWhenNoSibling={editable.percentageMaxWhenNoSibling}
            masterCombobox={editable.masterCombobox}
            allowEditExisting
            onSaved={onSaved ? () => onSaved() : undefined}
          />
        ) : hasValue ? (
          value
        ) : (
          readOnlyFallback
        )}
      </p>
    </div>
  );
}

function NormalizedField({
  label,
  score,
  total,
}: {
  label: string;
  score: string | null | undefined;
  total: string | null | undefined;
}) {
  if (!score || !total) return null;
  const { percentage, source } = normalizeAcademicScore(score, total);
  if (percentage == null || source !== "score_total") return null;
  return (
    <div className="min-w-0">
      <span className="text-muted-foreground text-xs">{label}</span>
      <p className="text-sm font-medium break-words">Normalized: {percentage}%</p>
    </div>
  );
}

interface Props {
  lead: Lead;
  submittedByName: string | null;
  onSaved?: () => void;
}

export function LeadProfileSection({ lead, submittedByName, onSaved }: Props) {
  const { isAdmin } = useRoleAccess();
  const ts = (lead.test_scores ?? {}) as Record<string, unknown>;

  const { countries, universities, courses } = useLeadMasterData();
  const countryOptions: MasterOption[] = countries.map((c) => ({ id: c.country_name, label: c.country_name }));
  const universityOptions: MasterOption[] = (() => {
    const country = (lead.intended_study_country ?? "").trim().toLowerCase();
    const filtered = country
      ? universities.filter((u) => (u.country ?? "").trim().toLowerCase() === country)
      : universities;
    return filtered.map((u) => ({ id: u.id, label: u.university_name, hint: u.country ?? undefined }));
  })();
  const courseOptions: MasterOption[] = courses.map((c) => ({ id: c.id, label: c.course_name, hint: c.course_category ?? undefined }));

  const ed = (
    field: string,
    extras?: Omit<EditableConfig, "leadId" | "field">,
  ): EditableConfig | undefined =>
    isAdmin ? { leadId: lead.id, field, ...extras } : undefined;

  // JSONB-backed editable: merges into test_scores without clobbering siblings.
  const edTS = (
    key: string,
    extras?: Omit<EditableConfig, "leadId" | "field" | "jsonbColumn">,
  ): EditableConfig | undefined =>
    isAdmin ? { leadId: lead.id, field: key, jsonbColumn: "test_scores", ...extras } : undefined;

  const tsStr = (k: string): string | null => {
    const v = ts[k];
    return v === null || v === undefined || v === "" ? null : String(v);
  };

  // Source-agnostic Highest Qualification Score:
  // Some sources write to top-level marks_gpa; others write to test_scores.highest_qualification_score.
  // Display-only fallback (mirrors AddLead/Student review): if neither dedicated source is set,
  // fall back to the matching level's score based on highest_qualification. Edit target unchanged.
  const hqRaw =
    (lead.marks_gpa && String(lead.marks_gpa).trim() !== "" ? String(lead.marks_gpa) : null) ??
    tsStr("highest_qualification_score");
  const hqLevel = (lead as any).highest_qualification ?? "";
  const hqScore =
    hqRaw ??
    (hqLevel === "12th / High School" ? tsStr("twelfth") : null) ??
    (hqLevel === "10th / SSC" ? tsStr("tenth") : null);
  const isAtOrBelow12 = hqLevel === "12th / High School" || hqLevel === "10th / SSC";
  const graduationRaw = tsStr("graduation");
  const graduationDisplay =
    graduationRaw ?? (isAtOrBelow12 ? "Not applicable" : null);
  // City display fallback: when the persisted city is empty, fall back to district
  // (mirrors resolvePincodeEnrichment). Backend backfill tracked separately.
  const cityDisplay =
    (lead.city && String(lead.city).trim() !== "" ? lead.city : null) ?? lead.district ?? null;
  // Edit target: prefer the column the value lives on. If neither is set, default to marks_gpa.
  const hqEditable = (() => {
    const hasMarks = lead.marks_gpa && String(lead.marks_gpa).trim() !== "";
    const hasTS = tsStr("highest_qualification_score") !== null;
    const range = { min: 0, max: ACADEMIC_TOTAL_RANGE.max, label: "Highest Qualification Score" };
    if (hasTS && !hasMarks) return edTS("highest_qualification_score", { numericRange: range, siblingMaxKey: "highest_qualification_total" });
    return ed("marks_gpa", { numericRange: range });
  })();

  const numericParse = (raw: string) => {
    const n = Number(raw);
    return Number.isFinite(n) ? n : raw;
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Student Details */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4 text-primary" /> Student Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <Field label="First Name" value={lead.student_first_name} editable={ed("student_first_name")}  onSaved={onSaved} />
            <Field label="Last Name" value={lead.student_last_name} editable={ed("student_last_name")}  onSaved={onSaved} />
            <Field label="Full Name" value={lead.student_full_name} editable={ed("student_full_name")}  onSaved={onSaved} />
            <Field
              label="Date of Birth"
              value={(lead as Lead & { student_dob?: string | null }).student_dob ?? null}
              editable={ed("student_dob", { inputType: "date" })}
              onSaved={onSaved}
            />
            <Field
              label="Gender"
              value={(lead as Lead & { student_gender?: string | null }).student_gender ?? null}
              editable={ed("student_gender", {
                options: [
                  { value: "male", label: "Male" },
                  { value: "female", label: "Female" },
                  { value: "other", label: "Other" },
                ],
                formatDisplay: (v) => formatDisplayLabel(v),
              })}
              onSaved={onSaved}
            />
            <Field label="Mobile" value={lead.student_phone} editable={ed("student_phone")}  onSaved={onSaved} />
            <Field label="Email" value={lead.student_email} editable={ed("student_email", { inputType: "email" })}  onSaved={onSaved} />
            <Field label="WhatsApp" value={lead.student_whatsapp} editable={ed("student_whatsapp")}  onSaved={onSaved} />
            <Field label="Pincode" value={lead.pincode} editable={ed("pincode")}  onSaved={onSaved} />
            <Field label="City" value={cityDisplay} editable={ed("city")}  onSaved={onSaved} />
            <Field label="District" value={lead.district ?? null} editable={ed("district")}  onSaved={onSaved} />
            <Field label="State" value={lead.state} editable={ed("state")}  onSaved={onSaved} />
            <Field label="Tier" value={lead.tier ?? null} editable={ed("tier")}  onSaved={onSaved} />
            <Field label="Country" value={lead.country_of_residence} editable={ed("country_of_residence")}  onSaved={onSaved} />
          </div>
        </CardContent>
      </Card>

      {/* Education / Study Intent */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-primary" /> Education & Study Intent
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Study Country"
              value={lead.intended_study_country}
              editable={ed("intended_study_country", {
                masterCombobox: {
                  options: countryOptions,
                  placeholder: "Search & select country…",
                  manualPlaceholder: "Type the country name",
                  helperText: "Search the master list, or pick 'Not available in list' to type manually.",
                },
              })}
              onSaved={onSaved}
            />
            <Field
              label="University"
              value={lead.university_name_raw}
              editable={ed("university_name_raw", {
                masterCombobox: {
                  options: universityOptions,
                  placeholder: lead.intended_study_country
                    ? `Search universities in ${lead.intended_study_country}…`
                    : "Search universities…",
                  manualPlaceholder: "Type the university name",
                  helperText: "Search the master list, or pick 'Not available in list' to type manually.",
                },
              })}
              onSaved={onSaved}
            />
            <Field
              label="Course"
              value={lead.course_name}
              editable={ed("course_name", {
                masterCombobox: {
                  options: courseOptions,
                  placeholder: "Search courses…",
                  manualPlaceholder: "Type the course name",
                  helperText: "Search the master list, or pick 'Not available in list' to type manually.",
                },
              })}
              onSaved={onSaved}
            />
            <Field
              label="Course Category"
              value={lead.course_category}
              editable={ed("course_category", {
                options: COURSE_CATEGORY_OPTIONS.map((v) => ({ value: v, label: v })),
                optionsRenderAs: "dropdown",
                formatDisplay: (v) => formatDisplayLabel(v),
              })}
              onSaved={onSaved}
            />
            {/* Intake Term + Intake Year intentionally omitted here — Intake
                in LeadSummaryStrip is the single source of truth for display. */}
            <Field
              label="Loan Amount"
              value={
                isAdmin
                  ? (lead.loan_amount_required ? String(lead.loan_amount_required) : null)
                  : (lead.loan_amount_required ? formatINRWithUnit(lead.loan_amount_required) : null)
              }
              editable={ed("loan_amount_required", {
                inputType: "number",
                formatDisplay: (v) => formatINRWithUnit(v),
                parseValue: numericParse,
              })}
              onSaved={onSaved}
            />
            <Field label="Highest Qualification" value={lead.highest_qualification} editable={ed("highest_qualification", { formatDisplay: (v) => formatDisplayLabel(v) })}  onSaved={onSaved} />
            <Field label="Highest Qualification Score" value={hqScore} editable={hqEditable}  onSaved={onSaved} />
            <Field
              label="Work Experience (years)"
              value={tsStr("work_experience_years")}
              editable={edTS("work_experience_years", {
                numericRange: { min: WORK_EXPERIENCE_YEARS_RANGE.min, max: WORK_EXPERIENCE_YEARS_RANGE.max, label: WORK_EXPERIENCE_YEARS_RANGE.label },
              })}
              onSaved={onSaved}
            />
            <Field label="10th Score" value={tsStr("tenth")} editable={edTS("tenth", { numericRange: { min: 0, max: ACADEMIC_TOTAL_RANGE.max, label: "10th Score" }, siblingMaxKey: "tenth_total" })} onSaved={onSaved} />
            <Field label="10th Total Marks" value={tsStr("tenth_total")} editable={edTS("tenth_total", { numericRange: { min: ACADEMIC_TOTAL_RANGE.min, max: ACADEMIC_TOTAL_RANGE.max, label: "10th Total Marks" } })} onSaved={onSaved} />
            <NormalizedField label="10th Normalized" score={tsStr("tenth")} total={tsStr("tenth_total")} />
            <Field label="12th Score" value={tsStr("twelfth")} editable={edTS("twelfth", { numericRange: { min: 0, max: ACADEMIC_TOTAL_RANGE.max, label: "12th Score" }, siblingMaxKey: "twelfth_total" })} onSaved={onSaved} />
            <Field label="12th Total Marks" value={tsStr("twelfth_total")} editable={edTS("twelfth_total", { numericRange: { min: ACADEMIC_TOTAL_RANGE.min, max: ACADEMIC_TOTAL_RANGE.max, label: "12th Total Marks" } })} onSaved={onSaved} />
            <NormalizedField label="12th Normalized" score={tsStr("twelfth")} total={tsStr("twelfth_total")} />
            <Field label="Graduation Score" value={graduationDisplay} editable={edTS("graduation", { numericRange: { min: 0, max: ACADEMIC_TOTAL_RANGE.max, label: "Graduation Score" }, siblingMaxKey: "graduation_total" })} onSaved={onSaved} />
            <Field label="Graduation Total / CGPA Scale" value={tsStr("graduation_total")} editable={edTS("graduation_total", { numericRange: { min: ACADEMIC_TOTAL_RANGE.min, max: ACADEMIC_TOTAL_RANGE.max, label: "Graduation Total / CGPA Scale" } })} onSaved={onSaved} />
            <NormalizedField label="Graduation Normalized" score={tsStr("graduation")} total={tsStr("graduation_total")} />
            <Field label="Highest Qual. Total / CGPA Scale" value={tsStr("highest_qualification_total")} editable={edTS("highest_qualification_total", { numericRange: { min: ACADEMIC_TOTAL_RANGE.min, max: ACADEMIC_TOTAL_RANGE.max, label: "Highest Qual. Total / CGPA Scale" } })} onSaved={onSaved} />
            <NormalizedField label="Highest Qual. Normalized" score={hqScore} total={tsStr("highest_qualification_total")} />
            {(["ielts","toefl","pte","duolingo","gre","gmat","sat"] as const).map((k) => {
              const r = TEST_SCORE_RANGES[k];
              return (
                <Field key={k} label={r.label} value={tsStr(k)} editable={edTS(k, { numericRange: { min: r.min, max: r.max, label: r.label } })} onSaved={onSaved} />
              );
            })}
            <Field label="Other Test Scores" value={tsStr("raw_text")} editable={edTS("raw_text")}  onSaved={onSaved} />
          </div>
        </CardContent>
      </Card>

      {/* Financial Snapshot */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Wallet className="h-4 w-4 text-primary" /> Financial Snapshot
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Co-Applicant" value={lead.coapplicant_name} editable={ed("coapplicant_name")}  onSaved={onSaved} />
            <Field label="Relation" value={lead.coapplicant_relation} editable={ed("coapplicant_relation", { formatDisplay: (v) => formatDisplayLabel(v) })}  onSaved={onSaved} />
            <Field label="Co-Applicant Mobile" value={lead.coapplicant_mobile} editable={ed("coapplicant_mobile")}  onSaved={onSaved} />
            <Field
              label="Co-Applicant Email"
              value={lead.coapplicant_email}
              editable={ed("coapplicant_email", { inputType: "email" })}
              onSaved={onSaved}
            />
            <Field
              label="Co-Applicant Age"
              value={tsStr("coapplicant_age")}
              editable={edTS("coapplicant_age", { inputType: "number", parseValue: numericParse })}
              onSaved={onSaved}
            />
            {/* Single decimal field. Reads new exact key first; falls back to
                legacy years+months. Saves into the new key only. */}
            <Field
              label="Work Experience (Years)"
              value={formatCoappWorkExpDecimal(resolveCoappWorkExpDecimalYears(ts))}
              editable={edTS("coapplicant_work_experience_total_years", {
                inputType: "number",
                parseValue: numericParse,
                numericKind: "decimal",
              })}
              onSaved={onSaved}
            />
            <Field
              label="Co-Applicant Employment Type"
              value={lead.coapplicant_employment_type}
              editable={ed("coapplicant_employment_type", { formatDisplay: (v) => formatDisplayLabel(v) })}
              onSaved={onSaved}
            />
            {/* Co-Applicant Income Source removed from Financial Snapshot
                display. DB column and write paths are preserved. */}
            <Field
              label="Co-Applicant Income"
              value={lead.coapplicant_income ? String(lead.coapplicant_income) : null}
              editable={ed("coapplicant_income", {
                inputType: "number",
                formatDisplay: (v) => formatINR(v),
                parseValue: numericParse,
              })}
              onSaved={onSaved}
            />
            <Field
              label="Collateral"
              value={
                lead.collateral_available === null || lead.collateral_available === undefined
                  ? null
                  : lead.collateral_available
                  ? "true"
                  : "false"
              }
              editable={ed("collateral_available", {
                options: [
                  { value: "true", label: "Yes" },
                  { value: "false", label: "No" },
                ],
                parseValue: (raw) => raw === "true",
                formatDisplay: (v) => (v === "true" ? "Yes" : "No"),
              })}
              onSaved={onSaved}
            />
            <Field label="Collateral Notes" value={lead.collateral_notes} editable={ed("collateral_notes")}  onSaved={onSaved} />
          </div>
        </CardContent>
      </Card>

      {/* Source / Creation Context — system-only, untouched */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FolderInput className="h-4 w-4 text-primary" /> Source & Creation Context
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Source Type" value={formatDisplayLabel(lead.source_type)} />
            <Field label="Source Subtype" value={formatDisplayLabel(lead.source_sub_type)} />
            <Field label="Submitted By" value={submittedByName} readOnlyFallback="Not captured" />
            <Field label="Created At" value={new Date(lead.created_at).toLocaleString()} readOnlyFallback="—" />
            <Field label="Last Updated" value={new Date(lead.updated_at).toLocaleString()} readOnlyFallback="—" />
            <div className="min-w-0">
              <span className="text-muted-foreground text-xs flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" /> Lead Authenticity
              </span>
              {(() => {
                const key = (lead.lead_authenticity ?? "unverified").toLowerCase();
                const meta = AUTHENTICITY_LABEL[key] ?? AUTHENTICITY_LABEL.unverified;
                return (
                  <div className="mt-1">
                    <Badge variant={meta.tone}>{meta.label}</Badge>
                    {lead.fraud_flag ? (
                      <Badge variant="destructive" className="ml-2">Legacy fraud_flag</Badge>
                    ) : null}
                  </div>
                );
              })()}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
