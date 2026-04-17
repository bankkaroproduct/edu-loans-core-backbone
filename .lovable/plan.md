# Document Authenticity & Mismatch-Detection — Refined Implementation Plan

## Refinements from review

1. **Single shared validator path** — one TS module + one edge function endpoint used by both Student and Partner uploads. No duplicated logic.
2. **Richer `validation_result`** — keeps `extracted_name_candidate`, adds `matched_name_tokens`, `unmatched_expected_tokens`, and a clear `inconclusive_reason` so `mismatch` vs `inconclusive` is never ambiguous.
3. **Override rules explicit** — strong-signal docs (PAN/Aadhaar/Passport/Salary Slip/ITR) allow override for **partner_admin**, **partner_agent**, and **student**, but every override is recorded with actor + role + timestamp. Admin sees these in a separate "Overridden" bucket.
4. **Phase 1 image behavior** — JPG/PNG uploads still succeed with full L1 validation; L2/L3 are explicitly skipped and the chip reads `Validation pending (image)` (neutral, not amber). No silent green checkmarks, no false alarms.
5. **Admin-readiness** — `overall_flag` has 5 distinct values: `ok`, `warn_name`, `warn_type`, `review_needed` (high-confidence type mismatch + override used), `inconclusive` (extraction failed). Admin can filter on each independently.

---

## Architecture: where this hooks in

- **Partner upload path:** `DocumentUploadDialog.tsx` → uploads to storage + writes `lead_documents` directly → **then calls shared `validate-document` edge function** with the new row id.
- **Student upload path:** `student-application` edge function (`handleUploadDocument`) → uploads to storage + writes `lead_documents` → **calls the same shared validator** internally.
- **Shared validator:** new edge function `validate-document` that:
  - Loads the `lead_documents` row + parent `student_leads` row + `document_master.document_code`
  - Runs L2 (type) + L3 (name) using shared rule modules
  - Writes `validation_result` jsonb back to `lead_documents`
  - Returns the result to the caller
- **Shared rule logic** lives in `supabase/functions/_shared/validation/` (rules.ts, normalizeName.ts, matchNames.ts, decide.ts) — imported by both `student-application` and `validate-document`.
- No changes to bulk upload, no changes to L1 file-validation flow, no changes to RLS.

---

## 1. Validation Model

| Layer | Check | Enforcement |
|---|---|---|
| **L1 file** | type, size, non-empty | hard reject (existing) |
| **L2 type** | does file content match the document slot's expected code? | warning by default; **soft block** only for high-confidence mismatch on strong-signal codes |
| **L3 name** | does extracted name match expected student/co-applicant? | warning only |

L2 + L3 run **after** the storage write succeeds, in the shared validator. UI shows "Validating…" then renders the chip when result returns (typical 1-3s for PDFs, skipped for images in Phase 1).

---

## 2. Document Categories & Rules

Driven by `document_master.document_code` (a single shared rule table — no master-data change):

| Code | Type-check signals | Name-check target | Strong-signal? |
|---|---|---|---|
| PAN | regex `[A-Z]{5}[0-9]{4}[A-Z]` + "INCOME TAX"/"PERMANENT ACCOUNT" | student or coapplicant | **Yes** |
| AADHAAR | 12-digit pattern + "Government of India"/"आधार"/"UIDAI" | student | **Yes** |
| PASSPORT | regex `[A-Z][0-9]{7}` + "REPUBLIC OF INDIA"/"PASSPORT" | student | **Yes** |
| MARK_10 / MARK_12 | "marksheet"/"board"/"central board"/"CBSE"/"ICSE" | student | No |
| GRAD_MARK / GRAD_DEGREE | "university"/"bachelor"/"degree"/"transcript" | student | No |
| ADMIT_LETTER / I20_CAS | "offer"/"admission"/"I-20"/"CAS"/university name | student | No |
| IELTS_TOEFL / GRE_SCORE | "IELTS"/"TOEFL"/"GRE"/"score" | student | No |
| SALARY_SLIP | "salary"/"pay slip"/"net pay"/"earnings"/"CTC" | coapplicant | **Yes** |
| ITR | "income tax return"/"ITR-V"/"assessment year" | coapplicant | **Yes** |
| BANK_STMT | "statement of account"/"IFSC"/"closing balance" | coapplicant | No |
| PROPERTY_DOC | "sale deed"/"property"/"sub-registrar" | coapplicant (warn-only) | No |

