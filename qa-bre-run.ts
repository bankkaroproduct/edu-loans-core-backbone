import { buildBreProfileFromLead } from "@/lib/bre/leadProfile";
import { evaluate } from "@/lib/bre/engine";
import fs from "node:fs";

const lead = JSON.parse(fs.readFileSync("/tmp/qa-lead.json","utf8"));
const cfgRow = JSON.parse(fs.readFileSync("/tmp/qa-cfg.json","utf8"));
const rulesRows = JSON.parse(fs.readFileSync("/tmp/qa-rules.json","utf8"));

const cfg = {
  id: cfgRow.id, version_number: cfgRow.version_number, is_active: cfgRow.is_active,
  bucket_threshold: Number(cfgRow.bucket_threshold),
  student_params: cfgRow.student_params ?? [],
  university_params: cfgRow.university_params ?? [],
  coapplicant_params: cfgRow.coapplicant_params ?? [],
  overall_band_mapping: cfgRow.overall_band_mapping ?? [],
};
const rules = rulesRows.map((r:any)=>({
  id:r.id, lender_id:r.lender_id, version_number:r.version_number, is_active:r.is_active,
  basic_info:r.basic_info, commercials:r.commercials, hard_thresholds:r.hard_thresholds,
  loan_caps:r.loan_caps, collateral_ltv:r.collateral_ltv, coverage:r.coverage, policy:r.policy,
}));

const { profile, missing } = buildBreProfileFromLead(lead);
console.log("MISSING:", JSON.stringify(missing));
const result = evaluate(profile, cfg as any, rules as any);
console.log("OVERALL_BAND:", result.overall_band, "SCORE:", result.overall_score);
for (const l of result.eligible_lenders) {
  const r = rules.find((rr:any)=>rr.lender_id===l.lender_id);
  console.log(`${r?.basic_info.lender_name} | eligible=${l.eligible} | rate=${l.projected_rate}% | loan=${l.projected_loan} | rank=${l.rank ?? "-"}`);
}
