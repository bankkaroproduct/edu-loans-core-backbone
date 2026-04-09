import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  action: "save_basic" | "save_education" | "save_coapplicant" | "submit" | "load";
  phone: string;
  lead_id?: string;
  data?: Record<string, unknown>;
}

const STUDENT_DIRECT_PARTNER_ID = "00000000-0000-0000-0000-000000000001";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body: RequestBody = await req.json();
    const { action, phone, lead_id, data } = body;

    // Validate phone is present and looks like an Indian mobile
    if (!phone || !/^\+91\d{10}$/.test(phone.replace(/\s/g, ""))) {
      return new Response(
        JSON.stringify({ error: "Invalid or missing phone number" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cleanPhone = phone.replace(/\s/g, "");

    // --- LOAD: fetch existing lead data ---
    if (action === "load") {
      const variants = [cleanPhone, cleanPhone.slice(3)];
      const { data: leads, error } = await supabaseAdmin
        .from("student_leads")
        .select("*")
        .in("student_phone", variants)
        .order("updated_at", { ascending: false })
        .limit(1);

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ lead: leads?.[0] || null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!data && action !== "submit") {
      return new Response(
        JSON.stringify({ error: "Missing data payload" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine if this is an existing lead or new
    let existingLeadId = lead_id;
    if (!existingLeadId) {
      // Try to find by phone
      const variants = [cleanPhone, cleanPhone.slice(3)];
      const { data: existing } = await supabaseAdmin
        .from("student_leads")
        .select("id")
        .in("student_phone", variants)
        .order("updated_at", { ascending: false })
        .limit(1);

      if (existing && existing.length > 0) {
        existingLeadId = existing[0].id;
      }
    }

    // --- SAVE BASIC ---
    if (action === "save_basic") {
      const basicFields = {
        student_first_name: data?.student_first_name as string,
        student_full_name: data?.student_full_name as string || data?.student_first_name as string,
        student_email: data?.student_email as string || null,
        student_phone: cleanPhone,
        student_dob: data?.student_dob as string || null,
        student_gender: data?.student_gender as string || null,
        city: data?.city as string || null,
        state: data?.state as string || null,
        pincode: data?.pincode as string || null,
        intended_study_country: data?.intended_study_country as string,
        course_category: data?.course_category as string || null,
        loan_amount_required: data?.loan_amount_required ? Number(data.loan_amount_required) : null,
        country_of_residence: data?.country_of_residence as string || "India",
      };

      if (!basicFields.student_first_name) {
        return new Response(
          JSON.stringify({ error: "Full name is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (existingLeadId) {
        const { data: updated, error } = await supabaseAdmin
          .from("student_leads")
          .update(basicFields)
          .eq("id", existingLeadId)
          .select()
          .single();

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        return new Response(
          JSON.stringify({ lead: updated }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        // Create new lead
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

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        return new Response(
          JSON.stringify({ lead: created }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // --- SAVE EDUCATION ---
    if (action === "save_education") {
      if (!existingLeadId) {
        return new Response(
          JSON.stringify({ error: "No existing application found. Complete basic details first." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const eduFields = {
        highest_qualification: data?.highest_qualification as string || null,
        marks_gpa: data?.marks_gpa as string || null,
        course_name: data?.course_name as string || "Not specified",
        course_category: data?.course_category as string || null,
        university_name_raw: data?.university_name_raw as string || null,
        intake_term: data?.intake_term as string || "Fall",
        intake_year: data?.intake_year ? Number(data.intake_year) : new Date().getFullYear() + 1,
        test_scores: data?.test_scores || {},
      };

      const { data: updated, error } = await supabaseAdmin
        .from("student_leads")
        .update(eduFields)
        .eq("id", existingLeadId)
        .select()
        .single();

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ lead: updated }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- SAVE CO-APPLICANT ---
    if (action === "save_coapplicant") {
      if (!existingLeadId) {
        return new Response(
          JSON.stringify({ error: "No existing application found. Complete basic details first." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const coFields = {
        coapplicant_name: data?.coapplicant_name as string || null,
        coapplicant_relation: data?.coapplicant_relation as string || null,
        coapplicant_mobile: data?.coapplicant_mobile as string || null,
        coapplicant_email: data?.coapplicant_email as string || null,
        coapplicant_income: data?.coapplicant_income ? Number(data.coapplicant_income) : null,
        coapplicant_employment_type: data?.coapplicant_employment_type as string || null,
        coapplicant_employer: data?.coapplicant_employer as string || null,
        coapplicant_existing_emi: data?.coapplicant_existing_emi ? Number(data.coapplicant_existing_emi) : null,
        collateral_available: data?.collateral_available as boolean ?? null,
        collateral_notes: data?.collateral_notes as string || null,
      };

      const { data: updated, error } = await supabaseAdmin
        .from("student_leads")
        .update(coFields)
        .eq("id", existingLeadId)
        .select()
        .single();

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ lead: updated }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- SUBMIT ---
    if (action === "submit") {
      if (!existingLeadId) {
        return new Response(
          JSON.stringify({ error: "No existing application found." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: updated, error } = await supabaseAdmin
        .from("student_leads")
        .update({
          current_stage: "submitted" as const,
          current_status: "new" as const,
        })
        .eq("id", existingLeadId)
        .select()
        .single();

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ lead: updated }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
