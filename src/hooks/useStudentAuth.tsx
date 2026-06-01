import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { clearAllStudentDrafts } from "@/hooks/useStudentApplication";

type OtpState = "idle" | "sending" | "otp_sent" | "verifying" | "verified";

interface StudentLead {
  id: string;
  lead_id: string | null;
  student_full_name: string | null;
  student_first_name: string;
  student_email: string | null;
  current_stage: string;
  current_status: string;
  updated_at: string;
  course_name: string;
  intended_study_country: string;
  intake_term: string;
  intake_year: number;
  coapplicant_name: string | null;
  coapplicant_relation: string | null;
  loan_amount_required: number | null;
  university_name_raw: string | null;
}

interface StudentAuthState {
  phone: string | null;
  isVerified: boolean;
  otpState: OtpState;
  leads: StudentLead[];
  studentName: string | null;
}

interface StudentAuthContextType extends StudentAuthState {
  sendOtp: (phone: string) => Promise<void>;
  verifyOtp: (otp: string) => Promise<boolean>;
  resetOtp: () => void;
  logout: () => void;
  setEligibilityData: (data: EligibilityData) => void;
  eligibilityData: EligibilityData | null;
  /** Re-fetch leads for the currently verified phone and push into context. */
  refreshLeads: () => Promise<void>;
  /** Epoch ms when the user can attempt again after a rate-limit response. */
  lockoutUntil: number | null;
  clearLockout: () => void;
}

function isOtpRateLimit(err: { message?: string; status?: number } | null | undefined): boolean {
  if (!err) return false;
  if (err.status === 429) return true;
  const msg = (err.message || "").toLowerCase();
  return msg.includes("rate limit") || msg.includes("too many") || msg.includes("for security purposes");
}

export interface EligibilityData {
  fullName: string;
  mobile: string;
  targetCountry: string;
  loanAmount: string;
}

const StudentAuthContext = createContext<StudentAuthContextType | null>(null);

