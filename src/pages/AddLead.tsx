import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Country = Tables<"countries_master">;
type University = Tables<"universities_master">;
type Course = Tables<"courses_master">;
type Intake = Tables<"intake_master">;

export default function AddLead() {
  const navigate = useNavigate();
  const { appUser } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const [countries, setCountries] = useState<Country[]>([]);
  const [universities, setUniversities] = useState<University[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [intakes, setIntakes] = useState<Intake[]>([]);

  const [form, setForm] = useState({
    student_first_name: "",
    student_last_name: "",
    student_email: "",
    student_phone: "",
    student_whatsapp: "",
    city: "",
    state: "",
    country_of_residence: "",
    intended_study_country: "",
    intake_term: "",
    intake_year: 0,
    course_name: "",
    university_name_raw: "",
    university_id: "",
    loan_amount_required: "",
    coapplicant_name: "",
    coapplicant_relation: "",
    coapplicant_income: "",
    collateral_available: false,
    collateral_notes: "",
  });

  useEffect(() => {
    const load = async () => {
      const [c, u, co, i] = await Promise.all([
        supabase.from("countries_master").select("*").eq("active_flag", true).order("country_name"),
        supabase.from("universities_master").select("*").eq("active_flag", true).order("university_name"),
        supabase.from("courses_master").select("*").eq("active_flag", true).order("course_name"),
        supabase.from("intake_master").select("*").eq("active_flag", true).order("sort_order"),
      ]);
      setCountries(c.data ?? []);
      setUniversities(u.data ?? []);
      setCourses(co.data ?? []);
      setIntakes(i.data ?? []);
    };
    load();
  }, []);

  const set = (field: string, value: string | number | boolean) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent, asDraft: boolean) => {
    e.preventDefault();
    if (!form.student_first_name.trim()) return toast.error("Student first name is required");
    if (!form.student_phone.trim()) return toast.error("Phone number is required");
    if (!form.intended_study_country) return toast.error("Study country is required");
    if (!form.intake_term || !form.intake_year) return toast.error("Intake term and year are required");
    if (!form.course_name) return toast.error("Course name is required");

    if (!appUser?.partner_id) return toast.error("No partner organization found for your account");

    setSubmitting(true);

    const payload = {
      student_first_name: form.student_first_name.trim(),
      student_last_name: form.student_last_name.trim() || null,
      student_full_name: `${form.student_first_name.trim()} ${form.student_last_name.trim()}`.trim(),
      student_email: form.student_email.trim() || null,
      student_phone: form.student_phone.trim(),
      student_whatsapp: form.student_whatsapp.trim() || null,
      city: form.city.trim() || null,
      state: form.state.trim() || null,
      country_of_residence: form.country_of_residence || null,
      intended_study_country: form.intended_study_country,
      intake_term: form.intake_term,
      intake_year: form.intake_year,
      course_name: form.course_name,
      university_name_raw: form.university_name_raw.trim() || null,
      university_id: form.university_id || null,
      loan_amount_required: form.loan_amount_required ? Number(form.loan_amount_required) : null,
      coapplicant_name: form.coapplicant_name.trim() || null,
      coapplicant_relation: form.coapplicant_relation.trim() || null,
      coapplicant_income: form.coapplicant_income ? Number(form.coapplicant_income) : null,
      collateral_available: form.collateral_available,
      collateral_notes: form.collateral_notes.trim() || null,
      partner_id: appUser.partner_id,
      partner_user_id: appUser.id,
      current_stage: asDraft ? ("draft" as const) : ("submitted" as const),
      current_status: "new" as const,
    };

    const { error } = await supabase.from("student_leads").insert(payload);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(asDraft ? "Lead saved as draft" : "Lead submitted successfully");
      navigate("/leads");
    }
    setSubmitting(false);
  };

  const intakeTerms = [...new Set(intakes.map((i) => i.intake_term))];
  const intakeYears = [...new Set(intakes.map((i) => i.intake_year))].sort();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold text-foreground">Add New Lead</h1>
      </div>

      <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-6">
        {/* Student Info */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Student Information</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>First Name *</Label>
              <Input value={form.student_first_name} onChange={(e) => set("student_first_name", e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Last Name</Label>
              <Input value={form.student_last_name} onChange={(e) => set("student_last_name", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.student_email} onChange={(e) => set("student_email", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Phone *</Label>
              <Input value={form.student_phone} onChange={(e) => set("student_phone", e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>WhatsApp</Label>
              <Input value={form.student_whatsapp} onChange={(e) => set("student_whatsapp", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>City</Label>
              <Input value={form.city} onChange={(e) => set("city", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>State</Label>
              <Input value={form.state} onChange={(e) => set("state", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Country of Residence</Label>
              <Select value={form.country_of_residence} onValueChange={(v) => set("country_of_residence", v)}>
                <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
                <SelectContent>
                  {countries.map((c) => (
                    <SelectItem key={c.id} value={c.country_name}>{c.country_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Study Details */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Study Details</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Intended Study Country *</Label>
              <Select value={form.intended_study_country} onValueChange={(v) => set("intended_study_country", v)}>
                <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
                <SelectContent>
                  {countries.map((c) => (
                    <SelectItem key={c.id} value={c.country_name}>{c.country_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>University</Label>
              <Select value={form.university_id} onValueChange={(v) => {
                const uni = universities.find((u) => u.id === v);
                set("university_id", v);
                set("university_name_raw", uni?.university_name ?? "");
              }}>
                <SelectTrigger><SelectValue placeholder="Select university" /></SelectTrigger>
                <SelectContent>
                  {universities.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.university_name} ({u.country})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Or enter university name</Label>
              <Input value={form.university_name_raw} onChange={(e) => set("university_name_raw", e.target.value)} placeholder="If not in list" />
            </div>
            <div className="space-y-2">
              <Label>Course *</Label>
              <Select value={form.course_name} onValueChange={(v) => set("course_name", v)}>
                <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
                <SelectContent>
                  {courses.map((c) => (
                    <SelectItem key={c.id} value={c.course_name}>{c.course_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Intake Term *</Label>
              <Select value={form.intake_term} onValueChange={(v) => set("intake_term", v)}>
                <SelectTrigger><SelectValue placeholder="Select term" /></SelectTrigger>
                <SelectContent>
                  {intakeTerms.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Intake Year *</Label>
              <Select value={form.intake_year ? String(form.intake_year) : ""} onValueChange={(v) => set("intake_year", Number(v))}>
                <SelectTrigger><SelectValue placeholder="Select year" /></SelectTrigger>
                <SelectContent>
                  {intakeYears.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Financial Info */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Financial Information</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Loan Amount Required (₹)</Label>
              <Input type="number" min="0" value={form.loan_amount_required} onChange={(e) => set("loan_amount_required", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Co-Applicant Name</Label>
              <Input value={form.coapplicant_name} onChange={(e) => set("coapplicant_name", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Co-Applicant Relation</Label>
              <Input value={form.coapplicant_relation} onChange={(e) => set("coapplicant_relation", e.target.value)} placeholder="e.g. Father, Mother, Spouse" />
            </div>
            <div className="space-y-2">
              <Label>Co-Applicant Income (₹)</Label>
              <Input type="number" min="0" value={form.coapplicant_income} onChange={(e) => set("coapplicant_income", e.target.value)} />
            </div>
            <div className="flex items-center gap-3 pt-2">
              <Switch checked={form.collateral_available} onCheckedChange={(v) => set("collateral_available", v)} />
              <Label>Collateral Available</Label>
            </div>
            {form.collateral_available && (
              <div className="space-y-2">
                <Label>Collateral Notes</Label>
                <Textarea value={form.collateral_notes} onChange={(e) => set("collateral_notes", e.target.value)} />
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-3 justify-end">
          <Button type="button" variant="outline" disabled={submitting} onClick={(e) => handleSubmit(e as any, true)}>
            Save as Draft
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Submitting..." : "Submit Lead"}
          </Button>
        </div>
      </form>
    </div>
  );
}
