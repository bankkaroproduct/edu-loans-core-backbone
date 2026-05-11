import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  action: "save_basic" | "save_education" | "save_coapplicant" | "submit" | "load" | "load_recommendations" | "load_documents" | "load_tracker";
  phone: string;
  lead_id?: string;
  data?: Record<string, unknown>;
}

const STUDENT_DIRECT_PARTNER_ID = "00000000-0000-0000-0000-000000000001";

// Unsafe keywords for remark sanitization
const UNSAFE_KEYWORDS = ["internal", "ops", "escalat", "partner", "commission", "payout", "admin", "agent"];

function sanitizeRemark(remark: string | null): string | null {
  if (!remark) return null;
  const lower = remark.toLowerCase();
  if (UNSAFE_KEYWORDS.some(kw => lower.includes(kw))) {
    return "Please upload a corrected version of this document.";
  }
  return remark;
}

// ─── Numeric sanitation for test_scores JSONB ────────────────────────────────
// Strips any non-numeric value (e.g. "wjjrjrj") for keys that are expected to
// be numeric. Free-text keys (e.g. raw_text) are passed through unchanged.
// Mirror of src/lib/numericValidation.ts but inlined for edge runtime.
const STRICT_NUMERIC = /^\d+(\.\d{1,3})?$/;
const NUMERIC_TEST_SCORE_KEYS = new Set([
  "tenth", "tenth_total",
  "twelfth", "twelfth_total",
  "graduation", "graduation_total",
  "highest_qualification_score", "highest_qualification_total",
  "ielts", "toefl", "pte", "duolingo", "gre", "gmat", "sat",
  "work_experience_years",
  "coapplicant_age",
  "coapplicant_work_experience_years",
  "coapplicant_work_experience_months",
]);

function sanitizeNumericTestScores(input: Record<string, unknown>): {
  cleaned: Record<string, unknown>;
  invalidKeys: string[];
} {
  const cleaned: Record<string, unknown> = {};
  const invalidKeys: string[] = [];
  for (const [k, v] of Object.entries(input ?? {})) {
    if (!NUMERIC_TEST_SCORE_KEYS.has(k)) {
      cleaned[k] = v;
      continue;
    }
    if (v === null || v === undefined || v === "") continue;
    const s = String(v).replace(/,/g, "").trim();
    if (!STRICT_NUMERIC.test(s)) {
      invalidKeys.push(k);
      continue;
    }
    cleaned[k] = Number(s);
  }
  return { cleaned, invalidKeys };
}

// Normalize phone to canonical +91XXXXXXXXXX form (mirrors DB normalize_phone()).
function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  const digits = String(input).replace(/\D/g, "");
  let local = digits;
  if (local.length === 12 && local.startsWith("91")) local = local.slice(2);
  if (local.length !== 10) return null;
  return `+91${local}`;
}

