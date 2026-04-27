import { useEffect, useState, useCallback, useMemo, useRef } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DuplicateWarningDialog } from "@/components/leads/DuplicateWarningDialog";
import { LeadSuccessDialog } from "@/components/leads/LeadSuccessDialog";
import { toast } from "sonner";
import { ArrowLeft, FileText, User, GraduationCap, MessageSquare, Eye, AlertTriangle, ChevronDown, Wallet, Building2, Check, ChevronsUpDown, Info } from "lucide-react";
import { HorizontalStepper } from "@/components/shared/HorizontalStepper";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { normalizePhone, isValidIndianPhone } from "@/lib/phone";
import { useRoleAccess } from "@/hooks/useRoleAccess";
import { computeAdminDiff, getAdminFieldLabel } from "@/lib/adminEditableFields";
import { MoneyInput } from "@/components/ui/money-input";
import { MasterCombobox, type MasterOption } from "@/components/ui/master-combobox";
import { CollateralRadio, collateralBoolToState, collateralStateToBool, type CollateralState } from "@/components/shared/CollateralRadio";
import { usePincodeLookup } from "@/hooks/usePincodeLookup";
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

const PARTNER_STEPS: StepId[] = ["student", "study", "financial", "notes", "review"];
const ADMIN_STEPS: StepId[] = ["student", "study", "financial", "notes", "review"];
const ADMIN_EDIT_STEPS: StepId[] = ["student", "study", "financial", "notes", "assign", "review"];

const CO_APPLICANT_RELATIONS = [
  "Father", "Mother", "Spouse", "Guardian", "Brother", "Sister", "Uncle", "Other",
];

const EMPLOYMENT_TYPE_OPTIONS = [
  "Salaried",
  "Self-employed",
  "Business owner",
  "Retired",
  "Other",
];

// Highest-qualification options come from the master table (admin-managed) with
// a hard-coded fallback. See `useHighestQualificationOptions`.
import { useHighestQualificationOptions } from "@/hooks/useHighestQualificationOptions";

const TERMINAL_STAGES = ["disbursed", "rejected", "dropped"];

/**
 * Compare two country labels case-insensitively, ignoring surrounding whitespace.
 * `universities_master.country` and `countries_master.country_name` both store
 * full display names (e.g. "United States", "United Kingdom"), so a normalized
 * string compare is the correct match — there is no ISO code in the universities
 * table to translate to. The earlier name→ISO map produced an empty result set
 * because no `universities_master.country` row matches "US" / "GB" / etc.
 */
