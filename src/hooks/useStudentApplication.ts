import { useState, useCallback, useEffect } from "react";
import { useStudentAuth } from "@/hooks/useStudentAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { parseCoappWorkExpShorthand } from "@/lib/academicScore";
import { getEnabledLevels, getMirroredHighestQual } from "@/lib/academicLevelCascade";

export interface StudentFormData {
  // Basic
  student_full_name: string;
  student_first_name: string;
  student_last_name: string;
  student_email: string;
  student_phone: string;
  student_whatsapp: string;
  whatsapp_same_as_phone: boolean;
  student_dob: string;
  student_gender: string;
  city: string;
  state: string;
  district: string;
  tier: string;
  pincode: string;
  /** Auto-derived from pincode (India-only master). Always "India" when set. */
  country_of_residence: string;
  intended_study_country: string;
  course_category: string;
  loan_amount_required: string;
  // Education
  highest_qualification: string;
  marks_gpa: string;
  course_name: string;
  university_name_raw: string;
  university_id: string;
  course_id: string;
  intake_term: string;
  intake_year: string;
  test_scores: {
    ielts?: string;
    toefl?: string;
    duolingo?: string;
    /** PTE Academic — optional English proficiency score. */
    pte?: string;
    gre?: string;
    gmat?: string;
    // Academic Profile (aligned with Bulk Upload):
    tenth?: string;
    twelfth?: string;
    graduation?: string;
    highest_qualification_score?: string;
    // Total Marks / Scale denominators for academic scores.
    tenth_total?: string;
    twelfth_total?: string;
    graduation_total?: string;
    highest_qualification_total?: string;
    // Extended (Student portal only — persisted in test_scores JSONB):
    coapplicant_age?: string;
    /** @deprecated CIBIL is no longer collected; historical values may exist
     *  in DB but are never read by BRE. Kept for back-compat type safety. */
    coapplicant_cibil?: string;
    work_experience_years?: string;
    coapplicant_work_experience_years?: string;
    coapplicant_work_experience_months?: string;
  };
  // Co-applicant
  coapplicant_name: string;
  coapplicant_relation: string;
  coapplicant_mobile: string;
  coapplicant_email: string;
  coapplicant_income: string;
  coapplicant_employment_type: string;
  coapplicant_employer: string;
  coapplicant_existing_emi: string;
  collateral_available: boolean | null;
  collateral_notes: string;
  coapplicant_income_source: string;
}

const EMPTY_FORM: StudentFormData = {
  student_full_name: "", student_first_name: "", student_last_name: "",
  student_email: "", student_phone: "",
  student_whatsapp: "", whatsapp_same_as_phone: false,
  student_dob: "", student_gender: "", city: "", state: "", district: "", tier: "", pincode: "",
  country_of_residence: "",
  intended_study_country: "", course_category: "", loan_amount_required: "",
  highest_qualification: "", marks_gpa: "", course_name: "",
  university_name_raw: "", university_id: "", course_id: "", intake_term: "", intake_year: "",
  test_scores: {},
  coapplicant_name: "", coapplicant_relation: "", coapplicant_mobile: "",
  coapplicant_email: "", coapplicant_income: "", coapplicant_employment_type: "",
  coapplicant_employer: "", coapplicant_existing_emi: "",
  collateral_available: null, collateral_notes: "",
  coapplicant_income_source: "",
};

export type StepKey = "basic" | "education" | "coapplicant" | "review";

export interface StepCompletion {
  basic: boolean;
  education: boolean;
  coapplicant: boolean;
  submitted: boolean;
}

/** Centralized step-completion logic. Used by both continue page and form pages.
 *  Step 1 (basic) is considered complete as soon as we have a name + phone + intended country.
 *  Email is preferred but NOT required — partner-originated leads commonly lack email and
 *  must not be reset back to step 1 when the student logs in to continue.
 */
