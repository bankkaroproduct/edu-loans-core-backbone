import { useEffect, useState, useCallback, useMemo } from "react";
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
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DuplicateWarningDialog } from "@/components/leads/DuplicateWarningDialog";
import { LeadSuccessDialog } from "@/components/leads/LeadSuccessDialog";
import { toast } from "sonner";
import { ArrowLeft, FileText, User, GraduationCap, MessageSquare, Eye, AlertTriangle, ChevronDown, Wallet, Building2, Check, ChevronsUpDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { normalizePhone, isValidIndianPhone } from "@/lib/phone";
import { useRoleAccess } from "@/hooks/useRoleAccess";
import { computeAdminDiff, getAdminFieldLabel } from "@/lib/adminEditableFields";
import type { Tables } from "@/integrations/supabase/types";

type Country = Tables<"countries_master">;
type University = Tables<"universities_master">;
type Course = Tables<"courses_master">;
type Intake = Tables<"intake_master">;

const STEP_DEFS = {
  student: { id: "student", label: "Student Details", icon: User },
  study: { id: "study", label: "Study Intent", icon: GraduationCap },
  financial: { id: "financial", label: "Financial Info", icon: Wallet },
  notes: { id: "notes", label: "Notes", icon: MessageSquare },
  assign: { id: "assign", label: "Assign to Partner", icon: Building2 },
  review: { id: "review", label: "Review & Submit", icon: Eye },
} as const;

type StepId = keyof typeof STEP_DEFS;

const PARTNER_STEPS: StepId[] = ["student", "study", "notes", "review"];
const ADMIN_STEPS: StepId[] = ["student", "study", "financial", "notes", "review"];
const ADMIN_EDIT_STEPS: StepId[] = ["student", "study", "financial", "notes", "assign", "review"];

const CO_APPLICANT_RELATIONS = [
  "Father", "Mother", "Spouse", "Guardian", "Brother", "Sister", "Uncle", "Other",
];

const TERMINAL_STAGES = ["disbursed", "rejected", "dropped"];

interface AddLeadProps {
  hideOwnHeader?: boolean;
  containerClassName?: string;
  /** When true, render the admin 5-step structure with a dedicated Financial Info step. */
  adminMode?: boolean;
}

export default function AddLead({ hideOwnHeader = false, containerClassName, adminMode = false }: AddLeadProps = {}) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const draftId = searchParams.get("draft");
  const editId = searchParams.get("edit");
  const hydrateId = draftId ?? editId;
  const isEditMode = Boolean(editId);

  const { user, appUser } = useAuth();
  const { isAdmin } = useRoleAccess();
  const { effectivePartnerId, effectiveUserId } = usePartnerContext();
  const { duplicates, checking, checkDuplicates } = useDuplicateCheck();
  const [submitting, setSubmitting] = useState(false);
  const [hydrating, setHydrating] = useState(Boolean(hydrateId));

  // Admin form mode: explicit prop OR signed-in admin user. Path-based fallback for safety.
  const isAdminContext = typeof window !== "undefined" && window.location.pathname.startsWith("/admin");
  const isAdminForm = adminMode || isAdmin || isAdminContext;

  // Mode-aware step list. Partner = 4 steps. Admin add = 5 steps. Admin edit = 6 steps (+ Assign).
  const steps = useMemo(() => {
    const list = isAdminForm ? (isEditMode ? ADMIN_EDIT_STEPS : ADMIN_STEPS) : PARTNER_STEPS;
    return list.map((id) => STEP_DEFS[id]);
  }, [isAdminForm, isEditMode]);
  const stepIds = useMemo(() => steps.map((s) => s.id) as StepId[], [steps]);

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
  const [coAppOpen, setCoAppOpen] = useState(false);
  const [originalLead, setOriginalLead] = useState<Record<string, unknown> | null>(null);
  const [editLeadStage, setEditLeadStage] = useState<string | null>(null);

  // Guardrail: never allow activeStep to settle on a step that's not in the
  // current mode's list. If partner mode lands on `financial` (e.g. via stale
  // draft state), normalize it.
  useEffect(() => {
    if (!stepIds.includes(activeStep)) {
      setActiveStep(isAdminForm ? "financial" : "notes");
    }
  }, [stepIds, activeStep, isAdminForm]);

  const goToStep = useCallback(
    (target: StepId) => {
      if (stepIds.includes(target)) {
        setActiveStep(target);
        return;
      }
      // Mode mismatch — normalize. Admin-only step requested in partner mode → notes.
      if (target === "financial" && !isAdminForm) {
        setActiveStep("notes");
      } else {
        setActiveStep(stepIds[0]);
      }
    },
    [stepIds, isAdminForm],
  );

  const [countries, setCountries] = useState<Country[]>([]);
  const [universities, setUniversities] = useState<University[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [intakes, setIntakes] = useState<Intake[]>([]);

  // Admin Assign-to-Partner state (admin-edit mode only)
  const [partnersList, setPartnersList] = useState<{ id: string; display_name: string; partner_code: string }[]>([]);
  const [partnerPickerOpen, setPartnerPickerOpen] = useState(false);
  const [originalPartnerId, setOriginalPartnerId] = useState<string | null>(null);
  const [partnerIdAssignment, setPartnerIdAssignment] = useState<string>("");

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

  // Admin-edit only: load full active partner list for the Assign-to-Partner picker.
  useEffect(() => {
    if (!isAdminForm || !isEditMode) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("partner_organizations")
        .select("id, display_name, partner_code")
        .eq("is_archived", false)
        .order("display_name");
      if (!cancelled) setPartnersList((data ?? []).filter((p) => !!p.display_name?.trim()));
    })();
    return () => { cancelled = true; };
  }, [isAdminForm, isEditMode]);

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
        partner_remark: "",
      });
      setOriginalLead(data as unknown as Record<string, unknown>);
      setEditLeadStage(data.current_stage ?? null);
      setOriginalPartnerId(data.partner_id ?? null);
      setPartnerIdAssignment(data.partner_id ?? "");
      // Always start hydrated forms on the first step of the active mode.
      setActiveStep(stepIds[0]);
      setIsDirty(false);
      setHydrating(false);
    })();
    return () => { cancelled = true; };
  }, [hydrateId, navigate, isEditMode, stepIds]);

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
  const resolvedCourseName = form.course_name || form.course_name_raw.trim();
  const resolvedUniversityName = form.university_name_raw.trim() || (form.university_id ? universities.find((u) => u.id === form.university_id)?.university_name : "") || "";

  const isTerminalEdit = isEditMode && editLeadStage && TERMINAL_STAGES.includes(editLeadStage);

  const validate = (isDraft: boolean): string | null => {
    if (!form.student_first_name.trim()) return "Student first name is required";
    if (!form.student_phone.trim()) return "Phone number is required";
    if (!isValidIndianPhone(form.student_phone)) return "Phone must be a valid 10-digit Indian number (with or without +91)";
    if (form.student_email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.student_email.trim())) return "Email format is invalid";

    if (!isDraft) {
      if (!form.intended_study_country) return "Study country is required";
      if (!resolvedUniversityName.trim()) return "University is required (pick from list or type manually)";
      if (!resolvedCourseName) return "Course is required (pick from list or type manually)";
      if (!form.intake_term) return "Intake term is required";
      if (!form.intake_year) return "Intake year is required";
      if (!form.loan_amount_required) return "Approx loan amount is required";
      if (isNaN(Number(form.loan_amount_required)) || Number(form.loan_amount_required) <= 0)
        return "Loan amount must be a positive number";
      if (form.coapplicant_income && (isNaN(Number(form.coapplicant_income)) || Number(form.coapplicant_income) < 0))
        return "Co-applicant income must be a valid number";
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

  const writeAdminAuditTrail = async (leadId: string) => {
    if (!isEditMode || !isAdmin || !appUser || !originalLead) return;
    const edited: Record<string, unknown> = {
      student_first_name: form.student_first_name.trim() || null,
      student_last_name: form.student_last_name.trim() || null,
      student_email: form.student_email.trim() || null,
      student_phone: normalizePhone(form.student_phone) ?? form.student_phone.trim() ?? null,
      student_whatsapp: form.student_whatsapp.trim() ? (normalizePhone(form.student_whatsapp) ?? form.student_whatsapp.trim()) : null,
      city: form.city.trim() || null,
      state: form.state.trim() || null,
      country_of_residence: form.country_of_residence || null,
      intended_study_country: form.intended_study_country || null,
      intake_term: form.intake_term || null,
      intake_year: form.intake_year || null,
      course_name: resolvedCourseName || null,
      university_id: form.university_id || null,
      university_name_raw: form.university_name_raw.trim() || null,
      loan_amount_required: form.loan_amount_required ? Number(form.loan_amount_required) : null,
      coapplicant_name: form.coapplicant_name.trim() || null,
      coapplicant_relation: form.coapplicant_relation || null,
      coapplicant_income: form.coapplicant_income ? Number(form.coapplicant_income) : null,
      collateral_available: form.collateral_available,
      collateral_notes: form.collateral_notes.trim() || null,
      partner_id: partnerIdAssignment || null,
    };
    const diff = computeAdminDiff(originalLead, edited);
    const changedKeys = Object.keys(diff);
    if (changedKeys.length === 0) return;

    const isTerminalAtEdit = !!(editLeadStage && TERMINAL_STAGES.includes(editLeadStage));

    try {
      await supabase.from("audit_logs").insert({
        entity_type: "student_lead",
        entity_id: leadId,
        action_type: "admin_direct_edit",
        actor_user_id: appUser.id,
        actor_role: appUser.role,
        old_value: Object.fromEntries(changedKeys.map((k) => [k, diff[k].from])) as any,
        new_value: Object.fromEntries(changedKeys.map((k) => [k, diff[k].to])) as any,
        meta: {
          field_count: changedKeys.length,
          source: "admin_direct_edit",
          terminal_stage_at_edit: isTerminalAtEdit,
        } as any,
      } as any);
      const labels = changedKeys.map((k) => getAdminFieldLabel(k)).join(", ");
      const note = `Admin directly edited ${changedKeys.length} field${changedKeys.length === 1 ? "" : "s"}: ${labels}${isTerminalAtEdit ? " [on terminal-stage lead]" : ""}`;
      await supabase.from("lead_notes").insert({
        lead_id: leadId,
        note_type: "internal",
        note_text: note,
        created_by: appUser.id,
      });
    } catch (e) {
      console.error("[AddLead] Audit trail insert failed:", e);
    }
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
      source_sub_type: "add_lead",
      partner_id: effectivePartnerId!,
      partner_user_id: effectiveUserId!,
      current_stage: stage,
      current_status: status,
      source_type: "partner",
      duplicate_flag: hasDuplicateWarning,
    };

    const updateTargetId = editId ?? draftId ?? null;
    let resultLeadId: string | null = null;
    let opError: any = null;

    if (updateTargetId) {
      const updatePayload: any = { ...payload };
      delete updatePayload.partner_id;
      delete updatePayload.partner_user_id;
      delete updatePayload.source_type;
      delete updatePayload.source_sub_type;
      if (isEditMode) {
        delete updatePayload.current_stage;
        delete updatePayload.current_status;
      }
      if (!hasDuplicateWarning) delete updatePayload.duplicate_flag;

      // Admin-edit only: persist partner reassignment if changed.
      // When the partner org changes, also clear partner_user_id so we don't
      // leak the old org's user attribution onto the new org.
      if (isAdminForm && isEditMode && partnerIdAssignment && partnerIdAssignment !== originalPartnerId) {
        updatePayload.partner_id = partnerIdAssignment;
        updatePayload.partner_user_id = null;
      }
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
        await supabase.from("lead_notes").insert({
          lead_id: resultLeadId,
          note_type: "partner_visible",
          note_text: form.partner_remark.trim(),
          created_by: appUser!.id,
        });
      }

      await writeAdminAuditTrail(resultLeadId);

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

  const stepIndex = stepIds.findIndex((s) => s === activeStep);

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

  const backTarget = isAdminContext ? "/admin/leads" : "/leads";

  // Mode-aware navigation targets
  const studyNextTarget: StepId = isAdminForm ? "financial" : "notes";
  const notesBackTarget: StepId = isAdminForm ? "financial" : "study";
  const showAssignStep = isAdminForm && isEditMode;
  const notesNextTarget: StepId = showAssignStep ? "assign" : "review";
  const reviewBackTarget: StepId = showAssignStep ? "assign" : "notes";

  const selectedAssignedPartner = partnersList.find((p) => p.id === partnerIdAssignment);
  const partnerChanged = !!partnerIdAssignment && partnerIdAssignment !== originalPartnerId;
  const originalPartner = partnersList.find((p) => p.id === originalPartnerId);

  return (
    <div className={containerClassName ?? "max-w-4xl mx-auto space-y-5"}>
      {!hideOwnHeader && (
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(backTarget)}>
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
      )}

      {isTerminalEdit && (
        <Alert className="bg-amber-50 border-amber-200 text-amber-900 [&>svg]:text-amber-600">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            <strong>Terminal stage ({editLeadStage}):</strong> This lead has reached a terminal stage. Edits here will not re-open the lifecycle and may affect downstream reporting. Proceed only if you have a documented business reason.
          </AlertDescription>
        </Alert>
      )}

      {/* Step progress — mode-aware */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {steps.map((step, i) => {
          const Icon = step.icon;
          const isActive = step.id === activeStep;
          const isPast = i < stepIndex;
          return (
            <button
              key={step.id}
              onClick={() => goToStep(step.id as StepId)}
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

      <Tabs value={activeStep} onValueChange={(v) => goToStep(v as StepId)} className="space-y-5">
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
              {isEditMode && isAdmin && (
                <div className="space-y-2 md:col-span-2">
                  <Label>Country of Residence</Label>
                  <Select value={form.country_of_residence} onValueChange={(v) => set("country_of_residence", v)}>
                    <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
                    <SelectContent>{countries.map((c) => <SelectItem key={c.id} value={c.country_name}>{c.country_name}</SelectItem>)}</SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Captured later by the student portal if not set here.</p>
                </div>
              )}
            </CardContent>
          </Card>
          <div className="flex justify-end mt-4">
            <Button onClick={() => goToStep("study")}>Next: Study Intent →</Button>
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
                <Label>University (from list) *</Label>
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
                <Label>Or enter university name *</Label>
                <Input value={form.university_name_raw} onChange={(e) => {
                  set("university_name_raw", e.target.value);
                  if (form.university_id) set("university_id", "");
                }} placeholder="If not in the list above" />
                <p className="text-xs text-muted-foreground">Required — pick from list or type manually.</p>
              </div>
              <div className="space-y-2">
                <Label>Course (from list) *</Label>
                <Select value={form.course_name} onValueChange={(v) => set("course_name", v)}>
                  <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
                  <SelectContent>{courses.map((c) => <SelectItem key={c.id} value={c.course_name}>{c.course_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Or enter course name *</Label>
                <Input value={form.course_name_raw} onChange={(e) => {
                  set("course_name_raw", e.target.value);
                  if (form.course_name) set("course_name", "");
                }} placeholder="If not in the list above" />
                <p className="text-xs text-muted-foreground">Required — pick from list or type manually.</p>
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
              {/* Loan Amount — partner mode only here. Admin shows it in Financial Info. */}
              {!isAdminForm && (
                <div className="space-y-2 md:col-span-2">
                  <Label>Approx Loan Amount Required (₹) *</Label>
                  <Input type="number" min="0" value={form.loan_amount_required} onChange={(e) => set("loan_amount_required", e.target.value)} placeholder="e.g. 2500000" />
                  <p className="text-xs text-muted-foreground">Rough expectation — exact figure can be refined later by ops.</p>
                </div>
              )}
            </CardContent>
          </Card>
          <div className="flex justify-between mt-4">
            <Button variant="outline" onClick={() => goToStep("student")}>← Student Details</Button>
            <Button onClick={() => goToStep(studyNextTarget)}>
              Next: {studyNextTarget === "financial" ? "Financial Info" : "Notes"} →
            </Button>
          </div>
        </TabsContent>

        {/* Financial Info — admin mode only */}
        {isAdminForm && (
          <TabsContent value="financial" className="mt-0">
            <Card>
              <CardHeader><CardTitle className="text-lg">Financial Information</CardTitle></CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label>Approx Loan Amount Required (₹) *</Label>
                  <Input type="number" min="0" value={form.loan_amount_required} onChange={(e) => set("loan_amount_required", e.target.value)} placeholder="e.g. 2500000" />
                  <p className="text-xs text-muted-foreground">Rough expectation — exact figure can be refined later by ops.</p>
                </div>
                <div className="space-y-2">
                  <Label>Co-Applicant Name</Label>
                  <Input value={form.coapplicant_name} onChange={(e) => set("coapplicant_name", e.target.value)} placeholder="Full name" />
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
                <div className="space-y-2 md:col-span-2">
                  <Label>Co-Applicant Income (₹)</Label>
                  <Input type="number" min="0" value={form.coapplicant_income} onChange={(e) => set("coapplicant_income", e.target.value)} placeholder="Annual income (optional)" />
                  <p className="text-xs text-muted-foreground">Optional — can be refined later from documents.</p>
                </div>
                <div className="md:col-span-2 flex items-center gap-3 rounded-md border p-2.5">
                  <Switch checked={form.collateral_available} onCheckedChange={(v) => set("collateral_available", v)} />
                  <div>
                    <Label className="text-sm">Secured (collateral likely available)</Label>
                    <p className="text-[11px] text-muted-foreground">Off = unsecured preference. Detailed collateral info is collected later.</p>
                  </div>
                </div>
                {form.collateral_available && (
                  <div className="space-y-2 md:col-span-2">
                    <Label>Collateral Notes</Label>
                    <Textarea value={form.collateral_notes} onChange={(e) => set("collateral_notes", e.target.value)} placeholder="Type, est. value, location…" rows={2} />
                  </div>
                )}
              </CardContent>
            </Card>
            <div className="flex justify-between mt-4">
              <Button variant="outline" onClick={() => goToStep("study")}>← Study Intent</Button>
              <Button onClick={() => goToStep("notes")}>Next: Notes →</Button>
            </div>
          </TabsContent>
        )}

        {/* Notes */}
        <TabsContent value="notes" className="mt-0">
          <Card>
            <CardHeader><CardTitle className="text-lg">Partner Notes</CardTitle></CardHeader>
            <CardContent className="grid gap-4">
              <div className="space-y-2">
                <Label>{isAdminForm ? "Admin / Partner Remark" : "Partner Remark"}</Label>
                <Textarea value={form.partner_remark} onChange={(e) => set("partner_remark", e.target.value)} placeholder="Any additional context for the operations team..." rows={3} />
              </div>

              {/* Partner mode only: optional co-applicant context — collapsed by default */}
              {!isAdminForm && (
                <Collapsible open={coAppOpen} onOpenChange={setCoAppOpen}>
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between rounded-md border bg-muted/40 px-3 py-2 text-left text-xs font-medium hover:bg-muted/60 transition-colors"
                    >
                      <span>Co-applicant context (optional)</span>
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform ${coAppOpen ? "rotate-180" : ""}`} />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-3">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Co-Applicant Name</Label>
                        <Input value={form.coapplicant_name} onChange={(e) => set("coapplicant_name", e.target.value)} />
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
                      <div className="md:col-span-2 flex items-center gap-3 rounded-md border p-2.5">
                        <Switch checked={form.collateral_available} onCheckedChange={(v) => set("collateral_available", v)} />
                        <div>
                          <Label className="text-sm">Secured (collateral likely available)</Label>
                          <p className="text-[11px] text-muted-foreground">Off = unsecured preference. Detailed collateral info is collected later.</p>
                        </div>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </CardContent>
          </Card>
          <div className="flex justify-between mt-4">
            <Button variant="outline" onClick={() => goToStep(notesBackTarget)}>
              ← {notesBackTarget === "financial" ? "Financial Info" : "Study Intent"}
            </Button>
            <Button onClick={() => goToStep(notesNextTarget)}>
              Next: {notesNextTarget === "assign" ? "Assign to Partner" : "Review & Submit"} →
            </Button>
          </div>
        </TabsContent>

        {/* Assign to Partner — admin edit only */}
        {showAssignStep && (
          <TabsContent value="assign" className="mt-0">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" /> Assign to Partner
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Partner organization</Label>
                  <Popover open={partnerPickerOpen} onOpenChange={setPartnerPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={partnerPickerOpen}
                        className={cn(
                          "w-full justify-between font-normal h-9",
                          !selectedAssignedPartner && "text-muted-foreground"
                        )}
                      >
                        <span className="truncate">
                          {selectedAssignedPartner
                            ? `${selectedAssignedPartner.display_name} (${selectedAssignedPartner.partner_code})`
                            : "Search & select a partner organization…"}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search partner by name or code…" />
                        <CommandList>
                          <CommandEmpty>No partners match that search.</CommandEmpty>
                          <CommandGroup>
                            {partnersList.map((p) => (
                              <CommandItem
                                key={p.id}
                                value={`${p.display_name} ${p.partner_code}`}
                                onSelect={() => {
                                  setPartnerIdAssignment(p.id);
                                  setIsDirty(true);
                                  setPartnerPickerOpen(false);
                                }}
                              >
                                <Check className={cn("mr-2 h-4 w-4", partnerIdAssignment === p.id ? "opacity-100" : "opacity-0")} />
                                <span className="truncate">{p.display_name}</span>
                                <span className="ml-2 text-xs text-muted-foreground">{p.partner_code}</span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <p className="text-xs text-muted-foreground">
                    Reassigning moves this lead to a different partner organization. The change is logged in the audit trail.
                    This is a direct admin action and does not trigger the partner edit-request workflow.
                  </p>
                </div>
                {partnerChanged && (
                  <Alert className="bg-amber-50 border-amber-200 text-amber-900 [&>svg]:text-amber-600">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      Saving will reassign this lead to <strong>{selectedAssignedPartner?.display_name}</strong> and clear the original
                      partner-user attribution to prevent cross-org leakage.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
            <div className="flex justify-between mt-4">
              <Button variant="outline" onClick={() => goToStep("notes")}>← Notes</Button>
              <Button onClick={() => goToStep("review")}>Next: Review & Submit →</Button>
            </div>
          </TabsContent>
        )}


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
              </div>
              <div>
                <Badge variant="outline" className="mb-2">Study Intent</Badge>
                <ReviewRow label="Study Country" value={form.intended_study_country} />
                <ReviewRow label="University" value={resolvedUniversityName} />
                <ReviewRow label="Course" value={resolvedCourseName} />
                <ReviewRow label="Intake" value={`${form.intake_term} ${form.intake_year || ""}`} />
                {!isAdminForm && (
                  <ReviewRow label="Approx Loan Amount (₹)" value={form.loan_amount_required ? `₹${Number(form.loan_amount_required).toLocaleString("en-IN")}` : undefined} />
                )}
              </div>
              {/* Admin: dedicated Financial Info group, always rendered */}
              {isAdminForm && (
                <div>
                  <Badge variant="outline" className="mb-2">Financial Info</Badge>
                  <ReviewRow label="Approx Loan Amount (₹)" value={form.loan_amount_required ? `₹${Number(form.loan_amount_required).toLocaleString("en-IN")}` : undefined} />
                  <ReviewRow label="Co-Applicant" value={form.coapplicant_name} />
                  <ReviewRow label="Relation" value={form.coapplicant_relation} />
                  <ReviewRow label="Co-Applicant Income (₹)" value={form.coapplicant_income ? `₹${Number(form.coapplicant_income).toLocaleString("en-IN")}` : undefined} />
                  <ReviewRow label="Collateral" value={form.collateral_available} />
                  {form.collateral_available && <ReviewRow label="Collateral Notes" value={form.collateral_notes} />}
                </div>
              )}
              {/* Partner: keep conditional co-applicant context block */}
              {!isAdminForm && (form.coapplicant_name || form.coapplicant_relation || form.collateral_available) && (
                <div>
                  <Badge variant="outline" className="mb-2">Co-applicant context</Badge>
                  <ReviewRow label="Co-Applicant" value={form.coapplicant_name} />
                  <ReviewRow label="Relation" value={form.coapplicant_relation} />
                  <ReviewRow label="Secured preference" value={form.collateral_available} />
                </div>
              )}
              {form.partner_remark && (
                <div>
                  <Badge variant="outline" className="mb-2">Notes</Badge>
                  <ReviewRow label={isAdminForm ? "Admin / Partner Remark" : "Partner Remark"} value={form.partner_remark} />
                </div>
              )}
              {showAssignStep && (
                <div>
                  <Badge variant="outline" className="mb-2">Partner Assignment</Badge>
                  <ReviewRow
                    label="Assigned Partner"
                    value={selectedAssignedPartner ? `${selectedAssignedPartner.display_name} (${selectedAssignedPartner.partner_code})` : (partnerIdAssignment || "—")}
                  />
                  {partnerChanged && (
                    <ReviewRow
                      label="Previous Partner"
                      value={originalPartner ? `${originalPartner.display_name} (${originalPartner.partner_code})` : (originalPartnerId ?? "—")}
                    />
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-3 justify-between sticky bottom-4 bg-background/80 backdrop-blur p-3 rounded-lg border">
            <Button variant="outline" onClick={() => goToStep(reviewBackTarget)}>
              ← Back to {reviewBackTarget === "assign" ? "Assign" : "Edit"}
            </Button>
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
        onClose={() => navigate(isAdminContext ? "/admin/leads" : "/leads")}
      />
    </div>
  );
}
