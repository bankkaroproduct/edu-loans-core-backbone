
# Prompt 3: Student Post-Submit Experience (Refined)

## Overview
Build 2 new pages — Recommendation Result (`/student/recommendations`) and Student Document Center (`/student/documents`) — plus update Continue page with state-driven CTAs. All data via existing `student-application` edge function. No schema changes.

---

## 1. Edge Function: 3 New Actions

Added to `supabase/functions/student-application/index.ts`:

**`load_recommendations`**: Query `lead_lender_matches` JOIN `lenders` for student's lead. Filter out `not_eligible` server-side. Strip `bre_output_json` — never sent to client. Return matches array + lead summary fields (country, university, course, loan amount, intake, coapplicant_name).

**`load_documents`**: Query `lead_document_requirements` JOIN `document_master` + `lead_documents` (latest versions only). Sanitize remarks (filter unsafe keywords: `internal`, `ops`, `escalat`, `partner`, `commission`, `payout` → replace with generic safe message). Return requirements + documents + summary counts.

**`upload_document`**: Accept multipart/form-data. Parse file + phone + lead_id + requirement_id. Verify phone↔lead ownership. Validate file type (PDF/JPG/PNG) and size (≤10MB). Upload to `lead-documents` bucket via service role. Mark prior versions `is_latest = false`. Insert `lead_documents` row. Update requirement status to `uploaded`.

All actions verify `student_phone` matches provided phone before returning data. `lead_id` mismatch → 403.

---

## 2. Page 8: Recommendation Result (`/student/recommendations`)

### File: `src/pages/student/StudentRecommendations.tsx`

### Sections (top to bottom):

**A. Header**
- Title: "Your Loan Options"
- Subtext: "Based on your profile, here are your recommended lending partners. These may be refined as your application progresses."

**B. Application Summary Strip**
- Compact row: destination country · university · course · loan amount · intake · co-applicant yes/no

**C. Provisional Notice (conditional)**
- Shown when lead still has pending documents or is under review
- Soft amber banner: "These options are based on your current profile. Final matching may improve once your documents are reviewed."
- Not shown when documents are complete and case is fully reviewed

**D. Recommendation Cards**
Each card includes:
- Lender name
- Fit label badge (Best Fit / Good Fit / Worth Considering) mapped from `fit_category`
- `recommendation_reason_summary` as main description
- **"Why this suits you" section** — 2–3 bullet points derived from available data:
  - If `supported_countries` includes student's country → "Specializes in loans for [country]"
  - If `loan_amount_min/max` brackets the student's amount → "Covers your requested loan amount"
  - If `processing_time_days` ≤ 14 → "Fast processing — typically within [X] days"
  - If `supports_collateral` matches student's collateral status → "Supports your collateral profile"
  - If `supports_unsecured` and no collateral → "Offers unsecured loan options"
  - Fallback: use `recommendation_reason_summary` split into bullets
- Processing time indicator if available
- CTA: "Continue with this option" → navigates to `/student/documents`

Ordered by `recommendation_rank`.

**E. "Why These Options" Educational Block**
- Small card explaining recommendations depend on: destination/university, course profile, co-applicant/financial context, application completeness
- Student-friendly, 4 short bullets with icons

**F. "What Happens Next" Guided Steps Strip**
Horizontal or vertical step indicator showing:
1. ✓ Application Submitted
2. → Review & Matching (current or done)
3. Complete Required Documents
4. Case Review & Lender Submission
5. Approval & Sanction
6. Disbursal

Current step highlighted based on lead `current_stage`. Future steps greyed. Reduces anxiety.

**G. Trust & Reassurance Strip**
3-column subtle strip (matches Prompt 1 pattern):
- 🧭 Guided Support — "Expert guidance through every step"
- 🏦 Multi-Lender Access — "Compare options in one journey"
- 👁 Real-Time Visibility — "Track your case progress anytime"

**H. Next-Step Guidance Panel**
Contextual single-action block:
- Has pending docs → "Upload your required documents to move ahead" + CTA to `/student/documents`
- Under review → "Your profile is being reviewed for the best fit"
- All complete → "Your application is progressing — we'll update you"

**I. Support CTA**
"Need help understanding your options?" → mailto or help link

### Recommendation States Handled:

| Condition | UI |
|---|---|
| Lead not submitted | Redirect to `/student/continue` |
| No matches yet (BRE pending) | "Under Review" state with timeline, "What Happens Next" strip, trust block |
| Matches exist, some visible | Cards + guidance |
| All matches `not_eligible` (filtered out) | Explicit fallback: "We're exploring additional options for your profile. This doesn't mean you're ineligible — our team is reviewing your case for the best possible match." + document completion nudge + support CTA |
| Provisional (matches exist but docs pending) | Cards shown with amber provisional notice |
| Error loading | Retry button + support fallback |

---

## 3. Page 9: Student Document Center (`/student/documents`)

### File: `src/pages/student/StudentDocuments.tsx`

### Sections (top to bottom):

