import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { StudentStepLayout } from "@/components/student/StudentStepLayout";
import { useStudentAuth } from "@/hooks/useStudentAuth";
import { useStudentApplication } from "@/hooks/useStudentApplication";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MasterCombobox, type MasterOption } from "@/components/ui/master-combobox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Lightbulb } from "lucide-react";
import { HIGHEST_QUALIFICATION_OPTIONS as QUALIFICATIONS } from "@/lib/highestQualificationOptions";

interface UniversityRow { id: string; university_name: string; country: string }
interface CourseRow { id: string; course_name: string; course_category: string | null }

export default function StudentEducationDetails() {
  const navigate = useNavigate();
  const { isVerified } = useStudentAuth();
  const { formData, updateField, updateTestScore, saveStep, saving } = useStudentApplication();
  const [intakes, setIntakes] = useState<{ id: string; intake_term: string; intake_year: number }[]>([]);
  const [universities, setUniversities] = useState<UniversityRow[]>([]);
  const [courses, setCourses] = useState<CourseRow[]>([]);

  useEffect(() => {
    if (!isVerified) { navigate("/student/login"); return; }
  }, [isVerified, navigate]);

  useEffect(() => {
    supabase.from("intake_master").select("id, intake_term, intake_year").eq("active_flag", true).order("sort_order").then(({ data }) => {
      if (data) setIntakes(data);
    });
    supabase.from("universities_master").select("id, university_name, country").eq("active_flag", true).order("university_name").then(({ data }) => {
      if (data) setUniversities(data as UniversityRow[]);
    });
    supabase.from("courses_master").select("id, course_name, course_category").eq("active_flag", true).order("course_name").then(({ data }) => {
      if (data) setCourses(data as CourseRow[]);
    });
  }, []);

  // Universities filtered by destination country (when present), else show all
  const universityOptions: MasterOption[] = useMemo(() => {
    const country = (formData.intended_study_country || "").trim().toLowerCase();
    const list = country
      ? universities.filter(u => (u.country || "").trim().toLowerCase() === country)
      : universities;
    const source = list.length > 0 ? list : universities;
    return source.map(u => ({ id: u.id, label: u.university_name, hint: u.country }));
  }, [universities, formData.intended_study_country]);

  const courseOptions: MasterOption[] = useMemo(
    () => courses.map(c => ({ id: c.id, label: c.course_name, hint: c.course_category ?? undefined })),
    [courses],
  );

  const handleContinue = async () => {
    if (!formData.course_name.trim()) {
      toast({ title: "Course name is required", variant: "destructive" }); return;
    }
    const result = await saveStep("save_education");
    if (result) {
      toast({ title: "Education details saved" });
      navigate("/student/apply/coapplicant");
    }
  };

  const handleSaveExit = async () => {
    await saveStep("save_education");
    toast({ title: "Progress saved" });
    navigate("/student/continue");
  };

  if (!isVerified) return null;

  // Context strip
  const contextItems = [
    formData.intended_study_country && `🌍 ${formData.intended_study_country}`,
    formData.course_category && `📚 ${formData.course_category}`,
  ].filter(Boolean);

  return (
    <StudentStepLayout
      currentStep={1}
      title="Step 2: Education Details"
      subtitle="Tell us about your academic background and study plans"
      onBack={() => navigate("/student/apply/basic")}
      onContinue={handleContinue}
      onSaveExit={handleSaveExit}
      saving={saving}
    >
      {/* Context strip */}
      {contextItems.length > 0 && (
        <div className="flex flex-wrap gap-2 rounded-lg border bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground">
          {contextItems.map((item, i) => (
            <span key={i} className="rounded-full bg-background px-2.5 py-1 font-medium">{item}</span>
          ))}
        </div>
      )}

      {/* Education Profile */}
      <Card>
        <CardContent className="p-5 sm:p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Education Profile</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Highest Qualification</Label>
              <Select value={formData.highest_qualification} onValueChange={v => updateField("highest_qualification", v)}>
                <SelectTrigger><SelectValue placeholder="Select qualification" /></SelectTrigger>
                <SelectContent>{QUALIFICATIONS.map(q => <SelectItem key={q} value={q}>{q}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Marks / GPA</Label>
              <Input value={formData.marks_gpa} onChange={e => updateField("marks_gpa", e.target.value)} placeholder="e.g. 8.5 CGPA or 85%" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Course Name <span className="text-destructive">*</span></Label>
              <MasterCombobox
                options={courseOptions}
                selectedId=""
                manualValue={formData.course_name}
                onSelectMaster={(opt) => {
                  updateField("course_name", opt.label);
                  if (opt.hint) updateField("course_category", opt.hint);
                }}
                onSelectManual={() => updateField("course_name", "")}
                onChangeManual={(t) => updateField("course_name", t)}
                placeholder="Search for your course"
                emptyMessage="No matching course."
                manualPlaceholder="e.g. MS in Computer Science"
                helperText="Pick from the list, or choose 'Not available' to type your own."
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>University Name</Label>
              <MasterCombobox
                options={universityOptions}
                selectedId={formData.university_id}
                manualValue={formData.university_name_raw}
                onSelectMaster={(opt) => {
                  updateField("university_id", opt.id);
                  updateField("university_name_raw", opt.label);
                }}
                onSelectManual={() => {
                  updateField("university_id", "");
                  updateField("university_name_raw", "");
                }}
                onChangeManual={(t) => updateField("university_name_raw", t)}
                placeholder={
                  formData.intended_study_country
                    ? `Search universities in ${formData.intended_study_country}`
                    : "Search universities"
                }
                emptyMessage="No matching university."
                manualPlaceholder="e.g. University of California, Berkeley"
                helperText="Can't find your university? Choose 'Not available' to enter it manually."
              />
            </div>
            <div className="space-y-1.5">
              <Label>Intake Term</Label>
              <Select value={formData.intake_term} onValueChange={v => updateField("intake_term", v)}>
                <SelectTrigger><SelectValue placeholder="Select term" /></SelectTrigger>
                <SelectContent>
                  {[...new Set(intakes.map(i => i.intake_term))].map(term => (
                    <SelectItem key={term} value={term}>{term}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Intake Year</Label>
              <Select value={formData.intake_year} onValueChange={v => updateField("intake_year", v)}>
                <SelectTrigger><SelectValue placeholder="Select year" /></SelectTrigger>
                <SelectContent>
                  {[...new Set(intakes.map(i => i.intake_year.toString()))].map(yr => (
                    <SelectItem key={yr} value={yr}>{yr}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info note */}
      <div className="flex items-start gap-2.5 rounded-lg border border-primary/10 bg-primary/[0.03] p-4">
        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p className="text-xs leading-relaxed text-muted-foreground">
          Strong academic scores and STEM backgrounds can improve your lender match quality. But don't worry — we evaluate your full profile, not just numbers.
        </p>
      </div>

      {/* Test Scores */}
      <Card>
        <CardContent className="p-5 sm:p-6">
          <div className="mb-1 flex items-center gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Test Scores</h2>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">Optional</span>
          </div>
          <p className="mb-4 text-xs text-muted-foreground">Fill in whatever you have — these are not mandatory at this stage.</p>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { key: "ielts", label: "IELTS", placeholder: "e.g. 7.5" },
              { key: "toefl", label: "TOEFL", placeholder: "e.g. 105" },
              { key: "duolingo", label: "Duolingo", placeholder: "e.g. 120" },
              { key: "gre", label: "GRE", placeholder: "e.g. 325" },
              { key: "gmat", label: "GMAT", placeholder: "e.g. 720" },
            ].map(t => (
              <div key={t.key} className="space-y-1.5">
                <Label className="text-xs">{t.label}</Label>
                <Input
                  type="number"
                  value={(formData.test_scores as any)[t.key] || ""}
                  onChange={e => updateTestScore(t.key, e.target.value)}
                  placeholder={t.placeholder}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </StudentStepLayout>
  );
}
