import { Card, CardContent } from "@/components/ui/card";
import type { Tables } from "@/integrations/supabase/types";
import { useRoleAccess } from "@/hooks/useRoleAccess";
import { InlineEditField } from "@/components/admin/InlineEditField";

type Lead = Tables<"student_leads">;

interface Props {
  lead: Lead;
}

/**
 * Read-only / non-admin cell. For admin we always render InlineEditField (which
 * itself shows a clickable "Please provide details" nudge when value is missing).
 */
function ReadOnlyCell({ label, value }: { label: string; value: string | null | undefined }) {
  const hasValue = value !== null && value !== undefined && value !== "";
  return (
    <p
      className={
        hasValue
          ? "text-sm font-medium truncate"
          : "text-sm italic text-muted-foreground/70 truncate"
      }
      title={hasValue ? String(value) : "Please provide details"}
    >
      {hasValue ? (value as string) : "Please provide details"}
    </p>
  );
}

function Cell({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground truncate">{label}</p>
      <div className="text-sm font-medium min-w-0">{children}</div>
    </div>
  );
}

export function LeadSummaryStrip({ lead }: Props) {
  const { isAdmin } = useRoleAccess();

  // Helper: render value or InlineEditField for admins.
  const editable = (
    field: string,
    value: string | null | undefined,
    label: string,
    extra?: { inputType?: string; formatDisplay?: (v: string) => string },
  ) =>
    isAdmin ? (
      <InlineEditField
        leadId={lead.id}
        field={field}
        label={label}
        value={value ?? null}
        allowEditExisting
        inputType={extra?.inputType}
        formatDisplay={extra?.formatDisplay}
      />
    ) : (
      <ReadOnlyCell label={label} value={value} />
    );

  // Composite cells (Intake / Collateral) — for admin we render two inline edits or a toggle.
  return (
    <Card>
      <CardContent className="py-4 px-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
          <Cell label="Study Destination">
            {editable("intended_study_country", lead.intended_study_country, "Study Destination")}
          </Cell>

          <Cell label="Intake">
            {isAdmin ? (
              <span className="inline-flex items-center gap-1">
                <InlineEditField
                  leadId={lead.id}
                  field="intake_term"
                  label="Intake Term"
                  value={lead.intake_term ?? null}
                  allowEditExisting
                />
                <span className="text-muted-foreground">·</span>
                <InlineEditField
                  leadId={lead.id}
                  field="intake_year"
                  label="Intake Year"
                  value={lead.intake_year ? String(lead.intake_year) : null}
                  inputType="number"
                  allowEditExisting
                  parseValue={(raw) => {
                    const n = Number(raw);
                    return Number.isFinite(n) ? n : raw;
                  }}
                />
              </span>
            ) : (
              <ReadOnlyCell label="Intake" value={`${lead.intake_term ?? ""} ${lead.intake_year ?? ""}`.trim() || null} />
            )}
          </Cell>

          <Cell label="University">
            {editable("university_name_raw", lead.university_name_raw, "University")}
          </Cell>

          <Cell label="Course">
            {editable("course_name", lead.course_name, "Course")}
          </Cell>

          <Cell label="Loan Amount">
            {editable("loan_amount_required", lead.loan_amount_required ? String(lead.loan_amount_required) : null, "Loan Amount", {
              inputType: "number",
              formatDisplay: (v) => `₹${Number(v).toLocaleString()}`,
            })}
          </Cell>

          <Cell label="Co-Applicant">
            {editable("coapplicant_name", lead.coapplicant_name, "Co-Applicant")}
          </Cell>

          <Cell label="Collateral">
            {isAdmin ? (
              <InlineEditField
                leadId={lead.id}
                field="collateral_available"
                label="Collateral"
                value={
                  lead.collateral_available === null || lead.collateral_available === undefined
                    ? null
                    : lead.collateral_available
                    ? "true"
                    : "false"
                }
                allowEditExisting
                options={[
                  { value: "true", label: "Yes" },
                  { value: "false", label: "No" },
                ]}
                parseValue={(raw) => raw === "true"}
                formatDisplay={(v) => (v === "true" ? "Yes" : "No")}
              />
            ) : (
              <ReadOnlyCell
                label="Collateral"
                value={lead.collateral_available === null ? null : lead.collateral_available ? "Yes" : "No"}
              />
            )}
          </Cell>

          <Cell label="Source Subtype">
            {editable("source_sub_type", lead.source_sub_type, "Source Subtype")}
          </Cell>
        </div>
      </CardContent>
    </Card>
  );
}
