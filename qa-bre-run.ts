import { buildBreProfileFromLead } from "@/lib/bre/leadProfile";
import { loadActive } from "@/lib/bre/loader";
import { evaluate } from "@/lib/bre/engine";
import { supabase } from "@/integrations/supabase/client";

const { data: lead } = await supabase.from("student_leads").select("*").eq("id","c0a302ef-17d7-4d4e-8a66-fcd580ed37f8").maybeSingle();
const { profile, missing } = buildBreProfileFromLead(lead as any);
console.log("MISSING:", JSON.stringify(missing));
console.log("PROFILE:", JSON.stringify({country:profile.country, loan:profile.loan_amount, coapp_income:profile.coapplicant_income, coapp_rel:profile.coapplicant_relation}));
const { cfg, rules } = await loadActive();
const result = evaluate(profile, cfg, rules);
console.log("OVERALL_BAND:", result.overall_band, "SCORE:", result.overall_score);
for (const l of result.eligible_lenders) {
  const r = rules.find(rr => rr.lender_id === l.lender_id);
  console.log(`LENDER ${r?.basic_info.lender_name} | eligible=${l.eligible} | rate=${l.projected_rate} | loan=${l.projected_loan}`);
}
