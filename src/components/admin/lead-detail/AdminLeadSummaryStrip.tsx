// Admin-only summary strip. Premium info-tile row for the key facts.
//
// Master-backed fields (Study Destination, Intake Session, University, Course)
// use MasterEditPopover + master tables fetched via useLeadMasterData. Other
// fields (Loan Amount, Co-applicant, Collateral, Source) keep the existing
// InlineEditField behaviour unchanged.
import { useEffect, useMemo, useState } from "react";
import { useRoleAccess } from "@/hooks/useRoleAccess";
import { InlineEditField } from "@/components/admin/InlineEditField";
import { MasterEditPopover } from "@/components/admin/MasterEditPopover";
import {
  MasterCombobox,
  type MasterOption,
} from "@/components/ui/master-combobox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLeadMasterData } from "@/hooks/useLeadMasterData";
import { formatINR } from "@/lib/formatCurrency";
import { INRAmountStacked } from "@/components/shared/INRAmountStacked";
import {
  buildIntakeSessionOptions,
  intakeSessionLabel,
  intakeSessionValue,
  parseIntakeSessionValue,
} from "@/lib/intakeSession";
import type { Tables } from "@/integrations/supabase/types";

type Lead = Tables<"student_leads">;

function ReadOnlyValue({
  value,
  emphasis = false,
}: {
  value: string | null | undefined;
  emphasis?: boolean;
}) {
  const hasValue = value !== null && value !== undefined && value !== "";
  return (
    <p
      className={
        hasValue
          ? `${emphasis ? "text-base font-semibold tabular-nums text-primary" : "text-sm font-semibold text-foreground"} break-words`
          : "text-sm italic text-muted-foreground/70 break-words"
      }
      title={hasValue ? String(value) : "Please provide details"}
    >
      {hasValue ? (value as string) : "Please provide details"}
    </p>
  );
}

function Tile({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="min-w-0 rounded-lg border border-border/60 bg-card px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
      title={label}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground truncate">
        {label}
      </p>
      <div className="min-w-0 mt-1.5">{children}</div>
    </div>
  );
}

interface Props {
  lead: Lead;
  onSaved?: () => void;
}