// Resolve lead by canonical phone and optionally verify lead_id ownership.
// Always uses the normalized form — DB rows are stored normalized via trigger.
async function resolveLead(supabaseAdmin: any, cleanPhone: string, leadId?: string) {
  const canonical = normalizePhone(cleanPhone) ?? cleanPhone;

  if (leadId) {
    const { data: lead, error } = await supabaseAdmin
      .from("student_leads")
      .select("*")
      .eq("id", leadId)
      .single();

    if (error || !lead) return { lead: null, error: "Lead not found" };

    const leadCanonical = normalizePhone(lead.student_phone);
    if (leadCanonical !== canonical) {
      return { lead: null, error: "Phone does not match this application" };
    }
    return { lead, error: null };
  }

  const { data: leads, error } = await supabaseAdmin
    .from("student_leads")
    .select("*")
    .eq("student_phone", canonical)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (error) return { lead: null, error: error.message };
  return { lead: leads?.[0] || null, error: null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Handle multipart upload_document separately
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      return await handleUploadDocument(req, supabaseAdmin);
    }

    const body: RequestBody = await req.json();
    const { action, phone, lead_id, data } = body;

    // Validate phone
    if (!phone || !/^\+91\d{10}$/.test(phone.replace(/\s/g, ""))) {
      return jsonResponse({ error: "Invalid or missing phone number" }, 400);
    }

    const cleanPhone = phone.replace(/\s/g, "");

    // --- LOAD ---
    if (action === "load") {
      const canonical = normalizePhone(cleanPhone) ?? cleanPhone;
      const { data: leads, error } = await supabaseAdmin
        .from("student_leads")
        .select("*")
        .eq("student_phone", canonical)
        .order("updated_at", { ascending: false })
        .limit(1);

      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse({ lead: leads?.[0] || null });
    }

    // --- LOAD RECOMMENDATIONS ---
    if (action === "load_recommendations") {
      const { lead, error: resolveErr } = await resolveLead(supabaseAdmin, cleanPhone, lead_id);
      if (resolveErr || !lead) return jsonResponse({ error: resolveErr || "No application found" }, lead_id ? 403 : 404);

      // Only show recommendations for submitted+ leads
      if (lead.current_stage === "draft") {
        return jsonResponse({ error: "Application not yet submitted" }, 400);
      }

      const { data: matches, error: matchErr } = await supabaseAdmin
        .from("lead_lender_matches")
        .select("id, fit_category, recommendation_rank, recommendation_reason_summary, score, lender_id")
        .eq("lead_id", lead.id)
        .order("recommendation_rank", { ascending: true });

      if (matchErr) return jsonResponse({ error: matchErr.message }, 500);

      // Filter out not_eligible
      const visibleMatches = (matches || []).filter((m: any) => m.fit_category !== "not_eligible");

      // Fetch lender details for visible matches
      const lenderIds = visibleMatches.map((m: any) => m.lender_id);
      let lenders: any[] = [];
      if (lenderIds.length > 0) {
        const { data: lenderData } = await supabaseAdmin
          .from("lenders")
          .select("id, lender_name, processing_time_days, supported_countries, loan_amount_min, loan_amount_max, supports_collateral, supports_unsecured")
          .in("id", lenderIds);
        lenders = lenderData || [];
      }

      // Build enriched cards (strip bre_output_json, never sent)
      const lenderMap = Object.fromEntries(lenders.map((l: any) => [l.id, l]));
      const recommendations = visibleMatches.map((m: any) => {
        const lender = lenderMap[m.lender_id] || {};
        // Generate student-friendly "why" bullets
        const whyBullets = generateWhyBullets(lender, lead);
        return {
          id: m.id,
          lender_name: lender.lender_name || "Lending Partner",
          fit_category: m.fit_category,
          fit_label: mapFitLabel(m.fit_category),
          reason_summary: m.recommendation_reason_summary,
          processing_time_days: lender.processing_time_days,
          why_bullets: whyBullets,
        };
      });

      // Also load document counts for provisional notice
      const { count: pendingDocs } = await supabaseAdmin
        .from("lead_document_requirements")
        .select("id", { count: "exact", head: true })
        .eq("lead_id", lead.id)
        .eq("required_flag", true)
        .in("status", ["not_uploaded", "rejected", "reupload_needed"]);

      return jsonResponse({
        recommendations,
        has_pending_docs: (pendingDocs || 0) > 0,
        total_matches: matches?.length || 0,
        visible_matches: visibleMatches.length,
        lead_summary: {
          id: lead.id,
          lead_id: lead.lead_id,
          intended_study_country: lead.intended_study_country,
          university_name_raw: lead.university_name_raw,
          course_name: lead.course_name,
          loan_amount_required: lead.loan_amount_required,
          intake_term: lead.intake_term,
          intake_year: lead.intake_year,
          coapplicant_name: lead.coapplicant_name,
          current_stage: lead.current_stage,
        },
      });
    }

    // --- LOAD DOCUMENTS ---
    if (action === "load_documents") {
      const { lead, error: resolveErr } = await resolveLead(supabaseAdmin, cleanPhone, lead_id);
      if (resolveErr || !lead) return jsonResponse({ error: resolveErr || "No application found" }, lead_id ? 403 : 404);

      // Fetch requirements with document master
      const { data: requirements, error: reqErr } = await supabaseAdmin
        .from("lead_document_requirements")
        .select("id, document_type_id, status, required_flag, remarks, due_date, document_master:document_type_id(id, document_name, document_code, document_category, description, applicable_for)")
        .eq("lead_id", lead.id);

      if (reqErr) return jsonResponse({ error: reqErr.message }, 500);

      // Fetch latest uploaded documents
      const { data: documents, error: docErr } = await supabaseAdmin
        .from("lead_documents")
        .select("id, document_type_id, file_name, uploaded_at, verification_status, verification_remark, version_number, is_latest, storage_path")
        .eq("lead_id", lead.id)
        .eq("is_latest", true);

      if (docErr) return jsonResponse({ error: docErr.message }, 500);

      // Build enriched list with sanitized remarks
      const docMap = new Map<string, any>();
      (documents || []).forEach((d: any) => {
        if (d.document_type_id) docMap.set(d.document_type_id, d);
      });

      const enrichedRequirements = (requirements || []).map((req: any) => {
        const doc = docMap.get(req.document_type_id);
        const safeRemark = sanitizeRemark(req.remarks);
        const safeVerificationRemark = doc ? sanitizeRemark(doc.verification_remark) : null;

        // For rejected/reupload with no remark, provide default
        const actionRemark = (req.status === "rejected" || req.status === "reupload_needed")
          ? (safeRemark || safeVerificationRemark || "Please upload a corrected version of this document.")
          : safeRemark;

        return {
          id: req.id,
          document_type_id: req.document_type_id,
          document_name: req.document_master?.document_name || "Document",
          document_code: req.document_master?.document_code || null,
          document_category: req.document_master?.document_category || null,
          applicable_for: (req.document_master as any)?.applicable_for || "student",
          description: req.document_master?.description || null,
          required: req.required_flag,
          status: req.status,
          student_status_label: mapDocStatusLabel(req.status),
          remark: actionRemark,
          due_date: req.due_date,
          uploaded_file: doc ? {
            file_name: doc.file_name,
            uploaded_at: doc.uploaded_at,
            version_number: doc.version_number,
          } : null,
        };
      });

      // Compute summary counts
      const counts = {
        total: enrichedRequirements.length,
        pending: enrichedRequirements.filter((r: any) => r.status === "not_uploaded").length,
        uploaded: enrichedRequirements.filter((r: any) => r.status === "uploaded").length,
        under_review: enrichedRequirements.filter((r: any) => r.status === "under_review").length,
        verified: enrichedRequirements.filter((r: any) => r.status === "verified").length,
        action_needed: enrichedRequirements.filter((r: any) => ["rejected", "reupload_needed"].includes(r.status)).length,
        not_required: enrichedRequirements.filter((r: any) => ["waived", "not_applicable"].includes(r.status)).length,
      };

      return jsonResponse({
        requirements: enrichedRequirements,
        counts,
        lead_summary: {
          id: lead.id,
          lead_id: lead.lead_id,
          current_stage: lead.current_stage,
          updated_at: lead.updated_at,
          student_full_name: lead.student_full_name || `${lead.student_first_name ?? ""} ${lead.student_last_name ?? ""}`.trim() || null,
          coapplicant_name: lead.coapplicant_name || null,
        },
      });
    }

    // --- LOAD TRACKER ---
    if (action === "load_tracker") {
      const { lead, error: resolveErr } = await resolveLead(supabaseAdmin, cleanPhone, lead_id);
      if (resolveErr || !lead) return jsonResponse({ error: resolveErr || "No application found" }, lead_id ? 403 : 404);

      if (lead.current_stage === "draft") {
        return jsonResponse({ error: "Application not yet submitted" }, 400);
      }

      // Stage history (last 20, exclude internal_note)
      const { data: history } = await supabaseAdmin
        .from("lead_stage_history")
        .select("id, new_stage, new_status, previous_stage, partner_visible_note, created_at")
        .eq("lead_id", lead.id)
        .order("created_at", { ascending: false })
        .limit(20);

      // Recommendation summary
      const { data: matches } = await supabaseAdmin
        .from("lead_lender_matches")
        .select("id, fit_category, recommendation_rank, lender_id")
        .eq("lead_id", lead.id)
        .order("recommendation_rank", { ascending: true });

      const visibleMatches = (matches || []).filter((m: any) => m.fit_category !== "not_eligible");
      let topLender: any = null;
      if (visibleMatches.length > 0) {
        const { data: lenderData } = await supabaseAdmin
          .from("lenders")
          .select("id, lender_name, processing_time_days")
          .eq("id", visibleMatches[0].lender_id)
          .single();
        topLender = lenderData ? {
          name: lenderData.lender_name,
          fit_category: visibleMatches[0].fit_category,
          fit_label: mapFitLabel(visibleMatches[0].fit_category),
          processing_time_days: lenderData.processing_time_days,
        } : null;
      }

      // Document counts
      const { data: docReqs } = await supabaseAdmin
        .from("lead_document_requirements")
        .select("id, status, required_flag")
        .eq("lead_id", lead.id);

      const docs = docReqs || [];
      const docCounts = {
        total: docs.length,
        pending: docs.filter((d: any) => d.status === "not_uploaded").length,
        uploaded: docs.filter((d: any) => d.status === "uploaded").length,
        under_review: docs.filter((d: any) => d.status === "under_review").length,
        verified: docs.filter((d: any) => d.status === "verified").length,
        action_needed: docs.filter((d: any) => ["rejected", "reupload_needed"].includes(d.status)).length,
        not_required: docs.filter((d: any) => ["waived", "not_applicable"].includes(d.status)).length,
      };

      // Map timeline to student-safe events
      const timeline = (history || []).map((h: any) => ({
        id: h.id,
        stage: h.new_stage,
        stage_label: mapStageLabel(h.new_stage),
        note: h.partner_visible_note ? sanitizeRemark(h.partner_visible_note) : null,
        date: h.created_at,
      }));

      // Derive health — expanded for more meaningful states
      const hasBlockers = docCounts.action_needed > 0;
      const hasPendingRequired = docs.filter((d: any) => d.required_flag && d.status === "not_uploaded").length > 0;
      const isOnHold = lead.current_stage === "on_hold";
      const isQuery = lead.current_stage === "credit_query";
      const isRejected = lead.current_stage === "rejected";
      const health = (hasBlockers || isRejected) ? "action_required"
        : (hasPendingRequired || isOnHold || isQuery) ? "needs_attention"
        : "on_track";

      // Derive current focus — single actionable sentence
      let currentFocus = "We're working on your application.";
      if (hasBlockers) {
        currentFocus = `Re-upload ${docCounts.action_needed} document${docCounts.action_needed > 1 ? "s" : ""} that need correction to unblock your case.`;
      } else if (hasPendingRequired) {
        const pendingReqCount = docs.filter((d: any) => d.required_flag && d.status === "not_uploaded").length;
        currentFocus = `Upload ${pendingReqCount} pending required document${pendingReqCount > 1 ? "s" : ""} to keep your application moving.`;
      } else if (isRejected) {
        currentFocus = "Your application needs further review. Our team will guide you on available options.";
      } else if (isOnHold) {
        currentFocus = "Your application is on hold. Our team will reach out with next steps.";
      } else if (isQuery) {
        currentFocus = "A query has been raised by the lender. Please keep your phone available for follow-up.";
      } else if (["sent_to_lender", "login_submitted"].includes(lead.current_stage)) {
        currentFocus = "Your application is being actively processed by the lender — no action needed from you.";
      } else if (lead.current_stage === "sanction_received") {
        currentFocus = "Great news — your loan has been approved! Disbursal will follow shortly.";
      } else if (lead.current_stage === "disbursed") {
        currentFocus = "Your loan has been disbursed. Congratulations!";
      } else if (["submitted", "under_initial_review"].includes(lead.current_stage)) {
        currentFocus = "We're reviewing your application — no action needed right now.";
      } else if (lead.current_stage === "documents_under_review") {
        currentFocus = "Your documents are under review. We'll update you on the next step.";
      } else if (lead.current_stage === "bre_evaluated" && visibleMatches.length > 0) {
        currentFocus = "Lender options are ready — review your recommended loan options.";
      } else if (lead.current_stage === "bre_evaluated") {
        currentFocus = "We're matching your profile with the best lending partners.";
      }

      // Derive lender processing phase
      const activeProcessingStages = ["sent_to_lender", "login_submitted", "credit_query", "sanction_received", "disbursed"];
      const isActivelyProcessing = activeProcessingStages.includes(lead.current_stage);
      const lenderPhase = isActivelyProcessing
        ? (lead.current_stage === "credit_query" ? "query_in_progress"
          : lead.current_stage === "sanction_received" ? "approved"
          : lead.current_stage === "disbursed" ? "disbursed"
          : "processing")
        : (visibleMatches.length > 0 ? "recommended" : "matching");

      return jsonResponse({
        lead_summary: {
          id: lead.id,
          lead_id: lead.lead_id,
          current_stage: lead.current_stage,
          current_status: lead.current_status,
          student_stage_label: mapStageLabel(lead.current_stage),
          updated_at: lead.updated_at,
          created_at: lead.created_at,
          student_first_name: lead.student_first_name,
          intended_study_country: lead.intended_study_country,
          course_name: lead.course_name,
          university_name_raw: lead.university_name_raw,
          loan_amount_required: lead.loan_amount_required,
        },
        health,
        current_focus: currentFocus,
        lender: {
          top_lender: topLender,
          total_matches: visibleMatches.length,
          phase: lenderPhase,
        },
        documents: docCounts,
        timeline,
      });
    }

    if (!data && action !== "submit") {
      return jsonResponse({ error: "Missing data payload" }, 400);
    }

    // For write actions, resolve lead by canonical phone
    const canonicalPhone = normalizePhone(cleanPhone) ?? cleanPhone;
    let existingLeadId = lead_id;
    let existingLead: any = null;
    if (!existingLeadId) {
      const { data: existing } = await supabaseAdmin
        .from("student_leads")
        .select("*")
        .eq("student_phone", canonicalPhone)
        .order("updated_at", { ascending: false })
        .limit(1);
      if (existing && existing.length > 0) {
        existingLeadId = existing[0].id;
        existingLead = existing[0];
      }
    } else {
      const { data: existing } = await supabaseAdmin
        .from("student_leads")
        .select("*")
        .eq("id", existingLeadId)
        .single();
      existingLead = existing;
    }

    // --- SAVE BASIC ---
    if (action === "save_basic") {
      const incomingFullName = (data?.student_full_name || "") as string;
      const incomingFirst = (data?.student_first_name || "") as string;
      const incomingLast = (data?.student_last_name || "") as string;

      // Preserve existing first/last when present; only derive from full_name as a last resort.
      // This prevents the "Sanjay Mehra Mehra" / partner-name-clobber class of bugs.
      let firstName = incomingFirst.trim() || existingLead?.student_first_name || "";
      let lastName: string | null = incomingLast.trim() || existingLead?.student_last_name || null;

      if ((!firstName || !lastName) && incomingFullName.trim()) {
        const parts = incomingFullName.trim().split(/\s+/);
        if (!firstName) firstName = parts[0] || "";
        if (!lastName && parts.length > 1) lastName = parts.slice(1).join(" ");
      }

      // Derive a clean full_name (no duplication) from first+last
      const derivedFullName = [firstName, lastName].filter(Boolean).join(" ").trim() || incomingFullName.trim() || null;

      // NOTE: student_full_name is a STORED GENERATED column in Postgres
      // (concatenated from first/last). Writing to it raises
      // "cannot insert a non-DEFAULT value into column student_full_name".
      // We intentionally OMIT it from the payload — the DB derives it.
      // `derivedFullName` is computed only for client-side response convenience.
      void derivedFullName;
      // Normalize whatsapp: accept 10-digit local; mirror primary if same_as_phone is true
      const sameAsPhone = !!(data?.whatsapp_same_as_phone);
      const rawWhatsapp = (data?.student_whatsapp as string | null) ?? null;
      const whatsappCanonical = sameAsPhone
        ? canonicalPhone
        : (rawWhatsapp ? (normalizePhone(rawWhatsapp) ?? null) : null);

      const basicFields: Record<string, unknown> = {
        student_first_name: firstName,
        student_last_name: lastName,
        student_email: data?.student_email as string || null,
        student_phone: canonicalPhone,
        student_whatsapp: whatsappCanonical,
        whatsapp_same_as_phone: sameAsPhone,
        student_dob: data?.student_dob as string || null,
        student_gender: data?.student_gender as string || null,
        city: data?.city as string || null,
        state: data?.state as string || null,
        district: data?.district as string || null,
        tier: data?.tier as string || null,
        pincode: data?.pincode as string || null,
        intended_study_country: data?.intended_study_country as string,
        course_category: data?.course_category as string || null,
        loan_amount_required: data?.loan_amount_required ? Number(data.loan_amount_required) : null,
        // Country of residence: only persist what the caller explicitly sent.
        // Do NOT default to "India" — admins handle that downstream and a blanket
        // default has caused incorrect attribution in past audits.
        ...(data?.country_of_residence != null && data?.country_of_residence !== ""
          ? { country_of_residence: data.country_of_residence as string }
          : {}),
      };

      if (!basicFields.student_first_name) {
        return jsonResponse({ error: "Full name is required" }, 400);
      }

      if (existingLeadId) {
        const { data: updated, error } = await supabaseAdmin
          .from("student_leads")
          .update(basicFields)
          .eq("id", existingLeadId)
          .select()
          .single();
        if (error) return jsonResponse({ error: error.message }, 500);
        return jsonResponse({ lead: updated });
      } else {
        const newLead = {
          ...basicFields,
          partner_id: STUDENT_DIRECT_PARTNER_ID,
          source_type: "student_direct",
          intended_study_country: basicFields.intended_study_country || "Not specified",
          course_name: data?.course_name as string || "Not specified",
          intake_term: data?.intake_term as string || "Fall",
          intake_year: data?.intake_year ? Number(data.intake_year) : new Date().getFullYear() + 1,
          current_stage: "draft" as const,
          current_status: "new" as const,
        };
        const { data: created, error } = await supabaseAdmin
          .from("student_leads")
          .insert(newLead)
          .select()
          .single();
        if (error) return jsonResponse({ error: error.message }, 500);
        return jsonResponse({ lead: created });
      }
    }

    // --- SAVE EDUCATION ---
    if (action === "save_education") {
      if (!existingLeadId) return jsonResponse({ error: "No existing application found. Complete basic details first." }, 400);
      // Merge test_scores: preserve any keys saved on other steps (e.g. coapplicant_age,
      // coapplicant_cibil saved during the Co-applicant step) by reading current then spreading.
      const incomingScoresRaw = (data?.test_scores as Record<string, unknown>) || {};
      const { cleaned: incomingScores, invalidKeys } = sanitizeNumericTestScores(incomingScoresRaw);
      if (invalidKeys.length > 0) {
        return jsonResponse({ error: `Only numeric values are allowed for: ${invalidKeys.join(", ")}` }, 400);
      }
      const { data: existingEdu, error: fetchEduErr } = await supabaseAdmin
        .from("student_leads")
        .select("test_scores")
        .eq("id", existingLeadId)
        .single();
      if (fetchEduErr) return jsonResponse({ error: fetchEduErr.message }, 500);
      const currentEdu = (existingEdu?.test_scores as Record<string, unknown>) || {};
      const preservedKeys = [
        "coapplicant_age",
        "coapplicant_cibil",
        "coapplicant_work_experience_years",
        "coapplicant_work_experience_months",
      ];
      const mergedEduScores: Record<string, unknown> = { ...incomingScores };
      for (const k of preservedKeys) {
        if (k in currentEdu && !(k in incomingScores)) mergedEduScores[k] = currentEdu[k];
      }

      const eduFields: Record<string, unknown> = {
        highest_qualification: data?.highest_qualification as string || null,
        marks_gpa: data?.marks_gpa as string || null,
        course_name: data?.course_name as string || "Not specified",
        course_category: data?.course_category as string || null,
        university_name_raw: data?.university_name_raw as string || null,
        university_id: (data?.university_id as string) || null,
        intake_term: data?.intake_term as string || "Fall",
        intake_year: data?.intake_year ? Number(data.intake_year) : new Date().getFullYear() + 1,
        test_scores: mergedEduScores,
      };
      const { data: updated, error } = await supabaseAdmin
        .from("student_leads")
        .update(eduFields)
        .eq("id", existingLeadId)
        .select()
        .single();
      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse({ lead: updated });
    }

    // --- SAVE CO-APPLICANT ---
    if (action === "save_coapplicant") {
      if (!existingLeadId) return jsonResponse({ error: "No existing application found. Complete basic details first." }, 400);

      // Merge co-applicant extension fields (age, CIBIL) into existing test_scores
      // JSONB without clobbering test/academic keys saved during education step.
      const extensionRaw = (data?.test_scores_extension as Record<string, unknown>) || {};
      let mergedTestScores: Record<string, unknown> | undefined = undefined;
      if (extensionRaw && typeof extensionRaw === "object") {
        const { data: existing, error: fetchErr } = await supabaseAdmin
          .from("student_leads")
          .select("test_scores")
          .eq("id", existingLeadId)
          .single();
        if (fetchErr) return jsonResponse({ error: fetchErr.message }, 500);
        const current = (existing?.test_scores as Record<string, unknown>) || {};
        mergedTestScores = { ...current };
        // Only set keys we explicitly handle here; preserve everything else
        // (academic scores/totals saved on the education step are preserved).
        for (const k of [
          "coapplicant_age",
          "coapplicant_cibil",
          "coapplicant_work_experience_years",
          "coapplicant_work_experience_months",
        ]) {
          if (k in extensionRaw) {
            const v = (extensionRaw as any)[k];
            if (v === null || v === "" || v === undefined) {
              delete (mergedTestScores as any)[k];
            } else {
              if (k === "coapplicant_work_experience_years" || k === "coapplicant_work_experience_months") {
                const raw = String(v).trim();
                if (typeof v !== "number" && !/^\d+$/.test(raw)) {
                  return jsonResponse({ error: "Invalid co-applicant work experience" }, 400);
                }
                const n = typeof v === "number" ? v : parseInt(raw, 10);
                const max = k === "coapplicant_work_experience_months" ? 11 : Number.MAX_SAFE_INTEGER;
                if (!Number.isInteger(n) || n < 0 || n > max) {
                  return jsonResponse({ error: "Invalid co-applicant work experience" }, 400);
                }
                (mergedTestScores as any)[k] = n;
              } else {
                (mergedTestScores as any)[k] = v;
              }
            }
          }
        }
      }

      const coFields: Record<string, unknown> = {
        coapplicant_name: data?.coapplicant_name as string || null,
        coapplicant_relation: data?.coapplicant_relation as string || null,
        coapplicant_mobile: data?.coapplicant_mobile as string || null,
        coapplicant_email: data?.coapplicant_email as string || null,
        coapplicant_income: data?.coapplicant_income ? Number(data.coapplicant_income) : null,
        coapplicant_income_source: data?.coapplicant_income_source as string || null,
        coapplicant_employment_type: data?.coapplicant_employment_type as string || null,
        coapplicant_employer: data?.coapplicant_employer as string || null,
        coapplicant_existing_emi: data?.coapplicant_existing_emi ? Number(data.coapplicant_existing_emi) : null,
        collateral_available: data?.collateral_available as boolean ?? null,
        collateral_notes: data?.collateral_notes as string || null,
      };
      if (mergedTestScores !== undefined) {
        coFields.test_scores = mergedTestScores;
      }

      const { data: updated, error } = await supabaseAdmin
        .from("student_leads")
        .update(coFields)
        .eq("id", existingLeadId)
        .select()
        .single();
      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse({ lead: updated });
    }

    // --- SUBMIT ---
    if (action === "submit") {
      if (!existingLeadId) return jsonResponse({ error: "No existing application found." }, 400);
      const { data: updated, error } = await supabaseAdmin
        .from("student_leads")
        .update({ current_stage: "submitted" as const, current_status: "awaiting_verification" as const })
        .eq("id", existingLeadId)
        .select()
        .single();
      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse({ lead: updated });
    }

    return jsonResponse({ error: "Invalid action" }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err || "Internal error");
    return jsonResponse({ error: message }, 500);
  }
});

