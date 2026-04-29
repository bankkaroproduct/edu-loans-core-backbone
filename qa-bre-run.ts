(globalThis as any).localStorage = { getItem:()=>null, setItem:()=>{}, removeItem:()=>{}, clear:()=>{}, key:()=>null, length:0 };
(globalThis as any).window = { addEventListener:()=>{}, removeEventListener:()=>{}, location:{href:""} };
(globalThis as any).document = { addEventListener:()=>{}, removeEventListener:()=>{} };

const lead = {"assigned_admin_id":null,"city":"New Delhi","coapplicant_employer":"Airtel","coapplicant_employment_type":"Salaried","coapplicant_existing_emi":70000,"coapplicant_income":550000,"coapplicant_name":"Deepak Father","coapplicant_relation":"Father","collateral_available":true,"collateral_notes":"NA","country_of_residence":"India","course_name":"Executive MBA","current_stage":"submitted","current_status":"awaiting_verification","duplicate_flag":false,"fraud_flag":false,"highest_qualification":"Diploma","id":"c0a302ef-17d7-4d4e-8a66-fcd580ed37f8","intake_term":"Fall","intake_year":2027,"intended_study_country":"United States","is_archived":false,"lead_authenticity":"unverified","lead_id":"EL-PL-000115","loan_amount_required":4090000,"marks_gpa":"80","partner_id":"b2c3d4e5-f6a7-8901-bcde-f12345678901","source_sub_type":"Direct","source_type":"partner","state":"Delhi","student_email":"Deepak@gmail.com","student_first_name":"Deepak","student_last_name":"Test","student_phone":"+918525582010","student_whatsapp":"+918525582010","test_scores":{"coapplicant_age":58,"coapplicant_cibil":700,"graduation":70,"highest_qualification":80,"tenth":90,"twelfth":91,"work_experience_years":8.2},"university_id":"5f71ae07-d809-4ea1-aed1-e6b1498b5f98","university_name_raw":"University of Toronto","whatsapp_same_as_phone":false};

const { buildBreProfileFromLead } = await import("@/lib/bre/leadProfile");
const { loadActive } = await import("@/lib/bre/loader");
const { evaluate } = await import("@/lib/bre/engine");

const { profile, missing } = buildBreProfileFromLead(lead as any);
console.log("MISSING:", JSON.stringify(missing));
const { cfg, rules } = await loadActive();
const result = evaluate(profile, cfg, rules);
console.log("OVERALL_BAND:", result.overall_band, "SCORE:", result.overall_score);
for (const l of result.eligible_lenders) {
  const r = rules.find(rr => rr.lender_id === l.lender_id);
  console.log(`${r?.basic_info.lender_name} | eligible=${l.eligible} | rate=${l.projected_rate}% | loan=${l.projected_loan}`);
}
