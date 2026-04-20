import { useEffect, useMemo, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Database, Search, Plus, Pencil, Power, AlertTriangle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { MASTER_SCHEMAS, MASTER_KEYS, MasterSchema, COUNTRY_OPTIONS } from "@/lib/masterSchemas";
import { MasterRecordDrawer } from "@/components/admin/MasterRecordDrawer";

type StatusFilter = "all" | "active" | "inactive";

export default function AdminMasterData() {
  const [activeKey, setActiveKey] = useState<string>(MASTER_KEYS[0]);
  const schema = MASTER_SCHEMAS[activeKey];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <PageHeader
          icon={Database}
          title="Master Data"
          subtitle="Manage system reference data — countries, universities, courses, lifecycle, documents."
        />

        <Tabs value={activeKey} onValueChange={setActiveKey}>
          <TabsList className="flex w-full flex-wrap h-auto gap-1 bg-muted p-1">
            {MASTER_KEYS.map((k) => (
              <TabsTrigger key={k} value={k} className="text-xs flex-1 min-w-[110px]">
                {MASTER_SCHEMAS[k].label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <MasterDataTable schema={schema} key={activeKey} />
      </div>
    </AdminLayout>
  );
}

function MasterDataTable({ schema }: { schema: MasterSchema }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from(schema.table)
        .select("*")
        .order(schema.defaultSort.column, { ascending: schema.defaultSort.ascending })
        .limit(1000);
      if (!cancelled) {
        if (error) toast({ title: "Failed to load", description: error.message, variant: "destructive" });
        setRows(data ?? []);
        setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [schema.table, refreshKey, schema.defaultSort.ascending, schema.defaultSort.column]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter === "active" && !r.active_flag) return false;
      if (statusFilter === "inactive" && r.active_flag) return false;
      if (schema.countryFilter && countryFilter !== "all" && r.country !== countryFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const hit = schema.searchKeys.some((k) => String(r[k] ?? "").toLowerCase().includes(q));
        if (!hit) return false;
      }
      return true;
    });
  }, [rows, search, statusFilter, countryFilter, schema]);

  const handleToggleActive = async (row: any) => {
    const newVal = !row.active_flag;
    const { error } = await (supabase as any)
      .from(schema.table)
      .update({ active_flag: newVal })
      .eq("id", row.id);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: newVal ? "Activated" : "Deactivated", description: `Record ${newVal ? "is now active" : "has been deactivated"}.` });
      setRefreshKey((k) => k + 1);
    }
  };

  const openCreate = () => { setEditing(null); setDrawerOpen(true); };
  const openEdit = (row: any) => { setEditing(row); setDrawerOpen(true); };

  return (
    <div className="space-y-4">
      {schema.sensitive && (
        <Alert className="bg-amber-50 border-amber-200 text-amber-900 [&>svg]:text-amber-600">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-xs leading-relaxed">
            <strong>{schema.label}:</strong> {schema.sensitiveNote}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2 justify-between">
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
              <div className="relative flex-1 min-w-[220px] max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={schema.searchPlaceholder}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={(v: StatusFilter) => setStatusFilter(v)}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All status</SelectItem>
                  <SelectItem value="active">Active only</SelectItem>
                  <SelectItem value="inactive">Inactive only</SelectItem>
                </SelectContent>
              </Select>
              {schema.countryFilter && (
                <Select value={countryFilter} onValueChange={setCountryFilter}>
                  <SelectTrigger className="w-[180px]"><SelectValue placeholder="Country" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All countries</SelectItem>
                    {COUNTRY_OPTIONS.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <Button onClick={openCreate} size="sm">
              <Plus className="h-4 w-4 mr-1.5" /> {schema.addLabel}
            </Button>
          </div>

          <div className="text-xs text-muted-foreground">
            Showing {filtered.length} of {rows.length} records
          </div>

          {loading ? (
            <PageSkeleton variant="table" />
          ) : (
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    {schema.columns.map((c) => (
                      <TableHead key={c.key} className="text-xs font-medium">{c.label}</TableHead>
                    ))}
                    <TableHead className="text-xs font-medium w-[100px]">Status</TableHead>
                    <TableHead className="text-xs font-medium w-[140px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={schema.columns.length + 2} className="text-center text-sm text-muted-foreground py-8">
                        No records match your filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((row) => (
                      <TableRow key={row.id} className="hover:bg-muted/20">
                        {schema.columns.map((c) => (
                          <TableCell key={c.key} className="text-sm py-2.5">
                            {renderCell(row[c.key], c.render)}
                          </TableCell>
                        ))}
                        <TableCell className="py-2.5">
                          {row.active_flag ? (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] px-1.5 py-0">Active</Badge>
                          ) : (
                            <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200 text-[10px] px-1.5 py-0">Inactive</Badge>
                          )}
                        </TableCell>
                        <TableCell className="py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => openEdit(row)}>
                              <Pencil className="h-3.5 w-3.5 mr-1" />Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2"
                              onClick={() => handleToggleActive(row)}
                              title={row.active_flag ? "Deactivate" : "Activate"}
                            >
                              <Power className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <MasterRecordDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        schema={schema}
        record={editing}
        onSaved={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  );
}

function renderCell(val: any, render?: "badge-bool" | "tags" | "iso") {
  if (render === "badge-bool") {
    return val ? (
      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] px-1.5 py-0">Yes</Badge>
    ) : (
      <span className="text-muted-foreground text-xs">—</span>
    );
  }
  if (render === "tags") {
    if (!Array.isArray(val) || val.length === 0) return <span className="text-muted-foreground text-xs">—</span>;
    return (
      <div className="flex flex-wrap gap-1">
        {val.slice(0, 3).map((t, i) => (
          <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">{t}</Badge>
        ))}
        {val.length > 3 && <span className="text-[10px] text-muted-foreground">+{val.length - 3}</span>}
      </div>
    );
  }
  if (render === "iso") {
    return val ? <span className="font-mono text-xs uppercase">{val}</span> : <span className="text-muted-foreground text-xs">—</span>;
  }
  if (val === null || val === undefined || val === "") return <span className="text-muted-foreground text-xs">—</span>;
  return String(val);
}