// --- UPLOAD DOCUMENT (multipart) ---
async function handleUploadDocument(req: Request, supabaseAdmin: any) {
  try {
    const formData = await req.formData();
    const phone = formData.get("phone") as string;
    const leadId = formData.get("lead_id") as string;
    const requirementId = formData.get("requirement_id") as string;
    const file = formData.get("file") as File;

    if (!phone || !/^\+91\d{10}$/.test(phone.replace(/\s/g, ""))) {
      return jsonResponse({ error: "Invalid phone" }, 400);
    }
    if (!leadId || !requirementId || !file) {
      return jsonResponse({ error: "Missing lead_id, requirement_id, or file" }, 400);
    }

    const cleanPhone = phone.replace(/\s/g, "");

    // Verify phone↔lead ownership
    const { lead, error: resolveErr } = await resolveLead(supabaseAdmin, cleanPhone, leadId);
    if (resolveErr || !lead) return jsonResponse({ error: resolveErr || "Access denied" }, 403);

    // Validate file type and size
    const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];
    if (!allowedTypes.includes(file.type)) {
      return jsonResponse({ error: "Only PDF, JPG, and PNG files are allowed" }, 400);
    }
    if (file.size > 10 * 1024 * 1024) {
      return jsonResponse({ error: "File size must be under 10MB" }, 400);
    }

    // Get the requirement to find document_type_id
    const { data: requirement, error: reqErr } = await supabaseAdmin
      .from("lead_document_requirements")
      .select("id, document_type_id")
      .eq("id", requirementId)
      .eq("lead_id", lead.id)
      .single();

    if (reqErr || !requirement) return jsonResponse({ error: "Document requirement not found" }, 404);

    // Mark previous versions as not latest
    await supabaseAdmin
      .from("lead_documents")
      .update({ is_latest: false })
      .eq("lead_id", lead.id)
      .eq("document_type_id", requirement.document_type_id)
      .eq("is_latest", true);

    // Get next version number
    const { count: versionCount } = await supabaseAdmin
      .from("lead_documents")
      .select("id", { count: "exact", head: true })
      .eq("lead_id", lead.id)
      .eq("document_type_id", requirement.document_type_id);

    const versionNumber = (versionCount || 0) + 1;

    // Upload to storage
    const ext = file.name.split(".").pop() || "pdf";
    const storagePath = `${lead.id}/${requirement.document_type_id}_v${versionNumber}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadErr } = await supabaseAdmin.storage
      .from("lead-documents")
      .upload(storagePath, arrayBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadErr) return jsonResponse({ error: "File upload failed: " + uploadErr.message }, 500);

    // Insert lead_documents row
    const { data: insertedDoc, error: insertErr } = await supabaseAdmin
      .from("lead_documents")
      .insert({
        lead_id: lead.id,
        document_type_id: requirement.document_type_id,
        file_name: file.name,
        storage_path: storagePath,
        mime_type: file.type,
        version_number: versionNumber,
        is_latest: true,
        verification_status: "uploaded",
        uploaded_by_role: "partner_agent", // closest role for student uploads
      })
      .select("id")
      .single();

    if (insertErr || !insertedDoc) return jsonResponse({ error: "Document record failed: " + (insertErr?.message ?? "unknown") }, 500);

    // Update requirement status to uploaded
    await supabaseAdmin
      .from("lead_document_requirements")
      .update({ status: "uploaded", remarks: null })
      .eq("id", requirementId);

    // Run validation inline (Phase 1 — fast PDF parse). Failures don't block the upload.
    let validation_result: unknown = null;
    let soft_block = false;
    try {
      const validateUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/validate-document`;
      const valRes = await fetch(validateUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({ lead_document_id: insertedDoc.id }),
      });
      if (valRes.ok) {
        const valBody = await valRes.json();
        validation_result = valBody.validation_result;
        soft_block = !!valBody.soft_block;
      }
    } catch (e) {
      console.error("[student-application] validation call failed", e);
    }

    return jsonResponse({
      success: true,
      version: versionNumber,
      lead_document_id: insertedDoc.id,
      validation_result,
      soft_block,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err || "Upload error");
    return jsonResponse({ error: message }, 500);
  }
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function mapFitLabel(category: string | null): string {
  switch (category) {
    case "best_fit": return "Best Fit";
    case "premium_match": return "Top Match";
    case "good_fit": return "Good Fit";
    case "backup": return "Worth Considering";
    default: return "Under Review";
  }
}

