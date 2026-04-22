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
            <Input value={rule.commercials.payout_trigger_stage ?? ""} onChange={(e) => set("commercials", { ...rule.commercials, payout_trigger_stage: e.target.value || null })} placeholder="disbursed" disabled={readOnly} />
          </Field>
          <Field label="Processing fee %">
            <Input type="number" step="any" value={rule.commercials.processing_fee_pct ?? ""} onChange={(e) => set("commercials", { ...rule.commercials, processing_fee_pct: numOrNull(e.target.value) })} disabled={readOnly} />
          </Field>
          <Field label="Processing fee flat (₹)">
            <Input type="number" step="any" value={rule.commercials.processing_fee_flat ?? ""} onChange={(e) => set("commercials", { ...rule.commercials, processing_fee_flat: numOrNull(e.target.value) })} disabled={readOnly} />
          </Field>
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
