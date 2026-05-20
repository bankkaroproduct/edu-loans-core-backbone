/**
 * "How to get this document?" guidance content — pulled from
 * eduloans_document_guidance_pack_v1.1.md (Sections A + B).
 *
 * This file is content-only. No upload, status, verification, OCR,
 * applicability, or backend logic depends on it. Safe to edit by content
 * owners. Unverified URLs are intentionally omitted (the matching source
 * still appears with a safe fallback line).
 */

export type SourceVerification = "verified" | "needs_verification";

export interface GuidanceSource {
  name: string;
  /** Only populated when verification_status === "verified" AND URL is a clean http(s) URL.
   *  When undefined, render only the name (and source_type), never a link. */
  url?: string;
  type: string;
  verification: SourceVerification;
}

export interface DocumentGuidance {
  /** Canonical name used for matching/display. */
  canonical_name: string;
  short_helper_line: string;
  where_to_get: GuidanceSource[];
  text_steps: string[];
  bank_specific_steps?: Record<string, string>;
  what_to_upload: string;
  accepted_format_guidance: string;
  common_mistakes: string[];
  password_protected_guidance?: string;
  privacy_note: string;
  /** Reserved for future image guide; omit when no asset exists. */
  image_guide?: { caption: string; image_url: string };
}

/* ----------------------- helpers (no runtime cost) ---------------------- */
const v = (name: string, url: string, type: string): GuidanceSource => ({
  name,
  url,
  type,
  verification: "verified",
});
const nv = (name: string, type: string): GuidanceSource => ({
  name,
  type,
  verification: "needs_verification",
});
const va = (name: string, type: string): GuidanceSource => ({
  name,
  type,
  verification: "verified",
}); // verified but no URL applicable (N/A)

