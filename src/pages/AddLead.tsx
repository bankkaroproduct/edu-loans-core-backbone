import { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DuplicateWarningDialog } from "@/components/leads/DuplicateWarningDialog";
import { LeadSuccessDialog } from "@/components/leads/LeadSuccessDialog";
import { toast } from "sonner";
import { ArrowLeft, FileText, User, GraduationCap, Wallet, MessageSquare, Eye } from "lucide-react";
import { normalizePhone, isValidIndianPhone } from "@/lib/phone";
import { useRoleAccess } from "@/hooks/useRoleAccess";
import type { Tables } from "@/integrations/supabase/types";

type Country = Tables<"countries_master">;
type University = Tables<"universities_master">;
type Course = Tables<"courses_master">;
type Intake = Tables<"intake_master">;

const STEPS = [
  { id: "student", label: "Student Details", icon: User },
  { id: "study", label: "Study Intent", icon: GraduationCap },
  { id: "financial", label: "Financial Info", icon: Wallet },
  { id: "notes", label: "Source & Notes", icon: MessageSquare },
  { id: "review", label: "Review & Submit", icon: Eye },
] as const;

type StepId = typeof STEPS[number]["id"];

const CO_APPLICANT_RELATIONS = [
  "Father", "Mother", "Spouse", "Guardian", "Brother", "Sister", "Uncle", "Other",
];

const SOURCE_SUBTYPES = [
  { value: "walk_in", label: "Walk-in" },
  { value: "phone_inquiry", label: "Phone Inquiry" },
  { value: "email_inquiry", label: "Email Inquiry" },
  { value: "referral", label: "Referral" },
  { value: "social_media", label: "Social Media" },
  { value: "event", label: "Event / Seminar" },
  { value: "university_referral", label: "University Referral" },
  { value: "other", label: "Other" },
];

