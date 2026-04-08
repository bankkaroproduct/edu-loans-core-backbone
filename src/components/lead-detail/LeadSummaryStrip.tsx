import { Card, CardContent } from "@/components/ui/card";
import type { Tables } from "@/integrations/supabase/types";

type Lead = Tables<"student_leads">;

interface Props {
  lead: Lead;
}

function Item({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground truncate">{label}</p>
      <p className="text-sm font-medium truncate">{value || "—"}</p>
    </div>
  );
}

export function LeadSummaryStrip({ lead }: Props) {
  return (
    <Card>
      <CardContent className="py-4 px-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
          <Item label="Study Destination" value={lead.intended_study_country} />
          <Item label="Intake" value={`${lead.intake_term} ${lead.intake_year}`} />
          <Item label="University" value={lead.university_name_raw} />
          <Item label="Course" value={lead.course_name} />
          <Item label="Loan Amount" value={lead.loan_amount_required ? `₹${Number(lead.loan_amount_required).toLocaleString()}` : null} />
          <Item label="Co-Applicant" value={lead.coapplicant_name} />
          <Item label="Collateral" value={lead.collateral_available === null ? null : lead.collateral_available ? "Yes" : "No"} />
          <Item label="Source Subtype" value={lead.source_sub_type} />
        </div>
      </CardContent>
    </Card>
  );
}
