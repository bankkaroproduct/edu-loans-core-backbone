// Lender-Specific Scorecard detail — editable v1.
// Edits ONLY the bre_lender_rules.scorecard JSONB. All other fields cloned
// verbatim by createNewLenderScorecardVersion. Engine bands/risk/knockouts
// remain read-only "Engine defaults".

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, AlertTriangle, Database, FileWarning } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatINR } from "@/lib/formatCurrency";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { canEditBre, normalizeBrePermission, isReadOnlyBre } from "@/lib/bre/permissions";
import { ProvenanceBadge } from "@/components/bre/lender-scorecard/ProvenanceBadge";
import { factorLabel } from "@/components/bre/lender-scorecard/BreLenderScorecardList";
import {
  aggregateProvenance,
  normalizeScorecard,
  type NormalizedScorecard,
} from "@/lib/bre/lenderScorecard/normalizeScorecard";
import { validateLenderScorecard, REQUIRED_FACTORS } from "@/lib/bre/lenderScorecard/validate";
import type { ProvenanceTag, ScorecardFactorKey } from "@/lib/bre/lenderScorecard/types";
import { WeightSumIndicator } from "@/components/bre/editor/WeightSumIndicator";
import { VersionActionBar } from "@/components/bre/editor/VersionActionBar";
import { ConfirmActivateDialog } from "@/components/bre/editor/ConfirmActivateDialog";
import {
  createNewLenderScorecardVersion,
  activateLenderRuleVersion,
} from "@/lib/bre/versioning";

interface LenderOption {
  lender_id: string;
  lender_name: string;
  lender_code: string;
  rule_id: string;
  version_number: number;
}

interface VersionRow {
  id: string;
  version_number: number;
  is_active: boolean;
  change_summary: string | null;
  created_at: string;
}

interface FactorNote { factor: ScorecardFactorKey; note?: string }

interface DraftState extends NormalizedScorecard {
  factor_notes: FactorNote[];
}

const PROV_OPTIONS: ProvenanceTag[] = ["source_backed", "inferred", "proposed", "needs_business_validation"];

const FACTOR_GROUPS: { title: string; description: string; factors: ScorecardFactorKey[] }[] = [
  { title: "Academic Profile", description: "Academic strength signals.", factors: ["academics", "backlogs"] },
  { title: "Repayment Strength", description: "Co-applicant credit + income capacity.", factors: ["cibil", "income", "emi_foir", "income_stability"] },
  { title: "University / Course Fit", description: "University tier and course employability.", factors: ["university_course"] },
  { title: "Lender Fit", description: "Operational and policy fit.", factors: ["collateral_route", "loan_amount_fit", "coverage", "processing_ops"] },
];

function ensureAllFactors(sc: NormalizedScorecard): DraftState {
  const map = new Map(sc.weights.map((w) => [w.factor, w]));
  const weights = REQUIRED_FACTORS.map(
    (f) => map.get(f) ?? { factor: f, weight: 0, provenance: "proposed" as ProvenanceTag },
  );
  return { ...sc, weights, factor_notes: [] };
}

function buildScorecardJson(d: DraftState): Record<string, unknown> {
  const noteByFactor = new Map(d.factor_notes.filter((n) => n.note?.trim()).map((n) => [n.factor, n.note!.trim()]));
  return {
    display_label: d.display_label.trim(),
    weights: d.weights.map((w) => ({
      factor: w.factor,
      weight: w.weight,
      provenance: w.provenance,
      ...(noteByFactor.has(w.factor) ? { note: noteByFactor.get(w.factor) } : {}),
    })),
    income_floor_monthly: d.income_floor_monthly,
    income_floor_provenance: d.income_floor_provenance,
    notes: d.notes ?? null,
    needs_business_validation: !!d.needs_business_validation,
  };
}

