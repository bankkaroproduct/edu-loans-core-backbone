import { useEffect, useMemo, useState } from "react";
import { useReadOnly } from "@/components/admin/ReadOnlyContext";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { FlaskConical } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { canEditBre, normalizeBrePermission } from "@/lib/bre/permissions";
import { evaluate } from "@/lib/bre/engine";
import { loadActive } from "@/lib/bre/loader";
import { getPreset, type PresetKey } from "@/lib/bre/presets";
import { buildSimulationPdf } from "@/lib/bre/pdf";
import type { BreLenderRule, BreProfileInput, BreResult, BreScoringConfig } from "@/lib/bre/types";
import { ProfileInputPanel } from "@/components/bre/simulate/ProfileInputPanel";
import { ResultSummaryCard } from "@/components/bre/simulate/ResultSummaryCard";
import { BucketScoreCards } from "@/components/bre/simulate/BucketScoreCards";
import { ParameterTraceTable } from "@/components/bre/simulate/ParameterTraceTable";
import { LenderMatchTable } from "@/components/bre/simulate/LenderMatchTable";
import { RejectionPanel } from "@/components/bre/simulate/RejectionPanel";
import { SimulationActionsBar } from "@/components/bre/simulate/SimulationActionsBar";
import { SaveScenarioDialog } from "@/components/bre/simulate/SaveScenarioDialog";

export default function BreSimulate() {
  const { appUser } = useAuth();
  const perm = normalizeBrePermission(appUser?.bre_permission);
  const sectionReadOnly = useReadOnly(); const canSave = !sectionReadOnly && canEditBre(appUser?.role, perm);

  const [cfg, setCfg] = useState<BreScoringConfig | null>(null);
  const [rules, setRules] = useState<BreLenderRule[]>([]);
  const [loadingActive, setLoadingActive] = useState(true);

  const [presetKey, setPresetKey] = useState<PresetKey>("custom");
  const [profile, setProfile] = useState<BreProfileInput>(() => getPreset("custom"));
  const [result, setResult] = useState<BreResult | null>(null);
  const [running, setRunning] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingActive(true);
      try {
        const { cfg, rules } = await loadActive();
        if (cancelled) return;
        setCfg(cfg);
        setRules(rules);
      } catch (e) {
        if (cancelled) return;
        toast({ title: "Failed to load active BRE config", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
      } finally {
        if (!cancelled) setLoadingActive(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handlePreset = (k: PresetKey) => {
    setPresetKey(k);
    setProfile(getPreset(k));
    setResult(null);
  };

  const handleReset = () => {
    setPresetKey("custom");
    setProfile(getPreset("custom"));
    setResult(null);
  };

  const handleRun = () => {
    if (!cfg) {
      toast({ title: "Active config not loaded yet", variant: "destructive" });
      return;
    }
    if (!profile.loan_amount || profile.loan_amount <= 0) {
      toast({ title: "Loan amount is required", description: "Enter a loan amount greater than zero.", variant: "destructive" });
      return;
    }
    if (!profile.destination_country) {
      toast({ title: "Destination country is required", variant: "destructive" });
      return;
    }
    setRunning(true);
    try {
      const r = evaluate(profile, cfg, rules);
      setResult(r);
    } catch (e) {
      toast({ title: "Simulation failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setRunning(false);
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(result, null, 2));
      toast({ title: "Result copied to clipboard" });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const handlePdf = () => {
    if (!result || !cfg) return;
    try {
      buildSimulationPdf({ profile, result, cfg, runByName: appUser?.full_name });
    } catch (e) {
      toast({ title: "PDF export failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  };

  const handleSave = async (name: string) => {
    if (!result || !cfg || !appUser) return;
    const versionsUsed = rules.map((r) => ({
      lender_id: r.lender_id,
      rule_id: r.id,
      version_number: r.version_number,
      lender_code: r.basic_info.lender_code,
      lender_name: r.basic_info.lender_name,
    }));
    const { data: inserted, error: insertErr } = await supabase
      .from("bre_simulation_runs")
      .insert({
        saved_name: name || null,
        run_by: appUser.id,
        scoring_config_id: cfg.id ?? null,
        scoring_config_version: cfg.version_number,
        scoring_config_snapshot: cfg as unknown as never,
        lender_rule_versions_used: versionsUsed as unknown as never,
        profile_input: profile as unknown as never,
        result: result as unknown as never,
      })
      .select("id")
      .single();
    if (insertErr) {
      toast({ title: "Save failed", description: insertErr.message, variant: "destructive" });
      throw insertErr;
    }
    await supabase.from("audit_logs").insert({
      entity_type: "bre_simulation",
      entity_id: inserted.id,
      action_type: "bre_simulation_saved",
      actor_user_id: appUser.id,
      actor_role: appUser.role,
      meta: {
        saved_name: name || null,
        scoring_config_version: cfg.version_number,
        lender_count: rules.length,
        eligibility_status: result.eligibility_status,
        overall_score: result.overall_score,
      } as unknown as never,
    });
    toast({ title: "Scenario saved", description: name ? `"${name}" persisted with snapshots.` : "Run persisted with snapshots." });
  };

  const eligibleCount = useMemo(
    () => (result ? result.eligible_lenders.filter((l) => l.eligible).length : 0),
    [result],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="BRE Simulator"
        description="Run a deterministic eligibility simulation against the active scoring config and active lender rules. Read-only users may run, copy, and export — saving requires edit permission."
      />

      {loadingActive || !cfg ? (
        <div className="grid gap-4 lg:grid-cols-[420px_1fr]">
          <Skeleton className="h-[600px] w-full" />
          <Skeleton className="h-[600px] w-full" />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[420px_1fr]">
          <ProfileInputPanel
            profile={profile}
            cfg={cfg}
            presetKey={presetKey}
            onPresetChange={handlePreset}
            onChange={setProfile}
            onRun={handleRun}
            onReset={handleReset}
            running={running}
          />

          <div className="space-y-4">
            {!result ? (
              <EmptyState
                icon={FlaskConical}
                title="No simulation run yet"
                description="Pick a preset or fill the inputs on the left and press Run simulation."
                className="rounded-md border border-dashed"
              />
            ) : (
              <>
                <ResultSummaryCard result={result} />
                <BucketScoreCards result={result} threshold={cfg.bucket_threshold} />
                <RejectionPanel result={result} />
                <ParameterTraceTable result={result} />
                <LenderMatchTable result={result} />
                <SimulationActionsBar
                  onCopy={handleCopy}
                  onDownloadPdf={handlePdf}
                  onSave={() => setSaveOpen(true)}
                  canSave={canSave}
                />
                <p className="text-[10px] text-muted-foreground">
                  Active scoring config v{cfg.version_number} · {rules.length} active lender rules · {eligibleCount} eligible
                </p>
              </>
            )}
          </div>
        </div>
      )}

      <SaveScenarioDialog open={saveOpen} onOpenChange={setSaveOpen} onConfirm={handleSave} />
    </div>
  );
}
