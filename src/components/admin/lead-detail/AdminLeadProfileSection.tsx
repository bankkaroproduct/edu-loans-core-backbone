// Admin-only profile section: Student Details / Education & Study Intent /
// Financial Snapshot / Source. Visual mirror of LeadProfileSection.
// Reuses InlineEditField for all save logic — no new save/edit code paths.
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { User, GraduationCap, Wallet, FolderInput } from "lucide-react";
import ProfileSectionCard from "@/components/lead-detail/ProfileSectionCard";
import type { Tables } from "@/integrations/supabase/types";
import { useRoleAccess } from "@/hooks/useRoleAccess";
import { InlineEditField } from "@/components/admin/InlineEditField";
import { MasterEditPopover } from "@/components/admin/MasterEditPopover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  buildIntakeSessionOptions,
  intakeSessionLabel,
  intakeSessionValue,
  parseIntakeSessionValue,
} from "@/lib/intakeSession";
import { formatINR } from "@/lib/formatCurrency";
import { INRAmountStacked } from "@/components/shared/INRAmountStacked";
import type { ReactNode } from "react";
import {
  normalizeAcademicScore,
  resolveCoappWorkExpDecimalYears,
  formatCoappWorkExpDecimal,
} from "@/lib/academicScore";
import { useHighestQualificationOptions } from "@/hooks/useHighestQualificationOptions";
import { useLeadMasterData } from "@/hooks/useLeadMasterData";
import { CO_APPLICANT_RELATIONS } from "@/lib/coapplicantRelations";
import { COURSE_CATEGORY_OPTIONS } from "@/lib/courseCategoryOptions";
import { TEST_SCORE_RANGES, ACADEMIC_TOTAL_RANGE, ACADEMIC_PERCENTAGE_MAX, WORK_EXPERIENCE_YEARS_RANGE } from "@/lib/leadScoreRanges";
import type { MasterOption } from "@/components/ui/master-combobox";
import { UniversityRankChip } from "@/components/admin/lead-detail/UniversityRankChip";
import { formatDisplayLabel } from "@/lib/formatDisplayLabel";

type Lead = Tables<"student_leads"> & {
  district?: string | null;
  tier?: string | null;
};

import type { NumericKind } from "@/lib/numericValidation";

interface EditableConfig {
  leadId: string;
  field: string;
  jsonbColumn?: string;
  inputType?: string;
  options?: { value: string; label: string }[];
  parseValue?: (raw: string) => unknown;
  formatDisplay?: (v: string) => string;
  formatDisplayNode?: (v: string) => ReactNode;
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
  displayNode,
  editable,
  readOnlyFallback = "—",
  onSaved,
}: {
  label: string;
  value: string | null | undefined;
  displayNode?: ReactNode;
  editable?: EditableConfig;
  readOnlyFallback?: string;
  onSaved?: () => void;
}) {
  const hasValue = value !== null && value !== undefined && value !== "";
  return (
    <div className="min-w-0 space-y-0.5 overflow-hidden">
      <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </span>
      <p
        style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}
        className={
          hasValue
            ? "text-sm font-medium text-foreground break-words min-w-0"
            : "text-sm text-muted-foreground/70"
        }
      >
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
            formatDisplayNode={editable.formatDisplayNode}
            numericKind={editable.numericKind}
            numericRange={editable.numericRange}
            siblingMaxKey={editable.siblingMaxKey}
            percentageMaxWhenNoSibling={editable.percentageMaxWhenNoSibling}
            masterCombobox={editable.masterCombobox}
            allowEditExisting
            onSaved={onSaved ? () => onSaved() : undefined}
          />
        ) : displayNode ? (
          displayNode
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
    <div className="min-w-0 space-y-0.5 overflow-hidden">
      <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </span>
      <p className="text-sm font-medium text-foreground break-words min-w-0">
        Normalized: {percentage}%
      </p>
    </div>
  );
}

interface Props {
  lead: Lead;
  submittedByName: string | null;
  partner?: Tables<"partner_organizations"> | null;
  isStudentDirect?: boolean;
  onSaved?: () => void;
}

