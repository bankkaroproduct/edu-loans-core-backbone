import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { canEditBre, normalizeBrePermission, isReadOnlyBre } from "@/lib/bre/permissions";
import type { BreLenderRule } from "@/lib/bre/types";
import type { ValidationError } from "@/lib/bre/validate";
import { LenderRuleSectionCards } from "@/components/bre/editor/LenderRuleSectionCards";
import { VersionActionBar } from "@/components/bre/editor/VersionActionBar";
import { ConfirmActivateDialog } from "@/components/bre/editor/ConfirmActivateDialog";
import { emptyLenderRule } from "@/lib/bre/empty";
import {
  createNewLenderRuleVersion,
  activateLenderRuleVersion,
} from "@/lib/bre/versioning";

type RuleDraft = Omit<BreLenderRule, "id" | "version_number" | "is_active" | "lender_id">;

function validateLenderRule(rule: RuleDraft): ValidationError[] {
  const errs: ValidationError[] = [];
  // Loan caps: min <= max
  for (const k of ["secured", "unsecured"] as const) {
    const r = rule.loan_caps[k];
    if (r.min !== null && r.max !== null && r.min > r.max) {
      errs.push({ message: `Loan caps (${k}): min (${r.min}) must be ≤ max (${r.max})` });
    }
    if (r.min !== null && r.min < 0) errs.push({ message: `Loan caps (${k}): min cannot be negative` });
    if (r.max !== null && r.max < 0) errs.push({ message: `Loan caps (${k}): max cannot be negative` });
  }
  // Age range
  const t = rule.hard_thresholds;
  if (t.min_age !== null && t.max_age !== null && t.min_age > t.max_age) {
    errs.push({ message: `Age range: min_age (${t.min_age}) must be ≤ max_age (${t.max_age})` });
  }
  // ROI / tenure
  const p = rule.policy;
  if (p.roi_min !== null && p.roi_max !== null && p.roi_min > p.roi_max) {
    errs.push({ message: `ROI: min (${p.roi_min}) must be ≤ max (${p.roi_max})` });
  }
  if (p.tenure_min_years !== null && p.tenure_max_years !== null && p.tenure_min_years > p.tenure_max_years) {
    errs.push({ message: `Tenure: min (${p.tenure_min_years}) must be ≤ max (${p.tenure_max_years})` });
  }
  // Percentages 0..100
  const pcts: [string, number | null][] = [
    ["payout_pct", rule.commercials.payout_pct],
    ["processing_fee_pct", rule.commercials.processing_fee_pct],
    ["fd_ltv_pct", rule.collateral_ltv.fd_ltv_pct],
    ["residential_ltv_pct", rule.collateral_ltv.residential_ltv_pct],
    ["commercial_ltv_pct", rule.collateral_ltv.commercial_ltv_pct],
    ["roi_min", p.roi_min],
    ["roi_max", p.roi_max],
  ];
  for (const [name, v] of pcts) {
    if (v !== null && (v < 0 || v > 100)) errs.push({ message: `${name} must be between 0 and 100 (got ${v})` });
  }
  // Country codes
  for (const c of rule.coverage.supported_countries ?? []) {
    if (c && (c.length !== 2 || c !== c.toUpperCase())) {
      errs.push({ message: `supported_countries: '${c}' must be a 2-letter uppercase ISO code` });
    }
  }
  // Lender name required
  if (!rule.basic_info.lender_name?.trim()) errs.push({ message: "Lender name is required" });
  return errs;
}

export default function BreLenderRuleEditor() {
  const { lenderId } = useParams<{ lenderId: string }>();
  const { appUser } = useAuth();
  const perm = normalizeBrePermission(appUser?.bre_permission);
  const canEdit = canEditBre(appUser?.role, perm);
  const readOnly = isReadOnlyBre(appUser?.role, perm);

  const [loading, setLoading] = useState(true);
  const [activeRow, setActiveRow] = useState<{ id: string; version_number: number } | null>(null);
  const [draft, setDraft] = useState<RuleDraft | null>(null);
  const [changeSummary, setChangeSummary] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmActivate, setConfirmActivate] = useState<{ id: string; version: number } | null>(null);

  const loadActive = async () => {
    if (!lenderId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("bre_lender_rules")
      .select("*")
      .eq("lender_id", lenderId)
      .eq("is_active", true)
      .maybeSingle();
    if (error) {
      toast({ title: "Failed to load lender rule", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    if (data) {
      setActiveRow({ id: data.id, version_number: data.version_number });
      setDraft({
        basic_info: data.basic_info as never,
        commercials: data.commercials as never,
        hard_thresholds: data.hard_thresholds as never,
        loan_caps: data.loan_caps as never,
        collateral_ltv: data.collateral_ltv as never,
        coverage: data.coverage as never,
        policy: data.policy as never,
      });
    } else {
      // No active rule for this lender — start from blank
      const blank = emptyLenderRule(lenderId);
      setDraft({
        basic_info: blank.basic_info,
        commercials: blank.commercials,
        hard_thresholds: blank.hard_thresholds,
        loan_caps: blank.loan_caps,
        collateral_ltv: blank.collateral_ltv,
        coverage: blank.coverage,
        policy: blank.policy,
      });
      setActiveRow(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadActive();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lenderId]);

  const errors = useMemo(() => (draft ? validateLenderRule(draft) : []), [draft]);

  const handleSave = async (thenActivate: boolean) => {
    if (!draft || !lenderId || !changeSummary.trim()) return;
    setSaving(true);
    try {
      const created = await createNewLenderRuleVersion(lenderId, draft, changeSummary.trim());
      toast({ title: `Saved v${created.version_number}`, description: "Created as inactive. Activate to make it live." });
      if (thenActivate) {
        setConfirmActivate({ id: created.id, version: created.version_number });
      } else {
        setChangeSummary("");
      }
    } catch (err) {
      toast({ title: "Save failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const doActivate = async () => {
    if (!confirmActivate) return;
    try {
      await activateLenderRuleVersion(confirmActivate.id);
      toast({ title: `v${confirmActivate.version} activated`, description: "Lender pointer updated." });
      setConfirmActivate(null);
      setChangeSummary("");
      await loadActive();
    } catch (err) {
      toast({ title: "Activation failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    }
  };

  if (loading || !draft) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      <PageHeader
        title={draft.basic_info.lender_name || "Lender rule"}
        description="Edit this lender's policy, thresholds and commercials. Sections seeded as null in Phase 1 are shown honestly as blank fields — fill them in to enable the corresponding engine logic."
      >
        <Button asChild variant="ghost" size="sm">
          <Link to="/admin/bre/lenders"><ArrowLeft className="mr-1 h-4 w-4" /> Back to lender list</Link>
        </Button>
        {activeRow && <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-300">Active: v{activeRow.version_number}</Badge>}
        {readOnly && <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-300">Read-only</Badge>}
      </PageHeader>

      <LenderRuleSectionCards rule={draft} onChange={setDraft} readOnly={!canEdit} />

      <VersionActionBar
        errors={errors}
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
        currentActiveLabel={activeRow ? `v${activeRow.version_number}` : null}
        scope="lender"
      />
    </div>
  );
}
