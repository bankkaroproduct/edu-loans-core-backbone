import { Card } from "@/components/ui/card";
import { GraduationCap } from "lucide-react";
import type { LeadRow } from "@/lib/sendToLender/buildDraft";

const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex justify-between gap-3 py-1.5 text-sm border-b border-border/40 last:border-0">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-medium text-foreground text-right">{value ?? "—"}</span>
  </div>
);

export function CaseSummaryCard({ lead }: { lead: LeadRow }) {
  const studentName =
    lead.student_full_name ||
    [lead.student_first_name, lead.student_last_name].filter(Boolean).join(" ");

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <GraduationCap className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Application Summary</h3>
        <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">
          Auto-filled from lead
        </span>
      </div>

      <div className="grid gap-x-6 gap-y-0 md:grid-cols-2">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Applicant</p>
          <Row label="Name" value={studentName} />
          <Row label="Lead ID" value={<span className="font-mono">{lead.lead_id}</span>} />
          <Row label="Phone" value={lead.student_phone} />
          <Row label="Email" value={lead.student_email} />
          <Row label="Stage / Status" value={`${lead.current_stage} · ${lead.current_status}`} />
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1 mt-3 md:mt-0">
            Study Plan
          </p>
          <Row label="Country" value={lead.intended_study_country} />
          <Row label="University" value={lead.university_name_raw} />
          <Row label="Course" value={lead.course_name} />
          <Row label="Intake" value={`${lead.intake_term ?? ""} ${lead.intake_year ?? ""}`.trim()} />
          <Row
            label="Loan Required"
            value={
              lead.loan_amount_required != null
                ? `₹ ${Number(lead.loan_amount_required).toLocaleString("en-IN")}`
                : "—"
            }
          />
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1 mt-3">
            Co-applicant
          </p>
          <Row label="Name" value={lead.coapplicant_name} />
          <Row label="Relation" value={lead.coapplicant_relation} />
          <Row
            label="Income"
            value={
              lead.coapplicant_income != null
                ? `₹ ${Number(lead.coapplicant_income).toLocaleString("en-IN")}`
                : "—"
            }
          />
          <Row label="Employment" value={lead.coapplicant_employment_type} />
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1 mt-3">
            Academics & Collateral
          </p>
          <Row label="Highest Qualification" value={lead.highest_qualification} />
          <Row label="Marks / GPA" value={lead.marks_gpa} />
          <Row
            label="Collateral"
            value={
              lead.collateral_available
                ? `Yes${lead.collateral_notes ? ` — ${lead.collateral_notes}` : ""}`
                : "No"
            }
          />
        </div>
      </div>
    </Card>
  );
}