export function AdminLeadProfileSection({ lead, submittedByName, partner, isStudentDirect, onSaved }: Props) {
  const { isAdmin } = useRoleAccess();
  const ts = (lead.test_scores ?? {}) as Record<string, unknown>;
  const { options: highestQualOptions } = useHighestQualificationOptions();
  const { countries, universities, courses, intakes } = useLeadMasterData();
  const intakeOptions = useMemo(() => buildIntakeSessionOptions(intakes, { onlyFuture: false }), [intakes]);
  const [intakeDraft, setIntakeDraft] = useState<string>(intakeSessionValue(lead.intake_term, lead.intake_year));
  useEffect(() => {
    setIntakeDraft(intakeSessionValue(lead.intake_term, lead.intake_year));
  }, [lead.id, lead.intake_term, lead.intake_year]);
  const intakeDisplay = intakeSessionLabel(lead.intake_term, lead.intake_year) || null;

  const countryOptions: MasterOption[] = countries.map((c) => ({ id: c.country_name, label: c.country_name }));
  const universityOptions: MasterOption[] = (() => {
    const country = (lead.intended_study_country ?? "").trim().toLowerCase();
    const filtered = country
      ? universities.filter((u) => (u.country ?? "").trim().toLowerCase() === country)
      : universities;
    return filtered.map((u) => ({ id: u.id, label: u.university_name, hint: u.country ?? undefined }));
  })();
  const courseOptions: MasterOption[] = courses.map((c) => ({ id: c.id, label: c.course_name, hint: c.course_category ?? undefined }));

  // Fixed product labels for Co-applicant Employment Type. Saved value must use
  // these exact strings (not the master table's hyphenated variants) so the
  // BRE display mapping in `formatEmploymentLabel` continues to recognize them.
  const COAPP_EMPLOYMENT_TYPES = [
    "Salaried",
    "Self Employed",
    "Business Owner",
    "Retired",
    "Other",
  ] as const;

  const ed = (
    field: string,
    extras?: Omit<EditableConfig, "leadId" | "field">,
  ): EditableConfig | undefined =>
    isAdmin ? { leadId: lead.id, field, ...extras } : undefined;

  const edTS = (
    key: string,
    extras?: Omit<EditableConfig, "leadId" | "field" | "jsonbColumn">,
  ): EditableConfig | undefined =>
    isAdmin ? { leadId: lead.id, field: key, jsonbColumn: "test_scores", ...extras } : undefined;

  const tsStr = (k: string): string | null => {
    const v = ts[k];
    return v === null || v === undefined || v === "" ? null : String(v);
  };

  const hqScore =
    (lead.marks_gpa && String(lead.marks_gpa).trim() !== "" ? String(lead.marks_gpa) : null) ??
    tsStr("highest_qualification_score");
  const hqEditable = (() => {
    const hasMarks = lead.marks_gpa && String(lead.marks_gpa).trim() !== "";
    const hasTS = tsStr("highest_qualification_score") !== null;
    if (hasTS && !hasMarks) return edTS("highest_qualification_score", { numericKind: "decimal" });
    return ed("marks_gpa", { numericKind: "decimal" });
  })();

  const numericParse = (raw: string) => {
    const n = Number(raw);
    return Number.isFinite(n) ? n : raw;
  };

  const cityDisplay = (lead.city && String(lead.city).trim() !== "" ? lead.city : null) ?? lead.district ?? null;

  return (
    <div className="gap-4 md:columns-2 [&>*]:break-inside-avoid [&>*]:mb-4 md:[&>*]:mb-4">
      <ProfileSectionCard icon={User} title="Student Details">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3.5">
          <Field label="First Name" value={lead.student_first_name} editable={ed("student_first_name")} onSaved={onSaved} />
          <Field label="Last Name" value={lead.student_last_name} editable={ed("student_last_name")} onSaved={onSaved} />
          <Field label="Full Name" value={lead.student_full_name} editable={ed("student_full_name")} onSaved={onSaved} />
          <Field
            label="Date of Birth"
            value={(lead as Lead & { student_dob?: string | null }).student_dob ?? null}
            editable={ed("student_dob", {
              inputType: "date",
              formatDisplay: (v) => {
                const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
                return m ? `${m[3]}-${m[2]}-${m[1]}` : v;
              },
            })}
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
          <Field label="Mobile" value={lead.student_phone} editable={ed("student_phone", { numericKind: "phone" })} onSaved={onSaved} />
          <Field label="Email" value={lead.student_email} editable={ed("student_email", { inputType: "email" })} onSaved={onSaved} />
          <Field label="WhatsApp" value={lead.student_whatsapp} editable={ed("student_whatsapp", { numericKind: "phone" })} onSaved={onSaved} />
          <Field label="Pincode" value={lead.pincode} editable={ed("pincode", { numericKind: "pincode" })} onSaved={onSaved} />
          <Field label="City" value={cityDisplay} editable={ed("city")} onSaved={onSaved} />
          <Field label="District" value={lead.district ?? null} editable={ed("district")} onSaved={onSaved} />
          <Field label="State" value={lead.state} editable={ed("state")} onSaved={onSaved} />
          <Field label="City Tier" value={lead.tier ?? null} editable={ed("tier")} onSaved={onSaved} />
          <Field label="Country" value={lead.country_of_residence || (lead.pincode && /^\d{6}$/.test(lead.pincode) ? "India" : null)} editable={ed("country_of_residence")} onSaved={onSaved} />
        </div>
      </ProfileSectionCard>

      <ProfileSectionCard icon={GraduationCap} title="Education & Study Intent">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3.5">
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
          <div>
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
            <UniversityRankChip universityId={lead.university_id} />
          </div>
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
          <div className="min-w-0 space-y-0.5 overflow-hidden">
            <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              Intake Session
            </span>
            <p className="text-sm font-medium text-foreground break-words min-w-0">
              {isAdmin ? (
                <MasterEditPopover
                  wrap
                  leadId={lead.id}
                  label="Intake Session"
                  display={intakeDisplay}
                  renderBody={() => (
                    <Select value={intakeDraft} onValueChange={setIntakeDraft}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Select intake session" />
                      </SelectTrigger>
                      <SelectContent>
                        {intakeOptions.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  validate={() => (!parseIntakeSessionValue(intakeDraft) ? "Please select an intake session" : null)}
                  buildPayload={() => {
                    const parsed = parseIntakeSessionValue(intakeDraft);
                    if (!parsed) return null;
                    return { intake_term: parsed.term, intake_year: parsed.year };
                  }}
                  buildAudit={() => {
                    const parsed = parseIntakeSessionValue(intakeDraft);
                    return {
                      old: { intake_term: lead.intake_term, intake_year: lead.intake_year },
                      new: { intake_term: parsed?.term ?? null, intake_year: parsed?.year ?? null },
                    };
                  }}
                  onSaved={onSaved}
                />
              ) : (
                intakeDisplay ?? "—"
              )}
            </p>
          </div>
          <Field
            label="Loan Amount"
            value={lead.loan_amount_required ? String(lead.loan_amount_required) : null}
            displayNode={
              lead.loan_amount_required ? (
                <INRAmountStacked value={lead.loan_amount_required} />
              ) : undefined
            }
            editable={ed("loan_amount_required", {
              inputType: "number",
              formatDisplayNode: (v) => <INRAmountStacked value={v} />,
              parseValue: numericParse,
              numericKind: "amount",
            })}
            onSaved={onSaved}
          />
          <Field
            label="Highest Qualification"
            value={lead.highest_qualification}
            editable={ed("highest_qualification", {
              options: highestQualOptions.map((o) => ({ value: o, label: o })),
              optionsRenderAs: "dropdown",
              formatDisplay: (v) => formatDisplayLabel(v),
            })}
            onSaved={onSaved}
          />
          <Field
            label="Highest Qualification Score"
            value={hqScore}
            editable={
              hqEditable
                ? {
                    ...hqEditable,
                    numericRange: { min: 0, max: ACADEMIC_TOTAL_RANGE.max, label: "Score" },
                    ...(hqEditable.jsonbColumn === "test_scores"
                      ? {
                          siblingMaxKey: "highest_qualification_total",
                          percentageMaxWhenNoSibling: ACADEMIC_PERCENTAGE_MAX,
                        }
                      : {}),
                  }
                : undefined
            }
            onSaved={onSaved}
          />
          <Field
            label="Work Experience (years)"
            value={tsStr("work_experience_years")}
            editable={edTS("work_experience_years", {
              numericKind: "integer",
              numericRange: { min: WORK_EXPERIENCE_YEARS_RANGE.min, max: WORK_EXPERIENCE_YEARS_RANGE.max, label: WORK_EXPERIENCE_YEARS_RANGE.label },
            })}
            onSaved={onSaved}
          />
          <Field
            label="10th Score"
            value={tsStr("tenth")}
            editable={edTS("tenth", {
              numericKind: "decimal",
              numericRange: { min: 0, max: ACADEMIC_TOTAL_RANGE.max, label: "10th Score" },
              siblingMaxKey: "tenth_total",
              percentageMaxWhenNoSibling: ACADEMIC_PERCENTAGE_MAX,
            })}
            onSaved={onSaved}
          />
          <Field
            label="10th Total Marks"
            value={tsStr("tenth_total")}
            editable={edTS("tenth_total", {
              numericKind: "decimal",
              numericRange: { min: ACADEMIC_TOTAL_RANGE.min, max: ACADEMIC_TOTAL_RANGE.max, label: "10th Total Marks" },
            })}
            onSaved={onSaved}
          />
          <NormalizedField label="10th Normalized" score={tsStr("tenth")} total={tsStr("tenth_total")} />
          <Field
            label="12th Score"
            value={tsStr("twelfth")}
            editable={edTS("twelfth", {
              numericKind: "decimal",
              numericRange: { min: 0, max: ACADEMIC_TOTAL_RANGE.max, label: "12th Score" },
              siblingMaxKey: "twelfth_total",
              percentageMaxWhenNoSibling: ACADEMIC_PERCENTAGE_MAX,
            })}
            onSaved={onSaved}
          />
          <Field
            label="12th Total Marks"
            value={tsStr("twelfth_total")}
            editable={edTS("twelfth_total", {
              numericKind: "decimal",
              numericRange: { min: ACADEMIC_TOTAL_RANGE.min, max: ACADEMIC_TOTAL_RANGE.max, label: "12th Total Marks" },
            })}
            onSaved={onSaved}
          />
          <NormalizedField label="12th Normalized" score={tsStr("twelfth")} total={tsStr("twelfth_total")} />
          <Field
            label="Graduation Score"
            value={tsStr("graduation")}
            editable={edTS("graduation", {
              numericKind: "decimal",
              numericRange: { min: 0, max: ACADEMIC_TOTAL_RANGE.max, label: "Graduation Score" },
              siblingMaxKey: "graduation_total",
              percentageMaxWhenNoSibling: ACADEMIC_PERCENTAGE_MAX,
            })}
            onSaved={onSaved}
          />
          <Field
            label="Graduation Total / CGPA Scale"
            value={tsStr("graduation_total")}
            editable={edTS("graduation_total", {
              numericKind: "decimal",
              numericRange: { min: ACADEMIC_TOTAL_RANGE.min, max: ACADEMIC_TOTAL_RANGE.max, label: "Graduation Total / CGPA Scale" },
            })}
            onSaved={onSaved}
          />
          <NormalizedField label="Graduation Normalized" score={tsStr("graduation")} total={tsStr("graduation_total")} />
          <Field
            label="Highest Qual. Total / CGPA Scale"
            value={tsStr("highest_qualification_total")}
            editable={edTS("highest_qualification_total", {
              numericKind: "decimal",
              numericRange: { min: ACADEMIC_TOTAL_RANGE.min, max: ACADEMIC_TOTAL_RANGE.max, label: "Highest Qual. Total / CGPA Scale" },
            })}
            onSaved={onSaved}
          />
          <NormalizedField label="Highest Qual. Normalized" score={hqScore} total={tsStr("highest_qualification_total")} />
          {(["ielts","toefl","pte","duolingo","gre","gmat","sat"] as const).map((k) => {
            const r = TEST_SCORE_RANGES[k];
            return (
              <Field
                key={k}
                label={r.label}
                value={tsStr(k)}
                editable={edTS(k, {
                  numericKind: "decimal",
                  numericRange: { min: r.min, max: r.max, label: r.label },
                })}
                onSaved={onSaved}
              />
            );
          })}
          <Field label="Other Test Scores" value={tsStr("raw_text")} editable={edTS("raw_text")} onSaved={onSaved} />
        </div>
      </ProfileSectionCard>

      <ProfileSectionCard icon={Wallet} title="Financial Snapshot">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3.5">
          <Field label="Co-Applicant" value={lead.coapplicant_name} editable={ed("coapplicant_name")} onSaved={onSaved} />
          <Field
            label="Relation"
            value={lead.coapplicant_relation}
            editable={ed("coapplicant_relation", {
              options: CO_APPLICANT_RELATIONS.map((r) => ({ value: r, label: r })),
              optionsRenderAs: "dropdown",
              formatDisplay: (v) => formatDisplayLabel(v),
            })}
            onSaved={onSaved}
          />
          <Field label="Co-Applicant Mobile" value={lead.coapplicant_mobile} editable={ed("coapplicant_mobile", { numericKind: "phone" })} onSaved={onSaved} />
          <Field
            label="Co-Applicant Email"
            value={lead.coapplicant_email}
            editable={ed("coapplicant_email", { inputType: "email" })}
            onSaved={onSaved}
          />
          <Field
            label="Co-Applicant Age"
            value={tsStr("coapplicant_age")}
            editable={edTS("coapplicant_age", {
              inputType: "number",
              parseValue: numericParse,
              numericKind: "integer",
              numericRange: { min: 18, max: 100, label: "Co-Applicant Age" },
            })}
            onSaved={onSaved}
          />
          {/* Single decimal field. Reads from
              test_scores.coapplicant_work_experience_total_years when present
              (exact decimal), else falls back to legacy years + months/12.
              Saves the exact decimal into the new key only; legacy keys are
              preserved untouched for backward compatibility. */}
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
            editable={ed("coapplicant_employment_type", {
              options: COAPP_EMPLOYMENT_TYPES.map((v) => ({ value: v, label: v })),
              optionsRenderAs: "dropdown",
              formatDisplay: (v) => formatDisplayLabel(v),
            })}
            onSaved={onSaved}
          />
          {/* Co-Applicant Income Source removed from Financial Snapshot display.
              DB column and writers (Add Lead, student-application edge fn) are
              intentionally preserved. */}
          <Field
            label="Co-Applicant Income"
            value={lead.coapplicant_income ? String(lead.coapplicant_income) : null}
            displayNode={lead.coapplicant_income ? <>{formatINR(lead.coapplicant_income)}</> : undefined}
            editable={ed("coapplicant_income", {
              inputType: "number",
              formatDisplay: (v) => formatINR(v),
              parseValue: numericParse,
              numericKind: "amount",
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
          <Field label="Collateral Notes" value={lead.collateral_notes} editable={ed("collateral_notes")} onSaved={onSaved} />
        </div>
      </ProfileSectionCard>

      <ProfileSectionCard icon={FolderInput} title="Source & Creation Context">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3.5">
          <Field label="Source Type" value={formatDisplayLabel(lead.source_type)} />
          <Field label="Source Subtype" value={formatDisplayLabel(lead.source_sub_type)} />

          {/* Admin-only org context — merged from former AdminPartnerCard.
              Reuses the partner fetch from AdminLeadDetail.loadAll — no new query. */}
          {isAdmin && (isStudentDirect || !partner ? (
            <div className="col-span-2 rounded-md border bg-muted/30 p-2.5">
              <p className="text-xs text-muted-foreground">
                {isStudentDirect
                  ? "Direct Student Lead — submitted via the student portal, no partner attached."
                  : "Partner record is missing or could not be loaded."}
              </p>
            </div>
          ) : partner.partner_code === "PTR-DIRECT" ? (
            <div className="col-span-2 rounded-md border border-dashed bg-muted/30 p-2.5">
              <p className="text-xs text-muted-foreground">
                Direct / Admin-owned — this lead is owned directly by the admin team and excluded from billable partner reports and payout calculations.
              </p>
            </div>
          ) : (
            <>
              <Field label="Organization" value={partner.display_name?.trim() || "Partner Lead"} />
              <Field label="Legal Name" value={partner.legal_name} />
              <Field label="Partner ID" value={partner.partner_code} />
              <div className="min-w-0 space-y-0.5 overflow-hidden">
                <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  Partner Tags
                </span>
                <div className="flex items-center gap-2 pt-1 flex-wrap">
                  <Badge variant="secondary" className="text-[10px]">
                    {formatDisplayLabel(partner.partner_type)}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      partner.status === "active" ? "border-emerald-300 text-emerald-700 bg-emerald-50" :
                      partner.status === "suspended" || partner.status === "terminated" ? "border-destructive/30 text-destructive bg-destructive/5" :
                      "border-amber-300 text-amber-700 bg-amber-50"
                    }`}
                  >
                    {formatDisplayLabel(partner.status)}
                  </Badge>
                </div>
              </div>
              <div className="col-span-2 min-w-0 space-y-0.5 overflow-hidden">
                <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  Org Contact
                </span>
                <p className="text-xs text-muted-foreground break-words">
                  {partner.contact_person_name || "—"}
                  {partner.contact_person_email ? ` · ${partner.contact_person_email}` : ""}
                  {partner.contact_person_phone ? ` · ${partner.contact_person_phone}` : ""}
                </p>
              </div>
            </>
          ))}

          <Field label="Submitted By" value={submittedByName} readOnlyFallback="Not captured" />
          <Field label="Created At" value={new Date(lead.created_at).toLocaleString()} readOnlyFallback="—" />
          <Field label="Last Updated" value={new Date(lead.updated_at).toLocaleString()} readOnlyFallback="—" />
        </div>
      </ProfileSectionCard>
    </div>
  );
}