function mapDocStatusLabel(status: string): string {
  switch (status) {
    case "not_uploaded": return "Pending Upload";
    case "uploaded": return "Uploaded";
    case "under_review": return "Being Reviewed";
    case "verified": return "Verified";
    case "rejected": return "Action Needed";
    case "reupload_needed": return "Action Needed";
    case "waived": return "Not Required";
    case "not_applicable": return "Not Required";
    default: return "Pending";
  }
}

function mapStageLabel(stage: string): string {
  const map: Record<string, string> = {
    draft: "Draft",
    submitted: "Application Submitted",
    under_initial_review: "Under Review",
    documents_pending: "Documents Pending",
    documents_under_review: "Documents Under Review",
    bre_evaluated: "Lender Matching",
    sent_to_lender: "Application in Process",
    login_submitted: "Application in Process",
    credit_query: "Query Review",
    sanction_received: "Approval Received",
    disbursed: "Funds Released",
    rejected: "Under Review",
    dropped: "Application Closed",
    on_hold: "Action Required",
  };
  return map[stage] || "In Progress";
}

function generateWhyBullets(lender: any, lead: any): string[] {
  const bullets: string[] = [];
  if (!lender || !lead) return ["Matched based on your profile"];

  // Country fit
  if (lender.supported_countries?.length > 0 && lead.intended_study_country) {
    const countries = lender.supported_countries.map((c: string) => c.toLowerCase());
    if (countries.includes(lead.intended_study_country.toLowerCase())) {
      bullets.push(`Specializes in education loans for ${lead.intended_study_country}`);
    }
  }

  // Loan amount fit
  if (lead.loan_amount_required && lender.loan_amount_min != null && lender.loan_amount_max != null) {
    if (lead.loan_amount_required >= lender.loan_amount_min && lead.loan_amount_required <= lender.loan_amount_max) {
      bullets.push("Covers your requested loan amount");
    }
  }

  // Fast processing
  if (lender.processing_time_days && lender.processing_time_days <= 14) {
    bullets.push(`Fast processing — typically within ${lender.processing_time_days} days`);
  }

  // Collateral match
  if (lead.collateral_available === true && lender.supports_collateral) {
    bullets.push("Supports secured loans with collateral");
  } else if (lead.collateral_available === false && lender.supports_unsecured) {
    bullets.push("Offers unsecured loan options");
  }

  // Ensure at least one bullet
  if (bullets.length === 0) {
    bullets.push("Matched based on your academic and financial profile");
  }

  return bullets.slice(0, 3);
}
