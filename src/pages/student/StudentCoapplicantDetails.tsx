import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { StudentStepLayout } from "@/components/student/StudentStepLayout";
import { useStudentAuth } from "@/hooks/useStudentAuth";
import { useStudentApplication } from "@/hooks/useStudentApplication";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Info, HeartHandshake } from "lucide-react";

const RELATIONSHIPS = ["Father", "Mother", "Spouse", "Sibling", "Uncle", "Aunt", "Grandparent", "Other"];
const EMPLOYMENT_TYPES = ["Salaried", "Self-employed", "Business Owner", "Professional", "Retired", "Homemaker", "Other"];

export default function StudentCoapplicantDetails() {
  const navigate = useNavigate();
  const { isVerified } = useStudentAuth();
  const { formData, updateField, saveStep, saving } = useStudentApplication();

  useEffect(() => {
    if (!isVerified) { navigate("/student/login"); return; }
  }, [isVerified, navigate]);

  // Context strip
  const contextItems = [
    formData.intended_study_country && `🌍 ${formData.intended_study_country}`,
    formData.university_name_raw && `🎓 ${formData.university_name_raw}`,
    formData.course_name && `📚 ${formData.course_name}`,
  ].filter(Boolean);

  const handleContinue = async () => {
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
            </div>
            <div className="space-y-1.5">
              <Label>Mobile Number</Label>
              <Input value={formData.coapplicant_mobile} onChange={e => updateField("coapplicant_mobile", e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="10-digit mobile" />
            </div>
            <div className="space-y-1.5">
              <Label>Email Address</Label>
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
              <Input type="number" value={formData.coapplicant_income} onChange={e => updateField("coapplicant_income", e.target.value)} placeholder="e.g. 80000" />
            </div>
            <div className="space-y-1.5">
              <Label>Existing EMI (₹/month)</Label>
              <Input type="number" value={formData.coapplicant_existing_emi} onChange={e => updateField("coapplicant_existing_emi", e.target.value)} placeholder="e.g. 15000" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <div className="flex items-center justify-between">
                <Label>Collateral / Property Available</Label>
                <Switch
                  checked={formData.collateral_available === true}
                  onCheckedChange={v => updateField("collateral_available", v)}
                />
              </div>
              {formData.collateral_available && (
                <Textarea
                  value={formData.collateral_notes}
                  onChange={e => updateField("collateral_notes", e.target.value)}
                  placeholder="Brief description of collateral (property type, approximate value)"
                  rows={2}
                  className="mt-2"
                />
              )}
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
