import { useEffect, useMemo, useState } from "react";
import { formatDisplayLabel } from "@/lib/formatDisplayLabel";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Plus, Pencil, Building2, ShieldCheck } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { PartnerDrawer } from "@/components/admin/PartnerDrawer";
import { format } from "date-fns";
import { useReadOnly } from "@/components/admin/ReadOnlyContext";
import { ReadOnlyBanner } from "@/components/admin/ReadOnlyBanner";

type Partner = Tables<"partner_organizations">;
type StatusFilter = "all" | Partner["status"];

const statusStyles: Record<Partner["status"], string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  onboarding: "bg-blue-50 text-blue-700 border-blue-200",
  inactive: "bg-slate-100 text-slate-700 border-slate-200",
  suspended: "bg-amber-50 text-amber-700 border-amber-200",
  terminated: "bg-red-50 text-red-700 border-red-200",
};

export default function AdminPartners() {
  const readOnly = useReadOnly();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [leadCounts, setLeadCounts] = useState<Record<string, number>>({});
  const [leadsThisMonth, setLeadsThisMonth] = useState<number>(0);
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [assignmentFilter, setAssignmentFilter] = useState<"all" | "unassigned">("all");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Partner | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const [partnersRes, leadsRes, monthRes, assignsRes] = await Promise.all([
        supabase
          .from("partner_organizations")
          .select("*")
          .eq("is_archived", false)
          .order("partner_code"),
        supabase
          .from("student_leads")
          .select("partner_id")
          .eq("is_archived", false),
        supabase
          .from("student_leads")
          .select("*", { count: "exact", head: true })
          .eq("is_archived", false)
          .gte("created_at", startOfMonth.toISOString()),
        supabase
          .from("admin_partner_assignments")
          .select("partner_id"),
      ]);
      if (cancelled) return;
      if (partnersRes.error) {
        toast({ title: "Failed to load", description: partnersRes.error.message, variant: "destructive" });
      }
      const counts: Record<string, number> = {};
      (leadsRes.data ?? []).forEach((l) => {
        if (l.partner_id) counts[l.partner_id] = (counts[l.partner_id] ?? 0) + 1;
      });
      setLeadCounts(counts);
      setLeadsThisMonth(monthRes.count ?? 0);
      setAssignedIds(new Set((assignsRes.data ?? []).map((a) => a.partner_id)));
      setPartners(partnersRes.data ?? []);
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [refreshKey]);

  const filtered = useMemo(() => {
    return partners.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        return (
          p.display_name.toLowerCase().includes(q) ||
          p.legal_name.toLowerCase().includes(q) ||
          p.partner_code.toLowerCase().includes(q) ||
          (p.contact_person_email ?? "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [partners, search, statusFilter]);

  const totalCount = partners.length;
  const activeCount = partners.filter((p) => p.status === "active").length;
  const onboardingCount = partners.filter((p) => p.status === "onboarding").length;

  const openCreate = () => { setEditing(null); setDrawerOpen(true); };
  const openEdit = (row: Partner) => { setEditing(row); setDrawerOpen(true); };

  const kpis = [
    { label: "Total partners", value: totalCount, color: "text-primary" },
    { label: "Active", value: activeCount, color: "text-emerald-700" },
    { label: "Onboarding", value: onboardingCount, color: "text-blue-700" },
    { label: "Leads this month", value: leadsThisMonth, color: "text-primary" },
  ];

  return (
    <div className="space-y-6 max-w-screen-2xl mx-auto">
      <PageHeader
        title="Partners"
        description="Manage partner organizations across the EduLoans network."
        count={loading ? null : totalCount}
      >
        <Button onClick={openCreate} size="sm" disabled={readOnly}>
          <Plus className="h-4 w-4 mr-1.5" /> Add Partner
        </Button>
      </PageHeader>
      <ReadOnlyBanner />

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
              <Input
                placeholder="Search by name, code, or contact email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v: StatusFilter) => setStatusFilter(v)}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="onboarding">Onboarding</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="terminated">Terminated</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="text-xs text-muted-foreground">
            Showing {filtered.length} of {partners.length} partner organizations
          </div>

          {loading ? (
            <PageSkeleton variant="table" />
          ) : (
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[110px]">Code</TableHead>
                    <TableHead>Display Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead className="w-[80px] text-right">Leads</TableHead>
                    <TableHead className="w-[100px]">Status</TableHead>
                    <TableHead className="w-[110px]">Created</TableHead>
                    <TableHead className="w-[80px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        No partners match your filters.
                      </TableCell>
                    </TableRow>
                  ) : filtered.map((p) => {
                    const isSystem = p.partner_code === "PTR-DIRECT";
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-mono text-xs">{p.partner_code}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="rounded bg-primary/10 p-1.5">
                              {isSystem ? <ShieldCheck className="h-3.5 w-3.5 text-primary" /> : <Building2 className="h-3.5 w-3.5 text-primary" />}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium truncate">{p.display_name}</p>
                              <p className="text-[11px] text-muted-foreground truncate">{p.legal_name}</p>
                            </div>
                            {isSystem && (
                              <Badge variant="outline" className="bg-primary/5 text-primary border-primary/30 text-[9px] px-1.5 py-0">SYSTEM</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDisplayLabel(p.partner_type)}
                        </TableCell>
                        <TableCell>
                          {p.contact_person_email ? (
                            <div className="min-w-0">
                              <p className="truncate">{p.contact_person_name ?? "—"}</p>
                              <p className="text-[11px] text-muted-foreground truncate">{p.contact_person_email}</p>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {leadCounts[p.id] ?? 0}
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${statusStyles[p.status]}`}>
                            {formatDisplayLabel(p.status)}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {format(new Date(p.created_at), "dd MMM yyyy")}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => openEdit(p)} disabled={readOnly}>
                            <Pencil className="h-4 w-4 mr-1.5" />Edit
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <PartnerDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        record={editing}
        onSaved={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  );
}
