import { useEffect } from "react";
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

const RELATIONSHIPS = ["Father", "Mother", "Spouse", "Sibling", "Uncle", "Aunt", "Grandparent", "Other"];
const EMPLOYMENT_TYPES = ["Salaried", "Self-employed", "Business Owner", "Professional", "Retired", "Homemaker", "Other"];

export default function StudentCoapplicantDetails() {
  const navigate = useNavigate();
  const { isVerified } = useStudentAuth();
  const { formData, updateField, updateTestScore, saveStep, saving } = useStudentApplication();

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
    if (!formData.coapplicant_name?.trim()) return "Co-applicant full name is required";
    if (!formData.coapplicant_relation?.trim()) return "Co-applicant relationship is required";
    const income = parseFloat(formData.coapplicant_income);
    if (!formData.coapplicant_income || isNaN(income) || income <= 0) {
      return "Co-applicant monthly income is required and must be a positive number";
    }
    if (formData.coapplicant_mobile && formData.coapplicant_mobile.length !== 10) {
      return "Co-applicant mobile must be a 10-digit number";
    }
    if (formData.coapplicant_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.coapplicant_email)) {
      return "Co-applicant email format is invalid";
    }
    // Collateral notes are OPTIONAL even when state === "likely". No hard validation here.
    return null;
  };

  const handleContinue = async () => {
    const err = validateCoapplicant();
    if (err) { toast({ title: "Please complete required fields", description: err, variant: "destructive" }); return; }
    const result = await saveStep("save_coapplicant");
    if (result) {
      toast({ title: "Co-applicant details saved" });
      navigate("/student/apply/review");
    }
  };

  const handleSaveExit = async () => {
    await saveStep("save_coapplicant");
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
            <div className="space-y-1.5">
              <Label>Relationship to Student</Label>
              <Select value={formData.coapplicant_relation} onValueChange={v => updateField("coapplicant_relation", v)}>
                <SelectTrigger><SelectValue placeholder="Select relationship" /></SelectTrigger>
                <SelectContent>{RELATIONSHIPS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Full Name</Label>
              <Input value={formData.coapplicant_name} onChange={e => updateField("coapplicant_name", e.target.value)} placeholder="Co-applicant's full name" />
              <p className="text-xs text-muted-foreground">Name as per Aadhaar Card / Passport</p>
            </div>
            <div className="space-y-1.5">
              <Label>Mobile Number</Label>
              <Input value={formData.coapplicant_mobile} onChange={e => updateField("coapplicant_mobile", e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="10-digit mobile" />
            </div>
            <div className="space-y-1.5">
              <Label>Email Address</Label>
              <Input type="email" value={formData.coapplicant_email} onChange={e => updateField("coapplicant_email", e.target.value)} placeholder="email@example.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Co-applicant Age</Label>
              <Input
                inputMode="numeric"
                value={formData.test_scores.coapplicant_age || ""}
                onChange={e => updateTestScore("coapplicant_age", e.target.value.replace(/\D/g, "").slice(0, 3))}
                placeholder="e.g. 48"
              />
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
            <div className="space-y-1.5">
              <Label>Employment Type</Label>
              <Select value={formData.coapplicant_employment_type} onValueChange={v => updateField("coapplicant_employment_type", v)}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>{EMPLOYMENT_TYPES.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Employer / Occupation</Label>
              <Input value={formData.coapplicant_employer} onChange={e => updateField("coapplicant_employer", e.target.value)} placeholder="e.g. Tata Consultancy Services" />
            </div>
            <div className="space-y-1.5">
              <Label>Monthly Income (₹)</Label>
              <MoneyInput
                value={formData.coapplicant_income}
                onChange={d => updateField("coapplicant_income", d)}
                placeholder="e.g. 80,000"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Existing EMI (₹/month)</Label>
              <MoneyInput
                value={formData.coapplicant_existing_emi}
                onChange={d => updateField("coapplicant_existing_emi", d)}
                placeholder="e.g. 15,000"
              />
            </div>
            <div className="space-y-1.5">
              <Label>CIBIL Score</Label>
              <Input
                inputMode="numeric"
                value={formData.test_scores.coapplicant_cibil || ""}
                onChange={e => updateTestScore("coapplicant_cibil", e.target.value.replace(/\D/g, "").slice(0, 3))}
                placeholder="e.g. 750"
              />
              <p className="text-xs text-muted-foreground">Range 300–900. Optional but improves lender match accuracy.</p>
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