export default function AddLead() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const draftId = searchParams.get("draft");
  const editId = searchParams.get("edit");
  const hydrateId = draftId ?? editId;
  const isEditMode = Boolean(editId);

  const { user, appUser } = useAuth();
  const { isAdmin } = useRoleAccess();
  const { effectivePartnerId, effectiveUserId, isSimulating } = usePartnerContext();
  const { duplicates, checking, checkDuplicates } = useDuplicateCheck();
  const [submitting, setSubmitting] = useState(false);
  const [hydrating, setHydrating] = useState(Boolean(hydrateId));

  // Partner guard: block direct lead-edit URL for non-admins; route them to Request Edit.
  useEffect(() => {
    if (!editId) return;
    if (appUser && !isAdmin) {
      toast.info("Partners can't edit leads directly. Use 'Request Edit' from the lead detail page.");
      navigate(`/leads/${editId}`, { replace: true });
    }
  }, [editId, appUser, isAdmin, navigate]);
  const [activeStep, setActiveStep] = useState<StepId>("student");
  const [showDupDialog, setShowDupDialog] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [createdLeadId, setCreatedLeadId] = useState<string | null>(null);
  const [createdLeadDisplayId, setCreatedLeadDisplayId] = useState<string | null>(null);
  const [isDraftSuccess, setIsDraftSuccess] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  

  const [countries, setCountries] = useState<Country[]>([]);
  const [universities, setUniversities] = useState<University[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [intakes, setIntakes] = useState<Intake[]>([]);

  const [form, setForm] = useState({
    student_first_name: "",
    student_last_name: "",
    student_email: "",
    student_phone: "",
    student_whatsapp: "",
    city: "",
    state: "",
    country_of_residence: "",
    intended_study_country: "",
    intake_term: "",
    intake_year: 0,
    course_name: "",
    course_name_raw: "",
    university_name_raw: "",
    university_id: "",
    loan_amount_required: "",
    coapplicant_name: "",
    coapplicant_relation: "",
    coapplicant_income: "",
    collateral_available: false,
    collateral_notes: "",
    source_sub_type: "",
    partner_remark: "",
  });

  useEffect(() => {
    Promise.all([
      supabase.from("countries_master").select("*").eq("active_flag", true).order("country_name"),
      supabase.from("universities_master").select("*").eq("active_flag", true).order("university_name"),
      supabase.from("courses_master").select("*").eq("active_flag", true).order("course_name"),
      supabase.from("intake_master").select("*").eq("active_flag", true).order("sort_order"),
    ]).then(([c, u, co, i]) => {
      setCountries(c.data ?? []);
      setUniversities(u.data ?? []);
      setCourses(co.data ?? []);
      setIntakes(i.data ?? []);
    });
  }, []);

  // Hydrate form when resuming a draft or editing an existing lead
  useEffect(() => {
    if (!hydrateId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("student_leads")
        .select("*")
        .eq("id", hydrateId)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        toast.error("Could not load lead for editing");
        setHydrating(false);
        navigate("/leads", { replace: true });
        return;
      }
      // Strip +91 prefix for display so user can edit naturally
      const stripPrefix = (p: string | null) => (p ? p.replace(/^\+91/, "") : "");
      setForm({
        student_first_name: data.student_first_name ?? "",
        student_last_name: data.student_last_name ?? "",
        student_email: data.student_email ?? "",
        student_phone: stripPrefix(data.student_phone),
        student_whatsapp: stripPrefix(data.student_whatsapp),
        city: data.city ?? "",
        state: data.state ?? "",
        country_of_residence: data.country_of_residence ?? "",
        intended_study_country: data.intended_study_country ?? "",
        intake_term: data.intake_term ?? "",
        intake_year: data.intake_year ?? 0,
        course_name: data.course_name ?? "",
        course_name_raw: "",
        university_name_raw: data.university_name_raw ?? "",
        university_id: data.university_id ?? "",
        loan_amount_required: data.loan_amount_required != null ? String(data.loan_amount_required) : "",
        coapplicant_name: data.coapplicant_name ?? "",
        coapplicant_relation: data.coapplicant_relation ?? "",
        coapplicant_income: data.coapplicant_income != null ? String(data.coapplicant_income) : "",
        collateral_available: data.collateral_available ?? false,
        collateral_notes: data.collateral_notes ?? "",
        source_sub_type: data.source_sub_type ?? "",
        partner_remark: "",
      });
      setIsDirty(false);
      setHydrating(false);
    })();
    return () => { cancelled = true; };
  }, [hydrateId, navigate]);

  // Unsaved changes protection
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const set = (field: string, value: string | number | boolean) => {
    setIsDirty(true);
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const fullName = `${form.student_first_name.trim()} ${form.student_last_name.trim()}`.trim();

  // Resolve final course name: master selection takes priority, raw fallback
  const resolvedCourseName = form.course_name || form.course_name_raw.trim();

  const validate = (isDraft: boolean): string | null => {
    if (!form.student_first_name.trim()) return "Student first name is required";
    if (!form.student_phone.trim()) return "Phone number is required";
    if (!isValidIndianPhone(form.student_phone)) return "Phone must be a valid 10-digit Indian number (with or without +91)";
    if (form.student_email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.student_email.trim())) return "Email format is invalid";

    if (!isDraft) {
      if (!form.intended_study_country) return "Study country is required";
      if (!form.intake_term) return "Intake term is required";
      if (!form.intake_year) return "Intake year is required";
      if (!resolvedCourseName) return "Course name is required";
      if (form.loan_amount_required && (isNaN(Number(form.loan_amount_required)) || Number(form.loan_amount_required) <= 0))
        return "Loan amount must be a positive number";
      if (form.coapplicant_income && (isNaN(Number(form.coapplicant_income)) || Number(form.coapplicant_income) < 0))
        return "Co-applicant income must be a valid number";
      if (form.collateral_available && !form.collateral_notes.trim())
        return "Please describe the collateral available";
    }

    if (!effectivePartnerId) return "No partner organization found for your account. Admins can use 'Test as Partner' in the sidebar.";
    return null;
  };

  const handleSubmit = async (asDraft: boolean) => {
    const err = validate(asDraft);
    if (err) return toast.error(err);

    if (!asDraft) {
      const dups = await checkDuplicates({
        phone: normalizePhone(form.student_phone) ?? form.student_phone.trim(),
        email: form.student_email.trim() || undefined,
        firstName: form.student_first_name.trim(),
        lastName: form.student_last_name.trim(),
        intakeTerm: form.intake_term,
        intakeYear: form.intake_year,
        partnerId: effectivePartnerId!,
        excludeId: editId ?? draftId ?? null,
      });
      if (dups.length > 0) {
        setShowDupDialog(true);
        return;
      }
    }

    await createLead(asDraft, false);
  };

  const createLead = async (asDraft: boolean, hasDuplicateWarning: boolean) => {
    setSubmitting(true);
    setShowDupDialog(false);

    const stage = asDraft ? "draft" as const : "submitted" as const;
    const status = asDraft ? "in_progress" as const : "awaiting_verification" as const;

    const payload = {
      student_first_name: form.student_first_name.trim(),
      student_last_name: form.student_last_name.trim() || null,
      
      student_email: form.student_email.trim() || null,
      student_phone: normalizePhone(form.student_phone) ?? form.student_phone.trim(),
      student_whatsapp: form.student_whatsapp.trim() ? (normalizePhone(form.student_whatsapp) ?? form.student_whatsapp.trim()) : null,
      city: form.city.trim() || null,
      state: form.state.trim() || null,
      country_of_residence: form.country_of_residence || null,
      intended_study_country: form.intended_study_country || "Not specified",
      intake_term: form.intake_term || "Not specified",
      intake_year: form.intake_year || new Date().getFullYear(),
      course_name: resolvedCourseName || "Not specified",
      university_name_raw: form.university_name_raw.trim() || null,
      university_id: form.university_id || null,
      loan_amount_required: form.loan_amount_required ? Number(form.loan_amount_required) : null,
      coapplicant_name: form.coapplicant_name.trim() || null,
      coapplicant_relation: form.coapplicant_relation || null,
      coapplicant_income: form.coapplicant_income ? Number(form.coapplicant_income) : null,
      collateral_available: form.collateral_available,
      collateral_notes: form.collateral_notes.trim() || null,
      source_sub_type: form.source_sub_type || null,
      partner_id: effectivePartnerId!,
      partner_user_id: effectiveUserId!,
      current_stage: stage,
      current_status: status,
      source_type: "partner",
      duplicate_flag: hasDuplicateWarning,
    };

    // Decide insert vs update
    // - editId: always update (preserve created_at, lead_id, partner_id ownership)
    // - draftId + asDraft: update existing draft in place
    // - draftId + submit: update draft → submitted (stage transition)
    const updateTargetId = editId ?? draftId ?? null;
    let resultLeadId: string | null = null;
    let opError: any = null;

    if (updateTargetId) {
      // Update existing record. Don't overwrite partner_id/partner_user_id on edit.
      const updatePayload: any = { ...payload };
      delete updatePayload.partner_id;
      delete updatePayload.partner_user_id;
      delete updatePayload.source_type;
      // Preserve duplicate_flag from existing unless we're explicitly setting it now
      if (!hasDuplicateWarning) delete updatePayload.duplicate_flag;
      const { data, error } = await supabase
        .from("student_leads")
        .update(updatePayload)
        .eq("id", updateTargetId)
        .select("id")
        .single();
      resultLeadId = data?.id ?? null;
      opError = error;
    } else {
      const { data, error } = await supabase.from("student_leads").insert(payload).select("id").single();
      resultLeadId = data?.id ?? null;
      opError = error;
    }

    if (opError) {
      console.error("[AddLead] Save failed:", opError.message, opError.details, opError.hint);
      toast.error(`Lead save failed: ${opError.message}`);
    } else if (resultLeadId) {
      // Skip downstream history/audit creation on update — the DB stage trigger handles it.
      // Only create downstream artifacts on first insert.
      if (!updateTargetId) {
        const downstream = await createDownstreamRecords({
          leadId: resultLeadId,
          appUser: appUser!,
          stage,
          status,
          isDraft: asDraft,
          hasDuplicateOverride: hasDuplicateWarning,
          partnerRemark: form.partner_remark,
        });

        if (!downstream.ok) {
          toast.error(`Lead row created, but downstream failed: ${downstream.failedStep}`);
          setSubmitting(false);
          return;
        }
      } else if (form.partner_remark.trim()) {
        // Add partner remark as a note on edit/draft-resume
        await supabase.from("lead_notes").insert({
          lead_id: resultLeadId,
          note_type: "partner_visible",
          note_text: form.partner_remark.trim(),
          created_by: appUser!.id,
        });
      }

      const displayIdResult = await fetchLeadDisplayId(resultLeadId);

      if (displayIdResult.error) {
        toast.error(`Lead saved, but could not fetch display ID`);
      }

      setCreatedLeadId(resultLeadId);
      setCreatedLeadDisplayId(displayIdResult.displayId);
      setIsDraftSuccess(asDraft);
      setIsDirty(false);
      setShowSuccess(true);
    }

    setSubmitting(false);
  };

  const intakeTerms = [...new Set(intakes.map((i) => i.intake_term))];
  const intakeYears = [...new Set(intakes.map((i) => i.intake_year))].sort();

  const stepIndex = STEPS.findIndex((s) => s.id === activeStep);

  const ReviewRow = ({ label, value }: { label: string; value: string | number | boolean | null | undefined }) => (
    <div className="flex justify-between py-1.5 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground text-right max-w-[60%]">
        {value === true ? "Yes" : value === false ? "No" : value || "—"}
      </span>
    </div>
  );

  if (hydrating) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center text-muted-foreground text-sm">
        Loading lead for editing…
      </div>
    );
  }

  const headingTitle = draftId ? "Resume Draft Lead" : isEditMode ? "Edit Lead" : "Add New Lead";
  const headingDesc = draftId
    ? "Continue where you left off. Submit when complete or save again as draft."
    : isEditMode
      ? "Update lead details. Changes are tracked in the lead timeline."
      : "Create a complete lead record for smoother downstream review and lender matching.";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> {headingTitle}
            {(draftId || isEditMode) && (
              <Badge variant="outline" className="ml-1 text-[10px]">
                {draftId ? "DRAFT" : "EDIT"}
              </Badge>
            )}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{headingDesc}</p>
        </div>
      </div>

      {/* Step progress */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          const isActive = step.id === activeStep;
          const isPast = i < stepIndex;
          return (
            <button
              key={step.id}
              onClick={() => setActiveStep(step.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                isActive ? "bg-primary text-primary-foreground" : isPast ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {step.label}
            </button>
          );
        })}
      </div>

      <Tabs value={activeStep} onValueChange={(v) => setActiveStep(v as StepId)} className="space-y-5">
        {/* Student Details */}
        <TabsContent value="student" className="mt-0">
          <Card>
            <CardHeader><CardTitle className="text-lg">Student Basic Details</CardTitle></CardHeader>
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
              {fullName && (
                <div className="space-y-2 md:col-span-2">
                  <Label>Full Name (auto-derived)</Label>
                  <Input value={fullName} disabled className="bg-muted" />
                </div>
              )}
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
                <Input value={form.city} onChange={(e) => set("city", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>State</Label>
                <Input value={form.state} onChange={(e) => set("state", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Country of Residence</Label>
                <Select value={form.country_of_residence} onValueChange={(v) => set("country_of_residence", v)}>
                  <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
                  <SelectContent>{countries.map((c) => <SelectItem key={c.id} value={c.country_name}>{c.country_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
          <div className="flex justify-end mt-4">
            <Button onClick={() => setActiveStep("study")}>Next: Study Intent →</Button>
          </div>
        </TabsContent>

        {/* Study Intent */}
        <TabsContent value="study" className="mt-0">
          <Card>
            <CardHeader><CardTitle className="text-lg">Education & Study Intent</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Intended Study Country *</Label>
                <Select value={form.intended_study_country} onValueChange={(v) => set("intended_study_country", v)}>
                  <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
                  <SelectContent>{countries.map((c) => <SelectItem key={c.id} value={c.country_name}>{c.country_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>University (from list)</Label>
                <Select value={form.university_id} onValueChange={(v) => {
                  const uni = universities.find((u) => u.id === v);
                  set("university_id", v);
                  set("university_name_raw", uni?.university_name ?? "");
                }}>
                  <SelectTrigger><SelectValue placeholder="Search university..." /></SelectTrigger>
                  <SelectContent>{universities.map((u) => <SelectItem key={u.id} value={u.id}>{u.university_name} ({u.country})</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Or enter university name</Label>
                <Input value={form.university_name_raw} onChange={(e) => {
                  set("university_name_raw", e.target.value);
                  if (form.university_id) set("university_id", "");
                }} placeholder="If not in the list above" />
                <p className="text-xs text-muted-foreground">Type university name manually if not found in the list</p>
              </div>
              <div className="space-y-2">
                <Label>Course (from list)</Label>
                <Select value={form.course_name} onValueChange={(v) => set("course_name", v)}>
                  <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
                  <SelectContent>{courses.map((c) => <SelectItem key={c.id} value={c.course_name}>{c.course_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Or enter course name</Label>
                <Input value={form.course_name_raw} onChange={(e) => {
                  set("course_name_raw", e.target.value);
                  if (form.course_name) set("course_name", "");
                }} placeholder="If not in the list above" />
                <p className="text-xs text-muted-foreground">Type course name if not found in master list</p>
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
                <Label>Loan Amount Required (₹)</Label>
                <Input type="number" min="0" value={form.loan_amount_required} onChange={(e) => set("loan_amount_required", e.target.value)} placeholder="e.g. 2500000" />
              </div>
            </CardContent>
          </Card>
          <div className="flex justify-between mt-4">
            <Button variant="outline" onClick={() => setActiveStep("student")}>← Student Details</Button>
            <Button onClick={() => setActiveStep("financial")}>Next: Financial Info →</Button>
          </div>
        </TabsContent>

        {/* Financial */}
        <TabsContent value="financial" className="mt-0">
          <Card>
            <CardHeader><CardTitle className="text-lg">Co-Applicant & Financial Snapshot</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Co-Applicant Name</Label>
                <Input value={form.coapplicant_name} onChange={(e) => set("coapplicant_name", e.target.value)} />
                <p className="text-xs text-muted-foreground">Name as per Aadhaar Card / Passport</p>
              </div>
              <div className="space-y-2">
                <Label>Co-Applicant Relation</Label>
                <Select value={form.coapplicant_relation} onValueChange={(v) => set("coapplicant_relation", v)}>
                  <SelectTrigger><SelectValue placeholder="Select relation" /></SelectTrigger>
                  <SelectContent>
                    {CO_APPLICANT_RELATIONS.map((r) => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Co-Applicant Income (₹)</Label>
                <Input type="number" min="0" value={form.coapplicant_income} onChange={(e) => set("coapplicant_income", e.target.value)} />
              </div>
              <div className="md:col-span-2 space-y-4">
                <div className="flex items-center gap-3">
                  <Switch checked={form.collateral_available} onCheckedChange={(v) => set("collateral_available", v)} />
                  <Label>Collateral Available</Label>
                </div>
                {form.collateral_available && (
                  <div className="space-y-2">
                    <Label>Collateral Details *</Label>
                    <Textarea value={form.collateral_notes} onChange={(e) => set("collateral_notes", e.target.value)} placeholder="Describe the collateral type, estimated value, location..." />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          <div className="flex justify-between mt-4">
            <Button variant="outline" onClick={() => setActiveStep("study")}>← Study Intent</Button>
            <Button onClick={() => setActiveStep("notes")}>Next: Source & Notes →</Button>
          </div>
        </TabsContent>

        {/* Notes */}
        <TabsContent value="notes" className="mt-0">
          <Card>
            <CardHeader><CardTitle className="text-lg">Lead Source & Partner Notes</CardTitle></CardHeader>
            <CardContent className="grid gap-4">
              <div className="space-y-2">
                <Label>Source Subtype</Label>
                <Select value={form.source_sub_type} onValueChange={(v) => set("source_sub_type", v)}>
                  <SelectTrigger><SelectValue placeholder="How did this lead come to you?" /></SelectTrigger>
                  <SelectContent>
                    {SOURCE_SUBTYPES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Partner Remark</Label>
                <Textarea value={form.partner_remark} onChange={(e) => set("partner_remark", e.target.value)} placeholder="Any additional context for the operations team..." rows={3} />
              </div>
            </CardContent>
          </Card>
          <div className="flex justify-between mt-4">
            <Button variant="outline" onClick={() => setActiveStep("financial")}>← Financial Info</Button>
            <Button onClick={() => setActiveStep("review")}>Next: Review & Submit →</Button>
          </div>
        </TabsContent>

        {/* Review */}
        <TabsContent value="review" className="mt-0 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Eye className="h-5 w-5" /> Review Lead Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Badge variant="outline" className="mb-2">Student Details</Badge>
                <ReviewRow label="Name" value={fullName} />
                <ReviewRow label="Phone" value={form.student_phone} />
                <ReviewRow label="Email" value={form.student_email} />
                <ReviewRow label="WhatsApp" value={form.student_whatsapp} />
                <ReviewRow label="City" value={form.city} />
                <ReviewRow label="State" value={form.state} />
                <ReviewRow label="Country of Residence" value={form.country_of_residence} />
              </div>
              <div>
                <Badge variant="outline" className="mb-2">Study Intent</Badge>
                <ReviewRow label="Study Country" value={form.intended_study_country} />
                <ReviewRow label="University" value={form.university_name_raw || (form.university_id ? universities.find(u => u.id === form.university_id)?.university_name : undefined)} />
                <ReviewRow label="Course" value={resolvedCourseName} />
                <ReviewRow label="Intake" value={`${form.intake_term} ${form.intake_year || ""}`} />
                <ReviewRow label="Loan Amount (₹)" value={form.loan_amount_required ? `₹${Number(form.loan_amount_required).toLocaleString("en-IN")}` : undefined} />
              </div>
              <div>
                <Badge variant="outline" className="mb-2">Financial</Badge>
                <ReviewRow label="Co-Applicant" value={form.coapplicant_name} />
                <ReviewRow label="Relation" value={form.coapplicant_relation} />
                <ReviewRow label="Co-Applicant Income" value={form.coapplicant_income ? `₹${Number(form.coapplicant_income).toLocaleString("en-IN")}` : undefined} />
                <ReviewRow label="Collateral Available" value={form.collateral_available} />
                {form.collateral_available && <ReviewRow label="Collateral Notes" value={form.collateral_notes} />}
              </div>
              {(form.source_sub_type || form.partner_remark) && (
                <div>
                  <Badge variant="outline" className="mb-2">Source & Notes</Badge>
                  <ReviewRow label="Source Subtype" value={SOURCE_SUBTYPES.find(s => s.value === form.source_sub_type)?.label} />
                  <ReviewRow label="Partner Remark" value={form.partner_remark} />
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-3 justify-between sticky bottom-4 bg-background/80 backdrop-blur p-3 rounded-lg border">
            <Button variant="outline" onClick={() => setActiveStep("notes")}>← Back to Edit</Button>
            <div className="flex gap-3">
              {!isEditMode && (
                <Button type="button" variant="secondary" disabled={submitting || checking} onClick={() => handleSubmit(true)}>
                  {draftId ? "Save Draft" : "Save as Draft"}
                </Button>
              )}
              <Button type="button" disabled={submitting || checking} onClick={() => handleSubmit(false)}>
                {submitting ? "Saving..." : checking ? "Checking..." : isEditMode ? "Save Changes" : "Submit Lead"}
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <DuplicateWarningDialog
        open={showDupDialog}
        onClose={() => setShowDupDialog(false)}
        onContinue={() => createLead(false, true)}
        duplicates={duplicates}
        submitting={submitting}
      />

      <LeadSuccessDialog
        open={showSuccess}
        leadId={createdLeadId}
        leadDisplayId={createdLeadDisplayId}
        studentName={fullName}
        isDraft={isDraftSuccess}
        onClose={() => navigate("/leads")}
      />
    </div>
  );
}
