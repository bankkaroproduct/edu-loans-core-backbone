# Replace View Sample document images

## Scope
Replace 11 sample images with the new uploads. Sample images are referenced ONLY through `src/data/documentSampleManifest.json` (mirrored in `public/document_samples/document_sample_manifest.json` + `.csv`). All three portals consume `findSampleForDocument()` from `src/lib/documentSamples.ts`, so one set of updates cascades everywhere.

## File replacements (overwrite in place — no code refs change)

| New upload | Target path |
|---|---|
| 01_salary_slip.png | public/document_samples/06_Coapplicant_Financial_Documents/salary_slips_sample.png |
| 02_bank_statement.png | public/document_samples/06_Coapplicant_Financial_Documents/bank_statements_sample.png |
| 03_itr_acknowledgement.png | public/document_samples/06_Coapplicant_Financial_Documents/income_tax_returns_sample.png |
| 04_offer_letter.png | public/document_samples/03_Admission_Study_Intent/admission_offer_letter_sample.png |
| 08_degree_certificate.png | public/document_samples/02_Education_Academic_History/graduation_degree_certificate_sample.png |
| 09_marksheet_10th.png | public/document_samples/02_Education_Academic_History/10th_marksheet_sample.png |
| 10_marksheet_12th.png | public/document_samples/02_Education_Academic_History/12th_marksheet_sample.png |
| 11_property_sale_deed.png | public/document_samples/07_Collateral_Secured_Loan_Documents/property_documents_sample.png |

## I-20 / CAS / CoE — split into 3 entries (per user choice)

1. Add 3 new image files under `public/document_samples/03_Admission_Study_Intent/`:
   - `i20_usa_sample.png` (from 05_i20_usa.png)
   - `cas_uk_sample.png` (from 06_cas_uk.png)
   - `coe_australia_sample.png` (from 07_coe_australia.png)
2. Delete the old combined `i20_cas_coe_sample.png`.
3. Update `src/data/documentSampleManifest.json` AND `public/document_samples/document_sample_manifest.json` + `.csv`: remove the single "I-20/CAS/CoE" entry, replace with three separate entries:
   - `I-20 (USA)` → i20_usa_sample.png
   - `CAS (UK)` → cas_uk_sample.png
   - `CoE (Australia)` → coe_australia_sample.png
   Each keeps the same `section_name`, `helper_text` style, `sample_instruction`, and `important_visible_fields` scoped to the country.
4. Update `src/lib/documentSamples.ts`:
   - `ALIASES`: map `"i20"` → `"I-20 (USA)"`, `"cas"` → `"CAS (UK)"`, `"coe"` → `"CoE (Australia)"`, plus variants (`"i 20"`, `"cas letter"`, `"confirmation of enrolment"`, etc.). Drop the combined `"i20 cas coe"` alias.
   - `FALLBACK_HELPER`: remove `"I-20/CAS/CoE"` key, add the three new canonical keys with country-specific helper copy.

## Not changed
- No modal/component logic or styling
- No "How to get this document?" feature
- No upload, validation, checklist, backend, or routing changes
- Untouched samples: Candidate Photograph, PAN, Aadhaar, Passport, Co-applicant Photograph/PAN/Aadhaar, Graduation Marksheet, Post-Graduation Marksheet, Post-Graduation Degree Certificate, IELTS/TOEFL, GRE

## Verification
- Confirm `findSampleForDocument("I-20")`, `"CAS"`, `"CoE"`, `"Salary Slip"`, `"10th Marksheet"`, `"Property Sale Deed"` resolve to the correct new images.
- Spot-check the View Sample modal on student/partner/admin document pages (all use `SampleDocumentModal`).
