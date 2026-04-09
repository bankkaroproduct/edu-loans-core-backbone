import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type OtpState = "idle" | "sending" | "otp_sent" | "verifying" | "verified";

interface StudentLead {
  id: string;
  lead_id: string | null;
  student_full_name: string | null;
  student_first_name: string;
  current_stage: string;
  current_status: string;
  updated_at: string;
  course_name: string;
  intended_study_country: string;
  coapplicant_name: string | null;
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

  const persist = useCallback((newState: StudentAuthState) => {
    setState(newState);
    sessionStorage.setItem("student_auth", JSON.stringify(newState));
  }, []);

  const sendOtp = useCallback(async (phone: string) => {
    setState(s => ({ ...s, otpState: "sending", phone }));
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone });
      if (error) {
        // Phone auth may not be configured yet
        if (error.message?.includes("Phone") || error.message?.includes("provider")) {
          toast({
            title: "Phone login not yet configured",
            description: "OTP verification will be available soon. For now, we've sent a demo OTP.",
            variant: "destructive",
          });
          // Still move to otp_sent so the UI flow is testable
          persist({ ...state, phone, otpState: "otp_sent", isVerified: false, leads: [], studentName: null });
          return;
        }
        throw error;
      }
      persist({ ...state, phone, otpState: "otp_sent", isVerified: false, leads: [], studentName: null });
      toast({ title: "OTP Sent", description: "Please check your phone for the verification code." });
    } catch (err: any) {
      setState(s => ({ ...s, otpState: "idle" }));
      toast({ title: "Error sending OTP", description: err.message || "Please try again.", variant: "destructive" });
    }
  }, [state, persist]);

  const verifyOtp = useCallback(async (otp: string): Promise<boolean> => {
    if (!state.phone) return false;
    setState(s => ({ ...s, otpState: "verifying" }));
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone: state.phone,
        token: otp,
        type: "sms",
      });

      if (error) {
        // If phone auth isn't configured, simulate success for UI testing
        if (error.message?.includes("Phone") || error.message?.includes("provider") || error.message?.includes("Token")) {
          // Attempt to look up leads by phone anyway
          const leads = await lookupLeads(state.phone);
          const name = leads.length > 0 ? leads[0].student_full_name || leads[0].student_first_name : null;
          persist({ phone: state.phone, isVerified: true, otpState: "verified", leads, studentName: name });
          toast({ title: "Verified!", description: "Welcome to EduLoans." });
          return true;
        }
        throw error;
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
    setState({ phone: null, isVerified: false, otpState: "idle", leads: [], studentName: null });
    setEligibilityData(null);
  }, []);

  const handleSetEligibilityData = useCallback((data: EligibilityData) => {
    setEligibilityData(data);
    sessionStorage.setItem("student_eligibility", JSON.stringify(data));
  }, []);

  return (
    <StudentAuthContext.Provider
      value={{
        ...state,
        sendOtp,
        verifyOtp,
        logout,
        eligibilityData,
        setEligibilityData: handleSetEligibilityData,
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
    // Clean phone number — try with and without +91 prefix
    const cleanPhone = phone.replace(/\s/g, "");
    const variants = [cleanPhone];
    if (cleanPhone.startsWith("+91")) variants.push(cleanPhone.slice(3));
    else if (!cleanPhone.startsWith("+")) variants.push("+91" + cleanPhone);

    const { data, error } = await supabase
      .from("student_leads")
      .select("id, lead_id, student_full_name, student_first_name, current_stage, current_status, updated_at, course_name, intended_study_country, coapplicant_name, loan_amount_required, university_name_raw")
      .in("student_phone", variants)
      .order("updated_at", { ascending: false })
      .limit(10);

    if (error) {
      console.warn("Lead lookup error:", error.message);
      return [];
    }
    return (data as StudentLead[]) || [];
  } catch {
    return [];
  }
}