/* --------------------------------- data --------------------------------- */
export const GUIDANCE_ENTRIES: DocumentGuidance[] = [
  /* ===== Section A — confusing/downloadable ===== */
  {
    canonical_name: "Candidate Aadhaar Card",
    short_helper_line:
      "Download from DigiLocker or UIDAI and upload a clear copy as requested by EduLoans or the lender.",
    where_to_get: [
      v("DigiLocker", "https://www.digilocker.gov.in", "portal"),
      v("UIDAI — Aadhaar Download", "https://myaadhaar.uidai.gov.in/genricDownloadAadhaar", "portal"),
      nv("mAadhaar App (Android/iOS)", "app"),
    ],
    text_steps: [
      "Go to myaadhaar.uidai.gov.in or open DigiLocker.",
      "Log in using your Aadhaar-linked mobile number.",
      "Complete OTP verification.",
      "Download the Aadhaar PDF (e-Aadhaar).",
      "Upload the PDF directly in EduLoans. If you have a physical card, upload a clear photo of the front and back.",
    ],
    what_to_upload:
      "Upload the Aadhaar copy as requested by EduLoans or the lender. If masked Aadhaar is accepted, ensure name, DOB/address, and last 4 digits are clearly visible. If full Aadhaar is required by lender policy, upload through EduLoans secure upload only. Both sides are required for physical card uploads.",
    accepted_format_guidance: "PDF / JPG / PNG. Full document visible. No cropping. No blurry photos.",
    common_mistakes: [
      "Uploading only the front side — both sides are required.",
      "Blurry or tilted photo taken in poor lighting.",
      "Uploading an old Aadhaar with outdated address — make sure details are current.",
      "Screenshot of Aadhaar instead of the actual downloaded PDF.",
      "Not checking with your counsellor whether masked or full Aadhaar is needed for your lender.",
    ],
    privacy_note:
      "Upload only through EduLoans secure upload. Do not share your Aadhaar on WhatsApp, email, or any unofficial channel unless instructed by an official EduLoans counsellor.",
  },
  {
    canonical_name: "Candidate PAN Card",
    short_helper_line:
      "Download e-PAN from the Income Tax portal or DigiLocker. Upload a clear copy.",
    where_to_get: [
      v("Income Tax e-Filing Portal — Instant e-PAN", "https://www.incometax.gov.in/iec/foportal/", "portal"),
      nv("Protean (formerly NSDL) — e-PAN Download", "portal"),
      v("DigiLocker", "https://www.digilocker.gov.in", "portal"),
    ],
    text_steps: [
      "Go to incometax.gov.in and click on 'Instant e-PAN' (under Quick Links), OR open DigiLocker and search for PAN.",
      "Enter your Aadhaar number and verify via OTP.",
      "Download the e-PAN PDF.",
      "Upload the PDF in EduLoans. If you have a physical PAN card, upload a clear photo of the front side.",
      "Make sure the PAN number, name, and date of birth are clearly visible.",
    ],
    what_to_upload:
      "PDF of e-PAN (preferred), OR clear photo/scan of the front of the physical PAN card. Only the front side is needed.",
    accepted_format_guidance: "PDF / JPG / PNG. PAN number, name, and DOB must be fully readable.",
    common_mistakes: [
      "Uploading a blurry or cropped photo where PAN number is not readable.",
      "Uploading a photocopy instead of a clear scan or original photo.",
      "Name on PAN does not match name on other documents — flag this to your counsellor.",
      "Confusing PAN card with Aadhaar card or tax filing receipt.",
    ],
    privacy_note:
      "Upload only through EduLoans secure upload. Do not share your PAN on WhatsApp or any unofficial channel.",
  },
  {
    canonical_name: "Passport",
    short_helper_line:
      "Upload a clear scan of the first and last page of your passport. You can also download a digital copy from DigiLocker.",
    where_to_get: [
      v("Passport Seva (MEA)", "https://www.passportindia.gov.in", "portal"),
      v("DigiLocker — Passport copy", "https://www.digilocker.gov.in", "portal"),
    ],
    text_steps: [
      "Take your physical passport.",
      "Scan or photograph the first page (photo + details page) and the last page (address page).",
      "Make sure the photo, passport number, name, DOB, and validity dates are all clearly visible.",
      "Upload both pages in EduLoans.",
      "Alternatively, download your passport copy from DigiLocker and upload the PDF.",
    ],
    what_to_upload:
      "Clear scan/photo of the first page (personal details + photo) AND the last page (address details). Both pages required.",
    accepted_format_guidance: "PDF / JPG / PNG. No glare, no shadows, full page visible, all text readable.",
    common_mistakes: [
      "Uploading only the first page — the last page (address page) is also required.",
      "Photo taken with flash causing glare on the laminated page.",
      "Passport is expired — check validity before uploading. Inform your counsellor if expired.",
      "Cropped image where passport number or validity dates are cut off.",
    ],
    privacy_note:
      "Upload only through EduLoans secure upload. Do not share passport images on WhatsApp or social media.",
  },
  {
    canonical_name: "Co-applicant Aadhaar Card",
    short_helper_line:
      "Same process as candidate Aadhaar. Download from UIDAI or DigiLocker using the co-applicant's mobile number.",
    where_to_get: [
      v("UIDAI — Aadhaar Download", "https://myaadhaar.uidai.gov.in/genricDownloadAadhaar", "portal"),
      v("DigiLocker", "https://www.digilocker.gov.in", "portal"),
    ],
    text_steps: [
      "Ask your co-applicant (parent/guardian) to visit myaadhaar.uidai.gov.in or open DigiLocker.",
      "Log in using the co-applicant's Aadhaar-linked mobile number.",
      "Complete OTP verification and download the e-Aadhaar PDF.",
      "Upload the PDF in EduLoans, OR upload a clear photo of both front and back of the physical card.",
      "Make sure the co-applicant's name and address match other submitted documents.",
    ],
    what_to_upload:
      "Upload the co-applicant's Aadhaar copy as requested by EduLoans or the lender. If masked Aadhaar is accepted, ensure name, DOB/address, and last 4 digits are clearly visible. If full Aadhaar is required by lender policy, upload through EduLoans secure upload only. Both sides required for physical card uploads.",
    accepted_format_guidance: "PDF / JPG / PNG. Full document visible. No cropping.",
    common_mistakes: [
      "Uploading the candidate's Aadhaar instead of the co-applicant's.",
      "Co-applicant's name spelled differently on Aadhaar vs other documents.",
      "Only front side uploaded — both sides are needed.",
      "Not checking with your counsellor whether masked or full Aadhaar is needed for your lender.",
    ],
    privacy_note:
      "This is the co-applicant's identity document. Ensure they consent to the upload. Use only EduLoans secure upload.",
  },
  {
    canonical_name: "Co-applicant PAN Card",
    short_helper_line:
      "Download co-applicant's e-PAN from the Income Tax portal or DigiLocker.",
    where_to_get: [
      v("Income Tax e-Filing Portal — Instant e-PAN", "https://www.incometax.gov.in/iec/foportal/", "portal"),
      v("DigiLocker", "https://www.digilocker.gov.in", "portal"),
    ],
    text_steps: [
      "Ask your co-applicant to visit incometax.gov.in and click 'Instant e-PAN', OR log in to DigiLocker.",
      "Enter the co-applicant's Aadhaar number and verify via OTP.",
      "Download the e-PAN PDF.",
      "Upload in EduLoans. If physical card, upload a clear photo of the front side.",
      "Ensure name on PAN matches name on other co-applicant documents.",
    ],
    what_to_upload:
      "PDF of co-applicant's e-PAN (preferred), OR clear photo/scan of the front of physical PAN card.",
    accepted_format_guidance: "PDF / JPG / PNG. PAN number, name, and DOB must be readable.",
    common_mistakes: [
      "Uploading the candidate's PAN instead of the co-applicant's.",
      "Name mismatch between PAN and Aadhaar of the co-applicant.",
      "Blurry photo where PAN number is not legible.",
    ],
    privacy_note:
      "Ensure the co-applicant consents to sharing their PAN. Use only EduLoans secure upload.",
  },
  {
    canonical_name: "ITR / Income Tax Return",
    short_helper_line:
      "Download ITR-V or ITR acknowledgement from the Income Tax e-Filing portal. Usually last 2 years required.",
    where_to_get: [
      v("Income Tax e-Filing Portal", "https://www.incometax.gov.in/iec/foportal/", "portal"),
    ],
    text_steps: [
      "Go to incometax.gov.in and log in with PAN and password.",
      "Go to e-File > Income Tax Returns > View Filed Returns.",
      "Select the relevant assessment year (e.g., AY 2025-26 for FY 2024-25).",
      "Download the ITR-V / Acknowledgement PDF.",
      "Upload in EduLoans. Repeat for each year the lender requires (usually last 2 years).",
    ],
    what_to_upload:
      "ITR-V acknowledgement PDF for each assessment year requested by the lender. Usually last 2 years. Upload each year as a separate file if required.",
    accepted_format_guidance: "PDF only (as downloaded from the portal). Do not convert to JPG.",
    common_mistakes: [
      "Uploading only 1 year when the lender asked for 2 years.",
      "Uploading the ITR form instead of the ITR-V acknowledgement.",
      "Confusing Assessment Year (AY) with Financial Year (FY) — AY 2025-26 = FY 2024-25.",
      "Uploading an unverified ITR — make sure ITR is verified (e-verified or physically sent to CPC Bangalore).",
      "Password-protected PDF uploaded without informing your counsellor.",
    ],
    privacy_note:
      "ITR contains sensitive financial information. Upload only through EduLoans secure upload. Do not share via WhatsApp or email.",
  },
  {
    canonical_name: "Form 16",
    short_helper_line:
      "Get Form 16 from your employer's HR or payroll team. It has two parts — Part A and Part B. Upload both.",
    where_to_get: [
      va("Employer HR / Payroll Department", "employer"),
      v("TRACES Portal (Part A — employer access)", "https://www.tdscpc.gov.in", "portal"),
    ],
    text_steps: [
      "Contact your employer's HR or payroll team and request Form 16 for the relevant financial year.",
      "If your company uses an HRMS (like Keka, GreytHR, Darwinbox), check your payroll/tax section — Form 16 may be downloadable there.",
      "Make sure you receive both Part A (TDS certificate) and Part B (salary details and tax computation).",
      "Download or collect the PDF.",
      "Upload both Part A and Part B in EduLoans as a single combined PDF or as separate files.",
    ],
    what_to_upload:
      "Complete Form 16 including both Part A (TDS certificate from employer) and Part B (detailed salary breakup and tax computation). Both parts are required unless the lender specifically says otherwise.",
    accepted_format_guidance: "PDF preferred. JPG/PNG acceptable if scanned clearly. All pages must be included.",
    common_mistakes: [
      "Uploading only Part A or only Part B — both are required.",
      "Confusing Form 16 with Form 16A (Form 16A is for non-salary TDS, not the same thing).",
      "Uploading Form 16 for the wrong financial year.",
      "Getting Form 16 from an unofficial source instead of the employer.",
      "Missing employer's TAN number or digital signature on the form.",
    ],
    privacy_note: "Form 16 contains your salary and tax details. Upload only through EduLoans secure upload.",
  },
  {
    canonical_name: "Salary Slips",
    short_helper_line:
      "Download from your company's HRMS portal or request from HR. Usually last 3 to 6 months required.",
    where_to_get: [
      va("Employer HRMS Portal (Keka, GreytHR, Darwinbox, SAP, etc.)", "employer"),
      va("Employer HR / Payroll Department (if no HRMS)", "employer"),
    ],
    text_steps: [
      "Log in to your company's HRMS portal (use your company's specific login URL).",
      "Go to Payroll or My Pay or Salary Slips section.",
      "Select and download salary slips for the months required (usually last 3 or 6 months).",
      "If your company does not have an HRMS, request salary slips directly from your HR or payroll team via email.",
      "Upload all required months in EduLoans.",
    ],
    what_to_upload:
      "Salary slips for the number of months requested by the lender (usually last 3 or 6 months). Each month as a separate PDF is ideal. Make sure gross salary, net salary, and deductions are visible.",
    accepted_format_guidance:
      "PDF preferred. JPG/PNG acceptable. Each slip should show month, employee name, gross pay, deductions, and net pay clearly.",
    common_mistakes: [
      "Uploading only 1 month when the lender asked for 3 or 6 months.",
      "Salary slip does not show company name or employee name.",
      "Uploading bank credit SMS or bank statement as a substitute — these are not salary slips.",
      "Salary slips are in a format that does not clearly show the breakup (gross, deductions, net).",
    ],
    privacy_note: "Upload only through EduLoans secure upload.",
  },
  {
    canonical_name: "Bank Statement",
    short_helper_line:
      "Download from your bank's net banking or mobile app. Usually last 6 to 12 months required.",
    where_to_get: [va("Your bank's net banking portal or mobile app", "bank")],
    text_steps: [
      "Log in to your bank's net banking portal or mobile banking app.",
      "Go to Accounts > Statement / e-Statement / Account Statement section.",
      "Select the date range (usually last 6 or 12 months as required by the lender).",
      "Download the statement as PDF.",
      "Upload the PDF in EduLoans. Make sure it is the bank-generated PDF, not a screenshot.",
    ],
    bank_specific_steps: {
      "Other banks":
        "Log in to your bank's net banking portal or app. Look for Account Statement or e-Statement under the Accounts section. Select the required date range and download as PDF. For SBI / HDFC / ICICI / Axis, check the official portal or contact your EduLoans counsellor for the latest path.",
    },
    what_to_upload:
      "Bank-generated PDF statement for the period required by the lender (usually 6 or 12 months). Must show account holder name, account number, and all transactions. The PDF should be the one directly downloaded from the bank, not a recreated or edited version.",
    accepted_format_guidance:
      "PDF only (bank-generated). Do not upload screenshots, Excel exports, or manually typed statements.",
    common_mistakes: [
      "Uploading a screenshot of the app instead of the actual bank-generated PDF.",
      "Statement does not cover the full date range the lender requested.",
      "Uploading a passbook photo instead of a digital bank statement.",
      "Uploading a statement from the wrong account (savings vs salary account).",
    ],
    password_protected_guidance:
      "If the bank statement PDF is password-protected, use the secure password field in EduLoans if available, or contact your EduLoans counsellor for the safest upload method. Do not share bank passwords or OTPs with anyone.",
    privacy_note:
      "Bank statements contain sensitive financial data. Upload only through EduLoans secure upload. Never share on WhatsApp or social media. Do not share your bank login credentials or OTPs with anyone.",
  },
  {
    canonical_name: "Offer Letter / Admission Letter",
    short_helper_line:
      "Download from the university portal or check your registered email inbox for the official admission offer.",
    where_to_get: [
      va("University's student portal / applicant dashboard", "university"),
      va("Registered email inbox", "email"),
    ],
    text_steps: [
      "Log in to the university's student portal or applicant dashboard where you applied.",
      "Look for 'Admission Decision', 'Offer Letter', 'Admission Letter', or 'Accept Offer' section.",
      "Download the official offer/admission letter as PDF.",
      "If you received it via email, download the attached PDF from your registered email.",
      "Upload the complete letter in EduLoans. Make sure it shows university name, course name, intake/start date, and your name.",
    ],
    what_to_upload:
      "Complete official offer letter or admission letter from the university. Must clearly show: university name, student name, course/program name, intake date or start date, and any conditions (if conditional offer).",
    accepted_format_guidance: "PDF preferred. JPG/PNG acceptable if scanned clearly. All pages must be included.",
    common_mistakes: [
      "Uploading only the email notification instead of the actual attached offer letter PDF.",
      "Offer letter is conditional but student does not mention the conditions to the counsellor.",
      "Missing pages — some offer letters are multi-page; upload all pages.",
      "Uploading a screenshot of the portal instead of the downloaded PDF.",
      "Name on the offer letter does not match passport/Aadhaar — flag to your counsellor.",
    ],
    privacy_note: "Upload only through EduLoans secure upload.",
  },
  {
    canonical_name: "I-20 (United States)",
    short_helper_line:
      "Download the I-20 from your US university's international student portal after accepting your offer.",
    where_to_get: [va("US University's International Student / ISSS Portal", "university")],
    text_steps: [
      "Accept your admission offer on the university portal and pay any required deposit.",
      "Submit the financial documents requested by the university's International Student Services (ISSS) office.",
      "Once approved, the university issues your I-20 form. You will be notified via email or portal.",
      "Download the I-20 PDF from the portal, OR receive it by mail/courier.",
      "Upload all pages of the I-20 in EduLoans. Key details: SEVIS ID, program dates, estimated costs.",
    ],
    what_to_upload:
      "Complete I-20 form (all pages). Must show: student name, SEVIS ID number, university name, program name, program start and end dates, and estimated cost of attendance.",
    accepted_format_guidance: "PDF preferred. If physical copy, scan all pages clearly. JPG/PNG acceptable.",
    common_mistakes: [
      "Uploading only the first page — I-20 has multiple pages, upload all.",
      "I-20 not yet issued — you cannot upload a draft or placeholder.",
      "SEVIS ID not visible or cut off in the scan.",
      "Uploading an old I-20 from a previous admission — make sure it is the current one.",
    ],
    privacy_note: "I-20 contains your SEVIS ID. Upload only through EduLoans secure upload.",
  },
  {
    canonical_name: "CAS — Confirmation of Acceptance for Studies (UK)",
    short_helper_line:
      "Your UK university emails the CAS statement or makes it available on the student portal after you accept and pay the deposit.",
    where_to_get: [va("UK University's Student Portal / Admissions Office", "university")],
    text_steps: [
      "Accept your offer on the university portal and pay the required tuition deposit.",
      "Submit any documents the university requires for CAS issuance (e.g., passport, academic transcripts).",
      "The university issues your CAS and sends the CAS statement via email or portal.",
      "Download or save the CAS statement PDF. Note your CAS number.",
      "Upload the CAS statement in EduLoans.",
    ],
    what_to_upload:
      "CAS statement (not just the CAS number). Must show: student name, CAS number, university/sponsor name, course details, course start date, and tuition fee.",
    accepted_format_guidance: "PDF / JPG / PNG. Full document clearly visible.",
    common_mistakes: [
      "Uploading only the CAS number without the full CAS statement.",
      "CAS not yet issued — do not upload the conditional offer letter as a substitute.",
      "CAS details do not match passport details — flag mismatches to your counsellor.",
      "Uploading an expired or withdrawn CAS.",
    ],
    privacy_note: "Upload only through EduLoans secure upload.",
  },
  {
    canonical_name: "CoE — Confirmation of Enrolment (Australia)",
    short_helper_line:
      "Your Australian university issues the CoE after you accept and pay the deposit. Download from the student portal or email.",
    where_to_get: [va("Australian University's Student Portal / Admissions Office", "university")],
    text_steps: [
      "Accept your offer (usually via the university portal or an agent portal) and pay the required deposit.",
      "The university processes your acceptance and issues the electronic CoE (eCoE).",
      "You will receive the CoE via email or it will appear on your student portal.",
      "Download the CoE PDF.",
      "Upload in EduLoans. Key details: CoE number, CRICOS course code, course dates, tuition fees.",
    ],
    what_to_upload:
      "Complete CoE (electronic Confirmation of Enrolment). Must show: student name, CoE number, provider name, CRICOS course code, course start and end dates, tuition fee.",
    accepted_format_guidance: "PDF / JPG / PNG.",
    common_mistakes: [
      "Uploading the offer letter instead of the CoE — these are different documents.",
      "CoE not yet issued — do not substitute with the offer acceptance email.",
      "CoE number or CRICOS code not visible.",
      "Details on CoE do not match passport — flag to your counsellor.",
    ],
    privacy_note: "Upload only through EduLoans secure upload.",
  },
  {
    canonical_name: "Equivalent Admission Document (Other Countries)",
    short_helper_line:
      "Download the official admission/enrolment confirmation from your university's portal or email. This is the document that confirms your seat.",
    where_to_get: [va("University's Student Portal / Admissions Office", "university")],
    text_steps: [
      "Log in to your university's student or applicant portal.",
      "Look for an official admission confirmation, enrolment letter, or acceptance letter.",
      "Download the document as PDF.",
      "If received via email, download the attached PDF.",
      "Upload in EduLoans. Make sure it shows: university name, your name, course, intake, and fees.",
    ],
    what_to_upload:
      "Official admission confirmation or enrolment letter from the university. Must show university name, student name, course/program, intake/start date, and fee details.",
    accepted_format_guidance: "PDF preferred. JPG/PNG acceptable.",
    common_mistakes: [
      "Uploading a conditional offer instead of the final/unconditional confirmation.",
      "Document is in a language other than English without a certified translation.",
      "Missing fee or course duration details.",
    ],
    privacy_note: "Upload only through EduLoans secure upload.",
  },
  {
    canonical_name: "Property Sale Deed",
    short_helper_line:
      "Get a certified copy from the Sub-Registrar's office where the property was registered. Upload all pages.",
    where_to_get: [nv("Sub-Registrar's Office (local to the property)", "government office")],
    text_steps: [
      "Locate the original registered sale deed. It was issued when the property was purchased.",
      "If the original is not available, visit the Sub-Registrar's office where the property is registered and request a certified copy.",
      "Some states allow online searches or downloads — check your state's registration portal.",
      "Scan all pages of the sale deed clearly.",
      "Upload the complete document in EduLoans.",
    ],
    what_to_upload:
      "Complete registered sale deed (all pages). Must show: property details, buyer and seller names, registration number, stamp duty details, Sub-Registrar's seal.",
    accepted_format_guidance:
      "PDF preferred (scanned). JPG/PNG acceptable. All pages must be included. Text must be legible.",
    common_mistakes: [
      "Uploading only the first page — sale deeds are usually multi-page documents.",
      "Uploading an unregistered agreement instead of the registered sale deed.",
      "Document is too old and faded to read — get a certified copy from the Sub-Registrar.",
      "Property owner name on the deed does not match the co-applicant — clarify with your counsellor.",
    ],
    privacy_note: "Property documents are sensitive. Upload only through EduLoans secure upload.",
  },
  {
    canonical_name: "Encumbrance Certificate (EC)",
    short_helper_line:
      "Get the EC from the Sub-Registrar's office. It proves the property has no pending legal dues or loans.",
    where_to_get: [nv("Sub-Registrar's Office (local to the property)", "government office")],
    text_steps: [
      "Visit the Sub-Registrar's office where the property is registered.",
      "Apply for an Encumbrance Certificate for the required period (usually last 13 or 30 years — check with your lender).",
      "Some states allow online EC application and download. Check your state's registration portal.",
      "Collect or download the EC.",
      "Upload the complete EC in EduLoans.",
    ],
    what_to_upload:
      "Complete Encumbrance Certificate covering the period required by the lender. Must show property survey number/details, period covered, and list of encumbrances (or 'Nil Encumbrance' if clear).",
    accepted_format_guidance: "PDF / JPG / PNG. All pages must be included and clearly readable.",
    common_mistakes: [
      "EC does not cover the time period the lender asked for.",
      "EC is in the local/regional language without translation — check if the lender needs an English version.",
      "Confusing EC with a property tax receipt — these are different documents.",
      "EC shows existing encumbrances (active loan or mortgage) — inform your counsellor immediately.",
    ],
    privacy_note: "Upload only through EduLoans secure upload.",
  },
  {
    canonical_name: "Property Valuation Report",
    short_helper_line:
      "This is usually arranged by the lender. If you need to get one yourself, use a lender-approved or government-empanelled valuer.",
    where_to_get: [nv("Lender-appointed / approved property valuer", "lender")],
    text_steps: [
      "Check with your lender or EduLoans counsellor whether the lender will arrange the valuation or if you need to get it done.",
      "If the lender arranges it, provide property access to the appointed valuer.",
      "If you need to arrange it yourself, use only a valuer approved/empanelled by the lender.",
      "Collect the valuation report after the inspection.",
      "Upload the complete report in EduLoans.",
    ],
    what_to_upload:
      "Complete property valuation report. Must show: valuer's name and credentials, date of valuation, property address, market value, forced sale value, methodology used, and valuer's signature/seal.",
    accepted_format_guidance:
      "PDF preferred. All pages including photographs taken by the valuer. Must be clearly legible.",
    common_mistakes: [
      "Getting the valuation done by an unapproved valuer — always confirm with the lender first.",
      "Valuation report is very old — lenders usually require a recent one (within 3-6 months).",
      "Missing pages — upload the full report including property photographs.",
      "Valuation amount seems inflated or deflated — the lender may reject it and order a fresh one.",
    ],
    privacy_note: "Upload only through EduLoans secure upload.",
  },

  /* ===== Section B — simple ===== */
  {
    canonical_name: "Candidate Photograph",
    short_helper_line:
      "Upload a recent passport-size photograph with a plain white or light background.",
    where_to_get: [va("Any photo studio, or take a selfie with a plain background", "self")],
    text_steps: [
      "Take a recent passport-size photograph (white or light background, front-facing, no sunglasses or hat).",
      "Upload in EduLoans.",
    ],
    what_to_upload:
      "Recent passport-size photograph. Face clearly visible, plain background, no filters.",
    accepted_format_guidance: "JPG / PNG. Minimum 200x200 pixels. Clear, well-lit, no blur.",
    common_mistakes: [
      "Using a group photo or a cropped photo from a social event.",
      "Heavy filters or edits on the photo.",
      "Photo is very old and does not match current appearance.",
      "Dark or busy background.",
    ],
    privacy_note: "Upload only through EduLoans secure upload.",
  },
  {
    canonical_name: "Co-applicant Photograph",
    short_helper_line:
      "Upload a recent passport-size photograph of the co-applicant (parent/guardian).",
    where_to_get: [va("Any photo studio, or take a photo with a plain background", "self")],
    text_steps: [
      "Take a recent passport-size photograph of the co-applicant.",
      "Upload in EduLoans.",
    ],
    what_to_upload:
      "Recent passport-size photograph of the co-applicant. Face clearly visible, plain background.",
    accepted_format_guidance: "JPG / PNG. Clear, well-lit.",
    common_mistakes: [
      "Uploading the candidate's photo instead of the co-applicant's.",
      "Photo is very old.",
      "Heavy filters or sunglasses.",
    ],
    privacy_note: "Upload only through EduLoans secure upload.",
  },
  {
    canonical_name: "10th Marksheet",
    short_helper_line:
      "Upload a clear scan of your 10th standard marksheet. You can also download it from DigiLocker.",
    where_to_get: [
      va("Physical copy from your school/board", "board"),
      v("DigiLocker (for CBSE, ICSE, and some state boards)", "https://www.digilocker.gov.in", "portal"),
    ],
    text_steps: [
      "Find your original 10th marksheet, OR log in to DigiLocker and search for your board's marksheet.",
      "Scan or photograph both sides if applicable.",
      "Upload in EduLoans.",
    ],
    what_to_upload:
      "Clear scan/photo of the complete 10th marksheet showing student name, board name, subjects, marks/grades, and roll number.",
    accepted_format_guidance: "PDF / JPG / PNG. Full document visible, not cropped.",
    common_mistakes: [
      "Uploading a blurry or cropped image.",
      "Name on marksheet does not match Aadhaar/passport — flag to counsellor.",
      "Uploading a provisional result instead of the final marksheet.",
    ],
    privacy_note: "Upload only through EduLoans secure upload.",
  },
  {
    canonical_name: "12th Marksheet",
    short_helper_line:
      "Upload a clear scan of your 12th standard marksheet. Also available on DigiLocker for CBSE and some state boards.",
    where_to_get: [
      va("Physical copy from your school/board", "board"),
      v("DigiLocker", "https://www.digilocker.gov.in", "portal"),
    ],
    text_steps: [
      "Find your original 12th marksheet, OR download from DigiLocker.",
      "Scan or photograph clearly.",
      "Upload in EduLoans.",
    ],
    what_to_upload:
      "Clear scan/photo of complete 12th marksheet showing name, board, subjects, marks/grades.",
    accepted_format_guidance: "PDF / JPG / PNG. Full document visible.",
    common_mistakes: [
      "Uploading a provisional result instead of final marksheet.",
      "Name mismatch with other documents.",
      "Blurry or partial scan.",
    ],
    privacy_note: "Upload only through EduLoans secure upload.",
  },
  {
    canonical_name: "Graduation Marksheet",
    short_helper_line:
      "Upload marksheets for all semesters/years of your graduation. Check DigiLocker or your university's student portal.",
    where_to_get: [
      va("University / College Examination Office", "university"),
      v("DigiLocker (for some universities registered with ABC/NAD)", "https://www.digilocker.gov.in", "portal"),
    ],
    text_steps: [
      "Collect all semester/year marksheets from your university or download from DigiLocker.",
      "Scan each marksheet clearly.",
      "Upload all semesters/years in EduLoans.",
    ],
    what_to_upload:
      "Marksheets for all completed semesters/years. Each semester as a separate file or combined PDF. Must show student name, university name, subjects, marks/CGPA.",
    accepted_format_guidance: "PDF / JPG / PNG. All semesters required.",
    common_mistakes: [
      "Uploading only the final semester — all semesters are usually required.",
      "Missing backlog/supplementary marksheets if applicable.",
      "Name on university marksheet differs from school records.",
    ],
    privacy_note: "Upload only through EduLoans secure upload.",
  },
  {
    canonical_name: "Graduation Degree Certificate",
    short_helper_line:
      "Upload the degree certificate (convocation certificate) issued by your university after completing graduation.",
    where_to_get: [
      va("University Examination / Convocation Office", "university"),
      v("DigiLocker (for some universities)", "https://www.digilocker.gov.in", "portal"),
    ],
    text_steps: [
      "Collect your degree certificate from your university. If not yet issued, request a provisional degree certificate.",
      "Scan clearly.",
      "Upload in EduLoans.",
    ],
    what_to_upload:
      "Degree certificate OR provisional degree certificate. Must show university name, student name, degree title, year of passing.",
    accepted_format_guidance: "PDF / JPG / PNG. Full document visible.",
    common_mistakes: [
      "Uploading the marksheet instead of the degree certificate — these are different.",
      "Degree not yet issued and no provisional certificate obtained.",
      "Poor scan quality where university seal is not visible.",
    ],
    privacy_note: "Upload only through EduLoans secure upload.",
  },
  {
    canonical_name: "Post-Graduation Marksheet",
    short_helper_line:
      "Upload marksheets for all semesters/years of your post-graduation, if applicable.",
    where_to_get: [
      va("University / College Examination Office", "university"),
      v("DigiLocker (for some universities)", "https://www.digilocker.gov.in", "portal"),
    ],
    text_steps: [
      "Collect all PG semester/year marksheets.",
      "Scan clearly.",
      "Upload all semesters in EduLoans.",
    ],
    what_to_upload: "All semester/year marksheets for post-graduation.",
    accepted_format_guidance: "PDF / JPG / PNG.",
    common_mistakes: [
      "Uploading only the final semester.",
      "Missing supplementary marksheets if applicable.",
      "Confusing PG marksheets with UG marksheets.",
    ],
    privacy_note: "Upload only through EduLoans secure upload.",
  },
  {
    canonical_name: "Post-Graduation Degree Certificate",
    short_helper_line:
      "Upload the PG degree certificate issued by your university, or a provisional certificate if not yet issued.",
    where_to_get: [va("University Examination / Convocation Office", "university")],
    text_steps: [
      "Collect your PG degree certificate from your university.",
      "Scan clearly.",
      "Upload in EduLoans.",
    ],
    what_to_upload: "PG degree certificate or provisional certificate.",
    accepted_format_guidance: "PDF / JPG / PNG.",
    common_mistakes: [
      "Uploading the PG marksheet instead of the degree certificate.",
      "No provisional certificate obtained when degree is pending.",
    ],
    privacy_note: "Upload only through EduLoans secure upload.",
  },
  {
    canonical_name: "English Language Test Scorecard (IELTS / TOEFL / PTE / Duolingo)",
    short_helper_line: "Download your score report from the official test provider's website.",
    where_to_get: [
      nv("IELTS — British Council / IDP", "portal"),
      v("TOEFL — ETS", "https://www.ets.org/mytoefl", "portal"),
      nv("PTE — Pearson", "portal"),
      nv("Duolingo English Test", "portal"),
    ],
    text_steps: [
      "Log in to the official test provider's website using the account you created when registering for the test.",
      "Go to your results or scores section.",
      "Download the score report as PDF.",
      "Upload in EduLoans.",
    ],
    what_to_upload:
      "Official score report PDF showing: test taker name, test date, overall score, section-wise scores. Must be the official report, not a screenshot.",
    accepted_format_guidance:
      "PDF preferred. JPG/PNG of the physical TRF (Test Report Form) acceptable for IELTS.",
    common_mistakes: [
      "Uploading a screenshot of the score instead of the official downloadable report.",
      "Score is expired — IELTS, TOEFL, and PTE scores are typically valid for 2 years.",
      "Name on the scorecard does not match passport.",
    ],
    privacy_note: "Upload only through EduLoans secure upload.",
  },
  {
    canonical_name: "Aptitude Test Scorecard (GRE / GMAT / SAT)",
    short_helper_line: "Download your score report from the official test provider's website.",
    where_to_get: [
      v("GRE — ETS", "https://www.ets.org/mygre", "portal"),
      nv("GMAT — GMAC / mba.com", "portal"),
      v("SAT — College Board", "https://www.collegeboard.org", "portal"),
    ],
    text_steps: [
      "Log in to the test provider's website (ETS for GRE, mba.com for GMAT, College Board for SAT).",
      "Go to scores/results section.",
      "Download the score report PDF.",
      "Upload in EduLoans.",
    ],
    what_to_upload:
      "Official score report showing: test taker name, test date, overall and section-wise scores.",
    accepted_format_guidance: "PDF preferred. JPG/PNG acceptable.",
    common_mistakes: [
      "Uploading a screenshot instead of the official report.",
      "Score is expired — GRE and GMAT scores are typically valid for 5 years, SAT varies.",
      "Name on scorecard does not match passport.",
    ],
    privacy_note: "Upload only through EduLoans secure upload.",
  },
];