export function deriveStepCompletion(lead: any): StepCompletion {
  if (!lead) return { basic: false, education: false, coapplicant: false, submitted: false };

  const hasName = !!(lead.student_first_name || lead.student_full_name);
  const hasPhone = !!lead.student_phone;
  const hasCountry = !!lead.intended_study_country;
  const basic = hasName && hasPhone && hasCountry;

  const education = !!lead.course_name && lead.course_name !== "Not specified" && !!lead.intake_term && !!lead.intake_year;
  const coapplicant = !!lead.coapplicant_name && !!lead.coapplicant_relation;
  const submitted = lead.current_stage !== "draft";

  return { basic, education, coapplicant, submitted };
}

export function deriveCurrentStep(completion: StepCompletion): number {
  if (completion.submitted) return 4;
  if (completion.coapplicant) return 3; // ready for review
  if (completion.education) return 2; // ready for coapplicant
  if (completion.basic) return 1; // ready for education
  return 0; // start at basic
}

const DRAFT_KEY_PREFIX = "student_form_draft:";
const draftKeyFor = (phone: string | null | undefined) =>
  phone ? `${DRAFT_KEY_PREFIX}${phone}` : null;

/** Wipe every phone-scoped draft from sessionStorage. Used on logout / phone mismatch. */
export function clearAllStudentDrafts() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && (k.startsWith(DRAFT_KEY_PREFIX) || k === "student_form_draft")) keys.push(k);
    }
    keys.forEach((k) => sessionStorage.removeItem(k));
  } catch { /* ignore */ }
}

