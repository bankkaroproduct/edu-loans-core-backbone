

# BRE Simulator — Test Scenario Matrix (Input → Expected Output)

You want a **deterministic test sheet**: pre-defined inputs you can paste into `/admin/bre/simulate`, run, and compare the actual UI output against the predicted output side-by-side.

Since I don't have runtime access to compute exact engine outputs ahead of time, the deliverable is a **two-phase artifact**:

1. **Phase A (build)** — I exit plan mode, run each scenario through `evaluate()` in a Node script using the live `DEFAULT_SCORING_CONFIG_V1` + the 10 active lender rules from your DB, and record the exact computed output (overall score, band, status, bucket scores, eligible lender count, best-match lender code, top rejection reasons).
2. **Phase B (deliver)** — Output a single Excel file (`/mnt/documents/bre-test-matrix.xlsx`) with two tabs: **Inputs** (one row per scenario, copy-paste-ready) and **Expected Outputs** (predicted values you compare against).

You then run each scenario in the live simulator and tick PASS/FAIL.

## Scenario set — 20 distinct cases

Each scenario is engineered so the **end result differs** (different status, different eligible count, different best-match lender, or different rejection reason).

| # | Scenario name | Key driver of difference |
|---|---|---|
| 1 | Strong / US / STEM Masters / ₹40L | Baseline approval, expect best-match = lowest-rate lender |
| 2 | Strong / Canada / MBA / ₹60L secured | Different country + collateral mix |
| 3 | Strong / UK / Non-STEM / ₹25L unsecured | Tests unsecured-cap lenders only |
| 4 | Average academics / US / STEM / ₹30L | Band B expected, narrower lender set |
| 5 | Average / Australia / STEM / ₹50L | Country coverage filters several lenders |
| 6 | Borderline / Germany / STEM / ₹35L | Status = Borderline, fewer eligible |
| 7 | Weak co-applicant (CIBIL 640, ₹28K/mo) | Coapplicant bucket fails → Rejected |
| 8 | Weak student (X=40, XII=42, Grad=45) | Student bucket fails → Rejected |
| 9 | Weak university (Tier 3, low employability) | University bucket fails or borderline |
| 10 | Strong but loan ₹50 Cr | All lenders knocked out on cap |
| 11 | Strong but country = "ZZ" (unsupported) | All lenders knocked out on country |
| 12 | Strong + state in one excluded list | One specific lender knocked out |
| 13 | Strong + CIBIL exactly 750 | Boundary check on min_cibil thresholds |
| 14 | Strong + age 64 (near max) | Age threshold edge |
| 15 | Strong + relationship = "sibling" | Allowed-relationship filter on some lenders |
| 16 | Collateral = secured only, ₹80L | FD/property LTV-aware lenders only |
| 17 | Collateral = unsecured only, ₹15L | Unsecured-cap lenders only, different ranking |
| 18 | Collateral = either, ₹40L | Maximum eligible set, route = "both" |
| 19 | Custom blank profile | Graceful Rejected, no crash, all buckets = 0 |
| 20 | Strong + missing destination_country | Knockout cascade, status = Rejected |

## What each row in the deliverable will contain

**Inputs tab columns** (24): scenario_id, scenario_name, loan_amount, destination_country, course_category, course_level, collateral_route, state, class_x_marks, class_xii_marks, graduation_marks, entrance_rank, work_experience_years, english_proficiency, university_tier, country_tier, employability_outlook, relationship, age, employment_type, monthly_income, cibil_score, existing_emi_burden_pct, income_stability_years.

**Expected Outputs tab columns** (12): scenario_id, expected_status (Approved / Approved with conditions / Borderline / Rejected), expected_overall_score, expected_overall_band, expected_student_score, expected_university_score, expected_coapplicant_score, expected_collateral_route, expected_eligible_lender_count, expected_best_match_lender_code, expected_top_rejection_reason, notes.

A third tab **Run Log** is left blank with columns: scenario_id, actual_status, actual_overall_score, actual_best_match, PASS/FAIL, comments — for you to fill in as you run each scenario in the UI.

## What I'll do once approved (default mode)

1. Write a Node script `/tmp/bre-matrix.ts` that:
   - Imports `evaluate` from `src/lib/bre/engine.ts` and `DEFAULT_SCORING_CONFIG_V1` from `src/lib/bre/defaults.ts`
   - Pulls the 10 active lender rules from `bre_lender_rules WHERE is_active=true` via Supabase
   - Runs each of the 20 scenarios through `evaluate()`
   - Collects the exact outputs
2. Generate the Excel file with the three tabs above using openpyxl, then recalculate.
3. Emit the file as a `<lov-artifact>` so you can download it directly.

No source files are modified. No DB writes. Pure read + artifact.

## Out of scope

- Running the scenarios in the UI for you (you'll do that — the whole point is independent verification)
- Live integration with lead pipeline
- Schema changes
- Phase 1/2/3 changes

