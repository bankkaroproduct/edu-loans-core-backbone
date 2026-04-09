import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { StudentHeader } from "@/components/student/StudentHeader";
import { StudentFooter } from "@/components/student/StudentFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useStudentAuth, EligibilityData } from "@/hooks/useStudentAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  GraduationCap, Shield, Compass, Clock, BarChart3,
  CheckCircle2, FileText, Users, Search, ArrowRight,
  Sparkles, HeartHandshake, Eye
} from "lucide-react";

const STEPS = [
  { icon: FileText, label: "Basic Details", desc: "Name, contact, and residence information" },
  { icon: GraduationCap, label: "Education Details", desc: "Course, university, and intake preferences" },
  { icon: Users, label: "Co-applicant", desc: "Guardian or co-applicant financial details" },
  { icon: Search, label: "Get Recommendations", desc: "We match you with suitable lenders" },
  { icon: CheckCircle2, label: "Apply & Track", desc: "Submit and track your application live" },
];

const BENEFITS = [
  { icon: BarChart3, label: "Compare Lenders", desc: "Side-by-side loan options from trusted lenders" },
  { icon: Compass, label: "Guided Support", desc: "Step-by-step process with clear instructions" },
  { icon: Clock, label: "Faster Clarity", desc: "Know your eligibility and options quickly" },
  { icon: Eye, label: "Track Status", desc: "Real-time updates on your application" },
];

const FAQS = [
  { q: "Am I eligible for an education loan?", a: "Eligibility depends on factors like your chosen course, university, co-applicant income, and collateral availability. Our quick eligibility check helps you understand your options before you apply." },
  { q: "What is the typical processing timeline?", a: "Once you submit your complete application with documents, most lenders process within 7–15 working days. We help you stay informed at every stage." },
  { q: "Do I need to apply to all lenders separately?", a: "No. EduLoans matches you with the most suitable lenders based on your profile. You fill in your details once, and we handle the rest." },
  { q: "How can I track my application status?", a: "After submission, you can log in anytime to see the current status of your application, from document review to final approval." },
  { q: "Are there any hidden charges?", a: "EduLoans does not charge students any advisory or processing fee. The only costs involved are those set by the lender as part of the loan agreement." },
  { q: "What if my application needs manual review?", a: "Some applications require additional verification. If yours does, our team will guide you through any additional steps needed. You'll always know what's happening." },
];

