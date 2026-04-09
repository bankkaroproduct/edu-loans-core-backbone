import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { StudentStepLayout } from "@/components/student/StudentStepLayout";
import { useStudentAuth } from "@/hooks/useStudentAuth";
import { useStudentApplication } from "@/hooks/useStudentApplication";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Shield, CheckCircle2, FileText, CreditCard, IdCard, BookOpen, ScrollText } from "lucide-react";

const GENDERS = ["Male", "Female", "Non-binary", "Prefer not to say"];

const INITIAL_DOCS = [
  { key: "passport", label: "Passport Copy", icon: IdCard },
  { key: "pan", label: "PAN Card", icon: CreditCard },
  { key: "aadhaar", label: "Aadhaar Card", icon: IdCard },
  { key: "offer", label: "Offer Letter", icon: FileText },
  { key: "transcripts", label: "Academic Transcripts", icon: ScrollText },
];

export default function StudentBasicDetails() {
  const navigate = useNavigate();
  const { isVerified, phone, eligibilityData } = useStudentAuth();
  const { formData, updateField, saveStep, saving, loading } = useStudentApplication();
  const [countries, setCountries] = useState<{ id: string; country_name: string }[]>([]);

  useEffect(() => {
    if (!isVerified) { navigate("/student/login"); return; }
  }, [isVerified, navigate]);

  useEffect(() => {
    supabase.from("countries_master").select("id, country_name").eq("active_flag", true).order("country_name").then(({ data }) => {
      if (data) setCountries(data);
    });
  }, []);

  // Prefill from eligibility data if form is empty
  useEffect(() => {
    if (eligibilityData && !formData.student_full_name) {
      if (eligibilityData.fullName) updateField("student_full_name", eligibilityData.fullName);
      if (eligibilityData.targetCountry) updateField("intended_study_country", eligibilityData.targetCountry);
      if (eligibilityData.loanAmount) updateField("loan_amount_required", eligibilityData.loanAmount);
    }
  }, [eligibilityData]);

  const handleContinue = async () => {
    if (!formData.student_full_name.trim()) {
      toast({ title: "Name is required", variant: "destructive" }); return;
    }
    if (!formData.student_email.trim()) {
      toast({ title: "Email is required", variant: "destructive" }); return;
    }
    if (!formData.intended_study_country) {
      toast({ title: "Please select a destination country", variant: "destructive" }); return;
    }
    const result = await saveStep("save_basic");
    if (result) {
      toast({ title: "Basic details saved" });
      navigate("/student/apply/education");
    }
  };

  const handleSaveExit = async () => {
    await saveStep("save_basic");
    toast({ title: "Progress saved" });
    navigate("/student/continue");
  };

  if (!isVerified) return null;

  return (
    <StudentStepLayout
      currentStep={0}
      title="Step 1: Basic Details"
      subtitle="Let's start with your personal and residence information"
      onBack={() => navigate("/student/continue")}
      onContinue={handleContinue}
      onSaveExit={handleSaveExit}
      saving={saving}
    >
      {/* Section 1: Identity */}
      <Card>
        <CardContent className="p-5 sm:p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Identity Details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Full Name <span className="text-destructive">*</span></Label>
              <Input value={formData.student_full_name} onChange={e => updateField("student_full_name", e.target.value)} placeholder="Enter your full name" />
            </div>
            <div className="space-y-1.5">
              <Label>Mobile Number</Label>
              <div className="flex">
                <span className="flex items-center rounded-l-md border border-r-0 bg-muted px-3 text-sm text-muted-foreground">+91</span>
                <Input value={phone?.slice(-10) || ""} disabled className="rounded-l-none bg-muted" />
              </div>
              <p className="text-[11px] text-muted-foreground">Verified via OTP — cannot be changed here</p>
            </div>
            <div className="space-y-1.5">
              <Label>Email Address <span className="text-destructive">*</span></Label>
              <Input type="email" value={formData.student_email} onChange={e => updateField("student_email", e.target.value)} placeholder="you@example.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Date of Birth</Label>
              <Input type="date" value={formData.student_dob} onChange={e => updateField("student_dob", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Gender</Label>
              <Select value={formData.student_gender} onValueChange={v => updateField("student_gender", v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{GENDERS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Residence & Destination */}
      <Card>
        <CardContent className="p-5 sm:p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Current Residence & Destination</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>City</Label>
              <Input value={formData.city} onChange={e => updateField("city", e.target.value)} placeholder="e.g. Mumbai" />
            </div>
            <div className="space-y-1.5">
              <Label>State</Label>
              <Input value={formData.state} onChange={e => updateField("state", e.target.value)} placeholder="e.g. Maharashtra" />
            </div>
            <div className="space-y-1.5">
              <Label>Pincode</Label>
              <Input value={formData.pincode} onChange={e => updateField("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6-digit pincode" />
              <p className="text-[11px] text-muted-foreground">Your pincode helps determine lender serviceability in your area</p>
            </div>
            <div className="space-y-1.5">
              <Label>Destination Country <span className="text-destructive">*</span></Label>
              <Select value={formData.intended_study_country} onValueChange={v => updateField("intended_study_country", v)}>
                <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
                <SelectContent>{countries.map(c => <SelectItem key={c.id} value={c.country_name}>{c.country_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Preferred Course Category</Label>
              <Select value={formData.course_category} onValueChange={v => updateField("course_category", v)}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {["STEM", "MBA / Management", "Arts & Humanities", "Medical", "Law", "Other"].map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Loan Amount Required (₹)</Label>
              <Input type="number" value={formData.loan_amount_required} onChange={e => updateField("loan_amount_required", e.target.value)} placeholder="e.g. 2000000" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 3: Initial Documents Awareness */}
      <Card>
        <CardContent className="p-5 sm:p-6">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Documents You'll Need</h2>
          <p className="mb-4 text-xs text-muted-foreground">You don't need to upload them now — this is just so you know what to keep handy.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {INITIAL_DOCS.map(doc => (
              <div key={doc.key} className="flex items-center gap-3 rounded-lg border p-3">
                <doc.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="text-sm text-foreground">{doc.label}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            <BookOpen className="mr-1 inline h-3 w-3" />
            Full document upload will be available after you complete your application.
          </p>
        </CardContent>
      </Card>

      {/* Reassurance */}
      <div className="flex items-start gap-2.5 rounded-lg border border-primary/10 bg-primary/[0.03] p-4">
        <Shield className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p className="text-xs leading-relaxed text-muted-foreground">
          Your information is securely stored. In the next step, we'll collect your academic and education details to help match you with the right lenders.
        </p>
      </div>
    </StudentStepLayout>
  );
}