**A. Header + Context Strip**
- Title: "Document Center"
- Subtext: "Upload and track the documents required for your loan application"
- Case context: Lead ID · Current stage (student-safe label) · Last updated

**B. Readiness Action Banner**
Prominent top banner, contextual:
- 🔴 "2 required documents still need upload" (action-needed count > 0)
- 🟡 "1 document needs re-upload before your case can proceed" (reupload count > 0)
- 🔵 "All documents uploaded — under review" (all uploaded, none rejected)
- 🟢 "All required documents are complete" (all verified/waived)
- ⚪ "No documents have been assigned yet — check back soon" (no requirements)

**C. Document Summary Strip**
Visual count cards: Total · Pending · Uploaded · Under Review · Verified · Action Needed

**D. Document Checklist (main body)**
Each document card/row shows:
- Document name (from `document_master.document_name`)
- Required / Optional badge
- Current status with student-safe label mapping:
  | Internal | Student Label | Color |
  |---|---|---|
  | not_uploaded | Pending Upload | Gray |
  | uploaded | Uploaded | Blue |
  | under_review | Being Reviewed | Amber |
  | verified | Verified ✓ | Green |
  | rejected | Action Needed | Red |
  | reupload_needed | Action Needed | Red |
  | waived | Not Required | Gray |
  | not_applicable | Not Required | Gray |
- Latest uploaded file name + timestamp if available
- Sanitized reason shown inline for rejected/reupload items
- "What we need" helper text for action-needed items:
  - Generic guidance like "Please ensure the document is clear, complete, and matches your application details"
  - If sanitized remark exists, show it as the primary guidance
- Action button: Upload / Re-upload / View File

**E. Upload / Re-upload Dialog**
### File: `src/components/student/StudentDocumentUploadDialog.tsx`
- Shows which document is being uploaded (name + requirement context)
- If re-upload: shows sanitized rejection reason at top
- File picker with validation (PDF/JPG/PNG, ≤10MB)
- Upload via multipart to edge function
- Progress indicator
- Success confirmation → row updates
- Error handling with retry

**F. Document Readiness Guidance Panel**
Bottom panel with contextual next-step:
- "Upload your pending documents so your case can move to the next stage"
- "All documents look good — your application is progressing"
- "Once re-uploads are reviewed, your case will continue"

**G. Trust Strip**
Same 3-column trust strip as recommendation page (consistent experience)

**H. Support CTA**
"Not sure which document to upload?" → help link

---

## 4. Continue Page: State-Driven Post-Submit CTAs

### File: `src/pages/student/StudentContinue.tsx`

When lead is submitted, fetch recommendation count + document action-needed count on mount via edge function.

**CTA Priority Rule (strict order):**
1. If action-needed documents exist (rejected/reupload/not_uploaded required) → **Primary CTA**: "Complete Required Documents" → `/student/documents`; Secondary: "View Loan Options" → `/student/recommendations` (if matches exist)
2. Else if recommendations available → **Primary CTA**: "View Your Loan Options" → `/student/recommendations`; Secondary: "View Documents" → `/student/documents`
3. Else → Non-clickable guidance: "Your Profile is Under Review" with supportive text

Only ONE primary CTA. Secondary is smaller/outlined.

---

## 5. Analytics / Event Tracking Hooks

Lightweight `console.log`-based tracking hooks at key points (ready for future analytics integration):
- `student.recommendations.viewed` — on page mount
- `student.recommendation.card_clicked` — lender card interaction
- `student.documents.viewed` — on page mount
- `student.document.upload_started` — upload dialog opened
- `student.document.upload_completed` — successful upload
- `student.document.reupload_initiated` — re-upload action
- `student.support.clicked` — support CTA clicked

No external analytics service needed now. Just structured console events.

---

## 6. Shared Student–Partner–Admin Linkage

Explicitly confirmed:
- Student document uploads write to `lead_documents` table — same table Partner/Admin reads
- Document requirement statuses in `lead_document_requirements` — same table Partner/Admin manages
- Recommendation matches from `lead_lender_matches` — same table Admin populates via BRE
- Student uploads are visible to Partner/Admin in the shared case view
- No disconnected student-only data model
- Edge function uses service role to bypass RLS, but all reads/writes target the shared schema

---

## 7. Routes Added

```
/student/recommendations → StudentRecommendations
/student/documents → StudentDocuments
```

---

## 8. Files Changed

| File | Change |
|------|--------|
| `supabase/functions/student-application/index.ts` | Phone↔lead verification, 3 new actions, remark sanitization |
| `src/pages/student/StudentRecommendations.tsx` | New — full recommendation page |
| `src/pages/student/StudentDocuments.tsx` | New — full document center |
| `src/components/student/StudentDocumentUploadDialog.tsx` | New — upload dialog |
| `src/pages/student/StudentContinue.tsx` | State-driven post-submit CTAs with priority |
| `src/App.tsx` | 2 new routes |

## 9. No Schema Changes
All tables and columns already exist.

## 10. Deferred to Prompt 4
- Full Application Tracker page
- Real-time push notifications
- Student dashboard unified view
- Document version history UI
- Full analytics service integration
