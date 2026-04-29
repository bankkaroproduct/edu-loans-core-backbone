// End-to-end runtime BRE evaluation against EL-PL-000115 with service role.
// Imports the actual app engine + leadProfile mapper used by the UI.
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(url, key, { auth: { persistSession: false } });

const LEAD_ID = 'c0a302ef-17d7-4d4e-8a66-fcd580ed37f8'; // EL-PL-000115

// ----- import app code via dynamic eval after registering tsx -----
// Use simple inline copies of the engine + mapping (logically identical to src/lib/bre/*).
// They must exactly mirror behavior; we re-import via tsx instead.

const engine = await import('/dev-server/src/lib/bre/engine.ts');
const mapper = await import('/dev-server/src/lib/bre/leadProfile.ts');

// 1. Fetch lead, config, lender rules, and current document count.
const [{ data: lead }, { data: cfgRow }, { data: ruleRows }, { count: preDocs }] = await Promise.all([
  sb.from('student_leads').select('*').eq('id', LEAD_ID).maybeSingle(),
  sb.from('bre_scoring_configs').select('*').eq('is_active', true).maybeSingle(),
  sb.from('bre_lender_rules').select('*').eq('is_active', true),
  sb.from('lead_documents').select('id', { count: 'exact', head: true }).eq('lead_id', LEAD_ID).eq('is_latest', true),
]);

// Cast cfg + rules to engine shapes (same as loader.ts).
const cfg = {
  id: cfgRow.id, version_number: cfgRow.version_number, is_active: cfgRow.is_active,
  bucket_threshold: Number(cfgRow.bucket_threshold),
  student_params: cfgRow.student_params ?? [],
  university_params: cfgRow.university_params ?? [],
  coapplicant_params: cfgRow.coapplicant_params ?? [],
  overall_band_mapping: cfgRow.overall_band_mapping ?? [],
};
const rules = (ruleRows ?? []).map((r) => ({
  id: r.id, lender_id: r.lender_id, version_number: r.version_number, is_active: r.is_active,
  basic_info: r.basic_info, commercials: r.commercials, hard_thresholds: r.hard_thresholds,
  loan_caps: r.loan_caps, collateral_ltv: r.collateral_ltv, coverage: r.coverage, policy: r.policy,
}));

const { profile, missing } = mapper.buildBreProfileFromLead(lead);
console.log('=== Profile mapping ===');
console.log('missing:', missing);
console.log('profile:', JSON.stringify(profile, null, 2));

console.log('\n=== Pre-upload doc count ===', preDocs);

// 2. Pre-upload state — both gates evaluated as the UI does.
const result = engine.evaluate(profile, cfg, rules);
console.log('\n=== BRE evaluation (independent of doc gate) ===');
console.log('overall_score:', result.overall_score, 'band:', result.overall_band?.band, 'status:', result.eligibility_status);
console.log('rejection_reasons:', result.rejection_reasons);
console.log('eligible_lenders (with rate):');
for (const l of result.eligible_lenders) {
  if (l.eligible && l.projected_rate != null) {
    console.log(`  rank=${l.rank}  ${l.lender_code} (${l.lender_name})  rate=${l.projected_rate}%  loan=${l.projected_loan_amount}  product=${l.product_type}`);
  }
}

// 3. Simulate documents (backend-only, marked qa_test_).
const docTypes = await sb.from('document_master').select('id').eq('active_flag', true).limit(3);
const inserts = (docTypes.data ?? []).map((d, i) => ({
  lead_id: LEAD_ID,
  document_type_id: d.id,
  file_url: `qa_test_runtime/dummy_${i}.pdf`,
  file_name: `qa_test_runtime_${i}.pdf`,
  is_latest: true,
  version_number: 1,
  uploaded_by_role: 'admin',
}));
const { error: insErr } = await sb.from('lead_documents').insert(inserts);
if (insErr) { console.error('insert err', insErr); process.exit(1); }

const { count: postDocs } = await sb.from('lead_documents')
  .select('id', { count: 'exact', head: true })
  .eq('lead_id', LEAD_ID).eq('is_latest', true);
console.log('\n=== Post-simulated-upload doc count ===', postDocs);

// 4. Now compute what AdminLenderRecommendations would render:
//    join persisted lead_lender_matches with the live BRE result rate map.
const { data: persisted } = await sb.from('lead_lender_matches')
  .select('id, lender_id, recommendation_rank, fit_category, lock_status, lender:lenders(lender_name, lender_code)')
  .eq('lead_id', LEAD_ID)
  .order('recommendation_rank', { ascending: true });

const rateById = new Map();
for (const l of result.eligible_lenders) {
  if (l.eligible && l.projected_rate != null) rateById.set(l.lender_id, l.projected_rate);
}

console.log('\n=== Final UI-equivalent rendered list (post-upload) ===');
const display = [];
for (const r of persisted ?? []) {
  const rate = rateById.get(r.lender_id);
  if (rate == null) continue;
  display.push({
    rank: r.recommendation_rank,
    lender: r.lender?.lender_name,
    code: r.lender?.lender_code,
    fit: r.fit_category,
    rate_pct: rate,
    locked: r.lock_status,
  });
}
console.table(display);

// 5. Cleanup.
const { error: delErr } = await sb.from('lead_documents')
  .delete().eq('lead_id', LEAD_ID).like('file_url', 'qa_test_runtime/%');
if (delErr) { console.error('cleanup err', delErr); process.exit(1); }
const { count: cleanDocs } = await sb.from('lead_documents')
  .select('id', { count: 'exact', head: true })
  .eq('lead_id', LEAD_ID).eq('is_latest', true);
console.log('\n=== Post-cleanup doc count ===', cleanDocs);
