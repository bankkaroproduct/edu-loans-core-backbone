import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Lock, Check, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * Admin-only card: manually assign (lock) a lender to a lead.
 *
 * Persistence model — intentionally separate from BRE:
 *  - Each pick is written to `lead_lender_matches` with `lock_status = true`.
 *  - Any previously locked rows for this lead are unlocked first, so only one
 *    lender is "currently assigned" at a time.
 *  - If the chosen lender doesn't already have a match row for this lead, we
 *    insert a fresh row (rank/score null — this is a manual override, not a
 *    BRE recommendation).
 *  - The current assignment is rehydrated on mount/refresh by reading the
 *    `lock_status = true` row, so the value persists across reload.
 *
 * NOTE: Calculate BRE never overwrites a locked manual assignment, and this
 * card never mutates BRE recommendation columns (score, rank, reason summary).
 */

type Lender = { id: string; lender_name: string; lender_code: string; active_flag: boolean };

interface CurrentAssignment {
  matchId: string;
  lenderId: string;
  lenderName: string;
  lenderCode: string;
}

export function AdminAssignLenderCard({ leadId }: { leadId: string }) {
  const navigate = useNavigate();
  const [lenders, setLenders] = useState<Lender[]>([]);
  const [current, setCurrent] = useState<CurrentAssignment | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [lendersRes, lockedRes] = await Promise.all([
      supabase
        .from("lenders")
        .select("id, lender_name, lender_code, active_flag")
        .eq("active_flag", true)
        .order("lender_name"),
      supabase
        .from("lead_lender_matches")
        .select("id, lender_id, lender:lenders(lender_name, lender_code)")
        .eq("lead_id", leadId)
        .eq("lock_status", true)
        .maybeSingle(),
    ]);
    setLenders((lendersRes.data ?? []) as Lender[]);
    if (lockedRes.data) {
      const row = lockedRes.data as unknown as {
        id: string;
        lender_id: string;
        lender: { lender_name: string; lender_code: string } | null;
      };
      const cur: CurrentAssignment = {
        matchId: row.id,
        lenderId: row.lender_id,
        lenderName: row.lender?.lender_name ?? "Unknown",
        lenderCode: row.lender?.lender_code ?? "",
      };
      setCurrent(cur);
      setSelected(cur.lenderId);
    } else {
      setCurrent(null);
      setSelected("");
    }
    setLoading(false);
  }, [leadId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    if (!selected) {
      toast.error("Pick a lender first");
      return;
    }
    setSaving(true);
    try {
      // 1. Unlock all currently-locked rows for this lead
      const { error: unlockErr } = await supabase
        .from("lead_lender_matches")
        .update({ lock_status: false })
        .eq("lead_id", leadId)
        .eq("lock_status", true);
      if (unlockErr) throw unlockErr;

      // 2. Find an existing match row for the chosen lender
      const { data: existingRow, error: existingErr } = await supabase
        .from("lead_lender_matches")
        .select("id")
        .eq("lead_id", leadId)
        .eq("lender_id", selected)
        .maybeSingle();
      if (existingErr) throw existingErr;

      if (existingRow) {
        const { error: lockErr } = await supabase
          .from("lead_lender_matches")
          .update({ lock_status: true })
          .eq("id", existingRow.id);
        if (lockErr) throw lockErr;
      } else {
        const { error: insertErr } = await supabase
          .from("lead_lender_matches")
          .insert({
            lead_id: leadId,
            lender_id: selected,
            lock_status: true,
            recommendation_reason_summary: "Manually assigned by admin",
          });
        if (insertErr) throw insertErr;
      }

      toast.success("Lender assigned");
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Failed to assign lender: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    if (!current) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("lead_lender_matches")
        .update({ lock_status: false })
        .eq("lead_id", leadId)
        .eq("lock_status", true);
      if (error) throw error;
      toast.success("Lender assignment cleared");
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Failed to clear: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Lock className="h-4 w-4" /> Assigned Lender
        </h3>
        {current && (
          <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary text-[10px] uppercase">
            <Check className="h-3 w-3 mr-1" /> Locked
          </Badge>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <>
          {current ? (
            <div className="rounded-md border border-border/60 bg-primary/5 ring-1 ring-primary/20 px-3 py-2 text-sm">
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="truncate" title={current.lenderName}>{current.lenderName}</span>
              </div>
              <div className="text-xs text-muted-foreground font-mono mt-0.5">{current.lenderCode}</div>
            </div>
          ) : (
            <div className="flex items-start gap-2.5 rounded-md border border-dashed border-border/60 px-3 py-3">
              <Lock className="h-4 w-4 text-muted-foreground/70 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div className="text-sm font-medium text-foreground">No lender assigned yet</div>
                <p className="text-xs text-muted-foreground">
                  Choose a lender below to lock it for this lead.
                </p>
              </div>
            </div>
          )}

          <div className={cn(current && "border-t border-border/40 pt-3")}>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <Select value={selected} onValueChange={setSelected} disabled={saving}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder={current ? "Reassign to another lender" : "Choose a lender to assign"} />
                </SelectTrigger>
                <SelectContent>
                  {lenders.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.lender_name} <span className="text-muted-foreground">({l.lender_code})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving || !selected || selected === current?.lenderId}
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : current ? "Reassign" : "Assign"}
              </Button>
              {current && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="sm:ml-auto text-muted-foreground hover:text-foreground"
                  onClick={handleClear}
                  disabled={saving}
                >
                  Clear
                </Button>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              Manual assignment is independent of BRE recommendations and persists across refresh.
            </p>
          </div>

          {current && (
            <div className="pt-3 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => navigate(`/admin/leads/${leadId}/send-to-lender`)}
                title="Opens a prefilled compose screen. Does not change lifecycle stage."
              >
                <Send className="h-3.5 w-3.5 mr-1.5" /> Send to Lender
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
