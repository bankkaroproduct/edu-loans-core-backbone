import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type DuplicateLead = Pick<
  Tables<"student_leads">,
  "id" | "lead_id" | "student_full_name" | "student_phone" | "student_email" | "current_stage" | "current_status" | "created_at" | "intake_term" | "intake_year"
>;

interface DuplicateCheckParams {
  phone: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  intakeTerm?: string;
  intakeYear?: number;
  partnerId: string;
}

export function useDuplicateCheck() {
  const [duplicates, setDuplicates] = useState<DuplicateLead[]>([]);
  const [checking, setChecking] = useState(false);

  const checkDuplicates = async (params: DuplicateCheckParams): Promise<DuplicateLead[]> => {
    setChecking(true);
    try {
      const found: DuplicateLead[] = [];
      const seenIds = new Set<string>();

      const selectFields = "id,lead_id,student_full_name,student_phone,student_email,current_stage,current_status,created_at,intake_term,intake_year";

      // Check by phone
      if (params.phone?.trim()) {
        const { data } = await supabase
          .from("student_leads")
          .select(selectFields)
          .eq("partner_id", params.partnerId)
          .eq("student_phone", params.phone.trim())
          .eq("is_archived", false)
          .limit(5);
        data?.forEach((d) => {
          if (!seenIds.has(d.id)) { seenIds.add(d.id); found.push(d); }
        });
      }

      // Check by email
      if (params.email?.trim()) {
        const { data } = await supabase
          .from("student_leads")
          .select(selectFields)
          .eq("partner_id", params.partnerId)
          .eq("student_email", params.email.trim())
          .eq("is_archived", false)
          .limit(5);
        data?.forEach((d) => {
          if (!seenIds.has(d.id)) { seenIds.add(d.id); found.push(d); }
        });
      }

      // Check by name + intake
      const fullName = `${params.firstName ?? ""} ${params.lastName ?? ""}`.trim();
      if (fullName && params.intakeTerm && params.intakeYear) {
        const { data } = await supabase
          .from("student_leads")
          .select(selectFields)
          .eq("partner_id", params.partnerId)
          .ilike("student_full_name", fullName)
          .eq("intake_term", params.intakeTerm)
          .eq("intake_year", params.intakeYear)
          .eq("is_archived", false)
          .limit(5);
        data?.forEach((d) => {
          if (!seenIds.has(d.id)) { seenIds.add(d.id); found.push(d); }
        });
      }

      setDuplicates(found);
      return found;
    } finally {
      setChecking(false);
    }
  };

  const clearDuplicates = () => setDuplicates([]);

  return { duplicates, checking, checkDuplicates, clearDuplicates };
}
