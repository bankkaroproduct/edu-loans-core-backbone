

# Student Portal — Prompt 2: Application Capture Flow

## Summary
Build 4 student application form pages (Basic Details, Education Details, Co-applicant, Review & Submit) with save/resume support, writing to the shared `student_leads` table via an edge function.

## Pages Built

### Page 4 — Basic Details (`/student/apply/basic`)
- Identity: full name, mobile (read-only/verified), email, DOB, gender
- Residence & Destination: city, state, pincode, country, course category, loan amount
- Document awareness checklist (no upload yet)
- Save & Exit, Back, Continue navigation

### Page 5 — Education Details (`/student/apply/education`)
- Education profile: qualification, marks/GPA, course, university, intake
- Test scores (IELTS, TOEFL, Duolingo, GRE, GMAT) — all optional
- Context strip showing carry-forward data

### Page 6 — Co-applicant (`/student/apply/coapplicant`)
- Co-applicant info: relationship, name, mobile, email
- Financial profile: employment, income, EMI, collateral
- Context strip

### Page 7 — Review & Submit (`/student/apply/review`)
- Summary cards for all 3 sections with Edit links
- Declaration checkbox
- Submit transitions lead to `submitted` stage

## Architecture

### Data Write Strategy
Edge function `student-application` uses service role to write to `student_leads`.
- Validates phone format server-side
- For existing leads: matches by phone number
- For new leads: creates with `partner_id = PTR-DIRECT`, `source_type = student_direct`
- Student Direct partner org is `is_archived = true` to exclude from partner reporting

### Step Completion (Centralized)
`deriveStepCompletion()` in `useStudentApplication.ts`:
- Basic: name + country + email
- Education: course_name (not "Not specified") + intake_term + intake_year
- Co-applicant: name + relation
- Submitted: current_stage !== 'draft'

Used by both Continue page and form navigation.

### Schema Changes
Added to `student_leads`: student_dob, student_gender, pincode, highest_qualification, marks_gpa, test_scores (jsonb), coapplicant_mobile, coapplicant_email, coapplicant_employment_type, coapplicant_employer, coapplicant_existing_emi.

## Deferred to Prompt 3
- Recommendation results page
- Document upload center
- Full application tracker
- Real phone OTP (Twilio)
- Student-specific RLS policies
