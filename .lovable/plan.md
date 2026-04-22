
# Phased BRE Build — Phase 1 Approval Request

## Pre-Build Verification (against live DB)

### 1. Existing `lenders` columns available for seeding
Confirmed present and usable:
- `loan_amount_min`, `loan_amount_max` (numeric)
- `supported_countries` (text[], ISO codes — already populated for all 10 lenders)
- `supports_collateral`, `supports_unsecured` (boolean)
- `processing_time_days` (integer, populated)
- `income_expectations_min` (numeric, populated)
- `lender_type` (text: NBFC / Private Bank / Public Bank / International)
- `active_flag` (boolean)

**Not present** in current schema (will be seeded as null/default-safe in BRE rule JSON, never invented):
- payout %, payout trigger, processing fee
- ROI / interest-rate ranges
- CIBIL / age / DPD / salary thresholds
- collateral LTV %, loan caps split secured/unsecured
- excluded states, accepted course list, university tier list
- tenure / moratorium policy

### 2. Existing user role distribution (for `bre_permission` seed)
- `super_admin`: 2 → seed `full`
- `admin`: 2 → seed `edit`
- `partner_admin`: 2 → seed `none`
- `partner_agent`: 4 → seed `none`

### 3. `audit_logs` schema
Generic — `entity_type` is free `text`, no enum. **No schema change needed.** Can immediately accept `bre_scoring_config`, `bre_lender_rule`, `bre_simulation`. Existing entity types in use: `bulk_upload_batch`, `lead_edit_request`, `lead_note`, `student_lead`.

### 4. Lenders to seed (10 active rows)
Avanse, Axis Bank, Bank of Baroda, HDFC Credila, ICICI Bank, InCred Finance, MPOWER Financing, Prodigy Finance, SBI, Union Bank of India.

---

## Phase 1 Scope (DB + Engine Foundation only)

**No UI. No routes. No sidebar changes. No pages.** Strictly the data and pure-TS engine layer.

### Files to create

**Migration (single SQL file)**
1. `bre_scoring_configs` table + RLS (admin-only ALL).
2. `bre_lender_rules` table + RLS (admin-only ALL) + unique `(lender_id, version_number)`.
3. `bre_simulation_runs` table + RLS (admin-only ALL).
4. Partial unique indexes:
   - `bre_scoring_configs (is_active) WHERE is_active = true` — at most one global active version.
   - `bre_lender_rules (lender_id) WHERE is_active = true` — at most one active rule per lender.
5. Validation triggers (no CHECK, per safe-migration rules):
   - `bre_validate_scoring_config_trg` — on insert/update verifies each bucket's weights sum to 100, bands non-overlapping, scores within 0–100. Raises clear exceptions on failure.
6. `lenders` add nullable `bre_rule_id uuid`.
7. `users` add `bre_permission text default 'none'` with CHECK constraint on the value enum (immutable, safe).
8. Seed:
   - One `bre_scoring_configs` v1 row, `is_active=true`, with all 6 student / 5 university / 7 co-applicant params from spec section 5, even default weights, default bands, `bucket_threshold=60`, default 5-row `overall_band_mapping`.
   - One `bre_lender_rules` v1 row per existing lender, `is_active=true`, populated only from real columns; unknown sections seeded as explicit defaults (documented below).
   - `users.bre_permission` updated by role: `full` for super_admin, `edit` for admin, `none` for the rest.
   - `lenders.bre_rule_id` backfilled to the active v1 rule.

**TypeScript engine layer** (pure, no React, no Supabase imports)
1. `src/lib/bre/types.ts` — interfaces for `BreScoringConfig`, `BreLenderRule`, `BreProfileInput`, `BreResult`, `ParameterTrace`.
2. `src/lib/bre/defaults.ts` — exported default scoring config object (mirrors what migration seeds; single source of truth for new versions).
3. `src/lib/bre/validate.ts` — `validateScoringConfig()` returns `{valid, errors[]}`; mirrors DB trigger (weight sum 100, no overlap/gap, scores 0–100). Inclusive lower bound, exclusive upper, documented in file header.
4. `src/lib/bre/reasons.ts` — flag → human string dictionary.
5. `src/lib/bre/engine.ts` — `evaluate(profile, scoringConfig, lenderRules[]): BreResult` implementing the full 8-step deterministic logic from spec section 4.
6. `src/lib/bre/__tests__/engine.test.ts` — vitest covering: deterministic output, bucket-threshold rejection, lender knockout, ranking order (rate → loan → payout), empty-eligible-lenders edge case.

