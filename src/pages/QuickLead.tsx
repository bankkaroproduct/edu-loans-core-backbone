import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePartnerContext } from "@/hooks/usePartnerContext";
import { useDuplicateCheck } from "@/hooks/useDuplicateCheck";
import { createDownstreamRecords, fetchLeadDisplayId } from "@/hooks/useLeadWriteFlow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DuplicateWarningDialog } from "@/components/leads/DuplicateWarningDialog";
import { LeadSuccessDialog } from "@/components/leads/LeadSuccessDialog";
import { toast } from "sonner";
import { ArrowLeft, Zap } from "lucide-react";
import { normalizePhone, isValidIndianPhone } from "@/lib/phone";
import type { Tables } from "@/integrations/supabase/types";

type Country = Tables<"countries_master">;
type Intake = Tables<"intake_master">;

const STAGE = "submitted" as const;
const STATUS = "awaiting_verification" as const;

export default function QuickLead() {
  const navigate = useNavigate();
  const { user, appUser } = useAuth();
  const { effectivePartnerId, effectiveUserId } = usePartnerContext();
  const { duplicates, checking, checkDuplicates } = useDuplicateCheck();
  const [submitting, setSubmitting] = useState(false);
  const [showDupDialog, setShowDupDialog] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [createdLeadId, setCreatedLeadId] = useState<string | null>(null);
  const [createdLeadDisplayId, setCreatedLeadDisplayId] = useState<string | null>(null);

  const [countries, setCountries] = useState<Country[]>([]);
  const [intakes, setIntakes] = useState<Intake[]>([]);

  const [form, setForm] = useState({
    student_first_name: "",
    student_last_name: "",
    student_phone: "",
    student_email: "",
    student_whatsapp: "",
    city: "",
    intended_study_country: "",
    intake_term: "",
    intake_year: 0,
    course_name: "",
    loan_amount_required: "",
    partner_remark: "",
  });

  useEffect(() => {
    Promise.all([
      supabase.from("countries_master").select("*").eq("active_flag", true).order("country_name"),
      supabase.from("intake_master").select("*").eq("active_flag", true).order("sort_order"),
    ]).then(([c, i]) => {
      setCountries(c.data ?? []);
      setIntakes(i.data ?? []);
    });
  }, []);

  const set = (field: string, value: string | number) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const validate = (): string | null => {
    if (!form.student_first_name.trim()) return "Student first name is required";
    if (!form.student_phone.trim()) return "Phone number is required";
    if (!isValidIndianPhone(form.student_phone)) return "Phone must be a valid 10-digit Indian number (with or without +91)";
    if (form.student_email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.student_email.trim())) return "Email format is invalid";
    if (!form.intended_study_country) return "Study country is required";
    if (!form.intake_term) return "Intake term is required";
    if (!form.intake_year) return "Intake year is required";
    if (!form.course_name.trim()) return "Course name is required";
    if (!form.loan_amount_required.trim()) return "Loan amount is required";
    if (isNaN(Number(form.loan_amount_required)) || Number(form.loan_amount_required) <= 0) return "Loan amount must be a positive number";
    if (!effectivePartnerId) return "No partner organization found. Admins can use 'Test as Partner' in the sidebar.";
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) return toast.error(err);

    const canonicalPhone = normalizePhone(form.student_phone)!;
    const canonicalWhatsapp = form.student_whatsapp.trim() ? normalizePhone(form.student_whatsapp) : null;

    const dups = await checkDuplicates({
      phone: canonicalPhone,
      email: form.student_email.trim() || undefined,
      firstName: form.student_first_name.trim(),
      lastName: form.student_last_name.trim(),
      intakeTerm: form.intake_term,
      intakeYear: form.intake_year,
      partnerId: effectivePartnerId!,
    });

    if (dups.length > 0) {
      setShowDupDialog(true);
      return;
    }

    await createLead(false, canonicalPhone, canonicalWhatsapp);
  };

  const createLead = async (hasDuplicateWarning: boolean, canonicalPhoneArg?: string, canonicalWhatsappArg?: string | null) => {
    setSubmitting(true);
    setShowDupDialog(false);

    const canonicalPhone = canonicalPhoneArg ?? normalizePhone(form.student_phone) ?? form.student_phone.trim();
    const canonicalWhatsapp = canonicalWhatsappArg !== undefined
      ? canonicalWhatsappArg
      : (form.student_whatsapp.trim() ? normalizePhone(form.student_whatsapp) : null);

    const payload = {
      student_first_name: form.student_first_name.trim(),
      student_last_name: form.student_last_name.trim() || null,
      student_phone: canonicalPhone,
      student_email: form.student_email.trim() || null,
      student_whatsapp: canonicalWhatsapp,
      city: form.city.trim() || null,
      intended_study_country: form.intended_study_country,
      intake_term: form.intake_term,
      intake_year: form.intake_year,
      course_name: form.course_name.trim(),
      loan_amount_required: Number(form.loan_amount_required),
      partner_id: effectivePartnerId!,
      partner_user_id: effectiveUserId!,
      current_stage: STAGE,
      current_status: STATUS,
      source_type: "partner",
      source_sub_type: "quick_lead",
      duplicate_flag: hasDuplicateWarning,
    };

    const { data, error } = await supabase.from("student_leads").insert(payload).select("id").single();

    if (error) {
      console.error("[QuickLead] Insert failed:", error.message, error.details, error.hint);
      toast.error(`Lead insert failed: ${error.message}`);
    } else if (data) {
      const downstream = await createDownstreamRecords({
        leadId: data.id,
        appUser: appUser!,
        stage: STAGE,
        status: STATUS,
        isDraft: false,
        hasDuplicateOverride: hasDuplicateWarning,
        partnerRemark: form.partner_remark,
      });

      if (!downstream.ok) {
        toast.error(`Lead row created, but downstream failed: ${downstream.failedStep}`);
        setSubmitting(false);
        return;
      }

      const displayIdResult = await fetchLeadDisplayId(data.id);

      if (displayIdResult.error) {
        toast.error(`Lead created, but could not fetch display ID`);
      }

      setCreatedLeadId(data.id);
      setCreatedLeadDisplayId(displayIdResult.displayId);
      setShowSuccess(true);
    }

    setSubmitting(false);
  };

  const intakeTerms = [...new Set(intakes.map((i) => i.intake_term))];
  const intakeYears = [...new Set(intakes.map((i) => i.intake_year))].sort();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" /> Add Quick Lead
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Capture a lead quickly when only essential details are available. You can enrich the lead later.
          </p>
        </div>
      </div>

      <div className="space-y-5">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Student & Contact</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>First Name *</Label>
              <Input value={form.student_first_name} onChange={(e) => set("student_first_name", e.target.value)} placeholder="Student first name" />
              <p className="text-xs text-muted-foreground">Name as per Aadhaar Card / Passport</p>
            </div>
            <div className="space-y-2">
              <Label>Last Name</Label>
              <Input value={form.student_last_name} onChange={(e) => set("student_last_name", e.target.value)} placeholder="Student last name" />
              <p className="text-xs text-muted-foreground">Name as per Aadhaar Card / Passport</p>
            </div>
            <div className="space-y-2">
              <Label>Mobile Number *</Label>
              <Input value={form.student_phone} onChange={(e) => set("student_phone", e.target.value)} placeholder="+91 9876543210" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.student_email} onChange={(e) => set("student_email", e.target.value)} placeholder="student@email.com" />
            </div>
            <div className="space-y-2">
              <Label>WhatsApp</Label>
              <Input value={form.student_whatsapp} onChange={(e) => set("student_whatsapp", e.target.value)} placeholder="WhatsApp number" />
            </div>
            <div className="space-y-2">
              <Label>City</Label>
              <Input value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="City" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Study & Loan Intent</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Study Country *</Label>
              <Select value={form.intended_study_country} onValueChange={(v) => set("intended_study_country", v)}>
                <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
                <SelectContent>{countries.map((c) => <SelectItem key={c.id} value={c.country_name}>{c.country_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Course Name *</Label>
              <Input value={form.course_name} onChange={(e) => set("course_name", e.target.value)} placeholder="e.g. MS Computer Science" />
            </div>
            <div className="space-y-2">
              <Label>Intake Term *</Label>
              <Select value={form.intake_term} onValueChange={(v) => set("intake_term", v)}>
                <SelectTrigger><SelectValue placeholder="Select term" /></SelectTrigger>
                <SelectContent>{intakeTerms.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Intake Year *</Label>
              <Select value={form.intake_year ? String(form.intake_year) : ""} onValueChange={(v) => set("intake_year", Number(v))}>
                <SelectTrigger><SelectValue placeholder="Select year" /></SelectTrigger>
                <SelectContent>{intakeYears.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Loan Amount Required (₹) *</Label>
              <Input type="number" min="1" value={form.loan_amount_required} onChange={(e) => set("loan_amount_required", e.target.value)} placeholder="e.g. 2500000" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label>Partner Remark (optional)</Label>
              <Textarea value={form.partner_remark} onChange={(e) => set("partner_remark", e.target.value)} placeholder="Any context for internal review..." rows={2} />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3 justify-end sticky bottom-4 bg-background/80 backdrop-blur p-3 rounded-lg border">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
          <Button type="button" onClick={handleSubmit} disabled={submitting || checking}>
            {submitting ? "Submitting..." : checking ? "Checking..." : "Submit Quick Lead"}
          </Button>
        </div>
      </div>

      <DuplicateWarningDialog
        open={showDupDialog}
        onClose={() => setShowDupDialog(false)}
        onContinue={() => createLead(true)}
        duplicates={duplicates}
        submitting={submitting}
      />

      <LeadSuccessDialog
        open={showSuccess}
        leadId={createdLeadId}
        leadDisplayId={createdLeadDisplayId}
        studentName={`${form.student_first_name} ${form.student_last_name}`.trim()}
        isDraft={false}
        onClose={() => navigate("/leads")}
      />

    </div>
  );
}
