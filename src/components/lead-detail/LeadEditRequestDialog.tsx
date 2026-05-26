import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { EDITABLE_FIELDS, computeDiff, diffToChanges } from "@/lib/editRequestFields";
import { FormSection } from "@/components/shared/FormSection";
import { MasterCombobox, type MasterOption } from "@/components/ui/master-combobox";
import { IndianPhoneInput } from "@/components/shared/IndianPhoneInput";
import { IndianCityCombobox } from "@/components/shared/IndianCityCombobox";
import { LakhsInput } from "@/components/ui/lakhs-input";
import { MoneyInput } from "@/components/ui/money-input";
import { CollateralRadio, collateralBoolToState, collateralStateToBool, type CollateralState } from "@/components/shared/CollateralRadio";
import { useLeadMasterData } from "@/hooks/useLeadMasterData";
import { useHighestQualificationOptions } from "@/hooks/useHighestQualificationOptions";
import { useEmploymentTypeOptions } from "@/hooks/useEmploymentTypeOptions";
import { CO_APPLICANT_RELATIONS } from "@/lib/coapplicantRelations";
import { COURSE_CATEGORY_OPTIONS } from "@/lib/courseCategoryOptions";
import {
  buildIntakeSessionOptions,
  intakeSessionValue,
  parseIntakeSessionValue,
} from "@/lib/intakeSession";
import { sortByPriority } from "@/lib/countryOrder";
import {
  hasCountry as jsonHasCountry,
  getUniversities as jsonGetUniversities,
  getCourses as jsonGetCourses,
} from "@/lib/universitiesData";
import type { Tables } from "@/integrations/supabase/types";

type Lead = Tables<"student_leads">;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead;
  onSubmitted: () => void;
}

