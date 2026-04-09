import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { StudentHeader } from "@/components/student/StudentHeader";
import { StudentFooter } from "@/components/student/StudentFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useStudentAuth } from "@/hooks/useStudentAuth";
import { ArrowLeft, Shield, Compass, BookOpen, RefreshCw } from "lucide-react";

export default function StudentLogin() {
  const navigate = useNavigate();
  const { sendOtp, verifyOtp, resetOtp, otpState, phone, eligibilityData } = useStudentAuth();
  const [phoneInput, setPhoneInput] = useState(eligibilityData?.mobile || "");
  const [otp, setOtp] = useState("");

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phoneInput.length !== 10) return;
    await sendOtp("+91" + phoneInput);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) return;
    const success = await verifyOtp(otp);
    if (success) navigate("/student/continue");
  };

  const isOtpSent = otpState === "otp_sent" || otpState === "verifying";
  const isSending = otpState === "sending";
  const isVerifying = otpState === "verifying";

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-primary/[0.02] via-background to-primary/[0.04]">
      <StudentHeader />

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-12">
        {/* Back link */}
        <div className="mb-6 w-full max-w-md">
          <Link to="/student" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to home
          </Link>
        </div>

        {/* Main card */}
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="pb-4 text-center">
            <CardTitle className="text-2xl font-bold">Welcome to EduLoans</CardTitle>
            <CardDescription className="text-base">
              Enter your mobile number to continue securely
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!isOtpSent ? (
              <form onSubmit={handleSendOtp} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Mobile Number</label>
                  <div className="flex">
                    <span className="flex items-center rounded-l-md border border-r-0 bg-muted px-3 text-sm font-medium text-muted-foreground">+91</span>
                    <Input
                      placeholder="10-digit mobile number"
                      className="rounded-l-none"
                      value={phoneInput}
                      onChange={e => setPhoneInput(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      autoFocus
                    />
                  </div>
                </div>
                <Button type="submit" size="lg" className="w-full text-base" disabled={phoneInput.length !== 10 || isSending}>
                  {isSending ? "Sending OTP…" : "Send OTP"}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleVerify} className="space-y-5">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    OTP sent to <span className="font-medium text-foreground">+91 {phone?.slice(-10)}</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => resetOtp()}
                    className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <RefreshCw className="h-3 w-3" /> Change number
                  </button>
                </div>

                <div className="flex flex-col items-center gap-3">
                  <label className="text-sm font-medium text-foreground">Enter 6-digit OTP</label>
                  <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>

                <Button type="submit" size="lg" className="w-full text-base" disabled={otp.length !== 6 || isVerifying}>
                  {isVerifying ? "Verifying…" : "Verify & Continue"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Reassurance cards */}
        <div className="mt-8 grid w-full max-w-md gap-3 sm:grid-cols-3">
          {[
            { icon: Shield, title: "Secure Sign-In", desc: "OTP-based verification keeps your data safe" },
            { icon: BookOpen, title: "Resume Your Journey", desc: "Pick up right where you left off" },
            { icon: Compass, title: "Guided Support", desc: "Step-by-step guidance after login" },
          ].map(c => (
            <div key={c.title} className="rounded-lg border bg-card p-4 text-center shadow-sm">
              <c.icon className="mx-auto mb-2 h-5 w-5 text-primary" />
              <h3 className="text-xs font-semibold text-foreground">{c.title}</h3>
              <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{c.desc}</p>
            </div>
          ))}
        </div>

        {/* Returning user strip */}
        <div className="mt-6 rounded-lg border border-primary/20 bg-primary/5 px-5 py-3 text-center text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Returning user?</span> Your progress is saved. Resume right after verification.
        </div>
      </main>

      <StudentFooter />
    </div>
  );
}
