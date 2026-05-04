import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StudentStepLayout } from "@/components/student/StudentStepLayout";
import { useStudentAuth } from "@/hooks/useStudentAuth";
import { useStudentApplication } from "@/hooks/useStudentApplication";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { HeartHandshake } from "lucide-react";
import { CollateralRadio, collateralBoolToState, collateralStateToBool } from "@/components/shared/CollateralRadio";
import { MoneyInput } from "@/components/ui/money-input";
import { parseCoappWorkExpShorthand, validateCoappWorkExpShorthand, previewCoappWorkExpShorthand, buildCoappWorkExpShorthand } from "@/lib/academicScore";

const RELATIONSHIPS = ["Father", "Mother", "Spouse", "Sibling", "Uncle", "Aunt", "Grandparent", "Other"];
const EMPLOYMENT_TYPES = ["Salaried", "Self-employed", "Business Owner", "Professional", "Retired", "Homemaker", "Other"];

export default function StudentCoapplicantDetails() {
  const navigate = useNavigate();
  const { isVerified } = useStudentAuth();
  const { formData, updateField, updateTestScore, saveStep, saving } = useStudentApplication();

  // Single-field shorthand for Co-applicant Work Experience ("years.months").
  // Hydrated once from stored years/months keys; parsed back on save.
  const [coWorkExp, setCoWorkExp] = useState<string>("");
  const [coWorkExpHydrated, setCoWorkExpHydrated] = useState(false);
  useEffect(() => {
    if (coWorkExpHydrated) return;
    const y = formData.test_scores.coapplicant_work_experience_years;
    const m = formData.test_scores.coapplicant_work_experience_months;
    if (y !== undefined || m !== undefined) {
      const built = buildCoappWorkExpShorthand(y, m);
      if (built) setCoWorkExp(built);
      setCoWorkExpHydrated(true);
    }
  }, [formData.test_scores.coapplicant_work_experience_years, formData.test_scores.coapplicant_work_experience_months, coWorkExpHydrated]);

  useEffect(() => {
    if (!isVerified) { navigate("/student/login"); return; }
  }, [isVerified, navigate]);

  // Context strip
  const contextItems = [
    formData.intended_study_country && `🌍 ${formData.intended_study_country}`,
    formData.university_name_raw && `🎓 ${formData.university_name_raw}`,
    formData.course_name && `📚 ${formData.course_name}`,
  ].filter(Boolean);

  const collateralState = collateralBoolToState(formData.collateral_available);

  const validateCoapplicant = (): string | null => {
    // 1. Name
    if (!formData.coapplicant_name?.trim()) return "Co-applicant Name is required";
    // 2. Age
    const ageStr = String(formData.test_scores.coapplicant_age ?? "").trim();
    if (!ageStr) return "Co-applicant Age is required";
    const age = parseInt(ageStr, 10);
    if (!Number.isFinite(age) || age < 18 || age > 100) return "Co-applicant Age must be between 18 and 100";
    // 3. Relation
    if (!formData.coapplicant_relation?.trim()) return "Co-applicant Relation is required";
    // 4. Mobile
    if (!formData.coapplicant_mobile?.trim()) return "Co-applicant Mobile is required";
    if (!/^\d{10}$/.test(formData.coapplicant_mobile.trim())) return "Co-applicant Mobile must be a 10-digit number";
    // 5. Email
    if (!formData.coapplicant_email?.trim()) return "Co-applicant Email is required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.coapplicant_email.trim())) return "Co-applicant Email format is invalid";
    // 6. Employment Type
    if (!formData.coapplicant_employment_type?.trim()) return "Employment Type is required";
    // 7. Employer / Occupation
    if (!formData.coapplicant_employer?.trim()) return "Employer / Occupation is required";
    // 8. Monthly Income
    const income = parseFloat(formData.coapplicant_income);
    if (!formData.coapplicant_income || isNaN(income) || income <= 0) return "Monthly Income is required and must be a positive number";
    // 9. Existing EMI
    if (formData.coapplicant_existing_emi === "" || formData.coapplicant_existing_emi == null) return "Existing EMI is required (enter 0 if none)";
    const emi = parseFloat(String(formData.coapplicant_existing_emi));
    if (isNaN(emi) || emi < 0) return "Existing EMI must be a non-negative number";
    // 10. CIBIL Score
    const cibilStr = String(formData.test_scores.coapplicant_cibil ?? "").trim();
    if (!cibilStr) return "CIBIL Score is required";
    const cibil = parseInt(cibilStr, 10);
    if (!Number.isFinite(cibil) || cibil < 300 || cibil > 900) return "CIBIL Score must be between 300 and 900";
    // Co-applicant work experience (optional but validated when present)
    const wErr = validateCoappWorkExpShorthand(coWorkExp);
    if (wErr) return `Co-applicant Work Experience: ${wErr}`;
    return null;
  };

  const handleContinue = async () => {
    const err = validateCoapplicant();
    if (err) { toast({ title: "Please complete required fields", description: err, variant: "destructive" }); return; }
    // Soft (non-blocking) warning when co-applicant work experience is blank.
    // Explicit "0" is allowed and must NOT trigger this warning.
    if (!coWorkExp.trim()) {
      const proceed = window.confirm(
        "Co-applicant work experience is missing. This may reduce Income Stability score in BRE. Continue?",
      );
      if (!proceed) return;
    }
    const result = await saveStep("save_coapplicant", { coapplicantWorkExperience: coWorkExp });
    if (result) {
      toast({ title: "Co-applicant details saved" });
      navigate("/student/apply/review");
    }
  };

  const handleSaveExit = async () => {
    await saveStep("save_coapplicant", { coapplicantWorkExperience: coWorkExp });
    toast({ title: "Progress saved" });
    navigate("/student/continue");
  };

  if (!isVerified) return null;

  return (
    <StudentStepLayout
      currentStep={2}
      title="Step 3: Co-applicant Details"
      subtitle="Provide details about your co-applicant and financial support"
      onBack={() => navigate("/student/apply/education")}
      onContinue={handleContinue}
      onSaveExit={handleSaveExit}
      saving={saving}
    >
      {/* Context strip */}
      {contextItems.length > 0 && (
        <div className="flex flex-wrap gap-2 rounded-lg border bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground">
          {contextItems.map((item, i) => (
            <span key={i} className="rounded-full bg-background px-2.5 py-1 font-medium">{item}</span>
          ))}
        </div>
      )}

      {/* Co-applicant Info */}
      <Card>
        <CardContent className="p-5 sm:p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Co-applicant Information</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {/* 1. Name */}
            <div className="space-y-1.5">
              <Label>Full Name *</Label>
              <Input value={formData.coapplicant_name} onChange={e => updateField("coapplicant_name", e.target.value)} placeholder="Co-applicant's full name" />
              <p className="text-xs text-muted-foreground">Name as per Aadhaar Card / Passport</p>
            </div>
            {/* 2. Age */}
            <div className="space-y-1.5">
              <Label>Co-applicant Age *</Label>
              <Input
                inputMode="numeric"
                value={formData.test_scores.coapplicant_age || ""}
                onChange={e => updateTestScore("coapplicant_age", e.target.value.replace(/\D/g, "").slice(0, 3))}
                placeholder="e.g. 48"
              />
            </div>
            {/* 3. Relation */}
            <div className="space-y-1.5">
              <Label>Relationship to Student *</Label>
              <Select value={formData.coapplicant_relation} onValueChange={v => updateField("coapplicant_relation", v)}>
                <SelectTrigger><SelectValue placeholder="Select relationship" /></SelectTrigger>
                <SelectContent>{RELATIONSHIPS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {/* 4. Mobile */}
            <div className="space-y-1.5">
              <Label>Mobile Number *</Label>
              <Input value={formData.coapplicant_mobile} onChange={e => updateField("coapplicant_mobile", e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="10-digit mobile" inputMode="numeric" />
            </div>
            {/* 5. Email */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Email Address *</Label>
              <Input type="email" value={formData.coapplicant_email} onChange={e => updateField("coapplicant_email", e.target.value)} placeholder="email@example.com" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Financial Profile */}
      <Card>
        <CardContent className="p-5 sm:p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Financial Profile</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Income Source field removed from UI per scoped form-fix pass.
                Existing `coapplicant_income_source` values in storage remain untouched. */}
            {/* 6. Employment Type */}
            <div className="space-y-1.5">
              <Label>Employment Type *</Label>
              <Select value={formData.coapplicant_employment_type} onValueChange={v => updateField("coapplicant_employment_type", v)}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>{EMPLOYMENT_TYPES.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {/* 7. Employer / Occupation */}
            <div className="space-y-1.5">
              <Label>Employer / Occupation *</Label>
              <Input value={formData.coapplicant_employer} onChange={e => updateField("coapplicant_employer", e.target.value)} placeholder="e.g. Tata Consultancy Services" />
            </div>
            {/* 8. Monthly Income */}
            <div className="space-y-1.5">
              <Label>Monthly Income (₹) *</Label>
              <MoneyInput
                value={formData.coapplicant_income}
                onChange={d => updateField("coapplicant_income", d)}
                placeholder="e.g. 80,000"
              />
            </div>
            {/* 9. Existing EMI */}
            <div className="space-y-1.5">
              <Label>Existing EMI (₹/month) *</Label>
              <MoneyInput
                value={formData.coapplicant_existing_emi}
                onChange={d => updateField("coapplicant_existing_emi", d)}
                placeholder="Enter 0 if none"
              />
            </div>
            {/* 10. CIBIL Score */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label>CIBIL Score *</Label>
              <Input
                inputMode="numeric"
                value={formData.test_scores.coapplicant_cibil || ""}
                onChange={e => updateTestScore("coapplicant_cibil", e.target.value.replace(/\D/g, "").slice(0, 3))}
                placeholder="e.g. 750"
              />
              <p className="text-xs text-muted-foreground">Range 300–900. Required to improve lender match accuracy.</p>
            </div>
            {/* 11. Co-applicant Work Experience — single shorthand input
                ("years.months", e.g. 3.6 = 3y 6m). Feeds BRE
                coapplicant.income_stability_years. */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-sm font-medium">Co-applicant Work Experience</Label>
              <p className="text-xs text-muted-foreground">
                The co-applicant's total work experience (not the student's).
              </p>
              <p className="text-xs text-muted-foreground">
                Example: enter <strong>3.6</strong> for 3 years 6 months. Used in BRE → Co-applicant Income Stability.
              </p>
              <Input
                inputMode="decimal"
                value={coWorkExp}
                onChange={(e) => {
                  const v = e.target.value.trim();
                  setCoWorkExp(v);
                  // Mirror immediately into stored keys so save/exit + review preview are accurate.
                  if (!v) {
                    updateTestScore("coapplicant_work_experience_years", "");
                    updateTestScore("coapplicant_work_experience_months", "");
                    return;
                  }
                  const parsed = parseCoappWorkExpShorthand(v);
                  if (parsed) {
                    updateTestScore("coapplicant_work_experience_years", String(parsed.years));
                    updateTestScore("coapplicant_work_experience_months", String(parsed.months));
                  }
                }}
                placeholder="e.g. 3.6"
              />
              {(() => {
                if (!coWorkExp) return null;
                const err = validateCoappWorkExpShorthand(coWorkExp);
                if (err) return <p className="text-xs font-medium text-destructive">{err}</p>;
                const preview = previewCoappWorkExpShorthand(coWorkExp);
                return preview ? <p className="text-xs text-muted-foreground">{preview}</p> : null;
              })()}
            </div>
            <div className="sm:col-span-2">
              <CollateralRadio
                state={collateralState}
                notes={formData.collateral_notes}
                onChangeState={(s) => updateField("collateral_available", collateralStateToBool(s))}
                onChangeNotes={(n) => updateField("collateral_notes", n)}
                idPrefix="student-coll"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Guidance */}
      <div className="flex items-start gap-2.5 rounded-lg border border-primary/10 bg-primary/[0.03] p-4">
        <HeartHandshake className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div>
          <p className="text-xs font-medium text-foreground">Why do we need this?</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            Co-applicant and financial details help lenders assess eligibility more accurately. Stronger financial profiles can unlock better loan options and faster approvals.
          </p>
        </div>
      </div>
    </StudentStepLayout>
  );
}