Unknown codes → no validation (safe default — adding new docs never breaks uploads).

---

## 3. Name-Match Logic

**Normalize** (`normalizeName`):
1. Lowercase + trim
2. Strip honorifics: `mr`, `mrs`, `ms`, `dr`, `shri`, `smt`, `master`, `mx`, `father`, `mother`
3. Remove punctuation `.,-/`
4. Collapse whitespace
5. Tokenize; mark single-letter tokens as initials

**Match** (`matchNames(extracted, expected)`):
- Token-set comparison; initials match by first letter
- Levenshtein tolerance: ≤1 for tokens ≥5 chars, ≤2 for ≥8 chars
- `score = matched_tokens / max(expected_tokens, extracted_tokens)`

**Bands:**
| Score | Verdict |
|---|---|
| ≥ 0.7 | `match` |
| 0.4–0.7 | `partial_match` (subtle info, no warning) |
| < 0.4 | `mismatch` (amber warning) |
| no name extracted | `inconclusive` (silent for user, visible to admin) |

---

## 4. Document-Type Validation

**Phase 1 extraction:**
- PDF → `pdf-parse` (Deno-compatible) inside shared validator
- JPG/PNG → **skipped**; verdict = `inconclusive` with `inconclusive_reason: "image_ocr_pending_phase_2"`. UI shows neutral "Validation pending (image)" chip.

**Rule application:** each rule has `keywords[]`, `regexes[]`, `requiredHits`. Confidence:
- `high` = regex match + ≥2 keywords (or regex alone for PAN/Passport)
- `medium` = regex OR ≥2 keywords
- `low` = 1 keyword
- `none` = no signal

**Verdict:**
- `type_match` = requiredHits met
- `type_mismatch_high` = strong contradicting signals (e.g., salary keywords in PAN slot) — only this triggers soft block
- `type_unconfirmed` = no clear signal either way (warning chip, no block)

---

## 5. Warning vs Block Decision Framework

| Condition | Action |
|---|---|
| L1 fails | Hard block (existing) |
| L2 = `type_mismatch_high` AND code is strong-signal | **Soft block** — modal: "This doesn't look like a {DocName}. Upload anyway?" — allowed for all roles (partner_admin / partner_agent / student); override stamps `overall_flag: review_needed` |
| L2 = `type_unconfirmed` | Amber chip "May not be a {DocName}"; upload accepted |
| L3 = `mismatch` (strong-signal types) | Amber chip "Name on document may not match…"; upload accepted |
| L3 = `partial_match` | Subtle info chip; no friction |
| L3 = `inconclusive` (PDF parse failed or Phase 1 image) | Neutral chip "Validation pending"; admin sees `overall_flag: inconclusive` |

**Override is never silent.** Every override writes actor, role, timestamp, and reason snapshot into `validation_result.override`.

---

## 6. Data Fields to Store

Single new column on `lead_documents`:

```sql
ALTER TABLE public.lead_documents ADD COLUMN validation_result jsonb;
```

Shape:
```json
{
  "validated_at": "2026-04-17T12:00:00Z",
  "validator_version": "v1",
  "extraction": {
    "method": "pdf_text" | "ocr_gemini" | "skipped_image",
    "success": true,
    "text_length": 1842,
    "inconclusive_reason": null
  },
  "type_check": {
    "expected_code": "PAN",
    "verdict": "type_match" | "type_unconfirmed" | "type_mismatch_high",
    "confidence": "high" | "medium" | "low" | "none",
    "matched_keywords": ["INCOME TAX", "PAN"],
    "matched_regex": true
  },
  "name_check": {
    "expected_name": "Sanjay Mehra",
    "expected_subject": "student" | "coapplicant",
    "extracted_name_candidate": "SANJAY K MEHRA",
    "matched_name_tokens": ["sanjay", "mehra"],
    "unmatched_expected_tokens": [],
    "verdict": "match" | "partial_match" | "mismatch" | "inconclusive",
    "score": 0.67
  },
  "overall_flag": "ok" | "warn_name" | "warn_type" | "review_needed" | "inconclusive",
  "override": null | {
    "by_user_id": "uuid",
    "by_role": "partner_agent" | "partner_admin" | "student",
    "at": "2026-04-17T12:00:00Z",
    "reason_snapshot": "type_mismatch_high on PAN slot"
  }
}
```

