// Admin-only summary strip. Premium info-tile row for the key facts.
// Reuses InlineEditField verbatim — no save/edit logic is duplicated or changed.
import { useRoleAccess } from "@/hooks/useRoleAccess";
import { InlineEditField } from "@/components/admin/InlineEditField";
import { formatINR } from "@/lib/formatCurrency";
import type { Tables } from "@/integrations/supabase/types";

type Lead = Tables<"student_leads">;

function ReadOnlyValue({
  value,
  emphasis = false,
}: {
  value: string | null | undefined;
  emphasis?: boolean;
}) {
  const hasValue = value !== null && value !== undefined && value !== "";
  return (
    <p
      className={
        hasValue
          ? `${emphasis ? "text-base font-semibold tabular-nums text-primary" : "text-sm font-semibold text-foreground"} truncate`
          : "text-sm italic text-muted-foreground/70 truncate"
      }
      title={hasValue ? String(value) : "Please provide details"}
    >
      {hasValue ? (value as string) : "Please provide details"}
    </p>
  );
}

function Tile({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="min-w-0 rounded-lg border border-border/60 bg-card px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
      title={label}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground truncate">
        {label}
      </p>
      <div className="min-w-0 mt-1.5">{children}</div>
    </div>
  );
}

interface Props {
  lead: Lead;
}

export function AdminLeadSummaryStrip({ lead }: Props) {
  const { isAdmin } = useRoleAccess();

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
      <ReadOnlyValue value={value} />
    );

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 2xl:grid-cols-8 gap-3">
      <Tile label="Study Destination">
        {editable("intended_study_country", lead.intended_study_country, "Study Destination")}
      </Tile>

      <Tile label="Intake">
        {isAdmin ? (
          <span className="inline-flex items-center gap-1 text-sm font-semibold">
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
          <ReadOnlyValue value={`${lead.intake_term ?? ""} ${lead.intake_year ?? ""}`.trim() || null} />
        )}
      </Tile>

      <Tile label="University">
        {editable("university_name_raw", lead.university_name_raw, "University")}
      </Tile>

      <Tile label="Course">{editable("course_name", lead.course_name, "Course")}</Tile>

      <Tile label="Loan Amount">
        {isAdmin ? (
          <span className="text-base font-semibold tabular-nums text-primary">
            <InlineEditField
              leadId={lead.id}
              field="loan_amount_required"
              label="Loan Amount"
              value={lead.loan_amount_required ? String(lead.loan_amount_required) : null}
              allowEditExisting
              inputType="number"
              formatDisplay={(v) => formatINR(v)}
            />
          </span>
        ) : (
          <ReadOnlyValue
            value={lead.loan_amount_required ? formatINR(String(lead.loan_amount_required)) : null}
            emphasis
          />
        )}
      </Tile>

      <Tile label="Co-Applicant">
        {editable("coapplicant_name", lead.coapplicant_name, "Co-Applicant")}
      </Tile>

      <Tile label="Collateral">
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
          <ReadOnlyValue
            value={lead.collateral_available === null ? null : lead.collateral_available ? "Yes" : "No"}
          />
        )}
      </Tile>

      <Tile label="Source">{editable("source_sub_type", lead.source_sub_type, "Source Subtype")}</Tile>
    </div>
  );
}
