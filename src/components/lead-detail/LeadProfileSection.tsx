import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, GraduationCap, Wallet, FolderInput, ShieldCheck } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { useRoleAccess } from "@/hooks/useRoleAccess";
import { InlineEditField } from "@/components/admin/InlineEditField";
import { formatINR } from "@/lib/formatCurrency";

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
            parseValue={editable.parseValue}
            formatDisplay={editable.formatDisplay}
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

interface Props {
  lead: Lead;
  submittedByName: string | null;
  onSaved?: () => void;
}

export function LeadProfileSection({ lead, submittedByName, onSaved }: Props) {
  const { isAdmin } = useRoleAccess();
  const ts = (lead.test_scores ?? {}) as Record<string, unknown>;

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
  const hqScore =
    (lead.marks_gpa && String(lead.marks_gpa).trim() !== "" ? String(lead.marks_gpa) : null) ??
    tsStr("highest_qualification_score");
  // Edit target: prefer the column the value lives on. If neither is set, default to marks_gpa.
  const hqEditable = (() => {
    const hasMarks = lead.marks_gpa && String(lead.marks_gpa).trim() !== "";
    const hasTS = tsStr("highest_qualification_score") !== null;
    if (hasTS && !hasMarks) return edTS("highest_qualification_score");
    return ed("marks_gpa");
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
              })}
            />
            <Field label="Mobile" value={lead.student_phone} editable={ed("student_phone")}  onSaved={onSaved} />
            <Field label="Email" value={lead.student_email} editable={ed("student_email", { inputType: "email" })}  onSaved={onSaved} />
            <Field label="WhatsApp" value={lead.student_whatsapp} editable={ed("student_whatsapp")}  onSaved={onSaved} />
            <Field label="Pincode" value={lead.pincode} editable={ed("pincode")}  onSaved={onSaved} />
            <Field label="City" value={lead.city} editable={ed("city")}  onSaved={onSaved} />
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
            <Field label="Study Country" value={lead.intended_study_country} editable={ed("intended_study_country")}  onSaved={onSaved} />
            <Field label="University" value={lead.university_name_raw} editable={ed("university_name_raw")}  onSaved={onSaved} />
            <Field label="Course" value={lead.course_name} editable={ed("course_name")}  onSaved={onSaved} />
            <Field label="Course Category" value={lead.course_category} editable={ed("course_category")}  onSaved={onSaved} />
            <Field label="Intake Term" value={lead.intake_term} editable={ed("intake_term")}  onSaved={onSaved} />
            <Field
              label="Intake Year"
              value={lead.intake_year ? String(lead.intake_year) : null}
              editable={ed("intake_year", { inputType: "number", parseValue: numericParse })}
            />
            <Field
              label="Loan Amount"
              value={lead.loan_amount_required ? String(lead.loan_amount_required) : null}
              editable={ed("loan_amount_required", {
                inputType: "number",
                formatDisplay: (v) => formatINR(v),
                parseValue: numericParse,
              })}
            />
            <Field label="Highest Qualification" value={lead.highest_qualification} editable={ed("highest_qualification")}  onSaved={onSaved} />
            <Field label="Highest Qualification Score" value={hqScore} editable={hqEditable}  onSaved={onSaved} />
            <Field
              label="Work Experience (years)"
              value={tsStr("work_experience_years")}
              editable={edTS("work_experience_years")}
            />
            <Field label="10th Score" value={tsStr("tenth")} editable={edTS("tenth")}  onSaved={onSaved} />
            <Field label="12th Score" value={tsStr("twelfth")} editable={edTS("twelfth")}  onSaved={onSaved} />
            <Field label="Graduation Score" value={tsStr("graduation")} editable={edTS("graduation")}  onSaved={onSaved} />
            <Field label="IELTS" value={tsStr("ielts")} editable={edTS("ielts")}  onSaved={onSaved} />
            <Field label="TOEFL" value={tsStr("toefl")} editable={edTS("toefl")}  onSaved={onSaved} />
            <Field label="PTE" value={tsStr("pte")} editable={edTS("pte")}  onSaved={onSaved} />
            <Field label="Duolingo" value={tsStr("duolingo")} editable={edTS("duolingo")}  onSaved={onSaved} />
            <Field label="GRE" value={tsStr("gre")} editable={edTS("gre")}  onSaved={onSaved} />
            <Field label="GMAT" value={tsStr("gmat")} editable={edTS("gmat")}  onSaved={onSaved} />
            <Field label="SAT" value={tsStr("sat")} editable={edTS("sat")}  onSaved={onSaved} />
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
            <Field label="Relation" value={lead.coapplicant_relation} editable={ed("coapplicant_relation")}  onSaved={onSaved} />
            <Field label="Co-Applicant Mobile" value={lead.coapplicant_mobile} editable={ed("coapplicant_mobile")}  onSaved={onSaved} />
            <Field
              label="Co-Applicant Email"
              value={lead.coapplicant_email}
              editable={ed("coapplicant_email", { inputType: "email" })}
            />
            <Field
              label="Co-Applicant Age"
              value={tsStr("coapplicant_age")}
              editable={edTS("coapplicant_age", { inputType: "number", parseValue: numericParse })}
            />
            <Field
              label="Co-Applicant CIBIL"
              value={tsStr("coapplicant_cibil")}
              editable={edTS("coapplicant_cibil", { inputType: "number", parseValue: numericParse })}
            />
            <Field
              label="Co-Applicant Employment Type"
              value={lead.coapplicant_employment_type}
              editable={ed("coapplicant_employment_type")}
            />
            <Field
              label="Co-Applicant Employer / Occupation"
              value={lead.coapplicant_employer}
              editable={ed("coapplicant_employer")}
            />
            <Field
              label="Co-Applicant Income Source"
              value={lead.coapplicant_income_source}
              editable={ed("coapplicant_income_source")}
            />
            <Field
              label="Co-Applicant Income"
              value={lead.coapplicant_income ? String(lead.coapplicant_income) : null}
              editable={ed("coapplicant_income", {
                inputType: "number",
                formatDisplay: (v) => formatINR(v),
                parseValue: numericParse,
              })}
            />
            <Field
              label="Co-Applicant Existing EMI"
              value={lead.coapplicant_existing_emi != null ? String(lead.coapplicant_existing_emi) : null}
              editable={ed("coapplicant_existing_emi", {
                inputType: "number",
                formatDisplay: (v) => formatINR(v),
                parseValue: numericParse,
              })}
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
            <Field label="Source Type" value={lead.source_type} />
            <Field label="Source Subtype" value={lead.source_sub_type} />
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
