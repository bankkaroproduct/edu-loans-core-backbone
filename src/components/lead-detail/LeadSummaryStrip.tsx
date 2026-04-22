import { Card, CardContent } from "@/components/ui/card";
import type { Tables } from "@/integrations/supabase/types";
import { useRoleAccess } from "@/hooks/useRoleAccess";
import { InlineEditField } from "@/components/admin/InlineEditField";

type Lead = Tables<"student_leads">;

interface Props {
  lead: Lead;
}

function Item({
  label,
  value,
  leadId,
  field,
  isAdmin,
}: {
  label: string;
  value: string | null | undefined;
  leadId: string;
  field?: string;
  isAdmin: boolean;
}) {
  const hasValue = value !== null && value !== undefined && value !== "";
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground truncate">{label}</p>
      <p
        className={
          hasValue
            ? "text-sm font-medium truncate"
            : "text-sm italic text-muted-foreground/70 truncate"
        }
        title={hasValue ? String(value) : "Please provide details"}
      >
        {isAdmin && field ? (
          <InlineEditField leadId={leadId} field={field} label={label} value={value ?? null} />
        ) : hasValue ? (
          (value as string)
        ) : (
          "Please provide details"
        )}
      </p>
    </div>
  );
}

export function LeadSummaryStrip({ lead }: Props) {
  const { isAdmin } = useRoleAccess();
  return (
    <Card>
      <CardContent className="py-4 px-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
          <Item
            label="Study Destination"
            value={lead.intended_study_country}
            leadId={lead.id}
            field="intended_study_country"
            isAdmin={isAdmin}
          />
          <Item
            label="Intake"
            value={`${lead.intake_term} ${lead.intake_year}`}
            leadId={lead.id}
            isAdmin={isAdmin}
          />
          <Item
            label="University"
            value={lead.university_name_raw}
            leadId={lead.id}
            field="university_name_raw"
            isAdmin={isAdmin}
          />
          <Item
            label="Course"
            value={lead.course_name}
            leadId={lead.id}
            field="course_name"
            isAdmin={isAdmin}
          />
          <Item
            label="Loan Amount"
            value={lead.loan_amount_required ? `₹${Number(lead.loan_amount_required).toLocaleString()}` : null}
            leadId={lead.id}
            isAdmin={isAdmin}
          />
          <Item
            label="Co-Applicant"
            value={lead.coapplicant_name}
            leadId={lead.id}
            field="coapplicant_name"
            isAdmin={isAdmin}
          />
          <Item
            label="Collateral"
            value={lead.collateral_available === null ? null : lead.collateral_available ? "Yes" : "No"}
            leadId={lead.id}
            isAdmin={isAdmin}
          />
          <Item
            label="Source Subtype"
            value={lead.source_sub_type}
            leadId={lead.id}
            field="source_sub_type"
            isAdmin={isAdmin}
          />
        </div>
      </CardContent>
    </Card>
  );
}
