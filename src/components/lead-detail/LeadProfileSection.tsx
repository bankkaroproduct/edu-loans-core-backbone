import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, GraduationCap, Wallet, FolderInput, ShieldCheck } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

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

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  const hasValue = value !== null && value !== undefined && value !== "";
  return (
    <div className="min-w-0">
      <span className="text-muted-foreground text-xs">{label}</span>
      <p
        className={
          hasValue
            ? "text-sm font-medium break-words"
            : "text-sm italic text-muted-foreground/70"
        }
      >
        {hasValue ? value : "Please provide details"}
      </p>
    </div>
  );
}

interface Props {
  lead: Lead;
  submittedByName: string | null;
}

export function LeadProfileSection({ lead, submittedByName }: Props) {
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
            <Field label="First Name" value={lead.student_first_name} />
            <Field label="Last Name" value={lead.student_last_name} />
            <Field label="Full Name" value={lead.student_full_name} />
            <Field label="Mobile" value={lead.student_phone} />
            <Field label="Email" value={lead.student_email} />
            <Field label="WhatsApp" value={lead.student_whatsapp} />
            <Field label="City" value={lead.city} />
            <Field label="State" value={lead.state} />
            <Field label="Country" value={lead.country_of_residence} />
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
            <Field label="Study Country" value={lead.intended_study_country} />
            <Field label="University" value={lead.university_name_raw} />
            <Field label="Course" value={lead.course_name} />
            <Field label="Course Category" value={lead.course_category} />
            <Field label="Intake Term" value={lead.intake_term} />
            <Field label="Intake Year" value={String(lead.intake_year)} />
            <Field label="Loan Amount" value={lead.loan_amount_required ? `₹${Number(lead.loan_amount_required).toLocaleString()}` : null} />
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
            <Field label="Co-Applicant" value={lead.coapplicant_name} />
            <Field label="Relation" value={lead.coapplicant_relation} />
            <Field label="Co-Applicant Income" value={lead.coapplicant_income ? `₹${Number(lead.coapplicant_income).toLocaleString()}` : null} />
            <Field label="Collateral" value={lead.collateral_available === null ? null : lead.collateral_available ? "Yes" : "No"} />
            <Field label="Collateral Notes" value={lead.collateral_notes} />
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
            <Field label="Source Type" value={lead.source_type} />
            <Field label="Source Subtype" value={lead.source_sub_type} />
            <Field label="Submitted By" value={submittedByName} />
            <Field label="Created At" value={new Date(lead.created_at).toLocaleString()} />
            <Field label="Last Updated" value={new Date(lead.updated_at).toLocaleString()} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
