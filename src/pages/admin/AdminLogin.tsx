import { useState } from "react";
import { useAuth, readSoftCounter, SOFT_LIMITS } from "@/hooks/useAuth";
import { LockoutNotice } from "@/components/auth/LockoutNotice";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import {
  Shield,
  Lock,
  AlertTriangle,
  Eye,
  EyeOff,
  Mail,
  KeyRound,
  ArrowRight,
  Boxes,
  ListChecks,
  BadgeCheck,
  Banknote,
} from "lucide-react";

/**
 * Admin sign-in page — V1 Console Refined polish.
 * Visual-only refresh. Auth handler, role gating, redirect, and
 * field name attributes preserved 1:1.
 */
export default function AdminLogin() {
  const { signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [unlockAt, setUnlockAt] = useState<number | null>(null);
  const [attemptsUsed, setAttemptsUsed] = useState<number>(
    () => readSoftCounter(email || "")?.count ?? 0
  );

  const isLocked = unlockAt !== null && unlockAt > Date.now();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) return;
    setErrorMsg(null);
    setSubmitting(true);

    const normalizedEmail = email.trim().toLowerCase();
    const result = await signIn(normalizedEmail, password, { expect: "admin" });
    if (result.code === "rate_limited") {
      setUnlockAt(Date.now() + (result.retryAfterSec ?? 900) * 1000);
      setErrorMsg(null);
      setSubmitting(false);
      return;
    }
    if (result.error) {
      setErrorMsg(result.error);
      setAttemptsUsed(readSoftCounter(normalizedEmail)?.count ?? 0);
      setSubmitting(false);
      return;
    }

    toast.success("Welcome back, admin");
    window.location.assign("/admin");
  };

  // TODO: wire build version from env var when available
  const buildVersion = "v0.1.0 · admin-prod";

  const features = [
    { Icon: Boxes, title: "Cross-partner lead queue", desc: "All leads, across all partners, in one place" },
    { Icon: ListChecks, title: "Lifecycle & underwriting actions", desc: "Trigger stage transitions and BRE runs" },
    { Icon: BadgeCheck, title: "Document verification", desc: "Review, approve or flag uploaded docs" },
    { Icon: Banknote, title: "Payout & disbursement controls", desc: "Authorize disbursals and partner payouts" },
  ];

  return (
    <div className="admin-login-shell">
      {/* Left — Console hero */}
      <div className="al-left">
        <div className="al-brand">
          <div className="al-mark">
            <Shield size={22} strokeWidth={2.25} />
          </div>
          <div>
            <div className="al-wordmark">EduLoans Admin</div>
            <div className="al-eyebrow">Operations Console</div>
          </div>
        </div>

        <div className="al-status">
          <div className="al-status-item">
            <span className="al-dot" />
            <span>All systems operational</span>
          </div>
        </div>

        <h1 className="al-headline">
          Cross-partner control layer for the <span className="accent">EduLoans</span> pipeline.
        </h1>
        <p className="al-sub">
          One operations console for every lead, every partner, every lender. Trigger stage
          transitions, verify documents, run BRE evaluations, and oversee disbursements end-to-end.
        </p>

        <div className="al-features">
          {features.map(({ Icon, title, desc }) => (
            <div key={title} className="al-feature">
              <div className="al-feature-icon">
                <Icon size={17} strokeWidth={2} />
              </div>
              <div>
                <div className="al-feature-title">{title}</div>
                <div className="al-feature-desc">{desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="al-footer">
          <span className="al-copyright">© 2026 EduLoans · A CashKaro venture</span>
          <span className="al-build">{buildVersion}</span>
        </div>
      </div>

      {/* Right — Auth card */}
      <div className="al-right">
        <div className="al-card">
          <div className="al-chip-wrap">
            <span className="al-chip">
              <Lock size={12} strokeWidth={2.5} />
              Restricted · Admin-only access
            </span>
          </div>
          <h2 className="al-heading">Sign in to Admin Console</h2>
          <p className="al-subheading">
            Use your EduLoans admin credentials. Partner &amp; student accounts are not permitted here.
          </p>

          <form onSubmit={handleSubmit} className="al-form">
            {errorMsg && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{errorMsg}</AlertDescription>
              </Alert>
            )}

            <div>
              <label htmlFor="admin-email" className="ll-label">Work email</label>
              <div className="ll-field has-icon-left">
                <span className="ll-icon-left"><Mail size={18} /></span>
                <input
                  id="admin-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@cashkaro.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="admin-password" className="ll-label">Password</label>
              <div className="ll-field has-icon-left has-icon-right">
                <span className="ll-icon-left"><KeyRound size={18} /></span>
                <input
                  id="admin-password"
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

            <button type="submit" className="al-submit" disabled={submitting}>
              {submitting ? "Verifying admin access..." : (
                <>
                  Sign in to Admin Console
                  <ArrowRight size={16} strokeWidth={2.25} />
                </>
              )}
            </button>
          </form>

          <div className="al-altlink">
            Not an admin?{" "}
            <a href="/login">Go to Partner Portal sign-in →</a>
          </div>
        </div>
      </div>
    </div>
  );
}
