import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { FormSection } from "@/components/shared/FormSection";
import { PRESET_OPTIONS, type PresetKey } from "@/lib/bre/presets";
import type { BreProfileInput, BreScoringConfig, EnumBand, ScoringParameter } from "@/lib/bre/types";
import { Play, RotateCcw } from "lucide-react";

interface Props {
  profile: BreProfileInput;
  cfg: BreScoringConfig;
  presetKey: PresetKey;
  onPresetChange: (k: PresetKey) => void;
  onChange: (next: BreProfileInput) => void;
  onRun: () => void;
  onReset: () => void;
  running: boolean;
}

const COUNTRY_OPTIONS = [
  { v: "US", l: "United States" },
  { v: "CA", l: "Canada" },
  { v: "GB", l: "United Kingdom" },
  { v: "AU", l: "Australia" },
  { v: "DE", l: "Germany" },
  { v: "FR", l: "France" },
  { v: "IE", l: "Ireland" },
  { v: "NZ", l: "New Zealand" },
  { v: "SG", l: "Singapore" },
  { v: "NL", l: "Netherlands" },
];

const COURSE_CATEGORIES = ["stem", "mba", "management", "healthcare", "arts", "other"];
const COURSE_LEVELS = ["bachelors", "masters", "phd", "diploma"];
const COLLATERAL_ROUTES: { v: NonNullable<BreProfileInput["collateral_route"]>; l: string }[] = [
  { v: "either", l: "Either (lender preference)" },
  { v: "secured", l: "Secured only" },
  { v: "unsecured", l: "Unsecured only" },
];

function ParamField({
  param,
  value,
  onChange,
}: {
  param: ScoringParameter;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const id = `param-${param.param_key}`;
  if (param.input_type === "number") {
    return (
      <div className="space-y-1.5">
        <Label htmlFor={id} className="text-xs">{param.label}</Label>
        <Input
          id={id}
          type="number"
          value={value == null || value === "" ? "" : String(value)}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v === "" ? null : Number(v));
          }}
          step="any"
          className="h-8 text-sm"
        />
      </div>
    );
  }
  // enum
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">{param.label}</Label>
      <Select value={value == null ? "" : String(value)} onValueChange={(v) => onChange(v || null)}>
        <SelectTrigger id={id} className="h-8 text-sm">
          <SelectValue placeholder="Select…" />
        </SelectTrigger>
        <SelectContent>
          {param.bands
            .filter((b): b is EnumBand => "value" in b)
            .map((b) => (
              <SelectItem key={b.value} value={b.value}>
                {b.label ?? b.value}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function ProfileInputPanel({
  profile,
  cfg,
  presetKey,
  onPresetChange,
  onChange,
  onRun,
  onReset,
  running,
}: Props) {
  const studentParams = useMemo(() => cfg.student_params, [cfg]);
  const universityParams = useMemo(() => cfg.university_params, [cfg]);
  const coapplicantParams = useMemo(() => cfg.coapplicant_params, [cfg]);

  const set = (patch: Partial<BreProfileInput>) => onChange({ ...profile, ...patch });
  const setStudent = (k: string, v: unknown) => onChange({ ...profile, student: { ...profile.student, [k]: v as never } });
  const setUni = (k: string, v: unknown) => onChange({ ...profile, university: { ...profile.university, [k]: v as never } });
  const setCo = (k: string, v: unknown) =>
    onChange({ ...profile, coapplicant: { ...profile.coapplicant, [k]: v as never } });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Profile input</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-1.5">
          <Label className="text-xs">Preset</Label>
          <Select value={presetKey} onValueChange={(v) => onPresetChange(v as PresetKey)}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRESET_OPTIONS.map((o) => (
                <SelectItem key={o.key} value={o.key}>
                  <span className="font-medium">{o.label}</span>
                  <span className="text-muted-foreground"> · {o.description}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Separator />

        <div className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Loan request</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="loan_amount" className="text-xs">Loan amount (₹) *</Label>
              <Input
                id="loan_amount"
                type="number"
                value={profile.loan_amount || ""}
                onChange={(e) => set({ loan_amount: Number(e.target.value) || 0 })}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="destination_country" className="text-xs">Destination country *</Label>
              <Select value={profile.destination_country} onValueChange={(v) => set({ destination_country: v })}>
                <SelectTrigger id="destination_country" className="h-8 text-sm">
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRY_OPTIONS.map((c) => (
                    <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Course category</Label>
              <Select value={profile.course_category ?? ""} onValueChange={(v) => set({ course_category: v || undefined })}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  {COURSE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c.toUpperCase()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Course level</Label>
              <Select value={profile.course_level ?? ""} onValueChange={(v) => set({ course_level: v || undefined })}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  {COURSE_LEVELS.map((c) => (
                    <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs">Collateral route</Label>
              <Select
                value={profile.collateral_route ?? "either"}
                onValueChange={(v) => set({ collateral_route: v as BreProfileInput["collateral_route"] })}
              >
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COLLATERAL_ROUTES.map((c) => (
                    <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Student</div>
          <div className="grid grid-cols-2 gap-3">
            {studentParams.map((p) => (
              <ParamField
                key={p.param_key}
                param={p}
                value={profile.student[p.param_key]}
                onChange={(v) => setStudent(p.param_key, v)}
              />
            ))}
          </div>
        </div>

        <Separator />

        <div className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">University</div>
          <div className="grid grid-cols-2 gap-3">
            {universityParams.map((p) => (
              <ParamField
                key={p.param_key}
                param={p}
                value={profile.university[p.param_key]}
                onChange={(v) => setUni(p.param_key, v)}
              />
            ))}
          </div>
        </div>

        <Separator />

        <div className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Co-applicant</div>
          <div className="grid grid-cols-2 gap-3">
            {coapplicantParams.map((p) => (
              <ParamField
                key={p.param_key}
                param={p}
                value={profile.coapplicant[p.param_key]}
                onChange={(v) => setCo(p.param_key, v)}
              />
            ))}
          </div>
        </div>

        <Separator />

        <div className="flex items-center gap-2">
          <Button onClick={onRun} disabled={running} size="sm" className="flex-1">
            <Play className="mr-2 h-3.5 w-3.5" />
            {running ? "Running…" : "Run simulation"}
          </Button>
          <Button onClick={onReset} variant="outline" size="sm">
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Reset
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
