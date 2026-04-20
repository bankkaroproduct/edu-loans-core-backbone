import { useEffect, useMemo, useState } from "react";
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

type Partner = Tables<"partner_organizations">;
type StatusFilter = "all" | Partner["status"];

const statusStyles: Record<Partner["status"], string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  onboarding: "bg-blue-50 text-blue-700 border-blue-200",
  inactive: "bg-slate-100 text-slate-600 border-slate-200",
  suspended: "bg-amber-50 text-amber-700 border-amber-200",
  terminated: "bg-rose-50 text-rose-700 border-rose-200",
};

export default function AdminPartners() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [leadCounts, setLeadCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Partner | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const [partnersRes, leadsRes] = await Promise.all([
        supabase
          .from("partner_organizations")
          .select("*")
          .eq("is_archived", false)
          .order("partner_code"),
        supabase
          .from("student_leads")
          .select("partner_id")
          .eq("is_archived", false),
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

  const openCreate = () => { setEditing(null); setDrawerOpen(true); };
  const openEdit = (row: Partner) => { setEditing(row); setDrawerOpen(true); };

  return (
    <div className="space-y-6 max-w-screen-2xl mx-auto">
      <PageHeader
        title="Partners"
        description="Manage partner organizations across the EduLoans network."
      >
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4 mr-1.5" /> Add Partner
        </Button>
      </PageHeader>

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
                  <TableRow className="bg-muted/40">
                    <TableHead className="text-xs font-medium w-[110px]">Code</TableHead>
                    <TableHead className="text-xs font-medium">Display Name</TableHead>
                    <TableHead className="text-xs font-medium">Type</TableHead>
                    <TableHead className="text-xs font-medium">Contact</TableHead>
                    <TableHead className="text-xs font-medium w-[80px] text-right">Leads</TableHead>
                    <TableHead className="text-xs font-medium w-[100px]">Status</TableHead>
                    <TableHead className="text-xs font-medium w-[110px]">Created</TableHead>
                    <TableHead className="text-xs font-medium w-[80px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">
                        No partners match your filters.
                      </TableCell>
                    </TableRow>
                  ) : filtered.map((p) => {
                    const isSystem = p.partner_code === "PTR-DIRECT";
                    return (
                      <TableRow key={p.id} className="hover:bg-muted/20">
                        <TableCell className="text-sm py-2.5 font-mono text-xs">{p.partner_code}</TableCell>
                        <TableCell className="text-sm py-2.5">
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
                        <TableCell className="text-xs py-2.5 capitalize text-muted-foreground">
                          {p.partner_type.replace(/_/g, " ")}
                        </TableCell>
                        <TableCell className="text-xs py-2.5">
                          {p.contact_person_email ? (
                            <div className="min-w-0">
                              <p className="truncate">{p.contact_person_name ?? "—"}</p>
                              <p className="text-[11px] text-muted-foreground truncate">{p.contact_person_email}</p>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm py-2.5 text-right tabular-nums font-medium">
                          {leadCounts[p.id] ?? 0}
                        </TableCell>
                        <TableCell className="py-2.5">
                          <Badge variant="outline" className={`${statusStyles[p.status]} text-[10px] px-1.5 py-0 capitalize`}>
                            {p.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs py-2.5 text-muted-foreground">
                          {format(new Date(p.created_at), "dd MMM yyyy")}
                        </TableCell>
                        <TableCell className="py-2.5 text-right">
                          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => openEdit(p)}>
                            <Pencil className="h-3.5 w-3.5 mr-1" />Edit
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