export function useStudentApplication() {
  const { phone, leads, isVerified, refreshLeads } = useStudentAuth();
  const [formData, setFormData] = useState<StudentFormData>(() => {
    // Start empty by default. Hydration is phone-scoped and runs in an effect below.
    return { ...EMPTY_FORM };
  });
  const [leadId, setLeadId] = useState<string | null>(leads?.[0]?.id || null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  // On phone change: hard-reset state, then hydrate ONLY this phone's draft (if any).
  useEffect(() => {
    if (!phone) {
      setFormData({ ...EMPTY_FORM });
      return;
    }
    const key = draftKeyFor(phone);
    if (!key) return;
    const saved = sessionStorage.getItem(key);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Defensive: if persisted draft was for a different phone, ignore.
        if (parsed && (!parsed.student_phone || parsed.student_phone === phone || parsed.student_phone === phone.slice(-10))) {
          setFormData({ ...EMPTY_FORM, ...parsed });
          return;
        }
      } catch { /* ignore */ }
    }
    setFormData({ ...EMPTY_FORM });
  }, [phone]);

  // Persist draft to phone-scoped sessionStorage on change
  useEffect(() => {
    const key = draftKeyFor(phone);
    if (!key) return;
    sessionStorage.setItem(key, JSON.stringify(formData));
  }, [formData, phone]);

  // Load existing lead from server when phone+verified is ready
  useEffect(() => {
    if (!phone || !isVerified) return;
    loadFromServer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone, isVerified]);

  const loadFromServer = useCallback(async () => {
    if (!phone) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("student-application", {
        body: { action: "load", phone },
      });
      if (error) throw error;
      if (data?.lead) {
        setLeadId(data.lead.id);
        populateFormFromLead(data.lead);
      }
    } catch (err: any) {
      console.warn("Failed to load application:", err.message);
    } finally {
      setLoading(false);
    }
  }, [phone]);

  const populateFormFromLead = (lead: any) => {
    const ts = lead.test_scores || {};
    setFormData(prev => ({
      ...prev,
      student_full_name: lead.student_full_name || lead.student_first_name || prev.student_full_name,
      student_first_name: lead.student_first_name || prev.student_first_name,
      student_last_name: lead.student_last_name || prev.student_last_name,
      student_email: lead.student_email || prev.student_email,
      student_phone: lead.student_phone || prev.student_phone,
      student_whatsapp: lead.student_whatsapp || prev.student_whatsapp,
      whatsapp_same_as_phone: lead.whatsapp_same_as_phone ?? prev.whatsapp_same_as_phone,
      student_dob: lead.student_dob || prev.student_dob,
      student_gender: lead.student_gender || prev.student_gender,
      city: lead.city || prev.city,
      state: lead.state || prev.state,
      district: lead.district || prev.district,
      tier: lead.tier || prev.tier,
      pincode: lead.pincode || prev.pincode,
      intended_study_country: lead.intended_study_country || prev.intended_study_country,
      course_category: lead.course_category || prev.course_category,
      loan_amount_required: lead.loan_amount_required?.toString() || prev.loan_amount_required,
      highest_qualification: lead.highest_qualification || prev.highest_qualification,
      marks_gpa: lead.marks_gpa || prev.marks_gpa,
      course_name: (lead.course_name && lead.course_name !== "Not specified") ? lead.course_name : prev.course_name,
      university_name_raw: lead.university_name_raw || prev.university_name_raw,
      university_id: lead.university_id || prev.university_id,
      course_id: lead.course_id || prev.course_id,
      intake_term: lead.intake_term || prev.intake_term,
      intake_year: lead.intake_year?.toString() || prev.intake_year,
      test_scores: {
        ielts: ts.ielts?.toString() || prev.test_scores.ielts || "",
        toefl: ts.toefl?.toString() || prev.test_scores.toefl || "",
        duolingo: ts.duolingo?.toString() || prev.test_scores.duolingo || "",
        pte: ts.pte?.toString() || prev.test_scores.pte || "",
        gre: ts.gre?.toString() || prev.test_scores.gre || "",
        gmat: ts.gmat?.toString() || prev.test_scores.gmat || "",
        tenth: ts.tenth?.toString() || prev.test_scores.tenth || "",
        twelfth: ts.twelfth?.toString() || prev.test_scores.twelfth || "",
        graduation: ts.graduation?.toString() || prev.test_scores.graduation || "",
        highest_qualification_score: ts.highest_qualification_score?.toString() || prev.test_scores.highest_qualification_score || "",
        tenth_total: ts.tenth_total?.toString() || prev.test_scores.tenth_total || "",
        twelfth_total: ts.twelfth_total?.toString() || prev.test_scores.twelfth_total || "",
        graduation_total: ts.graduation_total?.toString() || prev.test_scores.graduation_total || "",
        highest_qualification_total: ts.highest_qualification_total?.toString() || prev.test_scores.highest_qualification_total || "",
        coapplicant_age: ts.coapplicant_age?.toString() || prev.test_scores.coapplicant_age || "",
        coapplicant_cibil: ts.coapplicant_cibil?.toString() || prev.test_scores.coapplicant_cibil || "",
        work_experience_years: ts.work_experience_years !== undefined && ts.work_experience_years !== null
          ? ts.work_experience_years.toString()
          : (prev.test_scores.work_experience_years || ""),
        coapplicant_work_experience_years: ts.coapplicant_work_experience_years !== undefined && ts.coapplicant_work_experience_years !== null
          ? ts.coapplicant_work_experience_years.toString()
          : (prev.test_scores.coapplicant_work_experience_years || ""),
        coapplicant_work_experience_months: ts.coapplicant_work_experience_months !== undefined && ts.coapplicant_work_experience_months !== null
          ? ts.coapplicant_work_experience_months.toString()
          : (prev.test_scores.coapplicant_work_experience_months || ""),
      },
      coapplicant_name: lead.coapplicant_name || prev.coapplicant_name,
      coapplicant_relation: lead.coapplicant_relation || prev.coapplicant_relation,
      coapplicant_mobile: lead.coapplicant_mobile || prev.coapplicant_mobile,
      coapplicant_email: lead.coapplicant_email || prev.coapplicant_email,
      coapplicant_income: lead.coapplicant_income?.toString() || prev.coapplicant_income,
      coapplicant_employment_type: lead.coapplicant_employment_type || prev.coapplicant_employment_type,
      coapplicant_employer: lead.coapplicant_employer || prev.coapplicant_employer,
      coapplicant_existing_emi: lead.coapplicant_existing_emi?.toString() || prev.coapplicant_existing_emi,
      collateral_available: lead.collateral_available ?? prev.collateral_available,
      collateral_notes: lead.collateral_notes || prev.collateral_notes,
      coapplicant_income_source: lead.coapplicant_income_source || prev.coapplicant_income_source,
    }));
  };

  const saveStep = useCallback(async (
    action: "save_basic" | "save_education" | "save_coapplicant" | "submit",
    options?: { coapplicantWorkExperience?: string },
  ) => {
    if (!phone) return null;
    setSaving(true);
    try {
      let payload: Record<string, unknown> = {};

      if (action === "save_basic") {
        // If "same as primary phone" is checked, mirror primary into whatsapp on save.
        const primaryDigits = (formData.student_phone || phone || "").replace(/\D/g, "").slice(-10);
        const whatsappToSend = formData.whatsapp_same_as_phone
          ? primaryDigits
          : (formData.student_whatsapp || "").replace(/\D/g, "").slice(-10);

        payload = {
          student_full_name: formData.student_full_name,
          student_email: formData.student_email,
          student_whatsapp: whatsappToSend || null,
          whatsapp_same_as_phone: !!formData.whatsapp_same_as_phone,
          student_dob: formData.student_dob || null,
          student_gender: formData.student_gender || null,
          city: formData.city || null,
          state: formData.state || null,
          district: formData.district || null,
          tier: formData.tier || null,
          pincode: formData.pincode || null,
          intended_study_country: formData.intended_study_country,
          course_category: formData.course_category || null,
          loan_amount_required: formData.loan_amount_required || null,
          country_of_residence: "India",
        };
      } else if (action === "save_education") {
        // CRITICAL: build the merged scores object so we never overwrite
        // existing IELTS/TOEFL/Duolingo/GRE/GMAT keys when academic-only
        // fields change, and vice-versa.
        // Academic levels are gated by the highest-qualification cascade
        // (src/lib/academicLevelCascade.ts). Disabled levels are EXCLUDED
        // from the payload; the Highest Qualification pair is auto-mirrored
        // from the matching source level (12th or Graduation) when disabled.
        const enabledLevels = getEnabledLevels(formData.highest_qualification);
        const mirroredHQ = getMirroredHighestQual(formData.highest_qualification, {
          tenth: formData.test_scores.tenth || "",
          tenth_total: formData.test_scores.tenth_total || "",
          twelfth: formData.test_scores.twelfth || "",
          twelfth_total: formData.test_scores.twelfth_total || "",
          graduation: formData.test_scores.graduation || "",
          graduation_total: formData.test_scores.graduation_total || "",
        });
        const scoresStr: Record<string, string | undefined> = {
          ielts: formData.test_scores.ielts,
          toefl: formData.test_scores.toefl,
          duolingo: formData.test_scores.duolingo,
          pte: formData.test_scores.pte,
          gre: formData.test_scores.gre,
          gmat: formData.test_scores.gmat,
          tenth: enabledLevels.tenth ? formData.test_scores.tenth : undefined,
          twelfth: enabledLevels.twelfth ? formData.test_scores.twelfth : undefined,
          graduation: enabledLevels.graduation ? formData.test_scores.graduation : undefined,
          highest_qualification_score: enabledLevels.highest_qualification
            ? formData.test_scores.highest_qualification_score
            : mirroredHQ.score,
          // Total marks denominators (new — optional, BRE-aware).
          tenth_total: enabledLevels.tenth ? formData.test_scores.tenth_total : undefined,
          twelfth_total: enabledLevels.twelfth ? formData.test_scores.twelfth_total : undefined,
          graduation_total: enabledLevels.graduation ? formData.test_scores.graduation_total : undefined,
          highest_qualification_total: enabledLevels.highest_qualification
            ? formData.test_scores.highest_qualification_total
            : mirroredHQ.total,
          work_experience_years: formData.test_scores.work_experience_years,
        };
        const scores: Record<string, number | string> = {};
        for (const [k, raw] of Object.entries(scoresStr)) {
          const trimmed = (raw ?? "").toString().trim();
          if (!trimmed) continue;
          const num = parseFloat(trimmed);
          // Numeric scores stored as numbers; non-numeric (e.g. "85%") preserved as strings.
          scores[k] = Number.isFinite(num) && !isNaN(num) && /^[\d.+-]+$/.test(trimmed) ? num : trimmed;
        }

        payload = {
          highest_qualification: formData.highest_qualification || null,
          marks_gpa: formData.marks_gpa || null,
          course_name: formData.course_name || "Not specified",
          course_id: formData.course_id || null,
          course_category: formData.course_category || null,
          university_name_raw: formData.university_name_raw || null,
          university_id: formData.university_id || null,
          intake_term: formData.intake_term || "Fall",
          intake_year: formData.intake_year ? parseInt(formData.intake_year) : new Date().getFullYear() + 1,
          test_scores: scores,
        };
      } else if (action === "save_coapplicant") {
        // Co-applicant Age persists from THIS step via test_scores_extension.
        // CIBIL is intentionally NOT persisted anymore (universally excluded
        // from BRE). Historical values remain untouched in the DB.
        const ext: Record<string, number | string> = {};
        const ageRaw = (formData.test_scores.coapplicant_age ?? "").toString().trim();
        if (ageRaw) {
          const n = parseInt(ageRaw, 10);
          if (Number.isFinite(n)) ext.coapplicant_age = n;
        }
        // Co-applicant Work Experience (years/months) — feeds BRE
        // coapplicant.income_stability_years. Use numeric-validity checks so
        // explicit "0" is preserved (NOT dropped).
        const cwOverride = options?.coapplicantWorkExperience;
        if (cwOverride !== undefined) {
          const parsed = parseCoappWorkExpShorthand(cwOverride);
          if (parsed) {
            ext.coapplicant_work_experience_years = parsed.years;
            ext.coapplicant_work_experience_months = parsed.months;
          }
        } else {
          const cwYearsRaw = (formData.test_scores.coapplicant_work_experience_years ?? "").toString().trim();
          if (cwYearsRaw !== "") {
            const n = parseInt(cwYearsRaw, 10);
            if (Number.isFinite(n) && n >= 0) ext.coapplicant_work_experience_years = n;
          }
          const cwMonthsRaw = (formData.test_scores.coapplicant_work_experience_months ?? "").toString().trim();
          if (cwMonthsRaw !== "") {
            const n = parseInt(cwMonthsRaw, 10);
            if (Number.isFinite(n) && n >= 0 && n <= 11) ext.coapplicant_work_experience_months = n;
          }
        }

        // NOTE: coapplicant_employer and coapplicant_existing_emi are
        // intentionally omitted from the payload — historical values in the
        // DB are preserved unchanged; new leads simply do not write them.
        payload = {
          coapplicant_name: formData.coapplicant_name || null,
          coapplicant_relation: formData.coapplicant_relation || null,
          coapplicant_mobile: formData.coapplicant_mobile || null,
          coapplicant_email: formData.coapplicant_email || null,
          coapplicant_income: formData.coapplicant_income || null,
          coapplicant_income_source: formData.coapplicant_income_source || null,
          coapplicant_employment_type: formData.coapplicant_employment_type || null,
          collateral_available: formData.collateral_available,
          collateral_notes: formData.collateral_notes || null,
          test_scores_extension: ext,
        };
      }

      const { data, error } = await supabase.functions.invoke("student-application", {
        body: { action, phone, lead_id: leadId, data: payload },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.lead) {
        setLeadId(data.lead.id);
      }

      // After successful submit: clear this phone's draft and push fresh leads to context
      if (action === "submit" && data?.lead) {
        const key = draftKeyFor(phone);
        if (key) sessionStorage.removeItem(key);
        try { await refreshLeads?.(); } catch { /* best-effort */ }
      }

      return data?.lead || null;
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message || "Please try again.", variant: "destructive" });
      return null;
    } finally {
      setSaving(false);
    }
  }, [phone, leadId, formData, refreshLeads]);

  const updateField = useCallback((field: keyof StudentFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const updateTestScore = useCallback((key: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      test_scores: { ...prev.test_scores, [key]: value },
    }));
  }, []);

  return {
    formData,
    updateField,
    updateTestScore,
    saveStep,
    leadId,
    saving,
    loading,
    loadFromServer,
  };
}
