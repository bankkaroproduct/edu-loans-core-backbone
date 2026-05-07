import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Check, Shield, TrendingUp, Users, Banknote, AlertTriangle } from "lucide-react";

export default function Login() {
  const { user, appUser, loading } = useAuth();

  if (loading) return <div className="flex min-h-screen items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>;
  if (user && appUser) {
    const role = appUser.role;
    // Admins must NOT use the partner portal — bounce them to /admin/login.
    if (role === "super_admin" || role === "admin") return <Navigate to="/admin/login" replace />;
    return <Navigate to="/" replace />;
  }
  if (user && !appUser) return <div className="flex min-h-screen items-center justify-center"><p className="text-muted-foreground">Loading profile...</p></div>;

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Left Branding Panel */}
      <div className="relative flex w-full flex-col justify-between bg-primary px-8 py-10 text-primary-foreground lg:w-[45%] lg:px-12 lg:py-16">
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight lg:text-4xl">EduLoans</h1>
            <p className="mt-1 text-sm opacity-70">by CashKaro</p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold leading-snug lg:text-2xl lg:leading-snug">
              Simplify Education Loans for Your Students. Grow Your Business With Every Case.
            </h2>
            <p className="text-sm leading-relaxed opacity-80 lg:text-base">
              One platform to manage leads, track applications, and earn payouts — without dealing with multiple lenders.
            </p>
          </div>

          <ul className="space-y-3">
            {[
              "Multi-lender access in one place",
              "Real-time student tracking",
              "End-to-end processing support",
              "Transparent payouts",
            ].map((item) => (
              <li key={item} className="flex items-center gap-3 text-sm lg:text-base">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-foreground/20">
                  <Check className="h-3 w-3" />
                </span>
                {item}
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap gap-2 pt-2">
            {[
              { icon: Users, label: "Multi-Lender" },
              { icon: TrendingUp, label: "Real-Time Tracking" },
              { icon: Banknote, label: "Secure Payouts" },
              { icon: Shield, label: "Pan-India" },
            ].map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 rounded-full border border-primary-foreground/20 px-3 py-1 text-xs opacity-80"
              >
                <Icon className="h-3 w-3" />
                {label}
              </span>
            ))}
          </div>
        </div>

        <p className="mt-8 text-xs opacity-50 lg:mt-0">Trusted by partners across India</p>
      </div>

      {/* Right Login Panel */}
      <div className="flex w-full items-center justify-center bg-muted/30 p-6 lg:w-[55%] lg:p-12">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="space-y-2 p-8 pb-2 text-center">
            <CardTitle className="text-2xl font-bold">Welcome to EduLoans Partner Portal</CardTitle>
            <CardDescription>
              Manage your student leads, documents, and earnings — all in one place
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8 pt-4">
            <Tabs defaultValue="login">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>
              <TabsContent value="login"><LoginForm /></TabsContent>
              <TabsContent value="signup"><SignUpForm /></TabsContent>
            </Tabs>
            <div className="mt-6 space-y-2 text-center text-xs text-muted-foreground">
              <p>Secure login · Powered by CashKaro</p>
              <p>
                EduLoans admin?{" "}
                <a href="/admin/login" className="text-primary underline-offset-2 hover:underline">
                  Use the Admin Portal sign-in →
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function LoginForm() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);

    // Resolve username -> email if needed. Emails fall through unchanged.
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

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setErrorMsg(error.message);
      setSubmitting(false);
      return;
    }

    // Server-side role check: reject admins from the partner portal entirely.
    const { data: authData } = await supabase.auth.getUser();
    const authId = authData.user?.id;
    if (!authId) {
      setErrorMsg("Could not establish session. Please try again.");
      setSubmitting(false);
      return;
    }

    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("auth_user_id", authId)
      .maybeSingle();

    const role = profile?.role;
    if (role === "super_admin" || role === "admin") {
      // Tear down the session — admins must use /admin/login.
      await supabase.auth.signOut();
      setErrorMsg("This is an admin account. Please sign in via the Admin Portal at /admin/login.");
      setSubmitting(false);
      return;
    }

    toast.success("Signed in");
    setSubmitting(false);
    // AuthProvider state change → top-level redirect to "/".
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-4">
      {errorMsg && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}
      <div className="space-y-2">
        <Label htmlFor="login-email">Email</Label>
        <Input id="login-email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="login-password">Password</Label>
        <Input id="login-password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required />
      </div>
      <Button type="submit" className="h-11 w-full" disabled={submitting}>
        {submitting ? "Signing in..." : "Sign In"}
      </Button>
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
    <form onSubmit={handleSubmit} className="space-y-4 pt-4">
      <div className="space-y-2">
        <Label htmlFor="signup-name">Full Name</Label>
        <Input id="signup-name" value={fullName} onChange={e => setFullName(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-email">Email</Label>
        <Input id="signup-email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-password">Password</Label>
        <Input id="signup-password" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
      </div>
      <Button type="submit" className="h-11 w-full" disabled={submitting}>
        {submitting ? "Creating account..." : "Sign Up"}
      </Button>
    </form>
  );
}
