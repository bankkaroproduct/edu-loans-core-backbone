import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  AlertTriangle,
  Eye,
  EyeOff,
  Mail,
  KeyRound,
  ArrowRight,
  Check,
  GraduationCap,
} from "lucide-react";

/**
 * Partner sign-in page — V6 Mosaic (cleaned) polish.
 * Visual-only refresh. LoginForm / SignUpForm handlers, validators,
 * redirects, role gating, and field name attributes preserved 1:1.
 */
export default function Login() {
  const values = [
    {
      title: "Multi-lender access in one place",
      desc: "Submit once, get evaluated by every lender that fits the case.",
    },
    {
      title: "Real-time student tracking",
      desc: "Stage-by-stage visibility — application, BRE, sanction, disbursal.",
    },
    {
      title: "End-to-end processing support",
      desc: "Documents, follow-ups, queries — handled by our ops team.",
    },
    {
      title: "Transparent payouts",
      desc: "Track every commission, auditable down to the lead level.",
    },
  ];

  return (
    <div className="partner-login-shell">
      <div className="pl-topbar">
        <div className="pl-brand">
          <div className="pl-mark"><GraduationCap size={18} strokeWidth={2.25} /></div>
          <div>
            <div className="pl-wordmark">EduLoans</div>
            <div className="pl-sub">Partner Portal</div>
          </div>
        </div>
      </div>

      <div className="pl-stage">
        {/* Left — Hero */}
        <div className="pl-hero">
          <h1 className="pl-headline">
            Loans for your students. <span className="accent">Income</span> for your business.
          </h1>
          <p className="pl-hero-sub">
            EduLoans lets your team operate like a multi-lender broker — without dealing with
            twelve different portals. Sign in to manage leads or sign up to become a partner.
          </p>

          <div className="pl-values">
            {values.map((v) => (
              <div key={v.title} className="pl-value">
                <div className="pl-check">
                  <Check size={16} strokeWidth={2.75} />
                </div>
                <div>
                  <div className="pl-value-title">{v.title}</div>
                  <div className="pl-value-desc">{v.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right — Auth pane */}
        <div className="pl-right">
          <div className="pl-card">
            <Tabs defaultValue="login">
              <TabsList className="pl-tabs h-auto bg-transparent border-0 p-0">
                <TabsTrigger value="login" className="rounded-full">Sign In</TabsTrigger>
                <TabsTrigger value="signup" className="rounded-full">Sign Up</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <h2 className="pl-heading">Welcome back</h2>
                <p className="pl-subheading">Sign in to your partner dashboard.</p>
                <LoginForm />
              </TabsContent>

              <TabsContent value="signup">
                <h2 className="pl-heading">Become a partner</h2>
                <p className="pl-subheading">Create your EduLoans partner account.</p>
                <SignUpForm />
              </TabsContent>
            </Tabs>

            <div className="pl-altlink">
              EduLoans admin?{" "}
              <a href="/admin/login">Use the Admin Portal sign-in →</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoginForm() {
  const { signIn } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);

    let email = identifier.trim();
    if (email && !email.includes("@")) {
      const { data: resolved, error: resolveErr } = await supabase.rpc(
        "resolve_login_email",
        { _identifier: email }
      );
      if (resolveErr || !resolved) {
        setErrorMsg("Invalid username or password.");
        setSubmitting(false);
        return;
      }
      email = resolved as string;
    }
    email = email.toLowerCase();

    const { error } = await signIn(email, password, { expect: "partner" });
    if (error) {
      setErrorMsg(error);
      setSubmitting(false);
      return;
    }

    toast.success("Signed in");
    window.location.assign("/");
  };

  return (
    <form onSubmit={handleSubmit} className="pl-form">
      {errorMsg && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}
      <div>
        <label htmlFor="login-identifier" className="ll-label">Email / Username</label>
        <div className="ll-field has-icon-left">
          <span className="ll-icon-left"><Mail size={18} /></span>
          <input
            id="login-identifier"
            name="email"
            type="text"
            autoComplete="username"
            placeholder="you@partner.com"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
          />
        </div>
      </div>
      <div>
        <label htmlFor="login-password" className="ll-label">Password</label>
        <div className="ll-field has-icon-left has-icon-right">
          <span className="ll-icon-left"><KeyRound size={18} /></span>
          <input
            id="login-password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button
            type="button"
            className="ll-icon-right"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>
      <button type="submit" className="pl-submit" disabled={submitting}>
        {submitting ? "Signing in..." : (
          <>
            Sign in
            <ArrowRight size={16} strokeWidth={2.25} />
          </>
        )}
      </button>
    </form>
  );
}

function SignUpForm() {
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await signUp(email, password, fullName);
    if (error) toast.error(error);
    else toast.success("Check your email to confirm your account");
    setSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="pl-form">
      <div>
        <label htmlFor="signup-name" className="ll-label">Full Name</label>
        <div className="ll-field">
          <input
            id="signup-name"
            name="fullName"
            type="text"
            autoComplete="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
        </div>
      </div>
      <div>
        <label htmlFor="signup-email" className="ll-label">Email</label>
        <div className="ll-field has-icon-left">
          <span className="ll-icon-left"><Mail size={18} /></span>
          <input
            id="signup-email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
      </div>
      <div>
        <label htmlFor="signup-password" className="ll-label">Password</label>
        <div className="ll-field has-icon-left">
          <span className="ll-icon-left"><KeyRound size={18} /></span>
          <input
            id="signup-password"
            name="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
        </div>
      </div>
      <button type="submit" className="pl-submit" disabled={submitting}>
        {submitting ? "Creating account..." : (
          <>
            Sign Up
            <ArrowRight size={16} strokeWidth={2.25} />
          </>
        )}
      </button>
    </form>
  );
}
