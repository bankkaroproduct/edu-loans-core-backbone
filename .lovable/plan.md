# Broader Read-Only BRE QA Plan

## Objective
Run BRE simulation across **all 98 non-draft, non-archived leads** to verify stability, mapping correctness, and absence of side effects. **No writes, no code changes, no DB schema/master data/lifecycle/lender/communication changes.**

## Scope
- Leads filter: `current_stage <> 'draft' AND is_archived = false` → **98 leads**.
- Engine path: same as `AdminLenderRecommendations.tsx`:
  1. `buildBreProfileFromLead(lead)` (sync mapper)
  2. Patch `university.university_tier` from `universities_master.ranking_bucket` (matched=true → "unranked" if bucket null, mirrors approved fix)
  3. `evaluate(profile, activeCfg, activeRules)`
- Active config + active lender rules loaded once.

## Method
Add ONE new script: `scripts/bre-broad-qa.ts` (read-only, ad-hoc; NOT wired into the app). Bootstrap with the existing `bre-harness-bootstrap.ts` pattern. Runs via `bun` against `SUPABASE_URL` + `SERVICE_ROLE_KEY` env vars.

The script performs **only SELECT queries**:
- `bre_scoring_configs` (active), `bre_lender_rules` (active)
- `student_leads` (98 active rows)
- `universities_master` (batched by `university_id`)
- Snapshot counts before/after on `lead_lender_matches`, `lead_stage_history`, `communication_logs` to **prove no writes**.
- Snapshot per-lead `current_stage`, `current_status`, `updated_at`, `assigned_admin_id` before/after to **prove no lifecycle/lender mutation**.

No INSERT/UPDATE/DELETE anywhere. No edge-function invocation. No "Run BRE" UI button (which is itself read-only but also unnecessary here).

## Per-Lead Checks Captured
1. **Crash-free** (`evaluate` throws? → recorded with lead_id + message).
2. **Bucket calculation** — Student / University / Co-applicant scores returned.
3. **Rejection reasons** — tallied across all leads, top 15 reported.
4. **University tier on matched leads** — count of leads where `university_id` resolved AND `university_tier` ended up null (should be 0 after the fix).
5. **Fuzzy raw-name path** — sync mapper returns null tier when no `university_id`; matches UI's behavior on these leads (no false-positive matches).
6. **Course level (`course_category`)** — derived vs missing counts.
7. **English proficiency source** — named-test / Other-Test-Scores fallback / missing.
8. **Lender availability vs bucket gating** — if any eligible lender is returned while a bucket is below `bucket_threshold`, flagged as suspicious.

## Write-Verification Outputs
The report ends with hard before/after deltas:
- Mutated leads: must be **0**
- `lead_lender_matches` Δ: must be **0**
- `lead_stage_history` Δ: must be **0**
- `communication_logs` Δ: must be **0**

If any Δ ≠ 0, that is reported as a finding (not auto-fixed).

## Final Summary Report Sections
- Total leads checked
- Crashes/errors (with lead IDs)
- Passed checks vs failed checks vs not-verified
- University tier mapping correctness (0 expected null for matched)
- Course level derivation counts
- English proficiency source breakdown
- Top recurring rejection reasons (top 15)
- Suspicious mapping cases (lender + failing bucket)
- Confirmation of zero writes (with Δ counts)
- Confirmation no assignment / status / communication changed

## What I Will NOT Touch
- ❌ Any source file under `src/`
- ❌ DB schema, RLS, master data, leads, documents
- ❌ Lender assignment, lender rules, scoring config
- ❌ Lifecycle/status, payout, communication
- ❌ Student Portal, Partner Portal
- ❌ Any "Run BRE", "Send to Lender", or workflow buttons in the UI

The only artifact created is `scripts/bre-broad-qa.ts` (a dev-only QA script, not imported by the app). After QA, I can delete it if you prefer; it has no runtime effect either way.

## Risks
- **None to data.** Script does only `SELECT`s and uses the in-memory engine.
- Possible runtime errors in `evaluate` for unusual lead shapes — these are CAUGHT and reported, not propagated.

## Rollback
Nothing to roll back — no code or data is mutated. If asked, I will delete `scripts/bre-broad-qa.ts` after QA.

## What I Need From You
Approve switching to default mode so I can:
1. Create `scripts/bre-broad-qa.ts`
2. Run it once with `bun scripts/bre-harness-bootstrap.ts` style invocation (read-only)
3. Paste the full summary report back into chat
4. (Optional) delete the script