function sameCountryName(a: string | null | undefined, b: string | null | undefined): boolean {
  const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();
  return norm(a) === norm(b);
}

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
  const { options: QUALIFICATIONS } = useHighestQualificationOptions();
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
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);

  const [form, setForm] = useState({
    student_first_name: "",
    student_last_name: "",
    student_email: "",
    student_phone: "",
    student_whatsapp: "",
    whatsapp_same_as_phone: false,
    city: "",
    state: "",
    district: "",
    tier: "",
    pincode: "",
    country_of_residence: "",
    intended_study_country: "",
    intake_term: "",
    intake_year: 0,
    course_name: "",
    course_id: "",
    course_name_raw: "",
    university_name_raw: "",
    university_id: "",
    highest_qualification: "",
    marks_gpa: "",
    loan_amount_required: "",
    coapplicant_name: "",
    coapplicant_relation: "",
    coapplicant_mobile: "",
    coapplicant_income: "",
    coapplicant_income_source: "",
    coapplicant_employment_type: "",
    coapplicant_employer: "",
    coapplicant_existing_emi: "",
    collateral_state: "unsure" as CollateralState,
    collateral_notes: "",
    partner_remark: "",
    // Academic Profile (aligned with Bulk Upload)
    tenth_score: "",
    twelfth_score: "",
    graduation_score: "",
    highest_qualification_score: "",
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
      const hydratedPhone = stripPrefix(data.student_phone);
      const hydratedWhats = stripPrefix(data.student_whatsapp);
      setForm({
        student_first_name: data.student_first_name ?? "",
        student_last_name: data.student_last_name ?? "",
        student_email: data.student_email ?? "",
        student_phone: hydratedPhone,
        student_whatsapp: hydratedWhats,
        whatsapp_same_as_phone: !!data.whatsapp_same_as_phone || (!!hydratedWhats && hydratedWhats === hydratedPhone),
        city: data.city ?? "",
        state: data.state ?? "",
        district: (data as any).district ?? "",
        tier: (data as any).tier ?? "",
        pincode: data.pincode ?? "",
        country_of_residence: data.country_of_residence ?? "",
        intended_study_country: data.intended_study_country ?? "",
        intake_term: data.intake_term ?? "",
        intake_year: data.intake_year ?? 0,
        course_name: data.course_name ?? "",
        course_id: "",
        course_name_raw: "",
        university_name_raw: data.university_name_raw ?? "",
        university_id: data.university_id ?? "",
        loan_amount_required: data.loan_amount_required != null ? String(data.loan_amount_required) : "",
        coapplicant_name: data.coapplicant_name ?? "",
        coapplicant_relation: data.coapplicant_relation ?? "",
        coapplicant_mobile: stripPrefix((data as any).coapplicant_mobile ?? ""),
        coapplicant_income: data.coapplicant_income != null ? String(data.coapplicant_income) : "",
        coapplicant_income_source: (data as any).coapplicant_income_source ?? "",
        coapplicant_employment_type: (data as any).coapplicant_employment_type ?? "",
        coapplicant_employer: (data as any).coapplicant_employer ?? "",
        coapplicant_existing_emi: data.coapplicant_existing_emi != null ? String(data.coapplicant_existing_emi) : "",
        collateral_state: collateralBoolToState(data.collateral_available),
        collateral_notes: data.collateral_notes ?? "",
        highest_qualification: (data as any).highest_qualification ?? "",
        marks_gpa: (data as any).marks_gpa ?? "",
        partner_remark: "",
        tenth_score: ((data as any).test_scores?.tenth ?? "").toString(),
        twelfth_score: ((data as any).test_scores?.twelfth ?? "").toString(),
        graduation_score: ((data as any).test_scores?.graduation ?? "").toString(),
        highest_qualification_score: ((data as any).test_scores?.highest_qualification_score ?? "").toString(),
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

  const setMany = (patch: Partial<typeof form>) => {
    setIsDirty(true);
    setForm((prev) => ({ ...prev, ...patch }));
  };

  // Pincode auto-fill (only fires when 6 digits entered).
  // CRITICAL: If pincode changes to one that doesn't match (invalid or not-found),
  // clear district/state/tier we previously auto-filled — never carry forward stale.
  const pincodeResult = usePincodeLookup(form.pincode);
  const lastAppliedPincode = useRef<{
    pincode: string;
    district: string | null;
    state: string | null;
    tier: string | null;
  } | null>(null);
  useEffect(() => {
    const current = (form.pincode ?? "").trim();

    // Apply on a fresh successful match
    if (
      pincodeResult.found &&
      pincodeResult.pincode === current &&
      current.length === 6 &&
      lastAppliedPincode.current?.pincode !== current
    ) {
      setForm((prev) => {
        const prevApplied = lastAppliedPincode.current;
        // Only overwrite fields that are blank OR still hold the previously auto-filled value
        const overwriteIfOurs = (cur: string, was: string | null, next: string | null) =>
          (!cur || (prevApplied && cur === was)) && next ? next : cur;
        const nextDistrict = overwriteIfOurs(prev.district, prevApplied?.district ?? null, pincodeResult.district);
        const nextState = overwriteIfOurs(prev.state, prevApplied?.state ?? null, pincodeResult.state);
        const nextTier = overwriteIfOurs(prev.tier, prevApplied?.tier ?? null, pincodeResult.tier);
        lastAppliedPincode.current = {
          pincode: current,
          district: nextDistrict,
          state: nextState,
          tier: nextTier,
        };
        return { ...prev, district: nextDistrict, state: nextState, tier: nextTier };
      });
      return;
    }

    // Pincode changed away from the last applied one → clear stale autofill if invalid/not-found
    const prev = lastAppliedPincode.current;
    if (prev && prev.pincode !== current) {
      const newIsInvalid =
        current.length !== 6 ||
        (pincodeResult.found === false && pincodeResult.pincode === current);
      if (newIsInvalid) {
        setForm((p) => ({
          ...p,
          district: prev.district && p.district === prev.district ? "" : p.district,
          state: prev.state && p.state === prev.state ? "" : p.state,
          tier: prev.tier && p.tier === prev.tier ? "" : p.tier,
        }));
        if (current.length !== 6) lastAppliedPincode.current = null;
      }
    }
  }, [pincodeResult, form.pincode]);

  // Master combobox options
  // Universities master stores `country` as the full display name (e.g. "United States",
  // "United Kingdom") — same shape as `countries_master.country_name`. The previous
  // implementation incorrectly translated the form value to an ISO code (US, GB, …)
  // and tried to match against that, which produced an empty list for every country.
  // Compare the names directly (case-insensitive, trimmed). When no country is selected,
  // show the full master list so the user still sees options.
  const universityOptions: MasterOption[] = useMemo(() => {
    const country = (form.intended_study_country ?? "").trim();
    const filtered = country
      ? universities.filter((u) => sameCountryName(u.country, country))
      : universities;
    return filtered.map((u) => ({ id: u.id, label: u.university_name, hint: u.country }));
  }, [universities, form.intended_study_country]);

  const courseOptions: MasterOption[] = useMemo(
    () => courses.map((c) => ({ id: c.id, label: c.course_name, hint: c.course_category ?? undefined })),
    [courses],
  );

  const fullName = `${form.student_first_name.trim()} ${form.student_last_name.trim()}`.trim();
  const resolvedCourseName = form.course_name || form.course_name_raw.trim();
  const resolvedUniversityName = form.university_name_raw.trim() || (form.university_id ? universities.find((u) => u.id === form.university_id)?.university_name : "") || "";

  const isTerminalEdit = isEditMode && editLeadStage && TERMINAL_STAGES.includes(editLeadStage);

  type ValidationFailure = { message: string; step: StepId; field?: string };
  const validate = (isDraft: boolean): ValidationFailure | null => {
    if (!form.student_first_name.trim()) return { message: "Student first name is required", step: "student", field: "student_first_name" };
    if (!form.student_phone.trim()) return { message: "Mobile number is required", step: "student", field: "student_phone" };
    if (!isValidIndianPhone(form.student_phone)) return { message: "Mobile must be a valid 10-digit Indian number (with or without +91)", step: "student", field: "student_phone" };
    if (form.student_email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.student_email.trim())) return { message: "Email format is invalid", step: "student", field: "student_email" };

    if (!isDraft) {
      if (!form.intended_study_country) return { message: "Intended study country is required", step: "study", field: "intended_study_country" };
      if (!resolvedUniversityName.trim()) return { message: "University is required (pick from list or type manually)", step: "study", field: "university" };
      if (!resolvedCourseName) return { message: "Course is required (pick from list or type manually)", step: "study", field: "course" };
      if (!form.intake_term) return { message: "Intake term is required", step: "study", field: "intake_term" };
      if (!form.intake_year) return { message: "Intake year is required", step: "study", field: "intake_year" };

      // Academic Profile — mandatory: highest qualification, 10th score, 12th score.
      if (!form.highest_qualification) return { message: "Highest qualification is required", step: "study", field: "highest_qualification" };
      if (!form.tenth_score.trim()) return { message: "10th score is required", step: "study", field: "tenth_score" };
      if (!form.twelfth_score.trim()) return { message: "12th score is required", step: "study", field: "twelfth_score" };

      // Financial Info — required in BOTH partner and admin modes (restored).
      if (!form.loan_amount_required) return { message: "Approx loan amount is required", step: "financial", field: "loan_amount_required" };
      if (isNaN(Number(form.loan_amount_required)) || Number(form.loan_amount_required) <= 0)
        return { message: "Loan amount must be a positive number", step: "financial", field: "loan_amount_required" };
      if (!form.coapplicant_name.trim()) return { message: "Co-applicant name is required", step: "financial", field: "coapplicant_name" };
      if (!form.coapplicant_mobile.trim()) return { message: "Co-applicant mobile is required", step: "financial", field: "coapplicant_mobile" };
      if (!isValidIndianPhone(form.coapplicant_mobile)) return { message: "Co-applicant mobile must be a valid 10-digit Indian number", step: "financial", field: "coapplicant_mobile" };
      // NOTE: coapplicant_income_source removed from UI per scoped form-fix pass.
      // Existing DB values are preserved on save; the field is no longer captured.
      if (!form.coapplicant_employment_type) return { message: "Employment type is required", step: "financial", field: "coapplicant_employment_type" };
      if (!form.coapplicant_employer.trim()) return { message: "Employer / occupation is required", step: "financial", field: "coapplicant_employer" };
      if (!form.coapplicant_income || Number(form.coapplicant_income) <= 0)
        return { message: "Monthly income is required", step: "financial", field: "coapplicant_income" };
      if (form.coapplicant_existing_emi === "" || isNaN(Number(form.coapplicant_existing_emi)) || Number(form.coapplicant_existing_emi) < 0)
        return { message: "Existing EMI is required (enter 0 if none)", step: "financial", field: "coapplicant_existing_emi" };
    }

    if (!effectivePartnerId) return { message: "No partner organization found for your account. Admins can use 'Test as Partner' in the sidebar.", step: stepIds[0] };
    return null;
  };

  /**
   * Per-step required-field gate used by Next buttons.
   * Reuses `validate(false)` and only flags failures that belong to the CURRENT step.
   * - Save as Draft must remain lenient: callers MUST NOT invoke this for draft saves.
   * - Submit on the Review step is still gated by the existing full `validate()` call
   *   inside `handleSubmit`.
   */
  const guardStep = (step: StepId): boolean => {
    const failure = validate(false);
    if (failure && failure.step === step) {
      toast.error(failure.message);
      goToFieldAndFocus(failure.step, failure.field);
      return false;
    }
    return true;
  };
  const goNextFrom = (current: StepId, target: StepId) => {
    if (!guardStep(current)) return;
    goToStep(target);
  };

  // Helper used by review-step nudges: jump to a step and try to focus the missing field.
  const goToFieldAndFocus = useCallback(
    (step: StepId, field?: string) => {
      goToStep(step);
      if (!field) return;
      // Defer until after tab content mounts/becomes visible.
      setTimeout(() => {
        const el = document.querySelector<HTMLElement>(`[data-field="${field}"]`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          const focusable = el.querySelector<HTMLElement>("input, textarea, select, button");
          (focusable ?? el).focus?.();
        }
      }, 80);
    },
    [goToStep],
  );

  const handleSubmit = async (asDraft: boolean) => {
    const err = validate(asDraft);
    if (err) {
      toast.error(err.message);
      goToFieldAndFocus(err.step, err.field);
      return;
    }

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
    const effectiveWhatsapp = form.whatsapp_same_as_phone
      ? (normalizePhone(form.student_phone) ?? form.student_phone.trim())
      : (form.student_whatsapp.trim() ? (normalizePhone(form.student_whatsapp) ?? form.student_whatsapp.trim()) : null);
    const edited: Record<string, unknown> = {
      student_first_name: form.student_first_name.trim() || null,
      student_last_name: form.student_last_name.trim() || null,
      student_email: form.student_email.trim() || null,
      student_phone: normalizePhone(form.student_phone) ?? form.student_phone.trim() ?? null,
      student_whatsapp: effectiveWhatsapp,
      whatsapp_same_as_phone: form.whatsapp_same_as_phone,
      city: form.city.trim() || null,
      state: form.state.trim() || null,
      district: form.district.trim() || null,
      tier: form.tier.trim() || null,
      pincode: form.pincode.trim() || null,
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
      coapplicant_mobile: form.coapplicant_mobile.trim() ? (normalizePhone(form.coapplicant_mobile) ?? form.coapplicant_mobile.trim()) : null,
      coapplicant_income: form.coapplicant_income ? Number(form.coapplicant_income) : null,
      coapplicant_income_source: form.coapplicant_income_source || null,
      coapplicant_employment_type: form.coapplicant_employment_type || null,
      coapplicant_employer: form.coapplicant_employer.trim() || null,
      coapplicant_existing_emi: form.coapplicant_existing_emi !== "" ? Number(form.coapplicant_existing_emi) : null,
      collateral_available: collateralStateToBool(form.collateral_state),
      collateral_notes: form.collateral_state === "likely" ? (form.collateral_notes.trim() || null) : null,
      highest_qualification: form.highest_qualification || null,
      marks_gpa: form.marks_gpa.trim() || null,
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

  /**
   * Build the merged test_scores JSONB to write back to student_leads.
   *
   * Critical: this MUST preserve any existing keys we don't manage in this
   * form (e.g. IELTS / TOEFL / Duolingo / GRE / GMAT entered via the student
   * portal) so the AddLead/Admin edit surface never wipes them out.
   *
   * Numeric scores are stored as numbers when parseable; otherwise as the raw
   * trimmed string. Empty inputs are omitted (we never write empty strings).
   */
  const buildMergedTestScores = useCallback(() => {
    const existing = (originalLead?.test_scores && typeof originalLead.test_scores === "object")
      ? { ...(originalLead.test_scores as Record<string, unknown>) }
      : {};
    const setOrDelete = (key: string, raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed) {
        delete existing[key];
        return;
      }
      const num = Number(trimmed);
      existing[key] = Number.isFinite(num) && trimmed !== "" && !isNaN(num) ? num : trimmed;
    };
    setOrDelete("tenth", form.tenth_score);
    setOrDelete("twelfth", form.twelfth_score);
    setOrDelete("graduation", form.graduation_score);
    setOrDelete("highest_qualification_score", form.highest_qualification_score);
    return existing;
  }, [originalLead, form.tenth_score, form.twelfth_score, form.graduation_score, form.highest_qualification_score]);

  const createLead = async (asDraft: boolean, hasDuplicateWarning: boolean) => {
    setSubmitting(true);
    setShowDupDialog(false);

    const stage = asDraft ? "draft" as const : "submitted" as const;
    const status = asDraft ? "in_progress" as const : "awaiting_verification" as const;

    const effectiveWhatsapp = form.whatsapp_same_as_phone
      ? (normalizePhone(form.student_phone) ?? form.student_phone.trim())
      : (form.student_whatsapp.trim() ? (normalizePhone(form.student_whatsapp) ?? form.student_whatsapp.trim()) : null);

    const mergedTestScores = buildMergedTestScores();

    const payload = {
      student_first_name: form.student_first_name.trim(),
      student_last_name: form.student_last_name.trim() || null,
      student_email: form.student_email.trim() || null,
      student_phone: normalizePhone(form.student_phone) ?? form.student_phone.trim(),
      student_whatsapp: effectiveWhatsapp,
      whatsapp_same_as_phone: form.whatsapp_same_as_phone,
      city: form.city.trim() || null,
      state: form.state.trim() || null,
      district: form.district.trim() || null,
      tier: form.tier.trim() || null,
      pincode: form.pincode.trim() || null,
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
      coapplicant_mobile: form.coapplicant_mobile.trim() ? (normalizePhone(form.coapplicant_mobile) ?? form.coapplicant_mobile.trim()) : null,
      coapplicant_income: form.coapplicant_income ? Number(form.coapplicant_income) : null,
      coapplicant_income_source: form.coapplicant_income_source || null,
      coapplicant_employment_type: form.coapplicant_employment_type || null,
      coapplicant_employer: form.coapplicant_employer.trim() || null,
      coapplicant_existing_emi: form.coapplicant_existing_emi !== "" ? Number(form.coapplicant_existing_emi) : null,
      collateral_available: collateralStateToBool(form.collateral_state),
      collateral_notes: form.collateral_state === "likely" ? (form.collateral_notes.trim() || null) : null,
      highest_qualification: form.highest_qualification || null,
      marks_gpa: form.marks_gpa.trim() || null,
      test_scores: mergedTestScores,
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

      // Admin-edit only: ALWAYS write partner_id back so the assignment persists across
      // save → refresh → reopen edit. Sourced from the picker, falling back to the
      // hydrated original so we never accidentally null out a partner. We only skip
      // when the partners list hasn't loaded yet (avoids racing with hydration).
      if (isAdminForm && isEditMode && partnersList.length > 0) {
        const targetPartnerId = partnerIdAssignment || originalPartnerId || null;
        if (targetPartnerId) {
          updatePayload.partner_id = targetPartnerId;
          // If the partner ORG changed, drop the old org's user attribution so it
          // doesn't leak across organizations.
          if (targetPartnerId !== originalPartnerId) {
            updatePayload.partner_user_id = null;
          }
        }
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
      const { data, error } = await supabase.from("student_leads").insert(payload as any).select("id").single();
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
      // Re-anchor the original partner id so subsequent saves in the same
      // session compute the change-correctly and the UI reflects persisted state.
      if (isAdminForm && isEditMode && updateTargetId) {
        const persistedPartnerId = partnerIdAssignment || originalPartnerId || null;
        if (persistedPartnerId) setOriginalPartnerId(persistedPartnerId);
      }
      setShowSuccess(true);
    }

    setSubmitting(false);
  };

  // Drop past intake years from the picker. We keep historical values flowing
  // through edit-mode hydration (the saved value still renders on Review), but
  // the dropdown should only offer current/future intakes for new selections.
  const currentYear = new Date().getFullYear();
  const futureIntakes = intakes.filter((i) => i.intake_year >= currentYear);
  const intakeTerms = [...new Set(futureIntakes.map((i) => i.intake_term))];
  const intakeYears = [...new Set(futureIntakes.map((i) => i.intake_year))].sort();



  /**
   * Review row.
   * - If `value` is missing AND a `nudgeStep` is provided, render the missing slot as a
   *   clickable "Please provide details" link that jumps the user back to the relevant
   *   step (and field) so they can fix it without scrolling/hunting.
   * - Optional fields (no nudge) just render an em-dash.
   */
  const ReviewRow = ({
    label,
    value,
    nudgeStep,
    nudgeField,
  }: {
    label: string;
    value: string | number | boolean | null | undefined;
    nudgeStep?: StepId;
    nudgeField?: string;
  }) => {
    const display = value === true ? "Yes" : value === false ? "No" : value;
    const isMissing = display === undefined || display === null || display === "" || display === 0;
    return (
      <div className="flex justify-between py-1.5 border-b border-border/50 last:border-0">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-sm font-medium text-right max-w-[60%]">
          {isMissing ? (
            nudgeStep ? (
              <button
                type="button"
                onClick={() => goToFieldAndFocus(nudgeStep, nudgeField)}
                className="text-primary underline-offset-2 hover:underline"
              >
                Please provide details →
              </button>
            ) : (
              <span className="text-muted-foreground">—</span>
            )
          ) : (
            <span className="text-foreground">{display as React.ReactNode}</span>
          )}
        </span>
      </div>
    );
  };

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

      {/* Step progress — horizontal stepper (PR 5). Visual swap of the prior tab pill strip;
          state machine unchanged: goToStep + activeStep + Tabs value still drive content. */}
      <HorizontalStepper
        steps={steps.map((s) => ({ id: s.id, label: s.label }))}
        activeId={activeStep}
        onStepClick={(id) => goToStep(id as StepId)}
      />

      <Tabs value={activeStep} onValueChange={(v) => goToStep(v as StepId)} className="space-y-5">
        {/* Student Details */}
        <TabsContent value="student" forceMount className="mt-0 data-[state=inactive]:hidden">
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
              <div className="space-y-2">
                <Label>Mobile Number *</Label>
                <Input
                  value={form.student_phone}
                  onChange={(e) => set("student_phone", e.target.value.replace(/\D/g, "").slice(0, 10))}
                  placeholder="10-digit mobile (without +91)"
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={form.student_email} onChange={(e) => set("student_email", e.target.value)} placeholder="student@email.com" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="whatsapp-same"
                    checked={form.whatsapp_same_as_phone}
                    onCheckedChange={(v) => {
                      const checked = !!v;
                      setMany({
                        whatsapp_same_as_phone: checked,
                        student_whatsapp: checked ? form.student_phone : form.student_whatsapp,
                      });
                    }}
                  />
                  <Label htmlFor="whatsapp-same" className="text-sm font-normal cursor-pointer">
                    WhatsApp same as primary mobile
                  </Label>
                </div>
                <Input
                  value={form.whatsapp_same_as_phone ? form.student_phone : form.student_whatsapp}
                  onChange={(e) => set("student_whatsapp", e.target.value.replace(/\D/g, "").slice(0, 10))}
                  placeholder="10-digit WhatsApp number"
                  inputMode="numeric"
                  disabled={form.whatsapp_same_as_phone}
                  className={form.whatsapp_same_as_phone ? "bg-muted" : ""}
                />
              </div>
              <div className="space-y-2">
                <Label>Pincode</Label>
                <Input
                  value={form.pincode}
                  onChange={(e) => set("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="6-digit pincode"
                  inputMode="numeric"
                />
                {form.pincode.length === 6 && pincodeResult.found === false && (
                  <p className="text-[11px] text-muted-foreground">We couldn't match this pincode. Please confirm District and State manually.</p>
                )}
                {pincodeResult.hasConflict && (
                  <p className="text-[11px] text-amber-700 flex items-center gap-1">
                    <Info className="h-3 w-3" /> Please verify District and State — this pincode maps to more than one location.
                  </p>
                )}
                {!pincodeResult.hasConflict && pincodeResult.found && form.pincode.length === 6 && (
                  <p className="text-[11px] text-muted-foreground">Location details auto-filled. You can edit if needed.</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>District</Label>
                <Input value={form.district} onChange={(e) => set("district", e.target.value)} placeholder="Auto-fills from pincode" />
              </div>
              <div className="space-y-2">
                <Label>State</Label>
                <Input value={form.state} onChange={(e) => set("state", e.target.value)} placeholder="Auto-fills from pincode" />
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
            <Button onClick={() => goNextFrom("student", "study")}>Next: Study Intent →</Button>
          </div>
        </TabsContent>

        {/* Study Intent */}
        <TabsContent value="study" forceMount className="mt-0 data-[state=inactive]:hidden">
          <Card>
            <CardHeader><CardTitle className="text-lg">Education & Study Intent</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2" data-field="intended_study_country">
                <Label>Intended Study Country *</Label>
                <Popover open={countryPickerOpen} onOpenChange={setCountryPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={countryPickerOpen}
                      className={cn(
                        "w-full justify-between font-normal h-10",
                        !form.intended_study_country && "text-muted-foreground",
                      )}
                    >
                      <span className="truncate text-left">
                        {form.intended_study_country || "Search & select intended country…"}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Type a country name…" />
                      <CommandList>
                        <CommandEmpty>No countries match that search.</CommandEmpty>
                        <CommandGroup>
                          {countries.map((c) => (
                            <CommandItem
                              key={c.id}
                              value={c.country_name}
                              onSelect={() => {
                                // Switching country must clear stale university selection
                                // (master id + manual fallback) so partners aren't shown a
                                // university from a different country in review.
                                setMany({
                                  intended_study_country: c.country_name,
                                  university_id: "",
                                  university_name_raw: "",
                                });
                                setCountryPickerOpen(false);
                              }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", form.intended_study_country === c.country_name ? "opacity-100" : "opacity-0")} />
                              <span className="truncate">{c.country_name}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2 md:col-span-2" data-field="university">
                <Label>University *</Label>
                <MasterCombobox
                  options={universityOptions}
                  selectedId={form.university_id}
                  manualValue={form.university_id ? "" : form.university_name_raw}
                  onSelectMaster={(opt) => setMany({ university_id: opt.id, university_name_raw: opt.label })}
                  onSelectManual={() => setMany({ university_id: "", university_name_raw: form.university_name_raw })}
                  onChangeManual={(t) => setMany({ university_id: "", university_name_raw: t })}
                  placeholder={form.intended_study_country ? `Search universities in ${form.intended_study_country}…` : "Pick a country first to filter universities"}
                  helperText="Search the master list, or pick 'Not available in list' to type manually."
                  manualPlaceholder="Type the university name"
                />
              </div>
              <div className="space-y-2 md:col-span-2" data-field="course">
                <Label>Course *</Label>
                <MasterCombobox
                  options={courseOptions}
                  selectedId={form.course_id}
                  manualValue={form.course_id ? "" : form.course_name}
                  onSelectMaster={(opt) => setMany({ course_id: opt.id, course_name: opt.label })}
                  onSelectManual={() => setMany({ course_id: "", course_name: form.course_name })}
                  onChangeManual={(t) => setMany({ course_id: "", course_name: t })}
                  placeholder="Search courses…"
                  helperText="Search the master list, or pick 'Not available in list' to type manually."
                  manualPlaceholder="Type the course name"
                />
              </div>
              <div className="space-y-2" data-field="intake_term">
                <Label>Intake Term *</Label>
                <Select value={form.intake_term} onValueChange={(v) => set("intake_term", v)}>
                  <SelectTrigger><SelectValue placeholder="Select term" /></SelectTrigger>
                  <SelectContent>{intakeTerms.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2" data-field="intake_year">
                <Label>Intake Year *</Label>
                <Select value={form.intake_year ? String(form.intake_year) : ""} onValueChange={(v) => set("intake_year", Number(v))}>
                  <SelectTrigger><SelectValue placeholder="Select year" /></SelectTrigger>
                  <SelectContent>{intakeYears.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {/* Loan Amount intentionally moved to the Financial Info step in both modes. */}
            </CardContent>
          </Card>

          {/* Academic Profile — placed AFTER Education & Study Intent and BEFORE financial step.
              Aligned with Bulk Upload columns: highest_qualification, highest_qualification_score,
              10th_score, 12th_score, graduation_score. */}
          <Card className="mt-4">
            <CardHeader><CardTitle className="text-lg">Academic Profile</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2" data-field="highest_qualification">
                <Label>Highest Qualification *</Label>
                <Select
                  value={form.highest_qualification}
                  onValueChange={(v) => set("highest_qualification", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select qualification" />
                  </SelectTrigger>
                  <SelectContent>
                    {QUALIFICATIONS.map((q) => (
                      <SelectItem key={q} value={q}>{q}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2" data-field="highest_qualification_score">
                <Label>Highest Qualification Score</Label>
                <Input
                  value={form.highest_qualification_score}
                  onChange={(e) => set("highest_qualification_score", e.target.value)}
                  placeholder="e.g. 8.5 CGPA or 78%"
                />
              </div>
              <div className="space-y-2" data-field="tenth_score">
                <Label>10th Score *</Label>
                <Input
                  value={form.tenth_score}
                  onChange={(e) => set("tenth_score", e.target.value)}
                  placeholder="e.g. 85%"
                />
              </div>
              <div className="space-y-2" data-field="twelfth_score">
                <Label>12th Score *</Label>
                <Input
                  value={form.twelfth_score}
                  onChange={(e) => set("twelfth_score", e.target.value)}
                  placeholder="e.g. 88%"
                />
              </div>
              <div className="space-y-2 md:col-span-2" data-field="graduation_score">
                <Label>Graduation Score</Label>
                <Input
                  value={form.graduation_score}
                  onChange={(e) => set("graduation_score", e.target.value)}
                  placeholder="e.g. 7.8 CGPA or 75%"
                />
                <p className="text-xs text-muted-foreground">
                  10th and 12th are required. Graduation and Highest Qualification Score are optional.
                </p>
              </div>

              {/* Read-only academic context for student-origin leads in admin edit mode */}
              {isAdminForm && isEditMode && originalLead?.source_type === "student_direct" && (
                (originalLead?.marks_gpa || originalLead?.test_scores) && (
                  <div className="md:col-span-2 rounded-md border bg-muted/30 p-3 space-y-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">From student portal (read-only)</p>
                    <div className="grid gap-1 text-xs sm:grid-cols-2">
                      {originalLead?.marks_gpa ? <div><span className="text-muted-foreground">Marks / GPA: </span>{String(originalLead.marks_gpa)}</div> : null}
                      {originalLead?.test_scores && typeof originalLead.test_scores === "object" && Object.keys(originalLead.test_scores as object).length > 0 ? (
                        <div className="sm:col-span-2"><span className="text-muted-foreground">Test scores: </span>{Object.entries(originalLead.test_scores as Record<string, unknown>).map(([k, v]) => `${k.toUpperCase()}: ${v}`).join(" · ")}</div>
                      ) : null}
                    </div>
                  </div>
                )
              )}
            </CardContent>
          </Card>

          <div className="flex justify-between mt-4">
            <Button variant="outline" onClick={() => goToStep("student")}>← Student Details</Button>
            <Button onClick={() => goNextFrom("study", studyNextTarget)}>
              Next: {studyNextTarget === "financial" ? "Financial Info" : "Notes"} →
            </Button>
          </div>
        </TabsContent>

        {/* Financial Info — required step in BOTH partner and admin modes */}
        <TabsContent value="financial" forceMount className="mt-0 data-[state=inactive]:hidden">
          <Card>
            <CardHeader><CardTitle className="text-lg">Financial Information</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2" data-field="loan_amount_required">
                <Label>Approx Loan Amount Required (₹) *</Label>
                <MoneyInput value={form.loan_amount_required} onChange={(d) => set("loan_amount_required", d)} placeholder="e.g. 25,00,000" />
                <p className="text-xs text-muted-foreground">Rough expectation — exact figure can be refined later by ops.</p>
              </div>
              <div className="space-y-2" data-field="coapplicant_name">
                <Label>Co-Applicant Name *</Label>
                <Input value={form.coapplicant_name} onChange={(e) => set("coapplicant_name", e.target.value)} placeholder="Full name" />
                <p className="text-xs text-muted-foreground">Name as per Aadhaar and Passport</p>
              </div>
              <div className="space-y-2" data-field="coapplicant_mobile">
                <Label>Co-Applicant Mobile *</Label>
                <Input
                  value={form.coapplicant_mobile}
                  onChange={(e) => set("coapplicant_mobile", e.target.value.replace(/\D/g, "").slice(0, 10))}
                  placeholder="10-digit mobile (without +91)"
                  inputMode="numeric"
                />
                <p className="text-xs text-muted-foreground">Number as per Aadhaar and Passport</p>
              </div>
              <div className="space-y-2" data-field="coapplicant_relation">
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
              {/* Income Source field removed from UI per scoped form-fix pass.
                  Existing DB values are preserved on save (form state still hydrates +
                  writes the value back) so legacy records are not wiped. */}
              <div className="space-y-2" data-field="coapplicant_employment_type">
                <Label>Employment Type *</Label>
                <Select value={form.coapplicant_employment_type} onValueChange={(v) => set("coapplicant_employment_type", v)}>
                  <SelectTrigger><SelectValue placeholder="Select employment type" /></SelectTrigger>
                  <SelectContent>
                    {EMPLOYMENT_TYPE_OPTIONS.map((o) => (
                      <SelectItem key={o} value={o}>{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2" data-field="coapplicant_employer">
                <Label>Employer / Occupation *</Label>
                <Input value={form.coapplicant_employer} onChange={(e) => set("coapplicant_employer", e.target.value)} placeholder="Company / occupation" />
              </div>
              <div className="space-y-2" data-field="coapplicant_income">
                <Label>Monthly Income (₹) *</Label>
                <MoneyInput value={form.coapplicant_income} onChange={(d) => set("coapplicant_income", d)} placeholder="e.g. 1,25,000" />
              </div>
              <div className="space-y-2" data-field="coapplicant_existing_emi">
                <Label>Existing EMI (₹) *</Label>
                <MoneyInput value={form.coapplicant_existing_emi} onChange={(d) => set("coapplicant_existing_emi", d)} placeholder="Enter 0 if none" />
              </div>
              <div className="md:col-span-2">
                <CollateralRadio
                  state={form.collateral_state}
                  notes={form.collateral_notes}
                  onChangeState={(s) => set("collateral_state", s)}
                  onChangeNotes={(n) => set("collateral_notes", n)}
                  idPrefix="financial-coll"
                />
              </div>
            </CardContent>
          </Card>
          <div className="flex justify-between mt-4">
            <Button variant="outline" onClick={() => goToStep("study")}>← Study Intent</Button>
            <Button onClick={() => goNextFrom("financial", "notes")}>Next: Notes →</Button>
          </div>
        </TabsContent>

        {/* Notes */}
        <TabsContent value="notes" forceMount className="mt-0 data-[state=inactive]:hidden">
          <Card>
            <CardHeader><CardTitle className="text-lg">Partner Notes</CardTitle></CardHeader>
            <CardContent className="grid gap-4">
              <div className="space-y-2">
                <Label>{isAdminForm ? "Admin / Partner Remark" : "Partner Remark"}</Label>
                <Textarea value={form.partner_remark} onChange={(e) => set("partner_remark", e.target.value)} placeholder="Any additional context for the operations team..." rows={3} />
                <p className="text-xs text-muted-foreground">Optional — leave blank if no additional context.</p>
              </div>
            </CardContent>
          </Card>
          <div className="flex justify-between mt-4">
            <Button variant="outline" onClick={() => goToStep(notesBackTarget)}>
              ← {notesBackTarget === "financial" ? "Financial Info" : "Study Intent"}
            </Button>
            <Button onClick={() => goNextFrom("notes", notesNextTarget)}>
              Next: {notesNextTarget === "assign" ? "Assign to Partner" : "Review & Submit"} →
            </Button>
          </div>
        </TabsContent>

        {/* Assign to Partner — admin edit only */}
        {showAssignStep && (
          <TabsContent value="assign" forceMount className="mt-0 data-[state=inactive]:hidden">
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
                          "w-full justify-between font-normal h-10",
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
                  {originalPartner && !partnerChanged && (
                    <p className="text-xs text-muted-foreground">
                      Currently assigned to <strong className="text-foreground">{originalPartner.display_name}</strong>. Pick a different partner above to reassign.
                    </p>
                  )}
                  {!originalPartner && (
                    <p className="text-xs text-muted-foreground">
                      Select the partner organization this lead should belong to.
                    </p>
                  )}
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
              <Button onClick={() => goNextFrom("assign", "review")}>Next: Review & Submit →</Button>
            </div>
          </TabsContent>
        )}


        {/* Review */}
        <TabsContent value="review" forceMount className="mt-0 space-y-4 data-[state=inactive]:hidden">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Eye className="h-5 w-5" /> Review Lead Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Badge variant="outline" className="mb-2">Student Details</Badge>
                <ReviewRow label="Name" value={fullName} nudgeStep="student" nudgeField="student_first_name" />
                <ReviewRow label="Phone" value={form.student_phone} nudgeStep="student" nudgeField="student_phone" />
                <ReviewRow label="Email" value={form.student_email} />
                <ReviewRow label="WhatsApp" value={form.student_whatsapp} />
                <ReviewRow label="City" value={form.city} />
                <ReviewRow label="State" value={form.state} />
              </div>
              <div>
                <Badge variant="outline" className="mb-2">Study Intent</Badge>
                <ReviewRow label="Study Country" value={form.intended_study_country} nudgeStep="study" nudgeField="intended_study_country" />
                <ReviewRow label="University" value={resolvedUniversityName} nudgeStep="study" nudgeField="university" />
                <ReviewRow label="Course" value={resolvedCourseName} nudgeStep="study" nudgeField="course" />
                <ReviewRow
                  label="Intake"
                  value={form.intake_term && form.intake_year ? `${form.intake_term} ${form.intake_year}` : ""}
                  nudgeStep="study"
                  nudgeField="intake_term"
                />
              </div>
              <div>
                <Badge variant="outline" className="mb-2">Academic Profile</Badge>
                <ReviewRow label="Highest Qualification" value={form.highest_qualification} nudgeStep="study" nudgeField="highest_qualification" />
                <ReviewRow label="Highest Qualification Score" value={form.highest_qualification_score} />
                <ReviewRow label="10th Score" value={form.tenth_score} nudgeStep="study" nudgeField="tenth_score" />
                <ReviewRow label="12th Score" value={form.twelfth_score} nudgeStep="study" nudgeField="twelfth_score" />
                <ReviewRow label="Graduation Score" value={form.graduation_score} />
                {form.marks_gpa ? <ReviewRow label="Marks / GPA (legacy)" value={form.marks_gpa} /> : null}
              </div>
              {/* Financial Info — required group, rendered for both partner and admin modes */}
              <div>
                <Badge variant="outline" className="mb-2">Financial Info</Badge>
                <ReviewRow
                  label="Approx Loan Amount (₹)"
                  value={form.loan_amount_required ? `₹${Number(form.loan_amount_required).toLocaleString("en-IN")}` : ""}
                  nudgeStep="financial"
                  nudgeField="loan_amount_required"
                />
                <ReviewRow label="Co-Applicant Name" value={form.coapplicant_name} nudgeStep="financial" nudgeField="coapplicant_name" />
                <ReviewRow label="Mobile Number" value={form.coapplicant_mobile} nudgeStep="financial" nudgeField="coapplicant_mobile" />
                <ReviewRow label="Relation" value={form.coapplicant_relation} />
                {/* Income Source review row removed — field no longer captured in UI. */}
                <ReviewRow label="Employment Type" value={form.coapplicant_employment_type} nudgeStep="financial" nudgeField="coapplicant_employment_type" />
                <ReviewRow label="Employer / Occupation" value={form.coapplicant_employer} nudgeStep="financial" nudgeField="coapplicant_employer" />
                <ReviewRow
                  label="Monthly Income (₹)"
                  value={form.coapplicant_income ? `₹${Number(form.coapplicant_income).toLocaleString("en-IN")}` : ""}
                  nudgeStep="financial"
                  nudgeField="coapplicant_income"
                />
                <ReviewRow
                  label="Existing EMI (₹)"
                  value={form.coapplicant_existing_emi !== "" ? `₹${Number(form.coapplicant_existing_emi).toLocaleString("en-IN")}` : ""}
                  nudgeStep="financial"
                  nudgeField="coapplicant_existing_emi"
                />
                <ReviewRow label="Collateral" value={form.collateral_state === "likely" ? "Likely" : form.collateral_state === "unlikely" ? "Unlikely" : "Not sure"} />
                {form.collateral_state === "likely" && form.collateral_notes && (
                  <ReviewRow label="Collateral Notes" value={form.collateral_notes} />
                )}
              </div>
              {form.partner_remark.trim() && (
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
                    value={selectedAssignedPartner ? `${selectedAssignedPartner.display_name} (${selectedAssignedPartner.partner_code})` : "—"}
                  />
                  {partnerChanged && originalPartner && (
                    <ReviewRow
                      label="Previous Partner"
                      value={`${originalPartner.display_name} (${originalPartner.partner_code})`}
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
