import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Shield, Lock, AlertTriangle, Eye, EyeOff } from "lucide-react";

/**
 * Dedicated Admin sign-in page.
 * - Always renders the form. signInWithPassword overwrites any existing session.
 * - Non-admin credentials are signed out immediately with a clear error.
 */
export default function AdminLogin() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);

    await supabase.auth.signOut();

    const normalizedEmail = email.trim().toLowerCase();
    const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
    if (error) {
      setErrorMsg(error.message);
      setSubmitting(false);
      return;
    }

    // Verify role server-side via the users table before allowing entry.
    const { data: authData } = await supabase.auth.getUser();
    const authId = authData.user?.id;
    if (!authId) {
      setErrorMsg("Could not establish session. Please try again.");
      setSubmitting(false);
      return;
    }

    const { data: profile } = await supabase
      .from("users")
      .select("role, is_active")
      .eq("auth_user_id", authId)
      .maybeSingle();

    if (!profile) {
      await supabase.auth.signOut();
      setErrorMsg("Admin profile not found. Please contact a super admin.");
      setSubmitting(false);
      return;
    }

    const role = profile?.role;
    if (role !== "super_admin" && role !== "admin") {
      await supabase.auth.signOut();
      setErrorMsg("This account is not authorised for the Admin Portal. Please use the Partner Portal sign-in.");
      setSubmitting(false);
      return;
    }
    if (profile && profile.is_active === false) {
      await supabase.auth.signOut();
      setErrorMsg("This admin account is deactivated. Please contact a super admin.");
      setSubmitting(false);
      return;
    }

    toast.success("Welcome back, admin");
    setSubmitting(false);
    navigate("/admin", { replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col lg:flex-row bg-background">
      {/* Left brand panel — visually distinct from partner login */}
      <div className="relative flex w-full flex-col justify-between bg-slate-900 px-8 py-10 text-slate-100 lg:w-[40%] lg:px-12 lg:py-16">
        <div className="space-y-8">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-amber-400" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">EduLoans Admin</h1>
              <p className="text-xs uppercase tracking-widest opacity-60">Operations Console</p>
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-xl font-semibold leading-snug lg:text-2xl">
              Cross-partner control layer for the EduLoans pipeline.
            </h2>
            <p className="text-sm leading-relaxed opacity-80">
              Manage leads across all partners and the student portal. Trigger stage transitions,
              verify documents, run BRE evaluations, and oversee disbursements.
            </p>
          </div>

          <ul className="space-y-2 text-sm opacity-80">
            <li>• Cross-partner lead queue</li>
            <li>• Lifecycle &amp; underwriting actions</li>
            <li>• Document verification</li>
            <li>• Payout &amp; disbursement controls</li>
          </ul>
        </div>

        <Alert className="border-amber-500/30 bg-amber-500/10 text-amber-100">
          <Lock className="h-4 w-4 !text-amber-300" />
          <AlertDescription className="text-xs text-amber-100/90">
            Restricted access. Only authorised EduLoans admins should sign in here.
          </AlertDescription>
        </Alert>
      </div>

      {/* Right login panel */}
      <div className="flex w-full items-center justify-center p-6 lg:w-[60%] lg:p-12">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="space-y-2 p-8 pb-2 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold">Admin Sign In</CardTitle>
            <CardDescription>
              Use your EduLoans admin credentials. Partner accounts are not permitted here.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8 pt-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMsg && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{errorMsg}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="admin-email">Email</Label>
                <Input
                  id="admin-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-password">Password</Label>
                <div className="relative">
                  <Input
                    id="admin-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="h-11 w-full" disabled={submitting}>
                {submitting ? "Verifying admin access..." : "Sign In to Admin Console"}
              </Button>
            </form>

            <div className="mt-6 space-y-1 text-center text-xs text-muted-foreground">
              <p>Not an admin?</p>
              <a href="/login" className="text-primary underline-offset-2 hover:underline">
                Go to Partner Portal sign-in →
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
