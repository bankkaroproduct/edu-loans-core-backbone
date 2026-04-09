

# Student Portal — Prompt 1: Entry Layer Foundation

## Summary
Build 3 student-facing pages (Landing, OTP Login, Continue/Resume) with dedicated routing under `/student/*`, a student auth context, and a clean guided design distinct from the Partner Portal.

## Architecture Decisions

**Routing**: All student pages live under `/student` prefix to cleanly separate from partner routes:
- `/student` — Landing Page
- `/student/login` — OTP Login Page  
- `/student/continue` — Continue Application / Resume Page

**Auth**: A separate `useStudentAuth` hook that manages phone+OTP flow using Supabase phone auth. This is intentionally separate from the partner `useAuth` (email/password). The student auth context will:
- Call `supabase.auth.signInWithOtp({ phone })` to send OTP
- Call `supabase.auth.verifyOtp({ phone, token, type: 'sms' })` to verify
- After verification, look up existing `student_leads` by `student_phone` to determine if returning or new student
- Store student session state (phone, verified status, matched lead IDs)

**Note on OTP**: Supabase phone auth requires Twilio configuration. The UI and state flow will be product-correct. If phone auth is not yet configured, the flow will show a clear toast message rather than silently failing. This keeps the implementation future-ready without blocking the UI build.

**Data linkage**: The student portal reads from the shared `student_leads` table. The `student_portal_user_id` column already exists and will be used to link a Supabase auth user to their leads. No new tables needed for Prompt 1.

## Pages

### Page 1 — Student Landing (`/student`)
**File**: `src/pages/student/StudentLanding.tsx`

Sections built as a single-page scroll:
- **Header/Nav**: EduLoans brand + "by CashKaro" subtle tag, nav links (How It Works, Support), "Resume Application" ghost CTA, "Start My Journey" primary CTA
- **Hero**: Bold headline, supportive subtext, 2 CTAs, right-side decorative panel (gradient card with abstract shapes, not a stock image), 3 trust bullets below
- **Eligibility Check Strip**: Compact form — Full Name, Mobile, Target Country (select from `countries_master`), Loan Amount, "Check Eligibility" CTA. This prefills state and navigates to `/student/login`
- **Trust/Benefit Strip**: 4 icons+labels (Compare Lenders, Guided Support, Faster Clarity, Track Status)
- **How It Works**: 5-step visual stepper (Basic Details → Education → Co-applicant → Recommendations → Track)
- **Guided Journey**: Content block explaining the 3-phase process (Profile, Review, Match)
- **FAQ**: Accordion with 6 questions
- **Footer**: Privacy, Terms, Help Center, brand line

**Design direction**: Light background, soft blue/indigo accents (using existing primary palette), generous whitespace, rounded cards, large readable typography. Visually distinct from the dark-primary Partner login.

### Page 2 — Student OTP Login (`/student/login`)
**File**: `src/pages/student/StudentLogin.tsx`

- **Top bar**: Back arrow → landing, EduLoans brand
- **Main card**: Centered, max-w-md, with:
  - Title: "Welcome to EduLoans"
  - Subtext: "Enter your mobile number to continue securely"
  - Phone input with +91 prefix
  - "Send OTP" button
  - After OTP sent: 6-digit OTP input (using existing `InputOTP` component), "Verify & Continue" CTA
  - State machine: `idle` → `otp_sent` → `verifying` → `verified`
- **3 reassurance cards** below: Secure Sign-In, Resume Your Journey, Guided Support
- **Returning user strip**: "Your progress is saved. Resume right after verification."
- **Footer**: Privacy, Terms, Help

**Post-verification behavior**:
- Query `student_leads` by phone number
- If leads found → navigate to `/student/continue`
- If no leads → navigate to `/student/continue` (with "new" state — resume page handles both)

### Page 3 — Continue Application (`/student/continue`)
**File**: `src/pages/student/StudentContinue.tsx`

This is a protected page (requires student auth).

- **Welcome header**: "Welcome back, [name]" or "Welcome to EduLoans", verification badge, subtext
- **Progress container**: Card showing 5-step progress indicator:
  1. Basic Details
  2. Education Details  
  3. Co-applicant
  4. Review & Submit
  5. Recommendations
  - Shows completed steps (checkmarks), current step (highlighted), future steps (dimmed)
  - Current step has contextual description of what's needed
  - "Continue Application" primary CTA
- **Last completed / Next step cards**: Two side-by-side cards showing what was done and what comes next
- **Start fresh section**: Secondary, guarded — "Need to start a new application?" with explanatory text, secondary button
- **3 reassurance feature cards**: Guided Process, Secure Journey, Ongoing Support
- **Save state message**: "Progress saved automatically · Last updated X ago"

**Progress derivation**: For Prompt 1, progress is derived from checking which fields are populated on the student's lead record (basic → education → co-applicant → submitted). This maps internal `current_stage` to student-friendly step labels without exposing raw stage names.

## New Files

| File | Purpose |
|------|---------|
| `src/pages/student/StudentLanding.tsx` | Landing page |
| `src/pages/student/StudentLogin.tsx` | OTP login page |
| `src/pages/student/StudentContinue.tsx` | Resume/continue page |
| `src/hooks/useStudentAuth.tsx` | Student phone auth context + lead lookup |
| `src/components/student/StudentHeader.tsx` | Shared header/nav for student pages |
| `src/components/student/StudentFooter.tsx` | Shared footer |

## Modified Files

| File | Change |
|------|--------|
| `src/App.tsx` | Add 3 student routes + wrap with `StudentAuthProvider` |

## What Is Deferred to Prompt 2

- Application form pages (Basic Details, Education, Co-applicant, Review)
- Document upload center
- Recommendation results page
- Status tracker page
- Actual Twilio/SMS configuration (OTP UI is built and product-correct)
- Student profile table (if needed beyond `student_leads`)

## Technical Details

- Student routes are public (Landing, Login) or student-auth-protected (Continue)
- No interference with existing partner routes — completely separate route prefix and auth context
- Eligibility form data passed via React state/navigation to login page
- The `useStudentAuth` hook uses `sessionStorage` for student session to avoid conflicts with partner auth in `localStorage`
- Country dropdown on landing page fetches from `countries_master` table (already has public read RLS)
- No schema changes needed — `student_leads.student_portal_user_id` and `student_phone` already exist

