import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SemanticBadge } from "@/components/dashboard/StageBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Plus, Pencil, Power, Banknote, SlidersHorizontal, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { LenderDrawer } from "@/components/admin/LenderDrawer";
import { useAuth } from "@/hooks/useAuth";
import { canAccessBre, normalizeBrePermission } from "@/lib/bre/permissions";
import { useReadOnly } from "@/components/admin/ReadOnlyContext";
import { ReadOnlyBanner } from "@/components/admin/ReadOnlyBanner";

type Lender = Tables<"lenders">;
type StatusFilter = "all" | "active" | "inactive";

export default function AdminLenders() {
  const readOnly = useReadOnly();
  const { appUser } = useAuth();
  const breAccess = canAccessBre(appUser?.role, normalizeBrePermission(appUser?.bre_permission));
  const [lenders, setLenders] = useState<Lender[]>([]);
  const [mappingCounts, setMappingCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Lender | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const [lendersRes, mappingsRes] = await Promise.all([
        supabase.from("lenders").select("*").order("lender_name"),
        supabase
          .from("lender_university_mappings")
          .select("lender_id")
          .eq("active_flag", true),
      ]);
      if (cancelled) return;
      if (lendersRes.error) toast({ title: "Failed to load", description: lendersRes.error.message, variant: "destructive" });
      const counts: Record<string, number> = {};
      (mappingsRes.data ?? []).forEach((m) => {
        if (m.lender_id) counts[m.lender_id] = (counts[m.lender_id] ?? 0) + 1;
      });
      setMappingCounts(counts);
      setLenders(lendersRes.data ?? []);
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [refreshKey]);

  const filtered = useMemo(() => {
    return lenders.filter((l) => {
      if (statusFilter === "active" && !l.active_flag) return false;
      if (statusFilter === "inactive" && l.active_flag) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        return (
          l.lender_name.toLowerCase().includes(q) ||
          l.lender_code.toLowerCase().includes(q) ||
          (l.lender_type ?? "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [lenders, search, statusFilter]);

  const handleToggle = async (row: Lender) => {
    const newVal = !row.active_flag;
    const { error } = await supabase.from("lenders").update({ active_flag: newVal }).eq("id", row.id);
    if (error) toast({ title: "Update failed", description: error.message, variant: "destructive" });
    else {
      toast({ title: newVal ? "Activated" : "Deactivated" });
      setRefreshKey((k) => k + 1);
    }
  };

  const openCreate = () => { setEditing(null); setDrawerOpen(true); };
  const openEdit = (row: Lender) => { setEditing(row); setDrawerOpen(true); };

  const totalCount = lenders.length;
  const activeCount = lenders.filter((l) => l.active_flag).length;
  const collateralCount = lenders.filter((l) => l.supports_collateral).length;
  const unsecuredCount = lenders.filter((l) => l.supports_unsecured).length;

  const kpis = [
    { label: "Total lenders", value: totalCount, color: "text-primary" },
    { label: "Active", value: activeCount, color: "text-emerald-700" },
    { label: "Supports collateral", value: collateralCount, color: "text-primary" },
    { label: "Supports unsecured", value: unsecuredCount, color: "text-primary" },
  ];

  return (
    <div className="space-y-6 max-w-screen-2xl mx-auto">
      <PageHeader
        title="Lenders"
        description="Manage lender catalog and supported configurations."
        count={loading ? null : totalCount}
      >
        <Button onClick={openCreate} size="sm" disabled={readOnly}>
          <Plus className="h-4 w-4 mr-1.5" /> Add Lender
        </Button>
      </PageHeader>
      <ReadOnlyBanner />

      {breAccess && (
        <div className="rounded-md border border-primary/20 bg-primary/5 px-4 py-2.5 text-sm flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-primary">
            <SlidersHorizontal className="h-4 w-4 shrink-0" />
            <span><strong className="font-semibold">BRE Engine</strong> · lender rules, scoring config and version history are managed in the BRE console.</span>
          </div>
          <Button asChild size="sm" variant="outline" className="border-primary/30 text-primary hover:bg-primary/10 shrink-0">
            <Link to="/admin/bre/lenders">Open BRE <ArrowRight className="h-3.5 w-3.5 ml-1" /></Link>
          </Button>
        </div>
      )}

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label} className="p-4">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              {k.label}
            </p>
            {loading ? (
              <div className="h-7 w-12 mt-1.5 bg-muted animate-pulse rounded" />
            ) : (
              <p className={`text-2xl font-bold tabular-nums mt-1 ${k.color}`}>
                {k.value.toLocaleString("en-IN")}
              </p>
            )}
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[240px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by name, code, or type…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={(v: StatusFilter) => setStatusFilter(v)}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="active">Active only</SelectItem>
                <SelectItem value="inactive">Inactive only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="text-xs text-muted-foreground">
            Showing {filtered.length} of {lenders.length} lenders
          </div>

          {loading ? (
            <PageSkeleton variant="table" />
          ) : (
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[110px]">Code</TableHead>
                    <TableHead>Lender Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Loan Range</TableHead>
                    <TableHead>Loan Types</TableHead>
                    <TableHead>Countries</TableHead>
                    <TableHead className="w-[90px]">Days</TableHead>
                    <TableHead className="w-[100px] text-right">Mapped</TableHead>
                    <TableHead className="w-[100px]">Status</TableHead>
                    <TableHead className="w-[100px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                        No lenders match your filters.
                      </TableCell>
                    </TableRow>
                  ) : filtered.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-mono text-xs">{l.lender_code}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="rounded bg-primary/10 p-1.5">
                            <Banknote className="h-3.5 w-3.5 text-primary" />
                          </div>
                          <span className="font-medium">{l.lender_name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{l.lender_type ?? "—"}</TableCell>
                      <TableCell className="tabular-nums">
                        {l.loan_amount_min || l.loan_amount_max ? (
                          <span>
                            {l.loan_amount_min ? `₹${(l.loan_amount_min / 100000).toFixed(0)}L` : "—"}
                            {" – "}
                            {l.loan_amount_max ? `₹${(l.loan_amount_max / 100000).toFixed(0)}L` : "—"}
                          </span>
                        ) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {l.supports_collateral && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Coll.</Badge>}
                          {l.supports_unsecured && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Unsec.</Badge>}
                          {!l.supports_collateral && !l.supports_unsecured && <span className="text-muted-foreground">—</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        {l.supported_countries && l.supported_countries.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {l.supported_countries.slice(0, 3).map((c) => (
                              <Badge key={c} variant="outline" className="text-[10px] px-1.5 py-0 font-mono">{c}</Badge>
                            ))}
                            {l.supported_countries.length > 3 && (
                              <span className="text-[10px] text-muted-foreground">+{l.supported_countries.length - 3}</span>
                            )}
                          </div>
                        ) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {l.processing_time_days ?? "—"}
                      </TableCell>
                      <TableCell className="tabular-nums text-right">
                        <span className="font-medium">{mappingCounts[l.id] ?? 0}</span>
                        <span className="text-muted-foreground ml-1">univ.</span>
                      </TableCell>
                      <TableCell>
                        {l.active_flag ? (
                          <SemanticBadge tone="emerald">Active</SemanticBadge>
                        ) : (
                          <SemanticBadge tone="slate">Inactive</SemanticBadge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => openEdit(l)} title="Edit lender" disabled={readOnly}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => handleToggle(l)} title={l.active_flag ? "Deactivate" : "Activate"} disabled={readOnly}>
                            <Power className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <LenderDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        record={editing}
        onSaved={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  );
}