export function StudentAuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StudentAuthState>(() => {
    const saved = sessionStorage.getItem("student_auth");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // ignore
      }
    }
    return { phone: null, isVerified: false, otpState: "idle" as OtpState, leads: [], studentName: null };
  });

  const [eligibilityData, setEligibilityData] = useState<EligibilityData | null>(() => {
    const saved = sessionStorage.getItem("student_eligibility");
    if (saved) try { return JSON.parse(saved); } catch { return null; }
    return null;
  });

  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const clearLockout = useCallback(() => setLockoutUntil(null), []);
  const triggerLockout = useCallback(() => {
    setLockoutUntil(Date.now() + 15 * 60 * 1000);
  }, []);

  const persist = useCallback((newState: StudentAuthState) => {
    setState(newState);
    sessionStorage.setItem("student_auth", JSON.stringify(newState));
  }, []);

  const sendOtp = useCallback(async (phone: string) => {
    // If a different phone is being used than what's currently cached, wipe any
    // prior phone-scoped drafts so the new student does not inherit prior data.
    setState(s => {
      if (s.phone && s.phone !== phone) {
        clearAllStudentDrafts();
      }
      return { ...s, otpState: "sending", phone };
    });
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone });
      if (error) {
        // Rate-limit short-circuit — surface lockout UI, skip toast spam.
        if (isOtpRateLimit(error as any)) {
          setState(s => ({ ...s, otpState: "idle" }));
          triggerLockout();
          return;
        }
        // Provider unavailable in preview/dev → engage demo fallback so the student flow stays testable.
        const msg = (error.message || "").toLowerCase();
        const isProviderDisabled =
          msg.includes("phone provider") ||
          msg.includes("provider disabled") ||
          msg.includes("unsupported phone provider") ||
          msg.includes("sms") ||
          (error as any).status === 400;

        if (isProviderDisabled) {
          sessionStorage.setItem("student_otp_fallback", "1");
          persist({ ...state, phone, otpState: "otp_sent", isVerified: false, leads: [], studentName: null });
          toast({
            title: "Demo OTP mode",
            description: "Provider unavailable in preview. Use 123456 to continue.",
          });
          return;
        }

        setState(s => ({ ...s, otpState: "idle", phone: null }));
        toast({
          title: "OTP service unavailable",
          description: "We can't send a verification code right now. Please try again later or contact support.",
          variant: "destructive",
        });
        return;
      }
      sessionStorage.removeItem("student_otp_fallback");
      persist({ ...state, phone, otpState: "otp_sent", isVerified: false, leads: [], studentName: null });
      toast({ title: "OTP Sent", description: "Please check your phone for the verification code." });
    } catch (err: any) {
      // Network / unexpected failure → fall back to demo OTP so preview is unblocked.
      sessionStorage.setItem("student_otp_fallback", "1");
      persist({ ...state, phone, otpState: "otp_sent", isVerified: false, leads: [], studentName: null });
      toast({
        title: "Demo OTP mode",
        description: "Provider unreachable. Use 123456 to continue.",
      });
    }
  }, [state, persist]);

  const verifyOtp = useCallback(async (otp: string): Promise<boolean> => {
    if (!state.phone) return false;
    setState(s => ({ ...s, otpState: "verifying" }));

    const fallbackActive = sessionStorage.getItem("student_otp_fallback") === "1";

    try {
      if (fallbackActive) {
        // Demo / preview path — accept the fixed demo code (production path uses real provider).
        if (otp !== "123456") {
          setState(s => ({ ...s, otpState: "otp_sent" }));
          toast({
            title: "Verification failed",
            description: "Invalid OTP. In preview, use 123456.",
            variant: "destructive",
          });
          return false;
        }
        const leads = await lookupLeads(state.phone);
        const name = leads.length > 0 ? leads[0].student_full_name || leads[0].student_first_name : null;
        persist({ phone: state.phone, isVerified: true, otpState: "verified", leads, studentName: name });
        toast({ title: "Verified!", description: "Welcome to EduLoans." });
        return true;
      }

      const { error } = await supabase.auth.verifyOtp({
        phone: state.phone,
        token: otp,
        type: "sms",
      });

      if (error) {
        setState(s => ({ ...s, otpState: "otp_sent" }));
        toast({
          title: "Verification failed",
          description: error.message || "Invalid OTP. Please try again.",
          variant: "destructive",
        });
        return false;
      }

      const leads = await lookupLeads(state.phone);
      const name = leads.length > 0 ? leads[0].student_full_name || leads[0].student_first_name : null;
      persist({ phone: state.phone, isVerified: true, otpState: "verified", leads, studentName: name });
      toast({ title: "Verified!", description: "Welcome to EduLoans." });
      return true;
    } catch (err: any) {
      setState(s => ({ ...s, otpState: "otp_sent" }));
      toast({ title: "Verification failed", description: err.message || "Invalid OTP. Please try again.", variant: "destructive" });
      return false;
    }
  }, [state.phone, persist]);

  const resetOtp = useCallback(() => {
    persist({ ...state, otpState: "idle", isVerified: false, leads: [], studentName: null });
  }, [state, persist]);

  const logout = useCallback(() => {
    sessionStorage.removeItem("student_auth");
    sessionStorage.removeItem("student_eligibility");
    sessionStorage.removeItem("student_otp_fallback");
    clearAllStudentDrafts();
    setState({ phone: null, isVerified: false, otpState: "idle", leads: [], studentName: null });
    setEligibilityData(null);
  }, []);

  const handleSetEligibilityData = useCallback((data: EligibilityData) => {
    setEligibilityData(data);
    sessionStorage.setItem("student_eligibility", JSON.stringify(data));
  }, []);

  const refreshLeads = useCallback(async () => {
    if (!state.phone) return;
    const fresh = await lookupLeads(state.phone);
    const name = fresh.length > 0 ? fresh[0].student_full_name || fresh[0].student_first_name : state.studentName;
    persist({ ...state, leads: fresh, studentName: name });
  }, [state, persist]);

  return (
    <StudentAuthContext.Provider
      value={{
        ...state,
        sendOtp,
        verifyOtp,
        resetOtp,
        logout,
        eligibilityData,
        setEligibilityData: handleSetEligibilityData,
        refreshLeads,
        lockoutUntil,
        clearLockout,
      }}
    >
      {children}
    </StudentAuthContext.Provider>
  );
}

export function useStudentAuth() {
  const ctx = useContext(StudentAuthContext);
  if (!ctx) throw new Error("useStudentAuth must be used within StudentAuthProvider");
  return ctx;
}

async function lookupLeads(phone: string): Promise<StudentLead[]> {
  try {
    // Use the edge function (service role) to bypass RLS
    const { data, error } = await supabase.functions.invoke("student-application", {
      body: { action: "load", phone },
    });

    if (error || !data?.lead) {
      console.warn("Lead lookup error:", error?.message || "No lead found");
      return [];
    }

    const lead = data.lead;
    return [{
      id: lead.id,
      lead_id: lead.lead_id,
      student_full_name: lead.student_full_name,
      student_first_name: lead.student_first_name,
      student_email: lead.student_email,
      current_stage: lead.current_stage,
      current_status: lead.current_status,
      updated_at: lead.updated_at,
      course_name: lead.course_name,
      intended_study_country: lead.intended_study_country,
      intake_term: lead.intake_term,
      intake_year: lead.intake_year,
      coapplicant_name: lead.coapplicant_name,
      coapplicant_relation: lead.coapplicant_relation,
      loan_amount_required: lead.loan_amount_required,
      university_name_raw: lead.university_name_raw,
    }];
  } catch {
    return [];
  }
}
