import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { canEditBre, normalizeBrePermission, isReadOnlyBre } from "@/lib/bre/permissions";
import type { BreScoringConfig } from "@/lib/bre/types";
import { validateScoringConfig } from "@/lib/bre/validate";
import { BucketEditor } from "@/components/bre/editor/BucketEditor";
import { OverallBandMappingEditor, BucketThresholdEditor } from "@/components/bre/editor/OverallBandMappingEditor";
import { VersionActionBar } from "@/components/bre/editor/VersionActionBar";
import { ConfirmActivateDialog } from "@/components/bre/editor/ConfirmActivateDialog";
import {
  createNewScoringConfigVersion,
  activateScoringConfigVersion,
} from "@/lib/bre/versioning";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BreLenderScorecardList } from "@/components/bre/lender-scorecard/BreLenderScorecardList";

export default function BreScoringConfigEditor() {
  const { appUser } = useAuth();
  const perm = normalizeBrePermission(appUser?.bre_permission);
  const canEdit = canEditBre(appUser?.role, perm);
  const readOnly = isReadOnlyBre(appUser?.role, perm);

  const [loading, setLoading] = useState(true);
  const [activeRow, setActiveRow] = useState<{ id: string; version_number: number } | null>(null);
  const [draft, setDraft] = useState<BreScoringConfig | null>(null);
  const [changeSummary, setChangeSummary] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmActivate, setConfirmActivate] = useState<{ id: string; version: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("bre_scoring_configs")
        .select("*")
        .eq("is_active", true)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        toast({ title: "Failed to load active config", description: error.message, variant: "destructive" });
      } else if (data) {
        setActiveRow({ id: data.id, version_number: data.version_number });
        setDraft({
          id: data.id,
          version_number: data.version_number,
          is_active: data.is_active,
          bucket_threshold: Number(data.bucket_threshold),
          student_params: data.student_params as never,
          university_params: data.university_params as never,
          coapplicant_params: data.coapplicant_params as never,
          overall_band_mapping: data.overall_band_mapping as never,
        });
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const validation = useMemo(() => (draft ? validateScoringConfig(draft) : { valid: false, errors: [] }), [draft]);

  const handleSave = async (thenActivate: boolean) => {
    if (!draft || !changeSummary.trim()) return;
    setSaving(true);
    try {
      const created = await createNewScoringConfigVersion(
        {
          bucket_threshold: draft.bucket_threshold,
          student_params: draft.student_params,
          university_params: draft.university_params,
          coapplicant_params: draft.coapplicant_params,
          overall_band_mapping: draft.overall_band_mapping,
        },
        changeSummary.trim(),
      );
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
      await activateScoringConfigVersion(confirmActivate.id);
      toast({ title: `v${confirmActivate.version} activated` });
      setConfirmActivate(null);
      setChangeSummary("");
      // Reload active
      const { data } = await supabase
        .from("bre_scoring_configs")
        .select("*")
        .eq("is_active", true)
        .maybeSingle();
      if (data) {
        setActiveRow({ id: data.id, version_number: data.version_number });
        setDraft({
          id: data.id,
          version_number: data.version_number,
          is_active: data.is_active,
          bucket_threshold: Number(data.bucket_threshold),
          student_params: data.student_params as never,
          university_params: data.university_params as never,
          coapplicant_params: data.coapplicant_params as never,
          overall_band_mapping: data.overall_band_mapping as never,
        });
      }
    } catch (err) {
      toast({ title: "Activation failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    }
  };

  if (loading || !draft) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      <PageHeader
        title="Scoring Config"
        description="Global scoring buckets/bands and lender-specific scorecards."
      >
        <Button asChild variant="ghost" size="sm">
          <Link to="/admin/bre"><ArrowLeft className="mr-1 h-4 w-4" /> Back to BRE</Link>
        </Button>
        {activeRow && <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-300">Active: v{activeRow.version_number}</Badge>}
        {readOnly && <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-300">Read-only</Badge>}
      </PageHeader>

      <Tabs defaultValue="global" className="space-y-6">
        <TabsList>
          <TabsTrigger value="global">Global Scoring Config</TabsTrigger>
          <TabsTrigger value="lenders">Lender-Specific Scoring Config</TabsTrigger>
        </TabsList>

        <TabsContent value="global" className="space-y-6">
          <BucketThresholdEditor
            value={draft.bucket_threshold}
            onChange={(v) => setDraft({ ...draft, bucket_threshold: v })}
            readOnly={!canEdit}
          />

          <BucketEditor
            title="Student bucket"
            description="Academic + test-score parameters. Weights must sum to 100."
            params={draft.student_params}
            onChange={(p) => setDraft({ ...draft, student_params: p })}
            readOnly={!canEdit}
          />
          <BucketEditor
            title="University bucket"
            description="University tier, country, course type. Weights must sum to 100."
            params={draft.university_params}
            onChange={(p) => setDraft({ ...draft, university_params: p })}
            readOnly={!canEdit}
          />
          <BucketEditor
            title="Co-applicant bucket"
            description="Income, CIBIL, employment. Weights must sum to 100."
            params={draft.coapplicant_params}
            onChange={(p) => setDraft({ ...draft, coapplicant_params: p })}
            readOnly={!canEdit}
          />

          <OverallBandMappingEditor
            rows={draft.overall_band_mapping}
            onChange={(r) => setDraft({ ...draft, overall_band_mapping: r })}
            readOnly={!canEdit}
          />

          <VersionActionBar
            errors={validation.errors}
            changeSummary={changeSummary}
            onChangeSummary={setChangeSummary}
            onSave={() => handleSave(false)}
            onSaveAndActivate={() => handleSave(true)}
            showActivate
            saving={saving}
            hidden={!canEdit}
          />
        </TabsContent>

        <TabsContent value="lenders">
          <BreLenderScorecardList />
        </TabsContent>
      </Tabs>

      <ConfirmActivateDialog
        open={confirmActivate !== null}
        onOpenChange={(o) => !o && setConfirmActivate(null)}
        onConfirm={doActivate}
        newVersionLabel={confirmActivate ? `v${confirmActivate.version}` : ""}
        currentActiveLabel={activeRow ? `v${activeRow.version_number}` : null}
        scope="scoring"
      />
    </div>
  );
}