export function LeadEditRequestDialog({ open, onOpenChange, lead, onSubmitted }: Props) {
  const masters = useLeadMasterData();
  const { options: QUALIFICATIONS } = useHighestQualificationOptions();
  const { options: EMPLOYMENT_TYPE_OPTIONS } = useEmploymentTypeOptions();

  const sortedCountries = useMemo(
    () => sortByPriority(masters.countries, (c) => c.country_name),
    [masters.countries],
  );

  // Build initial form values from the lead, keyed by editRequestFields keys.
  const initial = useMemo(() => {
    const o: Record<string, unknown> = {};
    for (const f of EDITABLE_FIELDS) {
      const raw = (lead as unknown as Record<string, unknown>)[f.key];
      o[f.key] = raw ?? "";
    }
    return o;
  }, [lead]);

  const [values, setValues] = useState<Record<string, unknown>>(initial);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Reset state whenever a new lead is opened
  useEffect(() => {
    setValues(initial);
    setReason("");
  }, [initial, open]);

  const setField = (key: string, val: unknown) => setValues((v) => ({ ...v, [key]: val }));
  const setMany = (patch: Record<string, unknown>) => setValues((v) => ({ ...v, ...patch }));

  const diff = useMemo(() => computeDiff(initial, values), [initial, values]);
  const diffCount = Object.keys(diff).length;
  const reasonValid = reason.trim().length >= 10;

  // ---------- Country / University / Course cascade ----------
  const studyCountry = String(values.intended_study_country ?? "");
  const countryInJson = jsonHasCountry(studyCountry);

  const universityOptions: MasterOption[] = useMemo(() => {
    const country = studyCountry.trim();
    if (!country) return [];
    if (countryInJson) {
      return jsonGetUniversities(country).map((u) => ({
        id: u.name,
        label: u.name,
        hint: u.city ?? undefined,
      }));
    }
    // Fall back to master rows filtered case-insensitively by country name
    const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();
    return masters.universities
      .filter((u) => norm(u.country) === norm(country))
      .map((u) => ({ id: u.university_name, label: u.university_name }));
  }, [masters.universities, studyCountry, countryInJson]);

  const courseOptions: MasterOption[] = useMemo(() => {
    const country = studyCountry.trim();
    const uniName = String(values.university_name_raw ?? "").trim();
    if (countryInJson && country && uniName) {
      return jsonGetCourses(country, uniName).map((c) => ({ id: c, label: c }));
    }
    return masters.courses.map((c) => ({
      id: c.course_name,
      label: c.course_name,
      hint: c.course_category ?? undefined,
    }));
  }, [masters.courses, countryInJson, studyCountry, values.university_name_raw]);

  // Intake session options (rolling future windows). If the current lead's term/year
  // is not in the rolling list (legacy lead), inject it so it renders safely.
  const intakeSessionOptions = useMemo(() => {
    const opts = buildIntakeSessionOptions(masters.intakes, { onlyFuture: true });
    const currentTerm = String(initial.intake_term ?? "");
    const currentYear = Number(initial.intake_year ?? 0);
    if (currentTerm && currentYear) {
      const key = intakeSessionValue(currentTerm, currentYear);
      if (!opts.some((o) => o.value === key)) {
        opts.unshift({
          value: key,
          label: `${currentTerm} ${currentYear} (current)`,
          term: currentTerm,
          year: currentYear,
        });
      }
    }
    return opts;
  }, [masters.intakes, initial.intake_term, initial.intake_year]);

  const handleSubmit = async () => {
    if (!reasonValid) {
      toast.error("Please provide a reason of at least 10 characters.");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.rpc("submit_edit_request", {
      _lead_id: lead.id,
      _changes: diffToChanges(diff) as never,
      _reason: reason.trim(),
    } as never);
    setSubmitting(false);
    if (error) {
      toast.error(error.message ?? "Failed to submit edit request");
      return;
    }
    toast.success("Your edit request has been sent to admin for review.");
    setReason("");
    onSubmitted();
    onOpenChange(false);
  };

  const isChanged = (key: string) => diff[key] !== undefined;

  // Small helper to render a field cell with consistent label/changed badge.
  const Field = ({
    fieldKey,
    label,
    required,
    span,
    children,
  }: {
    fieldKey: string;
    label: string;
    required?: boolean;
    span?: boolean;
    children: React.ReactNode;
  }) => (
    <div className={`space-y-1.5 ${span ? "sm:col-span-2" : ""}`}>
      <Label className="text-xs flex items-center gap-1.5">
        {isChanged(fieldKey) && <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" aria-hidden />}
        <span className="truncate">
          {label}
          {required && <span className="text-destructive ml-0.5">*</span>}
        </span>
        {isChanged(fieldKey) && <Badge variant="secondary" className="h-4 px-1 text-[10px] shrink-0">edited</Badge>}
      </Label>
      {children}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Request Edit</DialogTitle>
          <DialogDescription>
            Update the fields you want changed. Admin will review and apply the approved ones.
            Editing first/last name will auto-update Full Name unless you also edit it.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[65vh] pr-4">
          <div className="space-y-6">
            {/* ---------- CONTACT ---------- */}
            <FormSection title="Contact">
              <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
                <Field fieldKey="student_email" label="Email">
                  <Input
                    type="email"
                    value={String(values.student_email ?? "")}
                    onChange={(e) => setField("student_email", e.target.value)}
                    className="h-9 text-sm"
                  />
                </Field>
                <Field fieldKey="student_phone" label="Phone">
                  <IndianPhoneInput
                    value={String(values.student_phone ?? "")}
                    onChange={(d) => setField("student_phone", d)}
                  />
                </Field>
                <Field fieldKey="student_whatsapp" label="WhatsApp">
                  <IndianPhoneInput
                    value={String(values.student_whatsapp ?? "")}
                    onChange={(d) => setField("student_whatsapp", d)}
                  />
                </Field>
              </div>
            </FormSection>

            {/* ---------- PROFILE ---------- */}
            <FormSection title="Profile">
              <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
                <Field fieldKey="student_first_name" label="First name">
                  <Input
                    value={String(values.student_first_name ?? "")}
                    onChange={(e) => setField("student_first_name", e.target.value)}
                    className="h-9 text-sm"
                  />
                </Field>
                <Field fieldKey="student_last_name" label="Last name">
                  <Input
                    value={String(values.student_last_name ?? "")}
                    onChange={(e) => setField("student_last_name", e.target.value)}
                    className="h-9 text-sm"
                  />
                </Field>
                <Field fieldKey="student_dob" label="Date of birth">
                  <Input
                    type="date"
                    value={String(values.student_dob ?? "")}
                    onChange={(e) => setField("student_dob", e.target.value)}
                    className="h-9 text-sm"
                  />
                </Field>
                <Field fieldKey="student_gender" label="Gender">
                  <Select
                    value={String(values.student_gender ?? "")}
                    onValueChange={(v) => setField("student_gender", v)}
                  >
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {["Male", "Female", "Other"].map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </FormSection>

            {/* ---------- ADDRESS ---------- */}
            <FormSection title="Address">
              <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
                <Field fieldKey="city" label="City / District">
                  <IndianCityCombobox
                    value={String(values.city ?? "")}
                    onChange={(v) => setField("city", v)}
                  />
                </Field>
                <Field fieldKey="state" label="State">
                  <Input
                    value={String(values.state ?? "")}
                    onChange={(e) => setField("state", e.target.value)}
                    className="h-9 text-sm"
                  />
                </Field>
                <Field fieldKey="pincode" label="Pincode">
                  <Input
                    value={String(values.pincode ?? "")}
                    onChange={(e) => setField("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="h-9 text-sm"
                  />
                </Field>
                <Field fieldKey="country_of_residence" label="Country of residence">
                  {(() => {
                    const current = String(values.country_of_residence ?? "");
                    const opts: MasterOption[] = sortedCountries.map((c) => ({ id: c.country_name, label: c.country_name }));
                    const isMaster = !!current && opts.some((o) => o.id === current);
                    return (
                      <MasterCombobox
                        options={opts}
                        selectedId={isMaster ? current : ""}
                        manualValue={isMaster ? "" : current}
                        onSelectMaster={(opt) => setField("country_of_residence", opt.label)}
                        onSelectManual={() => setField("country_of_residence", "")}
                        onChangeManual={(t) => setField("country_of_residence", t)}
                        placeholder="Search country…"
                        manualPlaceholder="Type the country name"
                      />
                    );
                  })()}
                </Field>
              </div>
            </FormSection>

            {/* ---------- STUDY ---------- */}
            <FormSection title="Study">
              <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
                <Field fieldKey="intended_study_country" label="Destination country" span>
                  {(() => {
                    const current = String(values.intended_study_country ?? "");
                    const opts: MasterOption[] = sortedCountries.map((c) => ({ id: c.country_name, label: c.country_name }));
                    const isMaster = !!current && opts.some((o) => o.id === current);
                    return (
                      <MasterCombobox
                        options={opts}
                        selectedId={isMaster ? current : ""}
                        manualValue={isMaster ? "" : current}
                        onSelectMaster={(opt) =>
                          setMany({
                            intended_study_country: opt.label,
                            // Changing country clears stale uni/course so we don't carry mismatched picks.
                            university_name_raw: "",
                            course_name: "",
                          })
                        }
                        onSelectManual={() => setField("intended_study_country", "")}
                        onChangeManual={(t) => setField("intended_study_country", t)}
                        placeholder="Search intended country…"
                        manualPlaceholder="Type the country name"
                      />
                    );
                  })()}
                </Field>

                <Field fieldKey="university_name_raw" label="University" span>
                  {(() => {
                    const current = String(values.university_name_raw ?? "");
                    const isMaster = !!current && universityOptions.some((o) => o.id === current);
                    return (
                      <MasterCombobox
                        options={universityOptions}
                        selectedId={isMaster ? current : ""}
                        manualValue={isMaster ? "" : current}
                        onSelectMaster={(opt) =>
                          setMany({
                            university_name_raw: opt.label,
                            // Changing university clears the previously selected course.
                            course_name: "",
                          })
                        }
                        onSelectManual={() => setField("university_name_raw", "")}
                        onChangeManual={(t) => setField("university_name_raw", t)}
                        placeholder={
                          studyCountry
                            ? `Search universities in ${studyCountry}…`
                            : "Pick a country first to filter universities"
                        }
                        helperText="Search the list, or pick 'Not available in list' to type manually."
                        manualPlaceholder="Type the university name"
                      />
                    );
                  })()}
                </Field>

                <Field fieldKey="course_name" label="Course">
                  {(() => {
                    const current = String(values.course_name ?? "");
                    const isMaster = !!current && courseOptions.some((o) => o.id === current);
                    return (
                      <MasterCombobox
                        options={courseOptions}
                        selectedId={isMaster ? current : ""}
                        manualValue={isMaster ? "" : current}
                        onSelectMaster={(opt) => {
                          // course_category auto-derives ONLY when the course actually changes.
                          const patch: Record<string, unknown> = { course_name: opt.label };
                          if (opt.hint && opt.label !== initial.course_name) {
                            patch.course_category = opt.hint;
                          }
                          setMany(patch);
                        }}
                        onSelectManual={() => setField("course_name", "")}
                        onChangeManual={(t) => setField("course_name", t)}
                        placeholder={
                          values.university_name_raw ? "Search courses…" : "Pick a university first"
                        }
                        helperText="Search the list, or pick 'Not available in list' to type manually."
                        manualPlaceholder="Type the course name"
                      />
                    );
                  })()}
                </Field>

                <Field fieldKey="course_category" label="Course category">
                  <Select
                    value={String(values.course_category ?? "")}
                    onValueChange={(v) => setField("course_category", v)}
                  >
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      {COURSE_CATEGORY_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>

                <Field fieldKey="intake_term" label="Intake session" span>
                  {/* Single unified control that updates BOTH intake_term + intake_year. */}
                  <Select
                    value={intakeSessionValue(
                      values.intake_term as string,
                      Number(values.intake_year) || null,
                    )}
                    onValueChange={(v) => {
                      const parsed = parseIntakeSessionValue(v);
                      if (parsed) {
                        setMany({ intake_term: parsed.term, intake_year: parsed.year });
                      }
                    }}
                  >
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select intake session" /></SelectTrigger>
                    <SelectContent>
                      {intakeSessionOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {isChanged("intake_year") && !isChanged("intake_term") && (
                    <p className="text-[11px] text-muted-foreground">Intake year updated.</p>
                  )}
                </Field>

                <Field fieldKey="loan_amount_required" label="Loan amount required" span>
                  <LakhsInput
                    value={values.loan_amount_required as string | number | null | undefined}
                    onChange={(rawRupees) => setField("loan_amount_required", rawRupees ? Number(rawRupees) : "")}
                  />
                </Field>
              </div>
            </FormSection>

            {/* ---------- ACADEMIC ---------- */}
            <FormSection title="Academic">
              <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
                <Field fieldKey="highest_qualification" label="Highest qualification">
                  <Select
                    value={String(values.highest_qualification ?? "")}
                    onValueChange={(v) => setField("highest_qualification", v)}
                  >
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select qualification" /></SelectTrigger>
                    <SelectContent>
                      {QUALIFICATIONS.map((q) => <SelectItem key={q} value={q}>{q}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field fieldKey="marks_gpa" label="Marks / GPA">
                  <Input
                    value={String(values.marks_gpa ?? "")}
                    onChange={(e) => setField("marks_gpa", e.target.value)}
                    className="h-9 text-sm"
                  />
                </Field>
              </div>
            </FormSection>

            {/* ---------- CO-APPLICANT ---------- */}
            <FormSection title="Co-applicant">
              <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
                <Field fieldKey="coapplicant_name" label="Name">
                  <Input
                    value={String(values.coapplicant_name ?? "")}
                    onChange={(e) => setField("coapplicant_name", e.target.value)}
                    className="h-9 text-sm"
                  />
                </Field>
                <Field fieldKey="coapplicant_relation" label="Relation">
                  <Select
                    value={String(values.coapplicant_relation ?? "")}
                    onValueChange={(v) => setField("coapplicant_relation", v)}
                  >
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {CO_APPLICANT_RELATIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field fieldKey="coapplicant_mobile" label="Mobile">
                  <IndianPhoneInput
                    value={String(values.coapplicant_mobile ?? "")}
                    onChange={(d) => setField("coapplicant_mobile", d)}
                  />
                </Field>
                <Field fieldKey="coapplicant_email" label="Email">
                  <Input
                    type="email"
                    value={String(values.coapplicant_email ?? "")}
                    onChange={(e) => setField("coapplicant_email", e.target.value)}
                    className="h-9 text-sm"
                  />
                </Field>
                <Field fieldKey="coapplicant_employment_type" label="Employment type">
                  <Select
                    value={String(values.coapplicant_employment_type ?? "")}
                    onValueChange={(v) => setField("coapplicant_employment_type", v)}
                  >
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {EMPLOYMENT_TYPE_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field fieldKey="coapplicant_income" label="Monthly income">
                  <MoneyInput
                    value={values.coapplicant_income as string | number | null | undefined}
                    onChange={(rawRupees) => setField("coapplicant_income", rawRupees ? Number(rawRupees) : "")}
                  />
                </Field>
              </div>
            </FormSection>

            {/* ---------- COLLATERAL ---------- */}
            <FormSection title="Collateral">
              <CollateralRadio
                state={collateralBoolToState(values.collateral_available as boolean | null | undefined)}
                notes={String(values.collateral_notes ?? "")}
                onChangeState={(s: CollateralState) =>
                  setField("collateral_available", collateralStateToBool(s))
                }
                onChangeNotes={(n) => setField("collateral_notes", n)}
              />
            </FormSection>
          </div>
        </ScrollArea>

        <div className="space-y-2 rounded-md border bg-muted/30 p-3">
          <Label className="text-xs">
            Reason for edit (min 10 characters) <span className="text-destructive">*</span>
          </Label>
          {diffCount === 0 && (
            <p className="text-xs text-muted-foreground">
              You can still submit this request without changing fields if you need admin to review the lead.
            </p>
          )}
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why is this edit needed? e.g. student updated their phone number, or please review co-applicant details"
            className="min-h-[60px] text-sm bg-background"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {diffCount === 0
                ? "No field changes — this will be sent as a review request to admin."
                : `${diffCount} field${diffCount > 1 ? "s" : ""} will be requested.`}
            </span>
            <span>{reason.trim().length}/10</span>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !reasonValid}>
            {submitting ? "Submitting..." : "Submit request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
