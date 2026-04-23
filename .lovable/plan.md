

# BRE Engine Bug Fixes — Hard-Gate Status Override + Age Cap + Dynamic Loan Cap Message

Three real defects exposed by the test matrix, plus two clarifications. All fixes live in `src/lib/bre/engine.ts` and `src/lib/bre/reasons.ts`. No DB changes, no UI changes, no schema changes.

## Defect summary (verified against current engine code)

| Bug | Root cause in code | Affected scenarios |
|---|---|---|
| 1 | Final status derived purely from `overall_score` → band lookup. Hard knockouts (cap, country, missing field) are reflected in `eligible_lenders[].eligible=false` but not in `eligibility_status`. | S10, S11, S20 |
| 2 | `evaluate()` checks `min_age` / `max_age` against lender thresholds per-lender but no engine-level guard exists, AND lender rules currently have `max_age` as null for some entries. The 60-cap is a business rule that must apply universally. | S14 |
| 3 | Rejection reason builder formats the threshold from a single lender's `loan_caps`, not the global max across all active lenders for the chosen route. | S10 (and any cap-knockout case) |

## Fix 1 — Hard-gate status override

In `engine.ts`, **after** computing `overall_score`, `overall_band`, and `eligible_lenders`, add a final override block:

```text
hardGateFailed =
  eligible_lenders.length === 0
  OR eligible_lenders.every(l => !l.eligible)
  OR profile.destination_country is missing/empty
  OR profile.loan_amount is missing/<=0

if (hardGateFailed) {
  eligibility_status = "Rejected"
  rejection_reasons.unshift("Hard eligibility gate failed — no lender can fund this profile")
}
```

This runs **after** score-based status is set, so a high-score profile with zero eligible lenders correctly flips to Rejected.

## Fix 2 — Universal co-applicant age cap (max 60)

Add a pre-scoring guard in `evaluate()`:

```text
COAPPLICANT_AGE_CAP = 60   // exported constant in engine.ts

if (profile.coapplicant.age != null && profile.coapplicant.age > COAPPLICANT_AGE_CAP) {
  // mark every lender ineligible with the same reason
  // force eligibility_status = "Rejected"
  // push "Co-applicant age N exceeds maximum permitted age 60"
}
```

This runs once, universally, before per-lender knockouts. Bucket scoring still executes (so the trace remains complete for audit) but lenders are pre-marked ineligible.

## Fix 3 — Dynamic loan-cap message

In `reasons.ts` (or wherever the cap-exceeded message is built), replace the per-lender lookup with a global-max lookup:

```text
function getMaxCapForRoute(rules, route):
  caps = []
  for r in rules where r.is_active:
    if route == "secured":      caps.push(r.loan_caps.secured.max)
    if route == "unsecured":    caps.push(r.loan_caps.unsecured.max)
    if route == "either":       caps.push(max(secured.max, unsecured.max))
  return max(caps.filter(non-null))

reason = `Loan amount ₹{loan} exceeds maximum available ₹{globalMax} for {route} route`
```

The per-lender knockout reason on each `LenderMatchResult.reasons` stays as-is (useful for the lender table). The **top-level** `rejection_reasons[]` uses the global figure.

## Files changed

| File | Change |
|---|---|
| `src/lib/bre/engine.ts` | Add `COAPPLICANT_AGE_CAP=60`, pre-scoring age guard, post-scoring hard-gate override |
| `src/lib/bre/reasons.ts` | Add `getMaxCapForRoute()` helper, use it for top-level cap-exceeded reason |
| `src/lib/bre/__tests__/engine.test.ts` | Add 4 unit tests: age-cap rejection, hard-gate override on zero eligible, dynamic cap message, missing destination_country → Rejected |

## Verification plan

1. Re-run the same Node script that built `bre-test-matrix.xlsx` against the patched engine.
2. Confirm S10, S11, S14, S20 now show `eligibility_status = Rejected`.
3. Confirm S10's top rejection reason cites ₹3 Cr (the real global max for `either` route), not ₹1 Cr.
4. Confirm S1–S5, S13, S16–S18 are unchanged (no regression on previously-passing scenarios).
5. Regenerate `bre-test-matrix-v2.xlsx` so you can re-test in the simulator UI.

## Two clarifications you raised

**Scoring formulas (S6/S8/S9 validation):** The math lives in `evaluate()` — `bucket_total = Σ (param.weight × band_score / 100)`. Param weights, bands, and the bucket pass-threshold (60) come from `bre_scoring_configs` (active version) and `DEFAULT_SCORING_CONFIG_V1` in `src/lib/bre/defaults.ts`. I will export the active scoring config to `/mnt/documents/bre-scoring-config-active.json` alongside the v2 matrix so you can verify weights against your business sheet.

**10 vs 12 lender count:** Confirmed — engine reads only `bre_lender_rules WHERE is_active=true`. The 2 inactive ones are excluded by design (matches your spec). No change needed.

## Out of scope

- UI / dashboard / sidebar changes
- Migrating data, adding columns, altering RLS
- Changing scoring weights or band thresholds
- Lead-pipeline / live integration work
- Phase 5