JSONB on `lead_documents` (versioned naturally with each upload). Admin queries: `WHERE validation_result->>'overall_flag' IN ('review_needed','warn_type','warn_name','inconclusive')`.

---

## 7. UI Messaging

**During upload:** "Validating document…" subline post-success, replaced by chip.

**Chips on checklist (DocumentChecklist + student doc center):**
- `✓ Authenticated` — both checks passed
- `⚠ Name may not match` — `warn_name`
- `⚠ May not be a {DocName}` — `warn_type`
- `⚠ Flagged for review` — `review_needed` (override used)
- `· Validation pending` (neutral) — `inconclusive` (Phase 1 images, encrypted PDFs)

Hover: full extracted vs expected name + matched tokens for transparency.

**Soft-block dialog:** strong-signal type mismatch only. Two buttons: "Choose different file" / "Upload anyway". Override path records to `validation_result.override`.

---

## 8. Testing Scenarios

**Unit:** normalizeName, matchNames (12 cases incl. `Sanjay Mehra` ↔ `Sanjay K Mehra`, `S. Mehra`, `Mr. Sanjay Mehra`, OCR variant `Sanjat`), applyTypeRule, decideOverallFlag (all combos).

**Integration:**
- PAN PDF → `type_match`, `name_check.match`, chip green
- Salary slip into PAN slot → soft block → "Upload anyway" → `review_needed` recorded
- PAN with different name → amber name chip, upload succeeds
- Encrypted PDF → `inconclusive` neutral chip
- JPG (Phase 1) → `inconclusive: image_ocr_pending_phase_2` neutral chip
- Reupload → new version's `validation_result` is fresh; old version's `is_latest=false`

**Runtime QA after build:**
- Partner uploads PAN → ✓ chip
- Partner uploads salary slip into 10th Marksheet slot → soft block path
- Same flows from student portal
- Refresh → chips persist
- Admin lead detail → chips visible (read-only)

---

## 9. Risks & Limitations

- **Phase 1 image uploads = `inconclusive`** by design; communicated via neutral chip (not amber) so users aren't alarmed
- **OCR hallucination** (Phase 2) mitigated by requiring extracted name to be a contiguous substring of OCR output
- **Performance:** 1-3s for PDFs; runs after storage write so upload latency unchanged. Edge function uses `EdgeRuntime.waitUntil` if needed
- **Privacy:** raw extracted text NOT stored — only candidate name + matched tokens
- **Master data:** unknown `document_code` → noop (safe)
- **No FK cascades:** `validation_result` is plain jsonb on the existing row

---

## 10. Phased Rollout

### Phase 1 — Foundation (PDF only, shared validator, both portals)
1. Migration: `ALTER TABLE lead_documents ADD COLUMN validation_result jsonb`
2. Shared modules in `supabase/functions/_shared/validation/`: `rules.ts`, `normalizeName.ts`, `matchNames.ts`, `decide.ts`
3. New edge function `validate-document` (POST `{ lead_document_id }` → returns `validation_result`)
4. `student-application` edge function: after upload, call shared validator inline
5. Partner `DocumentUploadDialog`: after upload+insert, invoke `validate-document`, await result, render chip
6. UI chips on `DocumentChecklist.tsx` + student doc center
7. Soft-block dialog for strong-signal type mismatch (with override recording)

### Phase 2 — OCR for images
- Lovable AI Gateway (`google/gemini-2.5-flash`) inside shared validator for JPG/PNG
- Toggle via env flag `ENABLE_IMAGE_OCR`

### Phase 3 — Admin visibility
- Surface chips on admin lead document panel
- Admin filter: `review_needed`, `warn_*`, `inconclusive` as separate buckets
- Telemetry on override rate to tune thresholds

**No phase breaks the existing upload flow.** Each phase is purely additive.
