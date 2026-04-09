import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StudentStepLayout } from "@/components/student/StudentStepLayout";
import { useStudentAuth } from "@/hooks/useStudentAuth";
import { useStudentApplication } from "@/hooks/useStudentApplication";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { Pencil, CheckCircle2, Sparkles, Shield, Info } from "lucide-react";

interface SummaryItem {
  label: string;
  value: string | null | undefined;
}

function SummaryBlock({ title, items, editPath }: { title: string; items: SummaryItem[]; editPath: string }) {
  const navigate = useNavigate();
  return (
    <Card>
      <CardContent className="p-5 sm:p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
          <Button variant="ghost" size="sm" onClick={() => navigate(editPath)} className="gap-1.5 text-xs text-primary">
            <Pencil className="h-3 w-3" /> Edit
          </Button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {items.map(item => (
            <div key={item.label}>
              <span className="text-[11px] text-muted-foreground">{item.label}</span>
              <p className="text-sm font-medium text-foreground">{item.value || <span className="text-muted-foreground/60">—</span>}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function StudentReviewSubmit() {
  const navigate = useNavigate();
  const { isVerified } = useStudentAuth();
  const { formData, saveStep, saving } = useStudentApplication();
  const [declared, setDeclared] = useState(false);

  useEffect(() => {
    if (!isVerified) { navigate("/student/login"); return; }
  }, [isVerified, navigate]);

  const handleSubmit = async () => {
    if (!declared) {
      toast({ title: "Please confirm the declaration", variant: "destructive" }); return;
    }
    const result = await saveStep("submit");
    if (result) {
      toast({ title: "Application submitted!", description: "We'll start matching you with suitable lenders." });
      navigate("/student/continue");
    }
  };

  if (!isVerified) return null;

  const testScores = formData.test_scores;
  const scoreDisplay = [
    testScores.ielts && `IELTS: ${testScores.ielts}`,
    testScores.toefl && `TOEFL: ${testScores.toefl}`,
    testScores.duolingo && `Duolingo: ${testScores.duolingo}`,
    testScores.gre && `GRE: ${testScores.gre}`,
    testScores.gmat && `GMAT: ${testScores.gmat}`,
  ].filter(Boolean).join(" · ") || null;

  return (
    <StudentStepLayout
      currentStep={3}
      title="Review & Submit"
      subtitle="Please review your information carefully before submitting"
      onBack={() => navigate("/student/apply/coapplicant")}
      saving={saving}
      hideContinue
    >
      {/* Basic Details */}
      <SummaryBlock
        title="Basic Details"
        editPath="/student/apply/basic"
        items={[
          { label: "Full Name", value: formData.student_full_name },
          { label: "Email", value: formData.student_email },
          { label: "Date of Birth", value: formData.student_dob },
          { label: "Gender", value: formData.student_gender },
          { label: "City", value: formData.city },
          { label: "State", value: formData.state },
          { label: "Pincode", value: formData.pincode },
          { label: "Destination Country", value: formData.intended_study_country },
          { label: "Course Category", value: formData.course_category },
          { label: "Loan Amount", value: formData.loan_amount_required ? `₹${Number(formData.loan_amount_required).toLocaleString("en-IN")}` : null },
        ]}
      />

      {/* Education Details */}
      <SummaryBlock
        title="Education & Academic Details"
        editPath="/student/apply/education"
        items={[
          { label: "Highest Qualification", value: formData.highest_qualification },
          { label: "Marks / GPA", value: formData.marks_gpa },
          { label: "Course", value: formData.course_name },
          { label: "University", value: formData.university_name_raw },
          { label: "Intake", value: formData.intake_term && formData.intake_year ? `${formData.intake_term} ${formData.intake_year}` : null },
          { label: "Test Scores", value: scoreDisplay },
        ]}
      />

      {/* Co-applicant Details */}
      <SummaryBlock
        title="Co-applicant Details"
        editPath="/student/apply/coapplicant"
        items={[
          { label: "Name", value: formData.coapplicant_name },
          { label: "Relationship", value: formData.coapplicant_relation },
          { label: "Mobile", value: formData.coapplicant_mobile },
          { label: "Email", value: formData.coapplicant_email },
          { label: "Employment", value: formData.coapplicant_employment_type },
          { label: "Employer", value: formData.coapplicant_employer },
          { label: "Monthly Income", value: formData.coapplicant_income ? `₹${Number(formData.coapplicant_income).toLocaleString("en-IN")}` : null },
          { label: "Existing EMI", value: formData.coapplicant_existing_emi ? `₹${Number(formData.coapplicant_existing_emi).toLocaleString("en-IN")}/mo` : null },
          { label: "Collateral", value: formData.collateral_available ? `Yes — ${formData.collateral_notes || "Details not specified"}` : formData.collateral_available === false ? "No" : null },
        ]}
      />

      {/* Declaration */}
      <Card className="border-primary/20">
        <CardContent className="p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <Checkbox
              id="declaration"
              checked={declared}
              onCheckedChange={v => setDeclared(v === true)}
              className="mt-0.5"
            />
            <label htmlFor="declaration" className="cursor-pointer text-sm leading-relaxed text-foreground">
              I confirm that the information provided above is true and accurate to the best of my knowledge. I understand that providing false information may affect my application processing.{" "}
              <a href="#" className="text-primary underline">Terms & Conditions</a> apply.
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Submission guidance */}
      <div className="flex items-start gap-2.5 rounded-lg border border-primary/10 bg-primary/[0.03] p-4">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div>
          <p className="text-xs font-medium text-foreground">What happens next?</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            After you submit, we'll review your profile and match you with the most suitable lenders. You can track your application status anytime from your dashboard.
          </p>
        </div>
      </div>

      {/* Submit CTA */}
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={() => navigate("/student/apply/coapplicant")} className="gap-1.5">
          Back to Edit
        </Button>
        <Button
          size="lg"
          onClick={handleSubmit}
          disabled={!declared || saving}
          className="gap-2 sm:min-w-[200px]"
        >
          {saving ? "Submitting…" : (
            <><CheckCircle2 className="h-4 w-4" /> Submit Application</>
          )}
        </Button>
      </div>
    </StudentStepLayout>
  );
}