const sameCountryName = (a: string | null | undefined, b: string | null | undefined) =>
  (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();

export function AdminLeadSummaryStrip({ lead, onSaved }: Props) {
  const { isAdmin } = useRoleAccess();
  const { countries, universities, courses, intakes } = useLeadMasterData();

  // Country picker (Study Destination)
  const [countryDraft, setCountryDraft] = useState<string>(lead.intended_study_country ?? "");

  // Intake Session
  const intakeOptions = useMemo(
    () => buildIntakeSessionOptions(intakes, { onlyFuture: false }),
    [intakes],
  );
  const [intakeDraft, setIntakeDraft] = useState<string>(
    intakeSessionValue(lead.intake_term, lead.intake_year),
  );

  // University picker
  const universityOptions: MasterOption[] = useMemo(() => {
    const country = (lead.intended_study_country ?? "").trim();
    const filtered = country
      ? universities.filter((u) => sameCountryName(u.country, country))
      : universities;
    return filtered.map((u) => ({ id: u.id, label: u.university_name, hint: u.country ?? undefined }));
  }, [universities, lead.intended_study_country]);
  const [uniId, setUniId] = useState<string>(lead.university_id ?? "");
  const [uniManual, setUniManual] = useState<string>(
    lead.university_id ? "" : lead.university_name_raw ?? "",
  );

  // Course picker
  const courseOptions: MasterOption[] = useMemo(
    () => courses.map((c) => ({ id: c.id, label: c.course_name, hint: c.course_category ?? undefined })),
    [courses],
  );
  const matchedCourseId = useMemo(() => {
    const cn = (lead.course_name ?? "").trim().toLowerCase();
    if (!cn) return "";
    return courses.find((c) => c.course_name.trim().toLowerCase() === cn)?.id ?? "";
  }, [courses, lead.course_name]);
  const [courseId, setCourseId] = useState<string>(matchedCourseId);
  const [courseManual, setCourseManual] = useState<string>(
    matchedCourseId ? "" : lead.course_name ?? "",
  );

  // Re-sync drafts when lead changes (after a refresh)
  useEffect(() => {
    setCountryDraft(lead.intended_study_country ?? "");
    setIntakeDraft(intakeSessionValue(lead.intake_term, lead.intake_year));
    setUniId(lead.university_id ?? "");
    setUniManual(lead.university_id ? "" : lead.university_name_raw ?? "");
    setCourseId(matchedCourseId);
    setCourseManual(matchedCourseId ? "" : lead.course_name ?? "");
  }, [lead.id, lead.intended_study_country, lead.intake_term, lead.intake_year, lead.university_id, lead.university_name_raw, lead.course_name, matchedCourseId]);

  const tileValueClass = "text-sm font-semibold text-foreground break-words block max-w-full";

  const editable = (
    field: string,
    value: string | null | undefined,
    label: string,
    extra?: { inputType?: string; formatDisplay?: (v: string) => string },
  ) =>
    isAdmin ? (
      <InlineEditField
        leadId={lead.id}
        field={field}
        label={label}
        value={value ?? null}
        allowEditExisting
        inputType={extra?.inputType}
        formatDisplay={extra?.formatDisplay}
        className={tileValueClass}
        onSaved={() => onSaved?.()}
      />
    ) : (
      <ReadOnlyValue value={extra?.formatDisplay && value ? extra.formatDisplay(value) : value} />
    );

  const titleizeEnum = (v: string) =>
    v
      .split(/[_\s]+/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");

  const intakeDisplay = intakeSessionLabel(lead.intake_term, lead.intake_year) || null;
  const universityDisplay = lead.university_name_raw ?? null;
  const courseDisplay = lead.course_name ?? null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 2xl:grid-cols-8 gap-3">
      <Tile label="Study Destination">
        {isAdmin ? (
          <MasterEditPopover
            leadId={lead.id}
            label="Study Destination"
            display={lead.intended_study_country || null}
            renderBody={() => {
              const opts: MasterOption[] = countries.map((c) => ({ id: c.country_name, label: c.country_name }));
              const isMaster = !!countryDraft && opts.some((o) => o.id === countryDraft);
              return (
                <MasterCombobox
                  options={opts}
                  selectedId={isMaster ? countryDraft : ""}
                  manualValue={isMaster ? "" : countryDraft}
                  onSelectMaster={(opt) => setCountryDraft(opt.label)}
                  onSelectManual={() => setCountryDraft("")}
                  onChangeManual={(t) => setCountryDraft(t)}
                  placeholder="Select country"
                  manualPlaceholder="Type the country name"
                />
              );
            }}
            validate={() => (!countryDraft.trim() ? "Please select or type a country" : null)}
            buildPayload={() => ({ intended_study_country: countryDraft.trim() })}
            buildAudit={() => ({
              old: { intended_study_country: lead.intended_study_country },
              new: { intended_study_country: countryDraft.trim() },
            })}
            onSaved={onSaved}
          />
        ) : (
          <ReadOnlyValue value={lead.intended_study_country} />
        )}
      </Tile>

      <Tile label="Intake Session">
        {isAdmin ? (
          <MasterEditPopover
            leadId={lead.id}
            label="Intake Session"
            display={intakeDisplay}
            renderBody={() => (
              <Select value={intakeDraft} onValueChange={setIntakeDraft}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select intake session" />
                </SelectTrigger>
                <SelectContent>
                  {intakeOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            validate={() => (!parseIntakeSessionValue(intakeDraft) ? "Please select an intake session" : null)}
            buildPayload={() => {
              const parsed = parseIntakeSessionValue(intakeDraft);
              if (!parsed) return null;
              return { intake_term: parsed.term, intake_year: parsed.year };
            }}
            buildAudit={() => {
              const parsed = parseIntakeSessionValue(intakeDraft);
              return {
                old: { intake_term: lead.intake_term, intake_year: lead.intake_year },
                new: { intake_term: parsed?.term ?? null, intake_year: parsed?.year ?? null },
              };
            }}
            onSaved={onSaved}
          />
        ) : (
          <ReadOnlyValue value={intakeDisplay} />
        )}
      </Tile>

      <Tile label="University">
        {isAdmin ? (
          <MasterEditPopover
            leadId={lead.id}
            label="University"
            display={universityDisplay}
            renderBody={() => (
              <MasterCombobox
                options={universityOptions}
                selectedId={uniId}
                manualValue={uniManual}
                onSelectMaster={(opt) => {
                  setUniId(opt.id);
                  setUniManual(opt.label);
                }}
                onSelectManual={() => {
                  setUniId("");
                }}
                onChangeManual={setUniManual}
                placeholder="Search universities…"
                manualPlaceholder="Type the university name"
                helperText={
                  lead.intended_study_country
                    ? `Filtered by ${lead.intended_study_country}`
                    : "Tip: set Study Destination first to filter the list"
                }
              />
            )}
            validate={() => (!uniId && !uniManual.trim() ? "Please pick a university or type one" : null)}
            buildPayload={() => ({
              university_id: uniId || null,
              university_name_raw: uniManual.trim() || null,
            })}
            buildAudit={() => ({
              old: {
                university_id: lead.university_id,
                university_name_raw: lead.university_name_raw,
              },
              new: {
                university_id: uniId || null,
                university_name_raw: uniManual.trim() || null,
              },
            })}
            onSaved={onSaved}
          />
        ) : (
          <ReadOnlyValue value={universityDisplay} />
        )}
      </Tile>

      <Tile label="Course">
        {isAdmin ? (
          <MasterEditPopover
            leadId={lead.id}
            label="Course"
            display={courseDisplay}
            renderBody={() => (
              <MasterCombobox
                options={courseOptions}
                selectedId={courseId}
                manualValue={courseManual}
                onSelectMaster={(opt) => {
                  setCourseId(opt.id);
                  setCourseManual(opt.label);
                }}
                onSelectManual={() => {
                  setCourseId("");
                }}
                onChangeManual={setCourseManual}
                placeholder="Search courses…"
                manualPlaceholder="Type the course name"
              />
            )}
            validate={() => {
              const name = courseId
                ? courses.find((c) => c.id === courseId)?.course_name ?? ""
                : courseManual.trim();
              return name ? null : "Please pick a course or type one";
            }}
            buildPayload={() => {
              const master = courseId ? courses.find((c) => c.id === courseId) : null;
              const name = master ? master.course_name : courseManual.trim();
              if (!name) return null;
              return {
                course_name: name,
                course_category: master?.course_category ?? lead.course_category ?? null,
              };
            }}
            buildAudit={() => {
              const master = courseId ? courses.find((c) => c.id === courseId) : null;
              const name = master ? master.course_name : courseManual.trim();
              return {
                old: { course_name: lead.course_name, course_category: lead.course_category },
                new: { course_name: name, course_category: master?.course_category ?? lead.course_category ?? null },
              };
            }}
            onSaved={onSaved}
          />
        ) : (
          <ReadOnlyValue value={courseDisplay} />
        )}
      </Tile>

      <Tile label="Loan Amount">
        {isAdmin ? (
          <InlineEditField
            leadId={lead.id}
            field="loan_amount_required"
            label="Loan Amount"
            value={lead.loan_amount_required ? String(lead.loan_amount_required) : null}
            allowEditExisting
            inputType="number"
            numericKind="amount"
            formatDisplayNode={(v) => <INRAmountStacked value={v} emphasis />}
            onSaved={() => onSaved?.()}
          />
        ) : lead.loan_amount_required ? (
          <INRAmountStacked value={lead.loan_amount_required} emphasis />
        ) : (
          <ReadOnlyValue value={null} emphasis />
        )}
      </Tile>

      <Tile label="Co-Applicant">
        {editable("coapplicant_name", lead.coapplicant_name, "Co-Applicant")}
      </Tile>

      <Tile label="Collateral">
        {isAdmin ? (
          <InlineEditField
            leadId={lead.id}
            field="collateral_available"
            label="Collateral"
            value={
              lead.collateral_available === null || lead.collateral_available === undefined
                ? null
                : lead.collateral_available
                ? "true"
                : "false"
            }
            allowEditExisting
            options={[
              { value: "true", label: "Yes" },
              { value: "false", label: "No" },
            ]}
            parseValue={(raw) => raw === "true"}
            formatDisplay={(v) => (v === "true" ? "Yes" : "No")}
            onSaved={() => onSaved?.()}
          />
        ) : (
          <ReadOnlyValue
            value={lead.collateral_available === null ? null : lead.collateral_available ? "Yes" : "No"}
          />
        )}
      </Tile>

      <Tile label="Source">
        {editable("source_sub_type", lead.source_sub_type, "Source Subtype", {
          formatDisplay: (v) => titleizeEnum(v),
        })}
      </Tile>
    </div>
  );
}