### Real-data vs default-safe seed mapping (lender rules JSON)

| BRE rule section | Source | Notes |
|---|---|---|
| `basic_info` | `lender_name`, `lender_code`, `lender_type`, `active_flag` | Real |
| `commercials` | **defaults** | `{ payout_pct: null, payout_trigger: null, processing_fee_pct: null }` — no source columns |
| `hard_thresholds` | **partial** | `min_income` from `income_expectations_min`; CIBIL/age/DPD = null (no source) |
| `loan_caps` | `loan_amount_min`, `loan_amount_max` | Real, applied to both secured & unsecured if both supported; otherwise scoped to whichever is true |
| `collateral_ltv` | **defaults** | `{ fd_ltv: null, residential_ltv: null, commercial_ltv: null }` |
| `coverage` | `supported_countries` | Real; `excluded_states: []`, `accepted_courses: []` (treated as "all") |
| `policy` | `processing_time_days` | Real; ROI ranges, tenure, moratorium = null |

The engine treats `null` thresholds as "not configured → do not knock out", so seeded lenders behave correctly until admins fill in real values via Phase 3.

### Phase 1 QA checklist (exit criteria)

1. ☐ Migration applies cleanly, no warnings beyond pre-existing.
2. ☐ Inserting a second `bre_scoring_configs` row with `is_active=true` fails (partial unique index).
3. ☐ Inserting a second `bre_lender_rules` row with `is_active=true` for same `lender_id` fails.
4. ☐ Validation trigger rejects a scoring config where any bucket's weights ≠ 100.
5. ☐ Validation trigger rejects overlapping bands.
6. ☐ Seed produces exactly: 1 scoring config (v1, active), 10 lender rules (v1, active), 10 `lenders.bre_rule_id` populated.
7. ☐ `users.bre_permission` distribution: 2 full, 2 edit, 6 none — matches role counts above.
8. ☐ `audit_logs` accepts `entity_type='bre_scoring_config'` insert (no schema change required — verified now).
9. ☐ `engine.test.ts` passes all cases including determinism (same input → same output across runs), bucket rejection, ranking, empty-eligible.
10. ☐ Project build clean, no TS errors, no broken imports.
11. ☐ `/admin/lenders`, `/admin`, partner pages, student pages all unchanged and functional.

### Phase 1 rollback strategy

Phase 1 is fully additive — no existing tables altered destructively, no existing code paths touched, no triggers attached to existing tables. Rollback is a single down-migration:

```sql
DROP TABLE IF EXISTS public.bre_simulation_runs CASCADE;
DROP TABLE IF EXISTS public.bre_lender_rules CASCADE;
DROP TABLE IF EXISTS public.bre_scoring_configs CASCADE;
ALTER TABLE public.lenders DROP COLUMN IF EXISTS bre_rule_id;
ALTER TABLE public.users   DROP COLUMN IF EXISTS bre_permission;
DROP FUNCTION IF EXISTS public.bre_validate_scoring_config();
```
Plus deleting `src/lib/bre/`. No partner / student / admin existing flow is affected, so rollback has zero blast radius.

### Out of Phase 1 (deferred to later phases)
- All 7 BRE routes, sidebar group, `BreAccessGate`, all page components.
- Lender editor, scoring editor, band editor.
- Simulation UI, PDF export, Save Scenario.
- Version history UI, audit log UI.
- Live lead-pipeline integration (out of V1 entirely).

---

**Awaiting your approval to execute Phase 1 only.** On approval I will:
1. Run the migration (single call, you'll see the SQL diff to approve).
2. Write the 6 engine-layer files.
3. Run vitest + report results.
4. Stop and hand back the Phase 1 QA report before touching Phase 2.
