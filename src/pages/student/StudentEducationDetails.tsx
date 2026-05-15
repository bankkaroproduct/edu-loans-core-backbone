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
import { getUniversities as jsonGetUniversities, getCourses as jsonGetCourses, hasCountry as jsonHasCountry } from "@/lib/universitiesData";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllUniversitiesMaster } from "@/lib/fetchAllUniversities";
import { toast } from "@/hooks/use-toast";
import { Lightbulb } from "lucide-react";
import { useHighestQualificationOptions } from "@/hooks/useHighestQualificationOptions";
import { formatDisplayLabel } from "@/lib/formatDisplayLabel";
import { buildIntakeSessionOptions, intakeSessionValue, parseIntakeSessionValue } from "@/lib/intakeSession";
import { sanitizeWorkExpInput, formatWorkExperience } from "@/lib/workExperience";
import { Checkbox } from "@/components/ui/checkbox";
import { normalizeAcademicScore, validateScoreTotalPair } from "@/lib/academicScore";
import { validateTestScoresMap } from "@/lib/leadScoreRanges";
import { ScoreTotalPair } from "@/components/shared/ScoreTotalPair";

interface UniversityRow { id: string; university_name: string; country: string }
interface CourseRow { id: string; course_name: string; course_category: string | null }

export default function StudentEducationDetails() {
  const navigate = useNavigate();
  const { isVerified } = useStudentAuth();
  const { formData, updateField, updateTestScore, saveStep, saving } = useStudentApplication();
  const { options: QUALIFICATIONS } = useHighestQualificationOptions();
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
    // Paginated — universities_master exceeds PostgREST's 1000-row default.
    fetchAllUniversitiesMaster<UniversityRow>("id, university_name, country", {
      activeOnly: true,
      orderBy: "university_name",
    }).then((rows) => setUniversities(rows));
    supabase.from("courses_master").select("id, course_name, course_category").eq("active_flag", true).order("course_name").then(({ data }) => {
      if (data) setCourses(data as CourseRow[]);
    });
  }, []);

  // Cascading Country → University → Course sourced from
  // src/data/universities.json (PR1, UI-only). Country comes from Step 1.
  // When the country isn't covered by the JSON, fall back to the existing
  // master-driven lists so users on uncovered countries still see options.
  const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();
  const countryInJson = jsonHasCountry(formData.intended_study_country);

  const universityOptions: MasterOption[] = useMemo(() => {
    const country = (formData.intended_study_country || "").trim();
    if (countryInJson) {
      return jsonGetUniversities(country).map(u => ({
        id: u.name,
        label: u.name,
        hint: u.city ?? undefined,
      }));
    }
    const list = country
      ? universities.filter(u => norm(u.country) === norm(country))
      : universities;
    const source = list.length > 0 ? list : universities;
    return source.map(u => ({ id: u.id, label: u.university_name, hint: u.country }));
  }, [universities, formData.intended_study_country, countryInJson]);

  const courseOptions: MasterOption[] = useMemo(() => {
    const country = (formData.intended_study_country || "").trim();
    const uni = (formData.university_name_raw || "").trim();
    if (countryInJson && uni) {
      return jsonGetCourses(country, uni).map(c => ({ id: c, label: c }));
    }
    return courses.map(c => ({ id: c.id, label: c.course_name, hint: c.course_category ?? undefined }));
  }, [courses, countryInJson, formData.intended_study_country, formData.university_name_raw]);

  const resolveUniversityId = (uniName: string, country: string): string => {
    const tName = norm(uniName);
    const tCountry = norm(country);
    if (!tName) return "";
    return universities.find(u => norm(u.university_name) === tName && norm(u.country) === tCountry)?.id ?? "";
  };
  const resolveCourseId = (courseName: string): string => {
    const t = norm(courseName);
    if (!t) return "";
    return courses.find(c => norm(c.course_name) === t)?.id ?? "";
  };

  const handleContinue = async () => {
    if (!formData.course_name.trim()) {
      toast({ title: "Course name is required", variant: "destructive" }); return;
    }
    if (!formData.highest_qualification) {
      toast({ title: "Highest qualification is required", variant: "destructive" }); return;
    }
    if (!(formData.test_scores.tenth ?? "").toString().trim()) {
      toast({ title: "10th score is required", variant: "destructive" }); return;
    }
    if (!(formData.test_scores.twelfth ?? "").toString().trim()) {
      toast({ title: "12th score is required", variant: "destructive" }); return;
    }
    // Score/Total pair validation — totals are optional (legacy compat),
    // but when both are filled they must be a valid pair.
    const pairChecks: Array<[string, string, string]> = [
      ["10th", formData.test_scores.tenth || "", formData.test_scores.tenth_total || ""],
      ["12th", formData.test_scores.twelfth || "", formData.test_scores.twelfth_total || ""],
      ["Graduation", formData.test_scores.graduation || "", formData.test_scores.graduation_total || ""],
      ["Highest Qualification", formData.test_scores.highest_qualification_score || "", formData.test_scores.highest_qualification_total || ""],
    ];
    for (const [label, s, t] of pairChecks) {
      const err = validateScoreTotalPair(s, t);
      if (err) { toast({ title: `${label}: ${err}`, variant: "destructive" }); return; }
    }
    // Test-score range validation (IELTS 0–9, TOEFL 0–120, etc.)
    {
      const testErr = validateTestScoresMap(formData.test_scores as Record<string, unknown>);
      if (testErr) { toast({ title: testErr, variant: "destructive" }); return; }
    }
    const result = await saveStep("save_education");
    if (result) {
      toast({ title: "Education details saved" });
      navigate("/student/apply/coapplicant");
    }
  };

  const handleSaveExit = async () => {
    // Even on Save & Exit, refuse to persist out-of-range / junk numeric values.
    // Required-ness is intentionally NOT enforced here.
    const pairChecks: Array<[string, string, string]> = [
      ["10th", formData.test_scores.tenth || "", formData.test_scores.tenth_total || ""],
      ["12th", formData.test_scores.twelfth || "", formData.test_scores.twelfth_total || ""],
      ["Graduation", formData.test_scores.graduation || "", formData.test_scores.graduation_total || ""],
      ["Highest Qualification", formData.test_scores.highest_qualification_score || "", formData.test_scores.highest_qualification_total || ""],
    ];
    for (const [label, s, t] of pairChecks) {
      const err = validateScoreTotalPair(s, t);
      if (err) { toast({ title: `${label}: ${err}`, variant: "destructive" }); return; }
    }
    const testErr = validateTestScoresMap(formData.test_scores as Record<string, unknown>);
    if (testErr) { toast({ title: testErr, variant: "destructive" }); return; }
    await saveStep("save_education");
    toast({ title: "Progress saved" });
    navigate("/student/continue");
  };

  if (!isVerified) return null;

  // Context strip
  const contextItems = [
    formData.intended_study_country && `🌍 ${formData.intended_study_country}`,
    formData.course_category && `📚 ${formatDisplayLabel(formData.course_category)}`,
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
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Course Name <span className="text-destructive">*</span></Label>
              <MasterCombobox
                options={courseOptions}
                selectedId={countryInJson ? (formData.course_name || "") : (formData.course_id || "")}
                manualValue={(countryInJson ? !!formData.course_name : !!formData.course_id) ? "" : formData.course_name}
                onSelectMaster={(opt) => {
                  const masterId = countryInJson ? resolveCourseId(opt.label) : opt.id;
                  updateField("course_id", masterId);
                  updateField("course_name", opt.label);
                  if (opt.hint) updateField("course_category", opt.hint);
                }}
                onSelectManual={() => { updateField("course_id", ""); updateField("course_name", ""); }}
                onChangeManual={(t) => { updateField("course_id", ""); updateField("course_name", t); }}
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
                selectedId={countryInJson ? (formData.university_name_raw || "") : (formData.university_id || "")}
                manualValue={(countryInJson ? !!formData.university_name_raw : !!formData.university_id) ? "" : formData.university_name_raw}
                onSelectMaster={(opt) => {
                  const country = formData.intended_study_country || "";
                  const masterId = countryInJson ? resolveUniversityId(opt.label, country) : opt.id;
                  updateField("university_id", masterId);
                  updateField("university_name_raw", opt.label);
                  // Picking a different university clears any previously selected course.
                  updateField("course_id", "");
                  updateField("course_name", "");
                }}
                onSelectManual={() => {
                  updateField("university_id", "");
                  updateField("university_name_raw", "");
                  updateField("course_id", "");
                  updateField("course_name", "");
                }}
                onChangeManual={(t) => {
                  updateField("university_id", "");
                  updateField("university_name_raw", t);
                  updateField("course_id", "");
                  updateField("course_name", "");
                }}
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
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Intake Session</Label>
              <Select
                value={intakeSessionValue(formData.intake_term, formData.intake_year ? Number(formData.intake_year) : null)}
                onValueChange={v => {
                  const parsed = parseIntakeSessionValue(v);
                  if (parsed) {
                    updateField("intake_term", parsed.term);
                    updateField("intake_year", String(parsed.year));
                  }
                }}
              >
                <SelectTrigger><SelectValue placeholder="Select intake session" /></SelectTrigger>
                <SelectContent>
                  {buildIntakeSessionOptions(intakes, { onlyFuture: true }).map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Academic Profile — placed AFTER Education Profile and BEFORE Test Scores.
          Aligned with Bulk Upload columns: 10th_score, 12th_score, graduation_score,
          highest_qualification_score. Highest qualification itself lives in Education
          Profile above, also part of this academic group. */}
      <Card>
        <CardContent className="p-5 sm:p-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Current Academic Profile</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Enter your score and the total it was out of. Example: enter <code>9.5</code> and total <code>10</code> for CGPA, or <code>78</code> and total <code>100</code> for percentage.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Highest Qualification <span className="text-destructive">*</span></Label>
              <Select value={formData.highest_qualification} onValueChange={v => updateField("highest_qualification", v)}>
                <SelectTrigger><SelectValue placeholder="Select qualification" /></SelectTrigger>
                <SelectContent>{QUALIFICATIONS.map(q => <SelectItem key={q} value={q}>{q}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <ScoreTotalPair
              label="10th"
              required
              scoreKey="tenth"
              totalKey="tenth_total"
              scoreLabel="10th Score Obtained"
              totalLabel="10th Total Marks"
              scorePlaceholder="e.g. 85"
              totalPlaceholder="e.g. 100"
              scoreValue={formData.test_scores.tenth || ""}
              totalValue={formData.test_scores.tenth_total || ""}
              onScore={(v) => updateTestScore("tenth", v)}
              onTotal={(v) => updateTestScore("tenth_total", v)}
            />
            <ScoreTotalPair
              label="12th"
              required
              scoreKey="twelfth"
              totalKey="twelfth_total"
              scoreLabel="12th Score Obtained"
              totalLabel="12th Total Marks"
              scorePlaceholder="e.g. 88"
              totalPlaceholder="e.g. 100"
              scoreValue={formData.test_scores.twelfth || ""}
              totalValue={formData.test_scores.twelfth_total || ""}
              onScore={(v) => updateTestScore("twelfth", v)}
              onTotal={(v) => updateTestScore("twelfth_total", v)}
            />
            <ScoreTotalPair
              label="Graduation"
              scoreKey="graduation"
              totalKey="graduation_total"
              scoreLabel="Graduation Score Obtained"
              totalLabel="Graduation Total Marks / CGPA Scale"
              scorePlaceholder="e.g. 7.8"
              totalPlaceholder="e.g. 10"
              scoreValue={formData.test_scores.graduation || ""}
              totalValue={formData.test_scores.graduation_total || ""}
              onScore={(v) => updateTestScore("graduation", v)}
              onTotal={(v) => updateTestScore("graduation_total", v)}
            />
            <ScoreTotalPair
              label="Highest Qualification"
              scoreKey="highest_qualification_score"
              totalKey="highest_qualification_total"
              scoreLabel="Highest Qualification Score Obtained"
              totalLabel="Highest Qualification Total Marks / CGPA Scale"
              scorePlaceholder="e.g. 8.5"
              totalPlaceholder="e.g. 10"
              scoreValue={formData.test_scores.highest_qualification_score || ""}
              totalValue={formData.test_scores.highest_qualification_total || ""}
              onScore={(v) => updateTestScore("highest_qualification_score", v)}
              onTotal={(v) => updateTestScore("highest_qualification_total", v)}
            />
            <p className="text-xs text-muted-foreground sm:col-span-2">
              Highest Qualification, 10th and 12th are required. Graduation and Highest Qualification Score are optional. Total Marks / Scale is optional but recommended for accurate scoring.
            </p>
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

      {/* Work Experience — placed above Test Scores. Persists in test_scores.work_experience_years.
          Single decimal digit only: "3" = 3 years, "3.2" = 3 years 2 months. Fresher stores 0. */}
      <Card>
        <CardContent className="p-5 sm:p-6">
          <div className="mb-1 flex items-center gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Work Experience</h2>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">Optional</span>
          </div>
          <p className="mb-4 text-xs text-muted-foreground">
            Enter as years with one optional decimal for months. Example: <code>3</code> = 3 years; <code>3.2</code> = 3 years and 2 months.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Years of Experience</Label>
              <Input
                inputMode="decimal"
                value={
                  formData.test_scores.work_experience_years === "0"
                    ? ""
                    : (formData.test_scores.work_experience_years || "")
                }
                disabled={formData.test_scores.work_experience_years === "0"}
                onChange={e => updateTestScore("work_experience_years", sanitizeWorkExpInput(e.target.value))}
                placeholder="e.g. 3 or 3.2"
              />
              {formData.test_scores.work_experience_years &&
               formData.test_scores.work_experience_years !== "0" && (
                <p className="text-xs text-muted-foreground">
                  {formatWorkExperience(formData.test_scores.work_experience_years) || "Enter a valid value"}
                </p>
              )}
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={formData.test_scores.work_experience_years === "0"}
                  onCheckedChange={(v) => {
                    updateTestScore("work_experience_years", v === true ? "0" : "");
                  }}
                />
                <span>I'm a Fresher (no work experience)</span>
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

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
              { key: "pte", label: "PTE", placeholder: "e.g. 65" },
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
