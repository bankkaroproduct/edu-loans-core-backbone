import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { StudentStepLayout } from "@/components/student/StudentStepLayout";
import { useStudentAuth } from "@/hooks/useStudentAuth";
import { useStudentApplication } from "@/hooks/useStudentApplication";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { Pencil, CheckCircle2, Sparkles, Shield, Info, Lock } from "lucide-react";
import { intakeSessionLabel } from "@/lib/intakeSession";
import { formatWorkExperience } from "@/lib/workExperience";
import { formatDisplayLabel } from "@/lib/formatDisplayLabel";
import { INRAmountStacked } from "@/components/shared/INRAmountStacked";
import { formatINR } from "@/lib/formatCurrency";
import { getEnabledLevels, getMirroredHighestQual } from "@/lib/academicLevelCascade";

interface SummaryItem {
  label: string;
  value: string | null | undefined;
  /** When provided, rendered in place of `value` (e.g. multi-line JSX). */
  node?: React.ReactNode;
  /**
   * When true, render "Not Applicable" instead of the "—" fallback. Used
   * for academic rows the cascade explicitly disables (e.g. Graduation
   * when Highest Qualification = 12th).
   */
  notApplicable?: boolean;
}

function SummaryBlock({ title, items, editPath, readOnly }: { title: string; items: SummaryItem[]; editPath: string; readOnly?: boolean }) {
  const navigate = useNavigate();
  return (
    <Card>
      <CardContent className="p-5 sm:p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
          {!readOnly && (
            <Button variant="ghost" size="sm" onClick={() => navigate(editPath)} className="gap-1.5 text-xs text-primary">
              <Pencil className="h-3 w-3" /> Edit
            </Button>
          )}
        </div>
        <div className="flex flex-col">
          {items.map(item => (
            <div key={item.label} className="flex items-start gap-2 py-2 border-b border-border/50 last:border-0">
              <span className="text-sm text-muted-foreground shrink-0">{item.label}:</span>
              <div className="text-sm font-medium text-foreground min-w-0">
                {item.notApplicable
                  ? <span className="text-muted-foreground">Not Applicable</span>
                  : (item.node ?? (item.value || <span className="text-muted-foreground/60">—</span>))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function StudentReviewSubmit() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isVerified, leads } = useStudentAuth();
  const { formData, saveStep, saving } = useStudentApplication();
  const [declared, setDeclared] = useState(false);

  const isReadOnly = searchParams.get("view") === "submitted" || 
    (leads[0]?.current_stage && leads[0].current_stage !== "draft");

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
      navigate("/student/tracker");
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
      title={isReadOnly ? "Submitted Application" : "Review & Submit"}
      subtitle={isReadOnly ? "Your application has been submitted. Here's what you provided." : "Please review your information carefully before submitting"}
      onBack={isReadOnly ? () => navigate("/student/tracker") : () => navigate("/student/apply/coapplicant")}
      saving={saving}
      hideContinue
    >
      {/* Read-only banner */}
      {isReadOnly && (
        <div className="flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50/50 px-4 py-3">
          <Lock className="h-4 w-4 shrink-0 text-emerald-600" />
          <p className="text-sm text-emerald-800">This application has been submitted and is being processed. You can view but not edit the details below.</p>
        </div>
      )}

      {/* Basic Details */}
      <SummaryBlock
        title="Basic Details"
        editPath="/student/apply/basic"
        readOnly={isReadOnly}
        items={[
          { label: "Full Name", value: formData.student_full_name },
          { label: "Email", value: formData.student_email },
          { label: "Date of Birth", value: formData.student_dob },
          { label: "Gender", value: formData.student_gender ? formatDisplayLabel(formData.student_gender) : null },
          { label: "City", value: formData.city || (formData as any).district || null },
          { label: "State", value: formData.state },
          { label: "Pincode", value: formData.pincode },
          { label: "Destination Country", value: formData.intended_study_country },
          { label: "Course Category", value: formData.course_category ? formatDisplayLabel(formData.course_category) : null },
          {
            label: "Loan Amount",
            value: formData.loan_amount_required ? String(formData.loan_amount_required) : null,
            node: formData.loan_amount_required
              ? <INRAmountStacked value={formData.loan_amount_required} />
              : undefined,
          },
        ]}
      />

      {/* Education Details */}
      <SummaryBlock
        title="Education & Academic Details"
        editPath="/student/apply/education"
        readOnly={isReadOnly}
        items={[
          { label: "Highest Qualification", value: formData.highest_qualification ? formatDisplayLabel(formData.highest_qualification) : null },
          { label: "Highest Qualification Score", value: (() => {
            // Cascade-aware display. When HQ pair is disabled per
            // src/lib/academicLevelCascade.ts, mirror the source level's
            // score (12th for "12th / High School", Graduation for
            // Diploma/Bachelor's). Otherwise use the user's entered value.
            const hq = formData.highest_qualification || "";
            const ts = formData.test_scores;
            const enabled = getEnabledLevels(hq);
            if (enabled.highest_qualification) {
              return ts.highest_qualification_score || formData.marks_gpa || "";
            }
            const mirrored = getMirroredHighestQual(hq, {
              tenth: ts.tenth || "", tenth_total: ts.tenth_total || "",
              twelfth: ts.twelfth || "", twelfth_total: ts.twelfth_total || "",
              graduation: ts.graduation || "", graduation_total: ts.graduation_total || "",
            });
            return mirrored.score || "";
          })() },
          { label: "Course", value: formData.course_name },
          { label: "University", value: formData.university_name_raw },
          { label: "Intake", value: formData.intake_term && formData.intake_year ? intakeSessionLabel(formData.intake_term, Number(formData.intake_year)) : null },
          { label: "Work Experience", value: formatWorkExperience(formData.test_scores.work_experience_years) },
          { label: "Test Scores", value: scoreDisplay },
        ]}
      />

      {/* Co-applicant Details */}
      <SummaryBlock
        title="Co-applicant Details"
        editPath="/student/apply/coapplicant"
        readOnly={isReadOnly}
        items={[
          { label: "Name", value: formData.coapplicant_name },
          { label: "Age", value: formData.test_scores.coapplicant_age ? String(formData.test_scores.coapplicant_age) : null },
          { label: "Relation", value: formData.coapplicant_relation ? formatDisplayLabel(formData.coapplicant_relation) : null },
          { label: "Mobile", value: formData.coapplicant_mobile },
          { label: "Email", value: formData.coapplicant_email },
          { label: "Employment Type", value: formData.coapplicant_employment_type ? formatDisplayLabel(formData.coapplicant_employment_type) : null },
          { label: "Monthly Income", value: formData.coapplicant_income ? `₹${Number(formData.coapplicant_income).toLocaleString("en-IN")}` : null },
          { label: "Collateral", value: formData.collateral_available ? `Yes — ${formData.collateral_notes || "Details not specified"}` : formData.collateral_available === false ? "No" : null },
        ]}
      />

      {/* Declaration + Submit — only for non-submitted */}
      {!isReadOnly && (
        <>
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

          <div className="flex items-start gap-2.5 rounded-lg border border-primary/10 bg-primary/[0.03] p-4">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div>
              <p className="text-xs font-medium text-foreground">What happens next?</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                After you submit, we'll review your profile and match you with the most suitable lenders. You can track your application status anytime from your dashboard.
              </p>
            </div>
          </div>

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
        </>
      )}

      {/* Read-only: back to tracker CTA */}
      {isReadOnly && (
        <div className="flex justify-center">
          <Button onClick={() => navigate("/student/tracker")} className="gap-2">
            ← Back to Tracker
          </Button>
        </div>
      )}
    </StudentStepLayout>
  );
}
