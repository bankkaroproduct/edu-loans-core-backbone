

# BRE Test Matrix — Run, Capture, Deliver

You're right. Forget the two-phase abstraction. The deliverable is **one Excel file** with the inputs I used and the outputs the engine actually produced. You then re-enter the same inputs in `/admin/bre/simulate` and check whether the UI matches.

## What I'll do

1. Read the live active scoring config + 10 active lender rules from the DB.
2. Write a single Node script that imports the real `evaluate()` from `src/lib/bre/engine.ts`.
3. Run all 20 scenarios through it.
4. Capture the **actual** output of each run (no predictions, no guesses — recorded results).
5. Write everything to `/mnt/documents/bre-test-matrix.xlsx`.
6. Emit it as a downloadable artifact.

## Excel file structure — 2 tabs only

### Tab 1: `Inputs`
One row per scenario. Columns:
- scenario_id, scenario_name
- loan_amount, destination_country, course_category, course_level, collateral_route, state
- Student bucket fields: class_x_marks, class_xii_marks, graduation_marks, entrance_rank, work_experience_years, english_proficiency
- University bucket fields: university_tier, country_tier, employability_outlook
- Co-applicant bucket fields: relationship, age, employment_type, monthly_income, cibil_score, existing_emi_burden_pct, income_stability_years

### Tab 2: `Outputs` (captured from engine, not predicted)
Same scenario_id key. Columns:
- overall_score
- overall_band
- eligibility_status
- student_bucket_score, student_passes
- university_bucket_score, university_passes
- coapplicant_bucket_score, coapplicant_passes
- collateral_route
- eligible_lender_count
- best_match_lender_code
- top_3_lender_codes
- top_rejection_reason
- eligible_loan_min, eligible_loan_max
- indicative_rate_min, indicative_rate_max

## How you use it

1. Open the file.
2. Pick scenario #N from the **Inputs** tab.
3. Type those exact values into the simulator.
4. Compare the simulator's result panel against scenario #N row in the **Outputs** tab.
5. Match = engine working correctly. Mismatch = real bug to investigate.

## 20 scenarios (each engineered to produce a different output)

1. Strong / US / STEM Masters / ₹40L
2. Strong / Canada / MBA / ₹60L secured
3. Strong / UK / Non-STEM / ₹25L unsecured
4. Average / US / STEM / ₹30L
5. Average / Australia / STEM / ₹50L
6. Borderline / Germany / STEM / ₹35L
7. Weak co-applicant (CIBIL 640, ₹28K/mo)
8. Weak student (X=40, XII=42, Grad=45)
9. Weak university (Tier 3)
10. Strong + ₹50 Cr loan (cap knockout)
11. Strong + country "ZZ" (country knockout)
12. Strong + excluded state
13. Strong + CIBIL exactly 750
14. Strong + age 64
15. Strong + relationship "sibling"
16. Secured-only / ₹80L
17. Unsecured-only / ₹15L
18. Either route / ₹40L
19. Blank profile
20. Missing destination_country

## What's NOT in the file

- No "expected" column (predictions are useless — the engine IS the source of truth)
- No PASS/FAIL column (you fill that in mentally as you compare)
- No third tab

## Out of scope

- UI changes
- Engine changes
- DB writes
- Phase 1/2/3 work
- Live pipeline integration

