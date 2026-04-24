import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, GraduationCap, Wallet, FolderInput, ShieldCheck } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { useRoleAccess } from "@/hooks/useRoleAccess";
import { InlineEditField } from "@/components/admin/InlineEditField";

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

function Field({
  label,
  value,
  editable,
  /** Neutral non-editable fallback for derived/metadata fields. Never shows action-like nudge text. */
  readOnlyFallback = "—",
}: {
  label: string;
  value: string | null | undefined;
  editable?: {
    leadId: string;
    field: string;
    inputType?: string;
    options?: { value: string; label: string }[];
    parseValue?: (raw: string) => unknown;
    formatDisplay?: (v: string) => string;
  };
  readOnlyFallback?: string;
}) {
  const hasValue = value !== null && value !== undefined && value !== "";
  return (
    <div className="min-w-0">
      <span className="text-muted-foreground text-xs">{label}</span>
      <p
        className={
          hasValue
            ? "text-sm font-medium break-words"
            : "text-sm text-muted-foreground/70"
        }
      >
        {editable ? (
          <InlineEditField
            leadId={editable.leadId}
            field={editable.field}
            label={label}
            value={value ?? null}
            inputType={editable.inputType}
            options={editable.options}
            parseValue={editable.parseValue}
            formatDisplay={editable.formatDisplay}
            allowEditExisting
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
}

export function LeadProfileSection({ lead, submittedByName }: Props) {
  const { isAdmin } = useRoleAccess();
  const ed = (
    field: string,
    extras?: {
      inputType?: string;
      options?: { value: string; label: string }[];
      parseValue?: (raw: string) => unknown;
      formatDisplay?: (v: string) => string;
    },
  ) => (isAdmin ? { leadId: lead.id, field, ...extras } : undefined);

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
            <Field label="First Name" value={lead.student_first_name} editable={ed("student_first_name")} />
            <Field label="Last Name" value={lead.student_last_name} editable={ed("student_last_name")} />
            <Field label="Full Name" value={lead.student_full_name} editable={ed("student_full_name")} />
            <Field label="Mobile" value={lead.student_phone} editable={ed("student_phone")} />
            <Field label="Email" value={lead.student_email} editable={ed("student_email", { inputType: "email" })} />
            <Field label="WhatsApp" value={lead.student_whatsapp} editable={ed("student_whatsapp")} />
            <Field label="Pincode" value={lead.pincode} editable={ed("pincode")} />
            <Field label="City" value={lead.city} editable={ed("city")} />
            <Field label="District" value={lead.district ?? null} editable={ed("district")} />
            <Field label="State" value={lead.state} editable={ed("state")} />
            <Field label="Tier" value={lead.tier ?? null} editable={ed("tier")} />
            <Field label="Country" value={lead.country_of_residence} editable={ed("country_of_residence")} />
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
            <Field label="Study Country" value={lead.intended_study_country} editable={ed("intended_study_country")} />
            <Field label="University" value={lead.university_name_raw} editable={ed("university_name_raw")} />
            <Field label="Course" value={lead.course_name} editable={ed("course_name")} />
            <Field label="Course Category" value={lead.course_category} editable={ed("course_category")} />
            <Field label="Intake Term" value={lead.intake_term} editable={ed("intake_term")} />
            <Field
              label="Intake Year"
              value={lead.intake_year ? String(lead.intake_year) : null}
              editable={ed("intake_year", {
                inputType: "number",
                parseValue: (raw) => {
                  const n = Number(raw);
                  return Number.isFinite(n) ? n : raw;
                },
              })}
            />
            <Field
              label="Loan Amount"
              value={lead.loan_amount_required ? String(lead.loan_amount_required) : null}
              editable={ed("loan_amount_required", {
                inputType: "number",
                formatDisplay: (v) => `₹${Number(v).toLocaleString()}`,
                parseValue: (raw) => {
                  const n = Number(raw);
                  return Number.isFinite(n) ? n : raw;
                },
              })}
            />
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
            <Field label="Co-Applicant" value={lead.coapplicant_name} editable={ed("coapplicant_name")} />
            <Field label="Relation" value={lead.coapplicant_relation} editable={ed("coapplicant_relation")} />
            <Field
              label="Co-Applicant Income"
              value={lead.coapplicant_income ? String(lead.coapplicant_income) : null}
              editable={ed("coapplicant_income", {
                inputType: "number",
                formatDisplay: (v) => `₹${Number(v).toLocaleString()}`,
                parseValue: (raw) => {
                  const n = Number(raw);
                  return Number.isFinite(n) ? n : raw;
                },
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
            <Field label="Collateral Notes" value={lead.collateral_notes} editable={ed("collateral_notes")} />
          </div>
        </CardContent>
      </Card>

      {/* Source / Creation Context */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FolderInput className="h-4 w-4 text-primary" /> Source & Creation Context
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Source Type" value={lead.source_type} editable={ed("source_type")} />
            <Field label="Source Subtype" value={lead.source_sub_type} editable={ed("source_sub_type")} />
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
