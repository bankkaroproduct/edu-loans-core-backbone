import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { StudentStepLayout } from "@/components/student/StudentStepLayout";
import { useStudentAuth } from "@/hooks/useStudentAuth";
import { useStudentApplication } from "@/hooks/useStudentApplication";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MoneyInput } from "@/components/ui/money-input";
import { LakhsInput } from "@/components/ui/lakhs-input";
import { MasterCombobox, type MasterOption } from "@/components/ui/master-combobox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Shield, FileText, CreditCard, IdCard, BookOpen, ScrollText, Info } from "lucide-react";
import { usePincodeLookup } from "@/hooks/usePincodeLookup";
import { sortByPriority } from "@/lib/countryOrder";

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
  const { formData, updateField, saveStep, saving } = useStudentApplication();
  const [countries, setCountries] = useState<{ id: string; country_name: string }[]>([]);

  useEffect(() => {
    if (!isVerified) { navigate("/student/login"); return; }
  }, [isVerified, navigate]);

  useEffect(() => {
    supabase.from("countries_master").select("id, country_name").eq("active_flag", true).order("country_name").then(({ data }) => {
      if (data) setCountries(data);
    });
  }, []);

  // Prefill from eligibility data if form is empty.
  // eligibilityData.fullName is split: first token → first_name, remainder → last_name.
  // Only applied when BOTH target name fields are currently empty.
  useEffect(() => {
    if (eligibilityData && !formData.student_first_name && !formData.student_last_name) {
      if (eligibilityData.fullName) {
        const parts = eligibilityData.fullName.trim().split(/\s+/);
        const first = parts.shift() || "";
        const last = parts.join(" ");
        if (first) updateField("student_first_name", first);
        if (last) updateField("student_last_name", last);
      }
      if (eligibilityData.targetCountry) updateField("intended_study_country", eligibilityData.targetCountry);
      if (eligibilityData.loanAmount) updateField("loan_amount_required", eligibilityData.loanAmount);
    }
  }, [eligibilityData]);

  // Pincode auto-fill — student-portal side.
  // Apply BOTH city (district) and state when a valid pincode is found.
  // CRITICAL: If pincode changes to one that doesn't match (or becomes invalid), clear the
  // values we previously auto-filled so stale district/state never carry forward silently.
  const pincodeResult = usePincodeLookup(formData.pincode);
  const lastApplied = useRef<{ pincode: string; city: string | null; state: string | null; country: string | null } | null>(null);
  useEffect(() => {
    const current = (formData.pincode ?? "").trim();

    // Case 1: New valid match — apply if blank OR previously auto-filled
    if (
      pincodeResult.found &&
      pincodeResult.pincode === current &&
      current.length === 6 &&
      lastApplied.current?.pincode !== current
    ) {
      const previouslyAuto = lastApplied.current;
      const cityIsOurs = !!(previouslyAuto && formData.city === previouslyAuto.city);
      const stateIsOurs = !!(previouslyAuto && formData.state === previouslyAuto.state);
      const countryIsOurs = !!(previouslyAuto && formData.country_of_residence === previouslyAuto.country);

      const newCity = pincodeResult.district || "";
      const newState = pincodeResult.state || "";
      const newCountry = pincodeResult.country || "";

      if ((!formData.city || cityIsOurs) && newCity) {
        updateField("city", newCity);
      }
      if ((!formData.state || stateIsOurs) && newState) {
        updateField("state", newState);
      }
      if ((!formData.country_of_residence || countryIsOurs) && newCountry) {
        updateField("country_of_residence", newCountry);
      }
      // Persist district + tier separately for downstream use
      if (pincodeResult.district) updateField("district", pincodeResult.district);
      if (pincodeResult.tier) updateField("tier", pincodeResult.tier);

      lastApplied.current = {
        pincode: current,
        city: (!formData.city || cityIsOurs) ? newCity : formData.city,
        state: (!formData.state || stateIsOurs) ? newState : formData.state,
        country: (!formData.country_of_residence || countryIsOurs) ? newCountry : formData.country_of_residence,
      };
      return;
    }

    // Case 2: Pincode was auto-filled before but has now changed AND new value is
    // invalid (not 6 digits) or 6-digit-but-not-found. Clear stale autofill only
    // if the user hasn't manually edited the auto-filled value since.
    const prev = lastApplied.current;
    if (prev && prev.pincode !== current) {
      const newIsInvalid =
        current.length !== 6 ||
        (pincodeResult.found === false && pincodeResult.pincode === current);
      if (newIsInvalid) {
        if (prev.city && formData.city === prev.city) updateField("city", "");
        if (prev.state && formData.state === prev.state) updateField("state", "");
        if (prev.country && formData.country_of_residence === prev.country) updateField("country_of_residence", "");
        // Always clear derived district/tier when pincode no longer matches
        if (formData.district) updateField("district", "");
        if (formData.tier) updateField("tier", "");
      }
      if (current.length !== 6) {
        lastApplied.current = null;
      }
    }
  }, [pincodeResult, formData.pincode, formData.city, formData.state, formData.district, formData.tier, formData.country_of_residence, updateField]);

  const handleContinue = async () => {
    if (!formData.student_first_name.trim()) {
      toast({ title: "First name is required", variant: "destructive" }); return;
    }
    // Email is optional, but if entered it must be valid.
    if (formData.student_email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.student_email.trim())) {
      toast({ title: "Email format is invalid", variant: "destructive" }); return;
    }
    if (!formData.whatsapp_same_as_phone && formData.student_whatsapp && formData.student_whatsapp.replace(/\D/g, "").length !== 10) {
      toast({ title: "WhatsApp number must be 10 digits", variant: "destructive" }); return;
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

  const primaryDigits = (phone || "").slice(-10);
  const whatsappDisplay = formData.whatsapp_same_as_phone ? primaryDigits : formData.student_whatsapp;

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
            <div className="space-y-1.5">
              <Label>First Name <span className="text-destructive">*</span></Label>
              <Input value={formData.student_first_name} onChange={e => updateField("student_first_name", e.target.value)} placeholder="Enter your first name" />
              <p className="text-xs text-muted-foreground">Name as per Aadhaar Card / Passport</p>
            </div>
            <div className="space-y-1.5">
              <Label>Last Name</Label>
              <Input value={formData.student_last_name} onChange={e => updateField("student_last_name", e.target.value)} placeholder="Enter your last name (optional)" />
              <p className="text-xs text-muted-foreground">Name as per Aadhaar Card / Passport</p>
            </div>
            <div className="space-y-1.5">
              <Label>Mobile Number</Label>
              <div className="flex">
                <span className="flex items-center rounded-l-md border border-r-0 bg-muted px-3 text-sm text-muted-foreground">+91</span>
                <Input value={primaryDigits || ""} disabled className="rounded-l-none bg-muted" />
              </div>
              <p className="text-[11px] text-muted-foreground">Verified via OTP — cannot be changed here</p>
            </div>
            <div className="space-y-1.5">
              <Label>WhatsApp Number</Label>
              <div className="flex">
                <span className="flex items-center rounded-l-md border border-r-0 bg-muted px-3 text-sm text-muted-foreground">+91</span>
                <Input
                  value={whatsappDisplay || ""}
                  onChange={e => updateField("student_whatsapp", e.target.value.replace(/\D/g, "").slice(0, 10))}
                  placeholder="10-digit WhatsApp number"
                  inputMode="numeric"
                  disabled={formData.whatsapp_same_as_phone}
                  className={`rounded-l-none ${formData.whatsapp_same_as_phone ? "bg-muted" : ""}`}
                />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Checkbox
                  id="wa-same"
                  checked={formData.whatsapp_same_as_phone}
                  onCheckedChange={(v) => {
                    const checked = !!v;
                    updateField("whatsapp_same_as_phone", checked);
                    if (checked) {
                      // mirror primary into whatsapp field for visibility
                      updateField("student_whatsapp", primaryDigits);
                    }
                  }}
                />
                <label htmlFor="wa-same" className="text-xs text-muted-foreground cursor-pointer">
                  This is the same number on WhatsApp
                </label>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Email Address</Label>
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
              <Label>Pincode</Label>
              <Input
                value={formData.pincode}
                onChange={e => updateField("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="6-digit pincode"
                inputMode="numeric"
              />
              {formData.pincode.length === 6 && pincodeResult.found === false && (
                <p className="text-[11px] text-muted-foreground">
                  We couldn't match this pincode. Please confirm your city and state manually.
                </p>
              )}
              {pincodeResult.hasConflict && (
                <p className="text-[11px] text-amber-700 flex items-center gap-1">
                  <Info className="h-3 w-3" /> Please verify your city and state — this pincode could match more than one area.
                </p>
              )}
              {!pincodeResult.hasConflict && pincodeResult.found && (
                <p className="text-[11px] text-muted-foreground">
                  Location details auto-filled. You can edit if needed.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>City</Label>
              <Input value={formData.city} onChange={e => updateField("city", e.target.value)} placeholder="e.g. Mumbai" />
            </div>
            <div className="space-y-1.5">
              <Label>State</Label>
              <Input value={formData.state} onChange={e => updateField("state", e.target.value)} placeholder="e.g. Maharashtra" />
            </div>
            <div className="space-y-1.5">
              <Label>Destination Country</Label>
              {(() => {
                const sorted = sortByPriority(countries, c => c.country_name);
                const opts: MasterOption[] = sorted.map(c => ({ id: c.country_name, label: c.country_name }));
                const current = formData.intended_study_country || "";
                const isMaster = !!current && opts.some(o => o.id === current);
                // Cascade reset: changing the destination country must clear any
                // university/course chosen on Step 2 (StudentEducationDetails),
                // since those are filtered by the country picked here.
                const resetCascade = () => {
                  if (formData.university_id) updateField("university_id", "");
                  if (formData.university_name_raw) updateField("university_name_raw", "");
                  if (formData.course_id) updateField("course_id", "");
                  if (formData.course_name) updateField("course_name", "");
                };
                return (
                  <MasterCombobox
                    options={opts}
                    selectedId={isMaster ? current : ""}
                    manualValue={isMaster ? "" : current}
                    onSelectMaster={(opt) => {
                      if (opt.label !== current) resetCascade();
                      updateField("intended_study_country", opt.label);
                    }}
                    onSelectManual={() => { resetCascade(); updateField("intended_study_country", ""); }}
                    onChangeManual={(t) => {
                      if (t !== current) resetCascade();
                      updateField("intended_study_country", t);
                    }}
                    placeholder="Select destination country"
                    manualPlaceholder="Type the country name"
                  />
                );
              })()}
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
              <Label>Loan Amount Required</Label>
              <LakhsInput
                value={formData.loan_amount_required}
                onChange={d => updateField("loan_amount_required", d)}
                placeholder="e.g. 25 or 12.5"
              />
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