export default function StudentLanding() {
  const navigate = useNavigate();
  const { setEligibilityData } = useStudentAuth();
  const [countries, setCountries] = useState<{ id: string; country_name: string }[]>([]);
  const [form, setForm] = useState<EligibilityData>({ fullName: "", mobile: "", targetCountry: "", loanAmount: "" });

  useEffect(() => {
    supabase.from("countries_master").select("id, country_name").eq("active_flag", true).order("country_name").then(({ data }) => {
      if (data) setCountries(data);
    });
  }, []);

  const handleEligibility = (e: React.FormEvent) => {
    e.preventDefault();
    setEligibilityData(form);
    navigate("/student/login");
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <StudentHeader />

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/[0.03] via-background to-primary/[0.06]">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 md:grid-cols-2 md:items-center md:py-24">
          <div className="flex flex-col gap-6">
            <h1 className="text-4xl font-extrabold leading-[1.1] tracking-tight text-foreground sm:text-5xl">
              Your Education Loan,{" "}
              <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">Simplified</span>
            </h1>
            <p className="max-w-lg text-lg leading-relaxed text-muted-foreground">
              Compare trusted lenders, get guided support at every step, and track your application — all in one place. No confusion, no hidden fees.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" onClick={() => document.getElementById("eligibility")?.scrollIntoView({ behavior: "smooth" })} className="gap-2 text-base">
                Start My Journey <ArrowRight className="h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate("/student/login")} className="text-base">
                Resume Application
              </Button>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><Shield className="h-4 w-4 text-primary" /> Trusted lenders</span>
              <span className="flex items-center gap-1.5"><Compass className="h-4 w-4 text-primary" /> Guided process</span>
              <span className="flex items-center gap-1.5"><HeartHandshake className="h-4 w-4 text-primary" /> No advisory fee</span>
            </div>
          </div>

          {/* Right decorative panel */}
          <div className="relative hidden md:flex md:justify-center">
            <div className="relative h-80 w-72">
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/20 to-primary/5 shadow-xl" />
              <div className="absolute -right-6 -top-6 h-32 w-32 rounded-2xl bg-primary/10 backdrop-blur-sm" />
              <div className="absolute -bottom-4 -left-4 h-24 w-24 rounded-xl bg-primary/15" />
              <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3">
                <GraduationCap className="h-16 w-16 text-primary/60" />
                <span className="text-sm font-semibold text-primary/80">Education Loan Platform</span>
                <div className="flex gap-2">
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">Compare</span>
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">Apply</span>
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">Track</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Eligibility Check ── */}
      <section id="eligibility" className="border-y bg-muted/30 py-14">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-bold text-foreground sm:text-3xl">Check Your Eligibility</h2>
            <p className="mt-2 text-muted-foreground">Quick pre-qualification — takes less than a minute</p>
          </div>
          <form onSubmit={handleEligibility} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="elig-name">Full Name</Label>
              <Input id="elig-name" placeholder="Enter your full name" required value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="elig-mobile">Mobile Number</Label>
              <div className="flex">
                <span className="flex items-center rounded-l-md border border-r-0 bg-muted px-3 text-sm text-muted-foreground">+91</span>
                <Input id="elig-mobile" placeholder="10-digit number" required className="rounded-l-none" value={form.mobile} onChange={e => setForm(f => ({ ...f, mobile: e.target.value.replace(/\D/g, "").slice(0, 10) }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Target Country</Label>
              <Select value={form.targetCountry} onValueChange={v => setForm(f => ({ ...f, targetCountry: v }))}>
                <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
                <SelectContent>
                  {countries.map(c => <SelectItem key={c.id} value={c.country_name}>{c.country_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="elig-amount">Loan Amount (₹)</Label>
              <Input id="elig-amount" placeholder="e.g. 2000000" type="number" value={form.loanAmount} onChange={e => setForm(f => ({ ...f, loanAmount: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" size="lg" className="w-full gap-2 text-base">
                Check Eligibility <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </div>
      </section>

      {/* ── Benefits ── */}
      <section className="py-14">
        <div className="mx-auto grid max-w-5xl gap-6 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
          {BENEFITS.map(b => (
            <div key={b.label} className="flex flex-col items-center gap-3 rounded-xl border bg-card p-6 text-center shadow-sm transition-shadow hover:shadow-md">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10">
                <b.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground">{b.label}</h3>
              <p className="text-sm text-muted-foreground">{b.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how-it-works" className="border-y bg-muted/20 py-14">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-bold text-foreground sm:text-3xl">How It Works</h2>
            <p className="mt-2 text-muted-foreground">Five simple steps from start to approval</p>
          </div>
          <div className="relative flex flex-col gap-0">
            {STEPS.map((s, i) => (
              <div key={s.label} className="relative flex gap-5 pb-10 last:pb-0">
                {/* connector line */}
                {i < STEPS.length - 1 && (
                  <div className="absolute left-[22px] top-12 h-[calc(100%-2rem)] w-px bg-border" />
                )}
                <div className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-background text-primary">
                  <s.icon className="h-5 w-5" />
                </div>
                <div className="pt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase text-muted-foreground">Step {i + 1}</span>
                  </div>
                  <h3 className="text-base font-semibold text-foreground">{s.label}</h3>
                  <p className="text-sm text-muted-foreground">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Guided Journey ── */}
      <section className="py-14">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-bold text-foreground sm:text-3xl">Our Guided Journey</h2>
            <p className="mt-2 text-muted-foreground">We don't just match — we guide you through</p>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            {[
              { icon: FileText, title: "Profile Capture", desc: "Share your academic and financial details through a simple, step-by-step form. We only ask what's needed." },
              { icon: Sparkles, title: "Guided Review", desc: "Our team reviews your profile and may reach out if anything needs clarification — no surprises, no confusion." },
              { icon: Search, title: "Smart Matching", desc: "Based on your profile, we recommend lenders best suited for your specific needs, ranked by fit." },
            ].map(p => (
              <div key={p.title} className="rounded-xl border bg-card p-6 shadow-sm">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <p.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mb-1 font-semibold text-foreground">{p.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="border-t bg-muted/20 py-14">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-bold text-foreground sm:text-3xl">Frequently Asked Questions</h2>
          </div>
          <Accordion type="single" collapsible className="w-full">
            {FAQS.map((f, i) => (
              <AccordionItem key={i} value={`faq-${i}`}>
                <AccordionTrigger className="text-left text-base">{f.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      <StudentFooter />
    </div>
  );
}
