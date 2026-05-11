// Admin-only profile section: Student Details / Education & Study Intent /
// Financial Snapshot / Source. Visual mirror of LeadProfileSection.
// Reuses InlineEditField for all save logic — no new save/edit code paths.
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, GraduationCap, Wallet, FolderInput, ShieldCheck } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { useRoleAccess } from "@/hooks/useRoleAccess";
import { InlineEditField } from "@/components/admin/InlineEditField";
import { formatINR } from "@/lib/formatCurrency";
import { normalizeAcademicScore } from "@/lib/academicScore";

type Lead = Tables<"student_leads"> & {
  district?: string | null;
  tier?: string | null;
  lead_authenticity?: string | null;
};

const AUTHENTICITY_LABEL: Record<
  string,
  { label: string; tone: "default" | "secondary" | "destructive" | "outline" }
> = {
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

function SectionCard({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof User;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="rounded-xl border-border/60 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
            <Icon className="h-3.5 w-3.5 text-primary" />
          </span>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

interface Props {
  lead: Lead;
  submittedByName: string | null;
  onSaved?: () => void;
}

export function AdminLeadProfileSection({ lead, submittedByName, onSaved }: Props) {
  const { isAdmin } = useRoleAccess();
  const ts = (lead.test_scores ?? {}) as Record<string, unknown>;

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
    if (hasTS && !hasMarks) return edTS("highest_qualification_score");
    return ed("marks_gpa");
  })();

  const numericParse = (raw: string) => {
    const n = Number(raw);
    return Number.isFinite(n) ? n : raw;
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <SectionCard icon={User} title="Student Details">
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
            })}
            onSaved={onSaved}
          />
          <Field label="Mobile" value={lead.student_phone} editable={ed("student_phone")} onSaved={onSaved} />
          <Field label="Email" value={lead.student_email} editable={ed("student_email", { inputType: "email" })} onSaved={onSaved} />
          <Field label="WhatsApp" value={lead.student_whatsapp} editable={ed("student_whatsapp")} onSaved={onSaved} />
          <Field label="Pincode" value={lead.pincode} editable={ed("pincode")} onSaved={onSaved} />
          <Field label="City" value={lead.city} editable={ed("city")} onSaved={onSaved} />
          <Field label="District" value={lead.district ?? null} editable={ed("district")} onSaved={onSaved} />
          <Field label="State" value={lead.state} editable={ed("state")} onSaved={onSaved} />
          <Field label="Tier" value={lead.tier ?? null} editable={ed("tier")} onSaved={onSaved} />
          <Field label="Country" value={lead.country_of_residence} editable={ed("country_of_residence")} onSaved={onSaved} />
        </div>
      </SectionCard>

      <SectionCard icon={GraduationCap} title="Education & Study Intent">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3.5">
          <Field label="Study Country" value={lead.intended_study_country} editable={ed("intended_study_country")} onSaved={onSaved} />
          <Field label="University" value={lead.university_name_raw} editable={ed("university_name_raw")} onSaved={onSaved} />
          <Field label="Course" value={lead.course_name} editable={ed("course_name")} onSaved={onSaved} />
          <Field label="Course Category" value={lead.course_category} editable={ed("course_category")} onSaved={onSaved} />
          <Field label="Intake Term" value={lead.intake_term} editable={ed("intake_term")} onSaved={onSaved} />
          <Field
            label="Intake Year"
            value={lead.intake_year ? String(lead.intake_year) : null}
            editable={ed("intake_year", { inputType: "number", parseValue: numericParse })}
            onSaved={onSaved}
          />
          <Field
            label="Loan Amount"
            value={lead.loan_amount_required ? String(lead.loan_amount_required) : null}
            editable={ed("loan_amount_required", {
              inputType: "number",
              formatDisplay: (v) => formatINR(v),
              parseValue: numericParse,
            })}
            onSaved={onSaved}
          />
          <Field label="Highest Qualification" value={lead.highest_qualification} editable={ed("highest_qualification")} onSaved={onSaved} />
          <Field label="Highest Qualification Score" value={hqScore} editable={hqEditable} onSaved={onSaved} />
          <Field
            label="Work Experience (years)"
            value={tsStr("work_experience_years")}
            editable={edTS("work_experience_years")}
            onSaved={onSaved}
          />
          <Field label="10th Score" value={tsStr("tenth")} editable={edTS("tenth")} onSaved={onSaved} />
          <Field label="10th Total Marks" value={tsStr("tenth_total")} editable={edTS("tenth_total")} onSaved={onSaved} />
          <NormalizedField label="10th Normalized" score={tsStr("tenth")} total={tsStr("tenth_total")} />
          <Field label="12th Score" value={tsStr("twelfth")} editable={edTS("twelfth")} onSaved={onSaved} />
          <Field label="12th Total Marks" value={tsStr("twelfth_total")} editable={edTS("twelfth_total")} onSaved={onSaved} />
          <NormalizedField label="12th Normalized" score={tsStr("twelfth")} total={tsStr("twelfth_total")} />
          <Field label="Graduation Score" value={tsStr("graduation")} editable={edTS("graduation")} onSaved={onSaved} />
          <Field label="Graduation Total / CGPA Scale" value={tsStr("graduation_total")} editable={edTS("graduation_total")} onSaved={onSaved} />
          <NormalizedField label="Graduation Normalized" score={tsStr("graduation")} total={tsStr("graduation_total")} />
          <Field label="Highest Qual. Total / CGPA Scale" value={tsStr("highest_qualification_total")} editable={edTS("highest_qualification_total")} onSaved={onSaved} />
          <NormalizedField label="Highest Qual. Normalized" score={hqScore} total={tsStr("highest_qualification_total")} />
          <Field label="IELTS" value={tsStr("ielts")} editable={edTS("ielts")} onSaved={onSaved} />
          <Field label="TOEFL" value={tsStr("toefl")} editable={edTS("toefl")} onSaved={onSaved} />
          <Field label="PTE" value={tsStr("pte")} editable={edTS("pte")} onSaved={onSaved} />
          <Field label="Duolingo" value={tsStr("duolingo")} editable={edTS("duolingo")} onSaved={onSaved} />
          <Field label="GRE" value={tsStr("gre")} editable={edTS("gre")} onSaved={onSaved} />
          <Field label="GMAT" value={tsStr("gmat")} editable={edTS("gmat")} onSaved={onSaved} />
          <Field label="SAT" value={tsStr("sat")} editable={edTS("sat")} onSaved={onSaved} />
          <Field label="Other Test Scores" value={tsStr("raw_text")} editable={edTS("raw_text")} onSaved={onSaved} />
        </div>
      </SectionCard>

      <SectionCard icon={Wallet} title="Financial Snapshot">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3.5">
          <Field label="Co-Applicant" value={lead.coapplicant_name} editable={ed("coapplicant_name")} onSaved={onSaved} />
          <Field label="Relation" value={lead.coapplicant_relation} editable={ed("coapplicant_relation")} onSaved={onSaved} />
          <Field label="Co-Applicant Mobile" value={lead.coapplicant_mobile} editable={ed("coapplicant_mobile")} onSaved={onSaved} />
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
          <Field
            label="Co-Applicant Work Exp (years)"
            value={tsStr("coapplicant_work_experience_years")}
            editable={edTS("coapplicant_work_experience_years", { inputType: "number", parseValue: numericParse })}
            onSaved={onSaved}
          />
          <Field
            label="Co-Applicant Work Exp (months)"
            value={tsStr("coapplicant_work_experience_months")}
            editable={edTS("coapplicant_work_experience_months", { inputType: "number", parseValue: numericParse })}
            onSaved={onSaved}
          />
          <Field
            label="Co-Applicant Employment Type"
            value={lead.coapplicant_employment_type}
            editable={ed("coapplicant_employment_type")}
            onSaved={onSaved}
          />
          <Field
            label="Co-Applicant Income Source"
            value={lead.coapplicant_income_source}
            editable={ed("coapplicant_income_source")}
            onSaved={onSaved}
          />
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
          <Field label="Collateral Notes" value={lead.collateral_notes} editable={ed("collateral_notes")} onSaved={onSaved} />
        </div>
        {/* Legacy Data — Not Used in BRE.
            Historical CIBIL/EMI/Employer values are preserved read-only for audit
            visibility. The current BRE engine ignores these fields universally. */}
        {(tsStr("coapplicant_cibil") || lead.coapplicant_existing_emi != null || lead.coapplicant_employer) && (
          <div className="mt-4 rounded-md border border-dashed bg-muted/30 p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Legacy Data — Not Used in BRE
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              These fields are historical only and are not used in current BRE scoring or lender recommendation.
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3.5">
              <Field label="Co-Applicant CIBIL (legacy)" value={tsStr("coapplicant_cibil")} />
              <Field
                label="Co-Applicant Existing EMI (legacy)"
                value={lead.coapplicant_existing_emi != null ? formatINR(String(lead.coapplicant_existing_emi)) : null}
              />
              <Field label="Co-Applicant Employer / Occupation (legacy)" value={lead.coapplicant_employer} />
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard icon={FolderInput} title="Source & Creation Context">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3.5">
          <Field label="Source Type" value={lead.source_type} />
          <Field label="Source Subtype" value={lead.source_sub_type} />
          <Field label="Submitted By" value={submittedByName} readOnlyFallback="Not captured" />
          <Field label="Created At" value={new Date(lead.created_at).toLocaleString()} readOnlyFallback="—" />
          <Field label="Last Updated" value={new Date(lead.updated_at).toLocaleString()} readOnlyFallback="—" />
          <div className="min-w-0 space-y-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" /> Lead Authenticity
            </span>
            {(() => {
              const key = (lead.lead_authenticity ?? "unverified").toLowerCase();
              const meta = AUTHENTICITY_LABEL[key] ?? AUTHENTICITY_LABEL.unverified;
              return (
                <div className="mt-1 flex items-center gap-2">
                  <Badge variant={meta.tone}>{meta.label}</Badge>
                  {lead.fraud_flag ? (
                    <Badge variant="destructive">Legacy fraud_flag</Badge>
                  ) : null}
                </div>
              );
            })()}
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
