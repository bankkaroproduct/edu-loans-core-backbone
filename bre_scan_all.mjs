import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const engine = await import('/dev-server/src/lib/bre/engine.ts');
const mapper = await import('/dev-server/src/lib/bre/leadProfile.ts');

const { data: cfgRow } = await sb.from('bre_scoring_configs').select('*').eq('is_active', true).maybeSingle();
const { data: ruleRows } = await sb.from('bre_lender_rules').select('*').eq('is_active', true);
const cfg = { ...cfgRow, bucket_threshold: Number(cfgRow.bucket_threshold) };
const rules = ruleRows;

const { data: leads } = await sb.from('student_leads')
  .select('*')
  .not('intended_study_country', 'is', null)
  .gt('loan_amount_required', 0)
  .not('coapplicant_income', 'is', null)
  .not('coapplicant_relation', 'is', null)
  .limit(200);

let anyPass = 0;
for (const lead of leads ?? []) {
  const { profile, missing } = mapper.buildBreProfileFromLead(lead);
  if (missing.length) continue;
  const r = engine.evaluate(profile, cfg, rules);
  const withRate = r.eligible_lenders.filter(l => l.eligible && l.projected_rate != null);
  if (withRate.length > 0) {
    anyPass++;
    console.log(`PASS ${lead.lead_id}: ${withRate.length} lenders`);
    for (const l of withRate) console.log(`   ${l.lender_code} rate=${l.projected_rate}%`);
  }
}
console.log(`\nTotal leads with at least one rated lender: ${anyPass} / ${leads.length}`);