export default function BreLenderScorecardDetail() {
  const { lenderId } = useParams<{ lenderId: string }>();
  const navigate = useNavigate();
  const { appUser } = useAuth();
  const perm = normalizeBrePermission(appUser?.bre_permission);
  const canEdit = canEditBre(appUser?.role, perm);
  const readOnly = isReadOnlyBre(appUser?.role, perm);

  const [loading, setLoading] = useState(true);
  const [lenders, setLenders] = useState<LenderOption[]>([]);
  const [activeRule, setActiveRule] = useState<{
    rule_id: string;
    lender_id: string;
    lender_name: string;
    lender_code: string;
    version_number: number;
    hard_thresholds: Record<string, unknown> | null;
    loan_caps: Record<string, unknown> | null;
    coverage: Record<string, unknown> | null;
  } | null>(null);
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [changeSummary, setChangeSummary] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmActivate, setConfirmActivate] = useState<{ id: string; version: number } | null>(null);

  // Load lender list (active rules) once
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("bre_lender_rules")
        .select("id, lender_id, version_number, basic_info")
        .eq("is_active", true);
      const list: LenderOption[] = (data ?? []).map((r) => {
        const bi = (r.basic_info ?? {}) as { lender_name?: string; lender_code?: string };
        return {
          lender_id: r.lender_id as string,
          lender_name: bi.lender_name ?? "Unknown",
          lender_code: bi.lender_code ?? "",
          rule_id: r.id as string,
          version_number: Number(r.version_number ?? 0),
        };
      });
      list.sort((a, b) => a.lender_name.localeCompare(b.lender_name));
      setLenders(list);
    })();
  }, []);

  // Load active rule + versions for selected lender
  const loadForLender = async (lid: string) => {
    setLoading(true);
    const [{ data: row, error }, { data: vList }] = await Promise.all([
      supabase
        .from("bre_lender_rules")
        .select("*")
        .eq("lender_id", lid)
        .eq("is_active", true)
        .maybeSingle(),
      supabase
        .from("bre_lender_rules")
        .select("id, version_number, is_active, change_summary, created_at")
        .eq("lender_id", lid)
        .order("version_number", { ascending: false }),
    ]);
    if (error) {
      toast({ title: "Failed to load scorecard", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    if (!row) {
      setActiveRule(null);
      setDraft(null);
      setVersions((vList ?? []) as VersionRow[]);
      setLoading(false);
      return;
    }
    const bi = (row.basic_info ?? {}) as { lender_name?: string; lender_code?: string };
    const code = bi.lender_code ?? "";
    setActiveRule({
      rule_id: row.id as string,
      lender_id: row.lender_id as string,
      lender_name: bi.lender_name ?? "Unknown",
      lender_code: code,
      version_number: Number(row.version_number ?? 0),
      hard_thresholds: (row.hard_thresholds as Record<string, unknown>) ?? null,
      loan_caps: (row.loan_caps as Record<string, unknown>) ?? null,
      coverage: (row.coverage as Record<string, unknown>) ?? null,
    });
    const norm = normalizeScorecard((row as { scorecard?: unknown }).scorecard, code);
    setDraft(ensureAllFactors(norm));
    setVersions((vList ?? []) as VersionRow[]);
    setChangeSummary("");
    setLoading(false);
  };

  useEffect(() => {
    if (!lenderId) return;
    loadForLender(lenderId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lenderId]);

  const validation = useMemo(() => (draft ? validateLenderScorecard(draft) : []), [draft]);
  const weightSum = useMemo(
    () => (draft ? draft.weights.reduce((a, w) => a + (Number(w.weight) || 0), 0) : 0),
    [draft],
  );
  const overall = useMemo(
    () => (draft ? aggregateProvenance(draft.weights, draft.income_floor_provenance, draft.needs_business_validation) : "proposed"),
    [draft],
  );

  const updateWeight = (idx: number, patch: Partial<DraftState["weights"][number]>) => {
    if (!draft) return;
    const next = [...draft.weights];
    next[idx] = { ...next[idx], ...patch };
    setDraft({ ...draft, weights: next });
  };

  const setFactorNote = (factor: ScorecardFactorKey, note: string) => {
    if (!draft) return;
    const others = draft.factor_notes.filter((n) => n.factor !== factor);
    setDraft({ ...draft, factor_notes: [...others, { factor, note }] });
  };

  const handleSave = async (thenActivate: boolean) => {
    if (!draft || !activeRule || !changeSummary.trim()) return;
    if (validation.length > 0) return;
    setSaving(true);
    try {
      const json = buildScorecardJson(draft);
      const created = await createNewLenderScorecardVersion(activeRule.lender_id, json, changeSummary.trim());
      toast({ title: `Saved v${created.version_number}`, description: "Created as inactive. Activate to make it live." });
      if (thenActivate) {
        setConfirmActivate({ id: created.id, version: created.version_number });
      } else {
        setChangeSummary("");
        // Reload to surface the new inactive version in the version list
        await loadForLender(activeRule.lender_id);
      }
    } catch (err) {
      toast({ title: "Save failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const doActivate = async () => {
    if (!confirmActivate || !activeRule) return;
    try {
      await activateLenderRuleVersion(confirmActivate.id);
      toast({ title: `v${confirmActivate.version} activated` });
      setConfirmActivate(null);
      await loadForLender(activeRule.lender_id);
    } catch (err) {
      toast({ title: "Activation failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    }
  };

  const activateExisting = async (id: string, version: number) => {
    setConfirmActivate({ id, version });
  };

  if (loading || !draft || !activeRule) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-32">
      <PageHeader title={`${activeRule.lender_name} — Scorecard`} description={draft.display_label}>
        <Button asChild variant="ghost" size="sm">
          <Link to="/admin/bre/scoring"><ArrowLeft className="mr-1 h-4 w-4" /> Back to Scoring Config</Link>
        </Button>
        {readOnly && <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-300">Read-only</Badge>}
      </PageHeader>

      {/* Lender selector + meta */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base">Lender</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">Select a lender to view or edit its scorecard.</p>
          </div>
          <WeightSumIndicator sum={weightSum} />
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 text-sm">
          <div>
            <Label className="text-[10px] uppercase text-muted-foreground">Select lender</Label>
            <Select value={activeRule.lender_id} onValueChange={(v) => navigate(`/admin/bre/scoring/lenders/${v}`)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {lenders.map((l) => (
                  <SelectItem key={l.lender_id} value={l.lender_id}>
                    {l.lender_name}{l.lender_code ? ` (${l.lender_code})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <KV k="Active rule version" v={`v${activeRule.version_number}`} />
          <KV k="Lender code" v={<span className="font-mono">{activeRule.lender_code || "—"}</span>} />
          <KV k="Source" v={
            draft.source === "db" ? (
              <Badge variant="outline" className="bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30">
                <Database className="mr-1 h-3 w-3" /> DB scorecard
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-300">
                <FileWarning className="mr-1 h-3 w-3" /> Fallback (seed default)
              </Badge>
            )
          } />
          <KV k="Aggregate provenance" v={<ProvenanceBadge tag={overall} />} />
          <div className="md:col-span-2">
            <Label className="text-[10px] uppercase text-muted-foreground">Display label</Label>
            <Input
              value={draft.display_label}
              onChange={(e) => setDraft({ ...draft, display_label: e.target.value })}
              disabled={!canEdit}
            />
          </div>
          <div className="md:col-span-2 flex items-center gap-3">
            <Switch
              checked={!!draft.needs_business_validation}
              onCheckedChange={(v) => setDraft({ ...draft, needs_business_validation: v })}
              disabled={!canEdit}
            />
            <div className="text-sm">
              <div className="font-medium">Needs business validation</div>
              <div className="text-xs text-muted-foreground">Flag when sources conflict and require manual sign-off.</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Inline validation summary — visible so admins see exactly what blocks save. */}
      {canEdit && validation.length > 0 && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              {validation.length} issue{validation.length === 1 ? "" : "s"} blocking save
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Fix these to enable <strong>Save as new version</strong> and <strong>Save &amp; activate</strong>.
            </p>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm text-destructive">
              {validation.map((e, i) => (
                <li key={i}>
                  • {e.param_key ? <span className="font-medium">{factorLabel(e.param_key as ScorecardFactorKey)}: </span> : null}
                  {e.message}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Factor weight groups */}
      {FACTOR_GROUPS.map((group) => (
        <Card key={group.title}>
          <CardHeader>
            <CardTitle className="text-base">{group.title}</CardTitle>
            <p className="text-xs text-muted-foreground">{group.description}</p>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Factor</TableHead>
                  <TableHead className="w-28">Weight</TableHead>
                  <TableHead className="w-56">Provenance</TableHead>
                  <TableHead>Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.factors.map((f) => {
                  const idx = draft.weights.findIndex((w) => w.factor === f);
                  if (idx < 0) return null;
                  const w = draft.weights[idx];
                  const noteVal = draft.factor_notes.find((n) => n.factor === f)?.note ?? "";
                  return (
                    <TableRow key={f}>
                      <TableCell className="font-medium">{factorLabel(f)}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={100}
                          step={1}
                          value={w.weight}
                          onChange={(e) => updateWeight(idx, { weight: Math.max(0, Math.min(100, Math.round(Number(e.target.value) || 0))) })}
                          disabled={!canEdit}
                          className="h-8 w-20"
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={w.provenance}
                          onValueChange={(v) => updateWeight(idx, { provenance: v as ProvenanceTag })}
                          disabled={!canEdit}
                        >
                          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {PROV_OPTIONS.map((p) => (
                              <SelectItem key={p} value={p}>{p.replace(/_/g, " ")}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={noteVal}
                          onChange={(e) => setFactorNote(f, e.target.value)}
                          placeholder="Optional note"
                          disabled={!canEdit}
                          className="h-8"
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}

      {/* Income floor */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Income floor</CardTitle>
          <p className="text-xs text-muted-foreground">Monthly co-applicant income floor used by this lender's scorecard.</p>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 text-sm">
          <div>
            <Label className="text-[10px] uppercase text-muted-foreground">Monthly floor (₹)</Label>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              step={1000}
              value={draft.income_floor_monthly}
              onChange={(e) => setDraft({ ...draft, income_floor_monthly: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
              disabled={!canEdit}
            />
          </div>
          <div>
            <Label className="text-[10px] uppercase text-muted-foreground">Provenance</Label>
            <Select
              value={draft.income_floor_provenance}
              onValueChange={(v) => setDraft({ ...draft, income_floor_provenance: v as ProvenanceTag })}
              disabled={!canEdit}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PROV_OPTIONS.map((p) => (
                  <SelectItem key={p} value={p}>{p.replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label className="text-[10px] uppercase text-muted-foreground">Notes</Label>
            <Textarea
              value={draft.notes ?? ""}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              disabled={!canEdit}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Engine defaults (read-only v1) */}
      <ScoringBandsPanel />
      <RiskBandPanel />
      <KnockoutRulesPanel
        hardThresholds={activeRule.hard_thresholds}
        loanCaps={activeRule.loan_caps}
        coverage={activeRule.coverage}
        incomeFloor={draft.income_floor_monthly}
        incomeFloorProv={draft.income_floor_provenance}
      />

      {/* Provenance/validation warnings */}
      <Card>
        <CardHeader><CardTitle className="text-base">Provenance &amp; Validation</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Aggregate:</span>
            <ProvenanceBadge tag={overall} />
          </div>
          {draft.needs_business_validation && (
            <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/5 p-3 text-red-700 dark:text-red-300">
              <AlertTriangle className="h-4 w-4 mt-0.5" />
              <div>This scorecard is flagged as <strong>needs business validation</strong>.</div>
            </div>
          )}
          {overall === "proposed" && (
            <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4 mt-0.5" />
              <div>One or more weights / floors are <strong>proposed defaults</strong>.</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Version history */}
      <Card>
        <CardHeader><CardTitle className="text-base">Versions</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Version</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead>Change summary</TableHead>
                <TableHead className="w-44">Created</TableHead>
                <TableHead className="w-32 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {versions.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-medium">v{v.version_number}</TableCell>
                  <TableCell>
                    {v.is_active ? (
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-300">Active</Badge>
                    ) : (
                      <Badge variant="outline">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">{v.change_summary || "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{new Date(v.created_at).toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    {!v.is_active && canEdit && (
                      <Button size="sm" variant="outline" onClick={() => activateExisting(v.id, v.version_number)}>Activate</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {versions.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-6">No versions yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <VersionActionBar
        errors={validation}
        changeSummary={changeSummary}
        onChangeSummary={setChangeSummary}
        onSave={() => handleSave(false)}
        onSaveAndActivate={() => handleSave(true)}
        showActivate
        saving={saving}
        hidden={!canEdit}
      />

      <ConfirmActivateDialog
        open={confirmActivate !== null}
        onOpenChange={(o) => !o && setConfirmActivate(null)}
        onConfirm={doActivate}
        newVersionLabel={confirmActivate ? `v${confirmActivate.version}` : ""}
        currentActiveLabel={activeRule ? `v${activeRule.version_number}` : null}
        scope="lender"
      />
    </div>
  );
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b py-1.5 last:border-0">
      <span className="text-muted-foreground">{k}</span>
      <span>{v}</span>
    </div>
  );
}

function EngineDefaultsBadge() {
  return (
    <Badge variant="outline" className="bg-slate-500/10 text-slate-700 border-slate-500/30 dark:text-slate-300">
      Engine defaults — not lender-overridable in v1
    </Badge>
  );
}

function ScoringBandsPanel() {
  const rows: { factor: string; bands: { range: string; raw: number }[] }[] = [
    { factor: "CIBIL", bands: [
      { range: "≥ 780", raw: 100 }, { range: "750–779", raw: 90 }, { range: "720–749", raw: 75 },
      { range: "700–719", raw: 60 }, { range: "680–699", raw: 40 }, { range: "650–679", raw: 25 }, { range: "< 650", raw: 5 },
    ]},
    { factor: "Income (× of floor)", bands: [
      { range: "Below floor", raw: 0 }, { range: "1.0–1.2×", raw: 40 }, { range: "1.2–1.5×", raw: 55 },
      { range: "1.5–2×", raw: 70 }, { range: "2–3×", raw: 85 }, { range: "≥ 3×", raw: 100 },
    ]},
    { factor: "FOIR", bands: [
      { range: "≤ 25%", raw: 100 }, { range: "26–35%", raw: 85 }, { range: "36–45%", raw: 65 },
      { range: "46–55%", raw: 35 }, { range: "> 55%", raw: 10 },
    ]},
    { factor: "Academics (avg %)", bands: [
      { range: "≥ 80", raw: 100 }, { range: "70–79", raw: 80 }, { range: "60–69", raw: 60 },
      { range: "50–59", raw: 35 }, { range: "< 50", raw: 10 },
    ]},
    { factor: "Backlogs", bands: [
      { range: "0", raw: 100 }, { range: "1–2", raw: 75 }, { range: "3–5", raw: 50 },
      { range: "6–10", raw: 25 }, { range: "> 10", raw: 5 },
    ]},
  ];
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">Scoring Bands</CardTitle>
          <EngineDefaultsBadge />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.map((r) => (
          <div key={r.factor}>
            <div className="text-sm font-medium mb-1.5">{r.factor}</div>
            <div className="flex flex-wrap gap-1.5">
              {r.bands.map((b) => (
                <Badge key={b.range} variant="secondary" className="font-normal">
                  {b.range} <span className="ml-1.5 text-muted-foreground">→ {b.raw}</span>
                </Badge>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function RiskBandPanel() {
  const bands = [
    { name: "Low Risk", range: "≥ 75", cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30" },
    { name: "Medium Risk", range: "55–74", cls: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30" },
    { name: "High Risk", range: "35–54", cls: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30" },
    { name: "Needs Review", range: "< 35", cls: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30" },
    { name: "Not Eligible", range: "Knockout fail", cls: "bg-red-700/10 text-red-800 dark:text-red-300 border-red-700/30" },
  ];
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">Risk Band Thresholds</CardTitle>
          <EngineDefaultsBadge />
        </div>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {bands.map((b) => (
          <Badge key={b.name} variant="outline" className={b.cls}>
            {b.name} <span className="ml-1.5 opacity-70">{b.range}</span>
          </Badge>
        ))}
      </CardContent>
    </Card>
  );
}

function KnockoutRulesPanel({
  hardThresholds, loanCaps, coverage, incomeFloor, incomeFloorProv,
}: {
  hardThresholds: Record<string, unknown> | null;
  loanCaps: Record<string, unknown> | null;
  coverage: Record<string, unknown> | null;
  incomeFloor: number;
  incomeFloorProv: ProvenanceTag;
}) {
  const ht = hardThresholds ?? {};
  const lc = (loanCaps ?? {}) as { secured?: { min?: number | null; max?: number | null }; unsecured?: { min?: number | null; max?: number | null } };
  const cov = (coverage ?? {}) as { supported_countries?: string[]; excluded_states?: string[] };
  const fmt = (v: unknown) => v == null || v === "" ? "—" : String(v);
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">Hard Knockout Rules</CardTitle>
          <EngineDefaultsBadge />
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2 text-sm">
        <KV k="Min co-applicant income" v={fmt(ht["min_coapplicant_income"])} />
        <KV k="Min CIBIL" v={fmt(ht["min_cibil"])} />
        <KV k="Min age" v={fmt(ht["min_age"])} />
        <KV k="Max age" v={fmt(ht["max_age"])} />
        <KV k="Max DPD months" v={fmt(ht["max_dpd_months"])} />
        <KV k="Min ITR years" v={fmt(ht["min_itr_years"])} />
        <KV k="Secured cap" v={`${fmt(lc.secured?.min)} – ${fmt(lc.secured?.max)}`} />
        <KV k="Unsecured cap" v={`${fmt(lc.unsecured?.min)} – ${fmt(lc.unsecured?.max)}`} />
        <KV k="Supported countries" v={cov.supported_countries?.length ? cov.supported_countries.join(", ") : "—"} />
        <KV k="Excluded states" v={cov.excluded_states?.length ? cov.excluded_states.join(", ") : "—"} />
        <KV
          k="Scorecard income floor"
          v={<span className="flex items-center gap-2">{formatINR(incomeFloor)} <ProvenanceBadge tag={incomeFloorProv} /></span>}
        />
      </CardContent>
    </Card>
  );
}
