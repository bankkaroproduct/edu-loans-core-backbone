import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import type { BreLenderRule } from "@/lib/bre/types";

type RuleDraft = Omit<BreLenderRule, "id" | "version_number" | "is_active" | "lender_id">;

interface Props {
  rule: RuleDraft;
  onChange: (next: RuleDraft) => void;
  readOnly?: boolean;
}

const numOrNull = (v: string): number | null => (v === "" ? null : Number(v));
const csvToList = (v: string): string[] => v.split(",").map((s) => s.trim()).filter(Boolean);

export function LenderRuleSectionCards({ rule, onChange, readOnly }: Props) {
  const set = <K extends keyof RuleDraft>(key: K, val: RuleDraft[K]) => onChange({ ...rule, [key]: val });

  return (
    <div className="space-y-4">
      {/* Basic info */}
      <Card>
        <CardHeader><CardTitle className="text-base">Basic info</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <Field label="Lender name">
            <Input value={rule.basic_info.lender_name ?? ""} onChange={(e) => set("basic_info", { ...rule.basic_info, lender_name: e.target.value })} disabled={readOnly} />
          </Field>
          <Field label="Lender code">
            <Input value={rule.basic_info.lender_code ?? ""} onChange={(e) => set("basic_info", { ...rule.basic_info, lender_code: e.target.value })} disabled={readOnly} />
          </Field>
          <Field label="Type">
            <Input value={rule.basic_info.lender_type ?? ""} onChange={(e) => set("basic_info", { ...rule.basic_info, lender_type: e.target.value || null })} disabled={readOnly} />
          </Field>
          <Field label="SPOC name">
            <Input value={rule.basic_info.spoc_name ?? ""} onChange={(e) => set("basic_info", { ...rule.basic_info, spoc_name: e.target.value || null })} disabled={readOnly} />
          </Field>
          <Field label="SPOC email">
            <Input type="email" value={rule.basic_info.spoc_email ?? ""} onChange={(e) => set("basic_info", { ...rule.basic_info, spoc_email: e.target.value || null })} disabled={readOnly} />
          </Field>
          <Field label="Code type">
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={rule.basic_info.code_type ?? ""}
              onChange={(e) => set("basic_info", { ...rule.basic_info, code_type: (e.target.value || null) as "internal" | "external" | "internal_under_process" | null })}
              disabled={readOnly}
            >
              <option value="">—</option>
              <option value="internal">Internal</option>
              <option value="external">External</option>
              <option value="internal_under_process">Internal (Under Process)</option>
            </select>
          </Field>
          <Field label="Active">
            <div className="flex h-10 items-center">
              <Switch checked={rule.basic_info.active} onCheckedChange={(v) => set("basic_info", { ...rule.basic_info, active: v })} disabled={readOnly} />
            </div>
          </Field>
        </CardContent>
      </Card>

      {/* Commercials */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Commercials</CardTitle>
          <p className="text-xs text-muted-foreground">Phase 1 seed left these as null since the source <code>lenders</code> table has no payout columns. Fill them in to enable payout-based ranking.</p>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <Field label="Payout %">
            <Input type="number" step="any" value={rule.commercials.payout_pct ?? ""} onChange={(e) => set("commercials", { ...rule.commercials, payout_pct: numOrNull(e.target.value) })} disabled={readOnly} />
          </Field>
          <Field label="Payout trigger stage">
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={rule.commercials.payout_trigger_stage ?? ""}
              onChange={(e) => set("commercials", { ...rule.commercials, payout_trigger_stage: e.target.value || null })}
              disabled={readOnly}
            >
              <option value="">—</option>
              <option value="sanction">On sanction</option>
              <option value="tranche_disbursement">On tranche disbursement</option>
              <option value="disbursement">On disbursement</option>
            </select>
          </Field>
          <Field label="Processing fee %">
            <Input type="number" step="any" value={rule.commercials.processing_fee_pct ?? ""} onChange={(e) => set("commercials", { ...rule.commercials, processing_fee_pct: numOrNull(e.target.value) })} disabled={readOnly} />
          </Field>
          <Field label="Processing fee flat (₹)">
            <Input type="number" step="any" value={rule.commercials.processing_fee_flat ?? ""} onChange={(e) => set("commercials", { ...rule.commercials, processing_fee_flat: numOrNull(e.target.value) })} disabled={readOnly} />
          </Field>
          <CoverageToggle
            label="PF GST applicable"
            checked={rule.commercials.processing_fee_gst_applicable === true}
            onCheckedChange={(v) => set("commercials", { ...rule.commercials, processing_fee_gst_applicable: v })}
            disabled={readOnly}
          />
          <CoverageToggle
            label="PF refundable on disbursement"
            checked={rule.commercials.processing_fee_refundable_on_disbursement === true}
            onCheckedChange={(v) => set("commercials", { ...rule.commercials, processing_fee_refundable_on_disbursement: v })}
            disabled={readOnly}
          />
          <Field label="VAS %">
            <Input type="number" step="any" value={rule.commercials.vas_pct ?? ""} onChange={(e) => set("commercials", { ...rule.commercials, vas_pct: numOrNull(e.target.value) })} disabled={readOnly} />
          </Field>
          <CoverageToggle
            label="VAS varies by lender (aggregator)"
            checked={rule.commercials.vas_varies_by_lender === true}
            onCheckedChange={(v) => set("commercials", { ...rule.commercials, vas_varies_by_lender: v })}
            disabled={readOnly}
          />
        </CardContent>
      </Card>

      {/* Hard thresholds */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hard thresholds (knockouts)</CardTitle>
          <p className="text-xs text-muted-foreground">Null = not configured (engine will not knock out on that field).</p>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <Field label="Min co-applicant income (₹)">
            <Input type="number" step="any" value={rule.hard_thresholds.min_coapplicant_income ?? ""} onChange={(e) => set("hard_thresholds", { ...rule.hard_thresholds, min_coapplicant_income: numOrNull(e.target.value) })} disabled={readOnly} />
          </Field>
          <Field label="Min CIBIL">
            <Input type="number" step="any" value={rule.hard_thresholds.min_cibil ?? ""} onChange={(e) => set("hard_thresholds", { ...rule.hard_thresholds, min_cibil: numOrNull(e.target.value) })} disabled={readOnly} />
          </Field>
          <Field label="Max DPD months">
            <Input type="number" step="any" value={rule.hard_thresholds.max_dpd_months ?? ""} onChange={(e) => set("hard_thresholds", { ...rule.hard_thresholds, max_dpd_months: numOrNull(e.target.value) })} disabled={readOnly} />
          </Field>
          <Field label="Min age">
            <Input type="number" step="any" value={rule.hard_thresholds.min_age ?? ""} onChange={(e) => set("hard_thresholds", { ...rule.hard_thresholds, min_age: numOrNull(e.target.value) })} disabled={readOnly} />
          </Field>
          <Field label="Max age">
            <Input type="number" step="any" value={rule.hard_thresholds.max_age ?? ""} onChange={(e) => set("hard_thresholds", { ...rule.hard_thresholds, max_age: numOrNull(e.target.value) })} disabled={readOnly} />
          </Field>
          <Field label="Min ITR years">
            <Input type="number" step="any" value={rule.hard_thresholds.min_itr_years ?? ""} onChange={(e) => set("hard_thresholds", { ...rule.hard_thresholds, min_itr_years: numOrNull(e.target.value) })} disabled={readOnly} />
          </Field>
          <Field label="Min CIBIL — student">
            <Input type="number" step="any" value={rule.hard_thresholds.min_cibil_student ?? ""} onChange={(e) => set("hard_thresholds", { ...rule.hard_thresholds, min_cibil_student: numOrNull(e.target.value) })} disabled={readOnly} />
          </Field>
          <Field label="Min CIBIL — co-applicant">
            <Input type="number" step="any" value={rule.hard_thresholds.min_cibil_coapplicant ?? ""} onChange={(e) => set("hard_thresholds", { ...rule.hard_thresholds, min_cibil_coapplicant: numOrNull(e.target.value) })} disabled={readOnly} />
          </Field>
          <Field label="Student min age">
            <Input type="number" step="any" value={rule.hard_thresholds.student_min_age ?? ""} onChange={(e) => set("hard_thresholds", { ...rule.hard_thresholds, student_min_age: numOrNull(e.target.value) })} disabled={readOnly} />
          </Field>
          <Field label="Student max age">
            <Input type="number" step="any" value={rule.hard_thresholds.student_max_age ?? ""} onChange={(e) => set("hard_thresholds", { ...rule.hard_thresholds, student_max_age: numOrNull(e.target.value) })} disabled={readOnly} />
          </Field>
          <Field label="Co-applicant min age">
            <Input type="number" step="any" value={rule.hard_thresholds.coapplicant_min_age ?? ""} onChange={(e) => set("hard_thresholds", { ...rule.hard_thresholds, coapplicant_min_age: numOrNull(e.target.value) })} disabled={readOnly} />
          </Field>
          <Field label="Co-applicant max age">
            <Input type="number" step="any" value={rule.hard_thresholds.coapplicant_max_age ?? ""} onChange={(e) => set("hard_thresholds", { ...rule.hard_thresholds, coapplicant_max_age: numOrNull(e.target.value) })} disabled={readOnly} />
          </Field>
          <Field label="Min marks Class X (%)">
            <Input type="number" step="any" value={rule.hard_thresholds.min_marks_class_x_pct ?? ""} onChange={(e) => set("hard_thresholds", { ...rule.hard_thresholds, min_marks_class_x_pct: numOrNull(e.target.value) })} disabled={readOnly} />
          </Field>
          <Field label="Min marks Class XII (%)">
            <Input type="number" step="any" value={rule.hard_thresholds.min_marks_class_xii_pct ?? ""} onChange={(e) => set("hard_thresholds", { ...rule.hard_thresholds, min_marks_class_xii_pct: numOrNull(e.target.value) })} disabled={readOnly} />
          </Field>
          <Field label="Min marks Graduation (%)">
            <Input type="number" step="any" value={rule.hard_thresholds.min_marks_grad_pct ?? ""} onChange={(e) => set("hard_thresholds", { ...rule.hard_thresholds, min_marks_grad_pct: numOrNull(e.target.value) })} disabled={readOnly} />
          </Field>
          <Field label="Min monthly salary (₹) — salaried">
            <Input type="number" step="any" value={rule.hard_thresholds.min_salary_monthly_salaried ?? ""} onChange={(e) => set("hard_thresholds", { ...rule.hard_thresholds, min_salary_monthly_salaried: numOrNull(e.target.value) })} disabled={readOnly} />
          </Field>
          <Field label="Min annual ITR (₹) — self-employed">
            <Input type="number" step="any" value={rule.hard_thresholds.min_itr_annual_self_employed ?? ""} onChange={(e) => set("hard_thresholds", { ...rule.hard_thresholds, min_itr_annual_self_employed: numOrNull(e.target.value) })} disabled={readOnly} />
          </Field>
          <Field label="Max DPD 30+">
            <Input type="number" step="any" value={rule.hard_thresholds.max_dpd_30 ?? ""} onChange={(e) => set("hard_thresholds", { ...rule.hard_thresholds, max_dpd_30: numOrNull(e.target.value) })} disabled={readOnly} />
          </Field>
          <Field label="Max DPD 60+">
            <Input type="number" step="any" value={rule.hard_thresholds.max_dpd_60 ?? ""} onChange={(e) => set("hard_thresholds", { ...rule.hard_thresholds, max_dpd_60: numOrNull(e.target.value) })} disabled={readOnly} />
          </Field>
          <Field label="Max DPD 90+">
            <Input type="number" step="any" value={rule.hard_thresholds.max_dpd_90 ?? ""} onChange={(e) => set("hard_thresholds", { ...rule.hard_thresholds, max_dpd_90: numOrNull(e.target.value) })} disabled={readOnly} />
          </Field>
          <Field label="Allowed relationships (CSV)" className="md:col-span-3">
            <Input
              value={(rule.hard_thresholds.allowed_relationships ?? []).join(", ")}
              onChange={(e) => set("hard_thresholds", { ...rule.hard_thresholds, allowed_relationships: csvToList(e.target.value) })}
              placeholder="parent, sibling, spouse"
              disabled={readOnly}
            />
          </Field>
        </CardContent>
      </Card>

      {/* Loan caps */}
      <Card>
        <CardHeader><CardTitle className="text-base">Loan caps</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <Field label="Secured min (₹)">
            <Input type="number" step="any" value={rule.loan_caps.secured?.min ?? ""} onChange={(e) => set("loan_caps", { ...rule.loan_caps, secured: { ...rule.loan_caps.secured, min: numOrNull(e.target.value) } })} disabled={readOnly} />
          </Field>
          <Field label="Secured max (₹)">
            <Input type="number" step="any" value={rule.loan_caps.secured?.max ?? ""} onChange={(e) => set("loan_caps", { ...rule.loan_caps, secured: { ...rule.loan_caps.secured, max: numOrNull(e.target.value) } })} disabled={readOnly} />
          </Field>
          <Field label="Unsecured min (₹)">
            <Input type="number" step="any" value={rule.loan_caps.unsecured?.min ?? ""} onChange={(e) => set("loan_caps", { ...rule.loan_caps, unsecured: { ...rule.loan_caps.unsecured, min: numOrNull(e.target.value) } })} disabled={readOnly} />
          </Field>
          <Field label="Unsecured max (₹)">
            <Input type="number" step="any" value={rule.loan_caps.unsecured?.max ?? ""} onChange={(e) => set("loan_caps", { ...rule.loan_caps, unsecured: { ...rule.loan_caps.unsecured, max: numOrNull(e.target.value) } })} disabled={readOnly} />
          </Field>
        </CardContent>
      </Card>

      {/* Collateral LTV */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Collateral LTV %</CardTitle>
          <p className="text-xs text-muted-foreground">Phase 1 seed left these as null. Fill in to enable secured-loan calculations.</p>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <Field label="FD LTV %">
            <Input type="number" step="any" value={rule.collateral_ltv.fd_ltv_pct ?? ""} onChange={(e) => set("collateral_ltv", { ...rule.collateral_ltv, fd_ltv_pct: numOrNull(e.target.value) })} disabled={readOnly} />
          </Field>
          <Field label="Residential LTV %">
            <Input type="number" step="any" value={rule.collateral_ltv.residential_ltv_pct ?? ""} onChange={(e) => set("collateral_ltv", { ...rule.collateral_ltv, residential_ltv_pct: numOrNull(e.target.value) })} disabled={readOnly} />
          </Field>
          <Field label="Commercial LTV %">
            <Input type="number" step="any" value={rule.collateral_ltv.commercial_ltv_pct ?? ""} onChange={(e) => set("collateral_ltv", { ...rule.collateral_ltv, commercial_ltv_pct: numOrNull(e.target.value) })} disabled={readOnly} />
          </Field>
        </CardContent>
      </Card>

      {/* Coverage */}
      <Card>
        <CardHeader><CardTitle className="text-base">Coverage</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Field label="Supported countries (ISO codes, CSV)">
            <Input
              value={(rule.coverage.supported_countries ?? []).join(", ")}
              onChange={(e) => set("coverage", { ...rule.coverage, supported_countries: csvToList(e.target.value).map((s) => s.toUpperCase()) })}
              placeholder="US, GB, CA, AU"
              disabled={readOnly}
            />
          </Field>
          <Field label="Excluded states (CSV)">
            <Input
              value={(rule.coverage.excluded_states ?? []).join(", ")}
              onChange={(e) => set("coverage", { ...rule.coverage, excluded_states: csvToList(e.target.value) })}
              placeholder="(empty = no exclusions)"
              disabled={readOnly}
            />
          </Field>
          <Field label="Accepted courses (CSV)">
            <Input
              value={(rule.coverage.accepted_courses ?? []).join(", ")}
              onChange={(e) => set("coverage", { ...rule.coverage, accepted_courses: csvToList(e.target.value) })}
              placeholder="(empty = all)"
              disabled={readOnly}
            />
          </Field>
          <Field label="Excluded countries (ISO codes, CSV)">
            <Input
              value={(rule.coverage.excluded_countries ?? []).join(", ")}
              onChange={(e) => set("coverage", { ...rule.coverage, excluded_countries: csvToList(e.target.value).map((s) => s.toUpperCase()) })}
              placeholder="CN, GE, UZ, KZ, UA"
              disabled={readOnly}
            />
          </Field>
          <Field label="Excluded Indian states (CSV)">
            <Input
              value={(rule.coverage.excluded_indian_states ?? []).join(", ")}
              onChange={(e) => set("coverage", { ...rule.coverage, excluded_indian_states: csvToList(e.target.value) })}
              placeholder="JK, NE"
              disabled={readOnly}
            />
          </Field>
          <Field label="Excluded Indian cities (CSV)">
            <Input
              value={(rule.coverage.excluded_indian_cities ?? []).join(", ")}
              onChange={(e) => set("coverage", { ...rule.coverage, excluded_indian_cities: csvToList(e.target.value) })}
              placeholder="(empty = no city exclusions)"
              disabled={readOnly}
            />
          </Field>
        </CardContent>
      </Card>

      {/* Expense Coverage (descriptive only — not used by scoring/ranking) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Expense Coverage</CardTitle>
          <p className="text-xs text-muted-foreground">
            What this lender funds for the student. Descriptive only — does not affect scoring,
            ranking, or eligibility. Leave a toggle off if unknown; only items explicitly turned on
            are shown on the lender card.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <CoverageToggle
              label="Tuition Fee"
              checked={rule.coverage.expenses?.tuition === true}
              onCheckedChange={(v) => set("coverage", { ...rule.coverage, expenses: { ...(rule.coverage.expenses ?? {}), tuition: v } })}
              disabled={readOnly}
            />
            <CoverageToggle
              label="Living / Accommodation"
              checked={rule.coverage.expenses?.living === true}
              onCheckedChange={(v) => set("coverage", { ...rule.coverage, expenses: { ...(rule.coverage.expenses ?? {}), living: v } })}
              disabled={readOnly}
            />
            <CoverageToggle
              label="Travel"
              checked={rule.coverage.expenses?.travel === true}
              onCheckedChange={(v) => set("coverage", { ...rule.coverage, expenses: { ...(rule.coverage.expenses ?? {}), travel: v } })}
              disabled={readOnly}
            />
            <CoverageToggle
              label="Insurance"
              checked={rule.coverage.expenses?.insurance === true}
              onCheckedChange={(v) => set("coverage", { ...rule.coverage, expenses: { ...(rule.coverage.expenses ?? {}), insurance: v } })}
              disabled={readOnly}
            />
            <CoverageToggle
              label="Other education expenses"
              checked={rule.coverage.expenses?.other_education_expenses === true}
              onCheckedChange={(v) => set("coverage", { ...rule.coverage, expenses: { ...(rule.coverage.expenses ?? {}), other_education_expenses: v } })}
              disabled={readOnly}
            />
          </div>
          <Field label="Coverage notes (optional)">
            <Textarea
              value={rule.coverage.expenses?.notes ?? ""}
              onChange={(e) => set("coverage", { ...rule.coverage, expenses: { ...(rule.coverage.expenses ?? {}), notes: e.target.value || null } })}
              rows={2}
              placeholder="Internal notes about coverage (not shown on lender cards)."
              disabled={readOnly}
            />
          </Field>
        </CardContent>
      </Card>

      {/* Policy */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Policy</CardTitle>
          <p className="text-xs text-muted-foreground">Processing time was seeded from real lender data. ROI / tenure / moratorium were left null.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Processing time (days)">
              <Input type="number" step="any" value={rule.policy.processing_time_days ?? ""} onChange={(e) => set("policy", { ...rule.policy, processing_time_days: numOrNull(e.target.value) })} disabled={readOnly} />
            </Field>
            <Field label="ROI min %">
              <Input type="number" step="any" value={rule.policy.roi_min ?? ""} onChange={(e) => set("policy", { ...rule.policy, roi_min: numOrNull(e.target.value) })} disabled={readOnly} />
            </Field>
            <Field label="ROI max %">
              <Input type="number" step="any" value={rule.policy.roi_max ?? ""} onChange={(e) => set("policy", { ...rule.policy, roi_max: numOrNull(e.target.value) })} disabled={readOnly} />
            </Field>
            <Field label="Tenure min (years)">
              <Input type="number" step="any" value={rule.policy.tenure_min_years ?? ""} onChange={(e) => set("policy", { ...rule.policy, tenure_min_years: numOrNull(e.target.value) })} disabled={readOnly} />
            </Field>
            <Field label="Tenure max (years)">
              <Input type="number" step="any" value={rule.policy.tenure_max_years ?? ""} onChange={(e) => set("policy", { ...rule.policy, tenure_max_years: numOrNull(e.target.value) })} disabled={readOnly} />
            </Field>
            <Field label="Moratorium (months)">
              <Input type="number" step="any" value={rule.policy.moratorium_months ?? ""} onChange={(e) => set("policy", { ...rule.policy, moratorium_months: numOrNull(e.target.value) })} disabled={readOnly} />
            </Field>
          </div>
          <Field label="Notes">
            <Textarea
              value={rule.policy.notes ?? ""}
              onChange={(e) => set("policy", { ...rule.policy, notes: e.target.value || null })}
              rows={3}
              disabled={readOnly}
            />
          </Field>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1 ${className ?? ""}`}>
      <Label className="text-[10px] uppercase text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function CoverageToggle({
  label,
  checked,
  onCheckedChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-muted/20 px-3 py-2">
      <span className="text-sm text-foreground">{label}</span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  );
}
