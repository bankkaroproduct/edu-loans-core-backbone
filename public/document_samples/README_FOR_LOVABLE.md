# EduLoans · Document Sample Assets (Dummy)

## What this is

A set of 21 dummy "sample" document images that power the **View Sample** modal
inside the EduLoans document upload UI. Each image is 1200x800 PNG and shows a
student or co-applicant where to locate the required fields on their real
document before uploading it.

All assets are clearly watermarked **SAMPLE ONLY - NOT A REAL DOCUMENT** and
carry the footer line "For upload guidance only".

## What this is NOT

- Not a real document or a template that can be filled in.
- Not a legally valid form.
- Not a substitute for KYC, OCR, or any backend validation.

## Authenticity boundaries

The visual layouts resemble the real-world documents closely enough that a
student can place their own document next to the sample and find the same
fields in the same positions. To stay safely on the "sample" side of the line,
the images use:

- Generic placeholder marks ("Sample Govt Icon", "Sample ID Authority")
  instead of any real emblem or logo.
- Dummy values for all numbers, names, dates, and references - no real PII
  and no scannable / valid identifiers.
- Non-functional QR code placeholders that do not encode any real data.
- The watermark "SAMPLE ONLY - NOT A REAL DOCUMENT" diagonally across every
  image, plus a red badge in the top-right corner.

## Folder structure

```
01_Student_Profile_Identity/
02_Education_Academic_History/
03_Admission_Study_Intent/
04_Test_Scores/
05_Coapplicant_Profile_Identity/
06_Coapplicant_Financial_Documents/
07_Collateral_Secured_Loan_Documents/
```

## Manifest files

- `document_sample_manifest.json` - structured asset metadata for the app
- `document_sample_manifest.csv`  - same data in tabular form

Each manifest entry has:

| Field | Meaning |
|---|---|
| document_name | Display label shown to the user |
| section_name | Folder / section name in this package |
| sample_file | Image file name |
| relative_path | Path from the package root |
| helper_text | Short caption shown under the document slot |
| sample_instruction | Body text rendered inside the View Sample modal |
| important_visible_fields | List of fields the user must be able to locate on their real document |

## How to wire into the UI

1. Drop the folder structure into your assets directory (CDN or `/public/document_samples/`).
2. When the user clicks the **View Sample** button next to a document slot,
   look up the matching entry by `document_name` (or by a stable
   `document_code` you maintain server-side).
3. Render the matched sample image inside the modal.
4. Use `sample_instruction` as the modal body text.
5. Optionally, render `important_visible_fields` as a checklist inside the
   modal so users see exactly which fields they must be able to find on
   their own document.
6. If a document name does not match any manifest entry, fall back gracefully
   (hide the View Sample button or show a "Sample not available" message).

## What NOT to change

- Do NOT use these assets as actual document content or templates.
- Do NOT change upload / status / verification / backend logic to depend on them.
- Do NOT remove the "SAMPLE ONLY - NOT A REAL DOCUMENT" watermark from any
  asset.
- Do NOT swap dummy data with real PII.

## Regeneration

The Python scripts that produce these assets live in:

- `lib_common.py`     - shared helpers, watermark and footer
- `gen_identity.py`   - folder 01 + 05
- `gen_education.py`  - folder 02
- `gen_other.py`      - folders 03, 04, 06, 07
- `build_all.py`      - orchestrator (regenerates everything + ZIP + manifests)

To regenerate after edits, run `python build_all.py` from the same folder.
